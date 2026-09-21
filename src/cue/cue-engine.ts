import { SemanticProviderError } from '../decision/semantic-failure';
import { accounting } from '../alive/evidence';
import { buildSemanticRequest, captureInspection, captureRelation, compileProposal, operationCandidates, rangeKey, validateSemanticInput, type SemanticInput, type SemanticProvider, type SemanticTrace } from '../alive/inspection';
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
  private relationInFlight = false;
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
  stopOptionalInspections() { this.optionalEnabled = false; }
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

  private async evaluateSemantic(provider: SemanticProvider): Promise<void> {
    this.inFlight = true; this.dirty = false;
    const generation = this.generation;
    const excluded = new Set<string>();
    let staleRetries = 0, step = 0;
    try {
      for (; step < 32 && !this.disposed && generation === this.generation; step++) {
        const input = captureInspection(this.lesson.getSnapshot(), `inspection-${this.proposalPrefix}-${++this.proposalSequence}`, {}, excluded);
        if (!input) break;
        this.publish({ status: 'in-flight', semanticRequest: input });
        const before = accounting(this.lesson.getSnapshot()).accountedCodeUnits;
        const result = await this.inspectSemantic(provider, input, generation);
        if (this.disposed || generation !== this.generation) break;
        if (!result) {
          // A bounded fresh capture can resolve a real dependency race. Never
          // rebase the old choice, retry a failed transport, or account failure.
          if (this.snapshot.lastSemantic?.outcome === 'stale' && staleRetries++ < 1) continue;
          input.sources.flatMap(s => s.ranges).forEach(ref => excluded.add(rangeKey([ref])));
          continue;
        }
        if (result.event.processing[0]?.kind === 'WAIT') {
          result.event.processing[0].ranges.forEach(ref => excluded.add(rangeKey([ref])));
        } else if (accounting(this.lesson.getSnapshot()).accountedCodeUnits <= before) {
          this.publish({ inputError: 'Semantic inspection made no processing progress.' }); break;
        }
        if (this.optionalEnabled && !this.relationInFlight) {
          const relation = captureRelation(this.lesson.getSnapshot(), input, result.judgment, result.event);
          if (relation) {
            this.relationInFlight = true;
            // Optional follow-up cannot block source-first publication or the
            // next primary operation. A changed endpoint rejects its own result.
            void this.inspectSemantic(provider, relation, generation).finally(() => { this.relationInFlight = false; });
          }
        }
      }
      if (step === 32 && !this.disposed && generation === this.generation &&
        captureInspection(this.lesson.getSnapshot(), 'budget-check', {}, excluded)) {
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
