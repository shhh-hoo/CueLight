import { buildCandidates, type Candidate } from '../candidates/candidate-builder';
import { systemClock, type Clock } from '../clock';
import { validateDecision, type CueDecisionProvider, type DecisionInput } from '../decision/decision-provider';
import { QUIET, type CueDecision } from '../decision/types';
import { appendEvidence, emptyEvidence, type EvidenceFragment, type EvidenceWindow } from '../evidence/evidence-buffer';
import type { TeachingEvidenceSource } from '../replay/replay-source';
import { applyDecision, expirePrevious } from './cue-reducer';
import { emptyCueState, type CueState } from './types';

export const PREVIOUS_CUE_MS = 4_000;

export type DecisionRecord = Readonly<{
  input: DecisionInput;
  decision: CueDecision;
  outcome: 'applied' | 'quiet' | 'discarded' | 'fallback';
  error: string | null;
}>;

export type EngineSnapshot = Readonly<{
  evidence: EvidenceWindow;
  candidates: readonly Candidate[];
  cues: CueState;
  incoming: EvidenceFragment | null;
  status: 'idle' | 'in-flight' | 'settling-previous-session';
  request: DecisionInput | null;
  lastDecision: DecisionRecord | null;
  inputError: string | null;
}>;

function initialSnapshot(): EngineSnapshot {
  return Object.freeze({
    evidence: emptyEvidence(), candidates: Object.freeze([]), cues: emptyCueState(),
    incoming: null, status: 'idle', request: null, lastDecision: null, inputError: null,
  });
}

export class CueEngine {
  private snapshot = initialSnapshot();
  private listeners = new Set<() => void>();
  private inFlight = false;
  private dirty = false;
  private generation = 0;
  private cueSequence = 0;
  private disposed = false;
  private expiry: ReturnType<typeof setTimeout> | undefined;
  private disconnectSource: (() => void) | undefined;

  constructor(private readonly provider: CueDecisionProvider, private readonly clock: Clock = systemClock) {}

  getSnapshot = (): EngineSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  connect(source: TeachingEvidenceSource): () => void {
    this.disconnectSource?.();
    const unsubscribe = source.subscribe(this.accept);
    this.disconnectSource = unsubscribe;
    return () => {
      unsubscribe();
      if (this.disconnectSource === unsubscribe) this.disconnectSource = undefined;
    };
  }

  accept = (fragment: EvidenceFragment): void => {
    if (this.disposed) return;
    let evidence: EvidenceWindow;
    try {
      evidence = appendEvidence(this.snapshot.evidence, fragment);
    } catch (error) {
      this.publish({ inputError: error instanceof Error ? error.message : 'Invalid evidence.' });
      return;
    }
    this.publish({
      evidence, incoming: evidence.fragments.at(-1)!, inputError: null,
      candidates: buildCandidates(evidence, this.snapshot.cues.currentCue),
    });
    if (this.inFlight) this.dirty = true;
    else void this.evaluateLatest();
  };

  reset(): void {
    this.generation++;
    this.dirty = false;
    this.cueSequence = 0;
    this.clearExpiry();
    this.snapshot = initialSnapshot();
    this.publish({ status: this.inFlight ? 'settling-previous-session' : 'idle' });
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.dirty = false;
    this.clearExpiry();
    this.disconnectSource?.();
    this.listeners.clear();
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

  private async evaluateLatest(): Promise<void> {
    this.inFlight = true;
    this.dirty = false;
    const generation = this.generation;
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
      const stale = input.evidence.version !== this.snapshot.evidence.version;
      if (!stale && !error) {
        const prior = this.snapshot.cues;
        const next = applyDecision(prior, decision, input.candidates, this.clock.now(),
          `cue-${generation}-${++this.cueSequence}`);
        if (next.previousCue !== prior.previousCue) {
          this.clearExpiry();
          if (next.previousCue) {
            this.expiry = this.clock.setTimeout(() => {
              this.expiry = undefined;
              this.publish({ cues: expirePrevious(this.snapshot.cues) });
            }, PREVIOUS_CUE_MS);
          }
        }
        this.publish({ cues: next });
      }
      this.publish({ lastDecision: Object.freeze({
        input, decision, error,
        outcome: stale ? 'discarded' : error ? 'fallback' : decision.action === 'QUIET' ? 'quiet' : 'applied',
      }) });
    }
    this.inFlight = false;
    if (this.disposed) return;
    this.publish({ status: 'idle', request: null });
    if (this.dirty) void this.evaluateLatest();
  }
}
