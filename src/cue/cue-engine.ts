import { InspectionSuspensions } from '../alive/inspection-suspension';
import { checkReadSet } from '../alive/reducer';
import { SemanticProviderError } from '../decision/semantic-failure';
import { accounting } from '../alive/evidence';
import { buildSemanticRequest, captureInspection, captureRelation, compileProposal, operationCandidates, rangeKey, validateSemanticInput, visibleReadSet, type SemanticInput, type SemanticProvider, type SemanticTrace } from '../alive/inspection';
import { buildCandidates, type Candidate } from '../candidates/candidate-builder';
import { systemClock, type Clock } from '../clock';
import { validateDecision, type CueDecisionProvider, type DecisionInput } from '../decision/decision-provider';
import { QUIET, type CueDecision } from '../decision/types';
import { appendEvidence, type EvidenceFragment, type EvidenceWindow } from '../evidence/evidence-buffer';
import type { TeachingEvidenceSource } from '../replay/replay-source';
import { LessonStore, memoryJournal } from '../alive/journal';
import { legacyProposal } from '../alive/legacy-adapter';
import { projectDisplay, projectEvidenceWindow, semanticWorkingSet } from '../alive/projection';
import type { LessonState, SemanticProposal } from '../alive/types';
import { emptyCueState, type CueState } from './types';

export const PREVIOUS_CUE_MS = 4_000;
// Bounded tolerance for ordinary append-only arrivals, not semantic freshness.
export const MAX_DECISION_LAG_MS = 5_000;

export type DecisionRecord = Readonly<{
  input: DecisionInput;
  decision: CueDecision;
  outcome: 'applied' | 'quiet' | 'discarded' | 'fallback';
  error: string | null;
  durationMs: number;
  discardReason: 'cue-changed' | 'request-expired' | 'source-advanced' | 'source-evicted' | null;
}>;

export type EngineSnapshot = Readonly<{
  lesson: LessonState;
  workingSet: ReturnType<typeof semanticWorkingSet>;
  evidence: EvidenceWindow;
  candidates: readonly Candidate[];
  cues: CueState;
  incoming: EvidenceFragment | null;
  status: 'idle' | 'in-flight' | 'settling-previous-session';
  request: DecisionInput | null;
  lastDecision: DecisionRecord | null;
  inputError: string | null;
  semanticRequest: SemanticInput | null;
  lastSemantic: SemanticTrace | null;
}>;

function initialSnapshot(lesson: LessonState): EngineSnapshot {
  return Object.freeze({
    lesson, workingSet: semanticWorkingSet(lesson), evidence: projectEvidenceWindow(lesson), candidates: Object.freeze([]), cues: emptyCueState(),
    incoming: null, status: 'idle', request: null, lastDecision: null, inputError: null, semanticRequest: null, lastSemantic: null,
  });
}

export class CueEngine {
  private snapshot: EngineSnapshot;
  private lesson: LessonStore;
  private listeners = new Set<() => void>();
  private inFlight = false;
  private optionalEnabled = true;
  private activeRelation: SemanticInput | null = null;
  private pendingRelation: SemanticInput | null = null;
  private suspensions = new InspectionSuspensions();
  private semanticObservers = new Set<(trace: SemanticTrace) => void>();
  private dirty = false;
  private generation = 0;
  private proposalSequence = 0;
  private readonly proposalPrefix = crypto.randomUUID();
  private disposed = false;
  private expiry: ReturnType<typeof setTimeout> | undefined;
  private disconnectSource: (() => void) | undefined;
  private drainListeners = new Set<() => void>();

  constructor(private readonly provider: CueDecisionProvider | SemanticProvider, private readonly clock: Clock = systemClock,
    store?: LessonStore) {
    this.lesson = store ?? new LessonStore(memoryJournal(crypto.randomUUID()));
    this.snapshot = initialSnapshot(this.lesson.getSnapshot());
    this.refreshLesson();
  }

  observeSemantics(observer: (trace: SemanticTrace) => void) {
    this.semanticObservers.add(observer); return () => { this.semanticObservers.delete(observer); };
  }
  stopOptionalInspections() {
    this.optionalEnabled = false;
    if (this.pendingRelation) this.reportRelationScheduling(this.pendingRelation, 'invalidated', 'Optional work stopped before this pending relation could start.');
    this.pendingRelation = null;
  }
  configureTeacherCapture(captureId: string) {
    const s = this.lesson.getSnapshot();
    this.acceptProposal({ proposalId: `role-${this.proposalPrefix}-${++this.proposalSequence}`, origin: 'host',
      sessionId: s.sessionId, sessionEpoch: s.sessionEpoch, readSet: { roles: { 'teacher-capture': 0 } },
      operations: [{ type: 'BIND_ROLE', binding: { bindingId: 'teacher-capture', revision: 1,
        subject: { kind: 'capture', id: captureId }, role: 'teacher', basis: 'configured',
        basisRefs: ['host-configured-teacher-input'], sourceRanges: [] } }], processing: [], policyVersion: 'alive-foundation-v1' });
  }

  exportLesson = () => this.lesson.export();
  // Host entry point for deterministic operations and lesson-local recall. It
  // uses the same writer as the legacy interpreter, never a second Cue reducer.
  acceptProposal(proposal: SemanticProposal): void {
    if (this.disposed) throw new Error('Engine disposed.');
    this.lesson.accept(proposal, this.clock.now());
    this.refreshLesson();
    // Only a changed suspended dependency can wake old source without new input.
    if ('inspect' in this.provider && proposal.operations.some(op => op.type === 'BIND_ROLE')) {
      const excluded = this.suspensions.excluded(this.lesson.getSnapshot());
      if (captureInspection(this.lesson.getSnapshot(), 'eligibility-check', {}, excluded)) {
        if (this.inFlight) this.dirty = true; else void this.evaluateLatest();
      }
    }
  }
  private refreshLesson(): void {
    const lesson = this.lesson.getSnapshot();
    const cues = projectDisplay(lesson, this.clock.now(), PREVIOUS_CUE_MS, this.snapshot.cues);
    if (cues.previousCue !== this.snapshot.cues.previousCue) {
      this.clearExpiry();
      if (cues.previousCue) this.expiry = this.clock.setTimeout(() => {
        this.expiry = undefined; this.refreshLesson();
      }, Math.max(0, lesson.attention.changedAt + PREVIOUS_CUE_MS - this.clock.now()));
    }
    const evidence = projectEvidenceWindow(lesson);
    this.publish({ evidence, lesson, workingSet: semanticWorkingSet(lesson), cues,
      candidates: buildCandidates(evidence, cues.currentCue) });
  }

  getSnapshot = (): EngineSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  connect(source: TeachingEvidenceSource): () => void {
    this.disconnectSource?.();
    const unsubscribe = source.subscribeBatch ? source.subscribeBatch(this.acceptBatch) : source.subscribe(this.accept);
    this.disconnectSource = unsubscribe;
    return () => {
      unsubscribe();
      if (this.disconnectSource === unsubscribe) this.disconnectSource = undefined;
    };
  }

  accept = (fragment: EvidenceFragment): void => { this.acceptBatch([fragment]); };

  // One finalized Voice event updates all its segments before scheduling Jev.
  acceptBatch = (fragments: readonly EvidenceFragment[]): void => {
    if (this.disposed || fragments.length === 0) return;
    let evidence = this.snapshot.evidence;
    const lesson = this.lesson.getSnapshot();
    try {
      const fresh: EvidenceFragment[] = [];
      for (const fragment of fragments) {
        const old = lesson.evidence[fragment.id];
        if (!old && !fresh.some(f => f.id === fragment.id)) {
          evidence = appendEvidence(evidence, fragment); fresh.push(fragment);
        }
      }
      // Even a retransmission is validated against immutable provider identity.
      this.lesson.accept({ proposalId: `capture-${this.proposalPrefix}-${++this.proposalSequence}`, origin: 'host',
        sessionId: lesson.sessionId, sessionEpoch: lesson.sessionEpoch, readSet: {},
        operations: [{ type: 'RECORD_EVIDENCE', fragments }], processing: [], policyVersion: 'alive-foundation-v1' }, this.clock.now());
      if (fresh.length === 0) { this.refreshLesson(); return; }
    } catch (error) {
      this.publish({ inputError: error instanceof Error ? error.message : 'Invalid evidence.' });
      return;
    }
    evidence = projectEvidenceWindow(this.lesson.getSnapshot());
    this.publish({
      lesson: this.lesson.getSnapshot(), workingSet: semanticWorkingSet(this.lesson.getSnapshot()),
      evidence, incoming: evidence.fragments.at(-1)!, inputError: null,
      candidates: buildCandidates(evidence, this.snapshot.cues.currentCue),
    });
    if (this.inFlight) this.dirty = true;
    else void this.evaluateLatest();
  };

  reset(): void {
    this.generation++;
    this.optionalEnabled = true;
    this.clearInspectionScheduling();
    for (const check of this.drainListeners) check();
    this.dirty = false;
    this.proposalSequence = 0;
    this.clearExpiry();
    const priorLesson = this.lesson.getSnapshot();
    this.lesson = new LessonStore(memoryJournal(priorLesson.sessionId, priorLesson.sessionEpoch + 1));
    this.snapshot = initialSnapshot(this.lesson.getSnapshot());
    this.publish({ status: this.inFlight ? 'settling-previous-session' : 'idle' });
  }

  dispose(): void {
    this.clearInspectionScheduling();
    this.disposed = true;
    this.generation++;
    for (const check of this.drainListeners) check();
    this.dirty = false;
    this.clearExpiry();
    this.disconnectSource?.();
    this.listeners.clear();
    this.semanticObservers.clear();
  }

  // Wait through the transient idle publication between coalesced requests.
  // The caller seals its source first; native semantics may still inspect several
  // remaining units. Reset/disposal cancel, never complete, a drain.
  drain(timeoutMs = 14_000): Promise<void> {
    const generation = this.generation;
    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: Error) => {
        if (timer !== undefined) this.clock.clearTimeout(timer);
        this.drainListeners.delete(check);
        if (error) reject(error); else resolve();
      };
      const check = () => {
        if (this.disposed || generation !== this.generation) finish(new Error('Decision drain cancelled.'));
        else if (!this.inFlight && !this.dirty) finish();
      };
      this.drainListeners.add(check);
      timer = this.clock.setTimeout(() => finish(new Error('Jev did not finish draining. The session is incomplete.')), timeoutMs);
      check();
    });
  }

  private publish(changes: Partial<EngineSnapshot>): void {
    if (this.disposed) return;
    this.snapshot = Object.freeze({ ...this.snapshot, ...changes });
    for (const listener of this.listeners) listener();
  }

  private clearExpiry(): void {
    if (this.expiry !== undefined) this.clock.clearTimeout(this.expiry);
    this.expiry = undefined;
  }

  private reportSemantic(trace: SemanticTrace) {
    if (trace.input.stage === 'primary' && trace.outcome !== 'started') this.publish({ lastSemantic: trace });
    for (const observe of this.semanticObservers) { try { observe(trace); } catch { /* Diagnostics never own state. */ } }
  }

  private async inspectSemantic(provider: SemanticProvider, input: SemanticInput, generation: number) {
    const start = this.clock.now();
    let trace: SemanticTrace = { input, candidates: operationCandidates(input), outcome: 'provider_failure',
      error: null, durationMs: 0, foregroundCueId: this.lesson.getSnapshot().attention.currentCueId };
    try {
      try { validateSemanticInput(input); }
      catch { trace = { ...trace, outcome: 'coverage_blocked' }; throw new Error('Semantic inspection requires missing source, candidate, or context coverage.'); }
      this.reportSemantic({ ...trace, outcome: 'started' });
      const judgment = await provider.inspect(input);
      if (this.disposed || generation !== this.generation) return null;
      trace = { ...trace, judgment, request: buildSemanticRequest(input, judgment.requestModel ?? judgment.model), outcome: 'invalid_judgment' };
      const proposal = compileProposal(input, judgment);
      trace = { ...trace, proposal, outcome: 'host_rejection' };
      const event = this.lesson.accept(proposal, this.clock.now());
      this.refreshLesson();
      trace = { ...trace, event, outcome: 'accepted', foregroundCueId: this.lesson.getSnapshot().attention.currentCueId };
      this.reportSemantic({ ...trace, durationMs: this.clock.now() - start });
      return { event, judgment };
    } catch (error) {
      if (this.disposed || generation !== this.generation) return null;
      if (error instanceof SemanticProviderError) trace = { ...trace, failureKind: error.kind,
        ...(error.requestModel ? { request: buildSemanticRequest(input, error.requestModel) } : {}) };
      const message = error instanceof Error ? error.message : 'Semantic inspection failed.';
      const stale = trace.outcome === 'host_rejection' && /Stale|dependency/.test(message);
      this.reportSemantic({ ...trace, outcome: stale ? 'stale' : trace.outcome, error: message, durationMs: this.clock.now() - start });
      return null;
    }
  }

  private reportRelationScheduling(input: SemanticInput, outcome: 'queued' | 'superseded' | 'invalidated', error: string | null) {
    this.reportSemantic({ input, candidates: operationCandidates(input), outcome, error, durationMs: 0,
      foregroundCueId: this.lesson.getSnapshot().attention.currentCueId });
  }
  private clearInspectionScheduling() {
    if (this.activeRelation) this.reportRelationScheduling(this.activeRelation, 'invalidated', 'Session reset or disposed.');
    if (this.pendingRelation) this.reportRelationScheduling(this.pendingRelation, 'invalidated', 'Session reset or disposed.');
    this.activeRelation = null; this.pendingRelation = null; this.suspensions.clear();
  }
  private scheduleRelation(provider: SemanticProvider, input: SemanticInput) {
    if (!this.optionalEnabled) { this.reportRelationScheduling(input, 'invalidated', 'Optional work stopped.'); return; }
    if (this.activeRelation) {
      if (this.pendingRelation) this.reportRelationScheduling(this.pendingRelation, 'superseded', `Coalesced into newer relation inspection ${input.inspectionId}.`);
      this.pendingRelation = input;
      this.reportRelationScheduling(input, 'queued', null);
      return;
    }
    // Pending snapshots retain their captured meaning. Never silently rebase them.
    try { checkReadSet(this.lesson.getSnapshot(), visibleReadSet(input)); }
    catch (error) { this.reportRelationScheduling(input, 'invalidated', String(error)); return; }
    const generation = this.generation;
    this.activeRelation = input;
    void this.inspectSemantic(provider, input, generation).finally(() => {
      if (generation !== this.generation || this.activeRelation !== input || this.disposed) return;
      this.activeRelation = null;
      const pending = this.pendingRelation; this.pendingRelation = null;
      if (pending) this.scheduleRelation(provider, pending);
    });
  }
  private async evaluateSemantic(provider: SemanticProvider): Promise<void> {
    this.inFlight = true; this.dirty = false;
    const generation = this.generation;
    // A lineage is the same primary source range, recaptured at most once.
    // Independent sources in the same burst each receive their own allowance.
    const staleRetries = new Map<string, string>();
    let step = 0;
    try {
      for (; step < 32 && !this.disposed && generation === this.generation; step++) {
        const state = this.lesson.getSnapshot(), excluded = this.suspensions.excluded(state);
        if (this.suspensions.atCapacity) { this.publish({ inputError: 'Inspection suspension capacity reached; evidence is retained. Reset the session before resuming automatic inspection.' }); break; }
        const captured = captureInspection(state, `inspection-${this.proposalPrefix}-${++this.proposalSequence}`, {}, excluded);
        if (!captured) break;
        const lineage = rangeKey(captured.sources[0]!.ranges);
        const parentInspectionId = staleRetries.get(lineage);
        const input: SemanticInput = parentInspectionId ? { ...captured, parentInspectionId } : captured;
        this.publish({ status: 'in-flight', semanticRequest: input });
        const before = accounting(state).accountedCodeUnits;
        const result = await this.inspectSemantic(provider, input, generation);
        if (this.disposed || generation !== this.generation) break;
        if (!result) {
          if (this.snapshot.lastSemantic?.outcome === 'stale' && !staleRetries.has(lineage)) {
            staleRetries.set(lineage, input.inspectionId); continue;
          }
          this.suspensions.suspend(this.lesson.getSnapshot(), input.sources.flatMap(s => s.ranges));
          continue;
        }
        staleRetries.delete(lineage);
        if (result.event.processing[0]?.kind === 'WAIT') {
          this.suspensions.suspend(this.lesson.getSnapshot(), result.event.processing[0].ranges);
        } else if (accounting(this.lesson.getSnapshot()).accountedCodeUnits <= before) {
          this.publish({ inputError: 'Semantic inspection made no processing progress.' }); break;
        }
        const relation = captureRelation(this.lesson.getSnapshot(), input, result.judgment, result.event);
        if (relation) this.scheduleRelation(provider, relation);
      }
      if (step === 32 && !this.disposed && generation === this.generation &&
        captureInspection(this.lesson.getSnapshot(), 'budget-check', {}, this.suspensions.excluded(this.lesson.getSnapshot()))) {
        this.publish({ inputError: 'Semantic inspection budget reached; remaining evidence is unresolved.' });
      }
    } finally {
      this.inFlight = false;
      if (!this.disposed) {
        this.publish({ status: 'idle', semanticRequest: null });
        if (this.dirty) void this.evaluateLatest();
        for (const check of this.drainListeners) check();
      }
    }
  }

  private async evaluateLatest(): Promise<void> {
    if ('inspect' in this.provider) return this.evaluateSemantic(this.provider);
    // Scripted demo and historical v3 replay compatibility only.
    const startedAt = this.clock.now();
    this.inFlight = true;
    this.dirty = false;
    const generation = this.generation;
    const capturedLesson = this.lesson.getSnapshot();
    const proposalId = `inspection-${this.proposalPrefix}-${++this.proposalSequence}`;
    const input: DecisionInput = Object.freeze({
      evidence: this.snapshot.evidence,
      candidates: this.snapshot.candidates,
      currentCue: this.snapshot.cues.currentCue,
    });
    this.publish({ status: 'in-flight', request: input });
    let decision: CueDecision = QUIET;
    let error: string | null = null;
    try {
      decision = validateDecision(await this.provider.decide(input), input.candidates);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Decision provider failed.';
    }

    if (!this.disposed && generation === this.generation) {
      const advanced = input.evidence.version !== this.snapshot.evidence.version;
      const candidate = decision.action === 'QUIET' ? undefined : input.candidates.find(c => c.id === decision.candidateId);
      const discardReason: DecisionRecord['discardReason'] = input.currentCue !== this.snapshot.cues.currentCue ? 'cue-changed'
        : advanced && this.clock.now() - startedAt > MAX_DECISION_LAG_MS ? 'request-expired'
        : advanced && this.snapshot.evidence.fragments.at(-1)!.endMs - input.evidence.fragments.at(-1)!.endMs > MAX_DECISION_LAG_MS ? 'source-advanced'
        : advanced && candidate && !candidate.sourceFragmentIds.every(id => this.snapshot.evidence.fragments.some(f => f.id === id)) ? 'source-evicted'
        : null;
      const stale = discardReason !== null;
      if (!stale && !error) {
        try {
          const proposal = legacyProposal(capturedLesson, input, decision, proposalId);
          if (proposal) this.lesson.accept(proposal, this.clock.now());
          this.refreshLesson();
        } catch (caught) {
          error = caught instanceof Error ? caught.message : 'Semantic acceptance failed.';
        }
      }
      this.publish({ lastDecision: Object.freeze({
        input, decision, error, discardReason, durationMs: Math.max(0, this.clock.now() - startedAt),
        outcome: stale ? 'discarded' : error ? 'fallback' : decision.action === 'QUIET' ? 'quiet' : 'applied',
      }) });
    }
    this.inFlight = false;
    if (this.disposed) return;
    this.publish({ status: 'idle', request: null });
    if (this.dirty) void this.evaluateLatest();
    for (const check of this.drainListeners) check();
  }
}
