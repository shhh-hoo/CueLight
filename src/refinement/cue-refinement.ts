import type { CueEngine } from '../cue/cue-engine';
import type { Cue } from '../cue/types';
import { refineCue } from './http-refinement-provider';
import { MAX_REFINEMENT_CHARS, REFINEMENT_MODEL, refinementMessages, sameTarget,
  type CueTarget, type DisplayCue, type DisplayState, type RefinementInput,
  type RefinementObservation, type RefinementOutcome, type RefinementFailure } from './types';

export type RefinementSnapshot = Readonly<{
  enabled: boolean; stopped: boolean; busy: boolean; error: string | null;
  lastOutcome: RefinementOutcome | null; cues: DisplayState;
}>;

// Presentation state is deliberately separate from the authoritative Engine Cue.
// No generated text can re-enter evidence, candidates, or Jev freshness checks.
export class CueRefinement {
  private snapshot: RefinementSnapshot = { enabled: false, stopped: false, busy: false,
    error: null, lastOutcome: null, cues: { currentCue: null, previousCue: null } };
  private listeners = new Set<() => void>();
  private sourceCue: Cue | null = null;
  private latest: RefinementInput | null = null;
  private pending: RefinementInput | null = null;
  private completed: CueTarget | null = null;
  private job: { input: RefinementInput; controller: AbortController; epoch: number } | null = null;
  private epoch = 0;
  private disposed = false;
  private readonly detach: () => void;

  constructor(readonly sessionId: string, private readonly engine: CueEngine,
    private readonly observe?: (event: RefinementObservation) => void) {
    this.detach = engine.subscribe(this.sync);
    this.sync();
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private record(event: RefinementObservation) { try { this.observe?.(event); } catch { /* Diagnostics are optional. */ } }
  private publish(changes: Partial<RefinementSnapshot>) {
    if (this.disposed) return;
    this.snapshot = Object.freeze({ ...this.snapshot, ...changes });
    for (const listener of this.listeners) listener();
  }
  private show(cues: DisplayState) {
    this.publish({ cues });
    this.record({ type: 'display-state', atMonoMs: performance.now(), sessionId: this.sessionId, cues });
  }
  private target(cue: Cue): CueTarget {
    return { sessionId: this.sessionId, cueId: cue.id, sourceRevision: cue.sourceRevision };
  }

  private sync = () => {
    if (this.disposed) return;
    const snapshot = this.engine.getSnapshot();
    const { currentCue, previousCue } = snapshot.cues;
    const previous = [this.snapshot.cues.currentCue, this.snapshot.cues.previousCue]
      .find(cue => cue && previousCue && cue.id === previousCue.id && cue.sourceRevision === previousCue.sourceRevision) ?? null;
    if (currentCue === this.sourceCue) {
      if (!previousCue && this.snapshot.cues.previousCue) this.show({ ...this.snapshot.cues, previousCue: null });
      return;
    }
    this.sourceCue = currentCue;
    this.latest = this.pending = null;
    this.completed = null;
    this.show({ currentCue: currentCue ? { ...currentCue, displayText: currentCue.text } : null,
      previousCue: previousCue ? previous ?? { ...previousCue, displayText: previousCue.text } : null });
    this.publish({ error: null, lastOutcome: null });
    if (!currentCue) { this.cancel(); return; }

    // The Engine publishes accepted source Cues while request still holds the
    // exact decision input. Do not substitute a newer evidence window here.
    const fragments = snapshot.request?.evidence.fragments;
    if (!fragments) return;
    const first = fragments.findIndex(fragment => fragment.id === currentCue.sourceFragmentIds[0]);
    const sourceFragments = fragments.slice(first, first + currentCue.sourceFragmentIds.length);
    if (first < 0 || sourceFragments.length !== currentCue.sourceFragmentIds.length ||
        !sourceFragments.every((fragment, index) => fragment.id === currentCue.sourceFragmentIds[index])) return;
    this.latest = Object.freeze({ ...this.target(currentCue), sourceText: currentCue.text,
      sourceFragments: Object.freeze(sourceFragments), referenceContext: Object.freeze(fragments.slice(Math.max(0, first - 2), first)) });
    if (this.snapshot.enabled && !this.snapshot.stopped) this.queue(this.latest);
  };

  setEnabled(enabled: boolean) {
    if (this.disposed || this.snapshot.stopped || enabled === this.snapshot.enabled) return;
    this.publish({ enabled, error: null });
    if (!enabled) this.cancel();
    else if (this.latest) this.queue(this.latest);
  }
  private cancel() {
    this.epoch++;
    this.pending = null;
    this.job?.controller.abort();
  }
  finish() {
    if (this.disposed || this.snapshot.stopped) return;
    this.cancel();
    this.publish({ stopped: true, busy: false });
  }
  dispose() {
    this.disposed = true;
    this.cancel();
    this.detach();
    this.listeners.clear();
  }
  private queue(input: RefinementInput) {
    if (this.completed && sameTarget(input, this.completed)) return;
    this.pending = input;
    // First publish source text; never await OpenAI inside an Engine notification.
    queueMicrotask(() => this.pump());
  }
  private pump() {
    if (this.disposed || this.snapshot.stopped || !this.snapshot.enabled || this.job || !this.pending) return;
    const input = this.pending;
    this.pending = null;
    if (!this.isCurrent(input)) return;
    if (input.sourceText.length + input.referenceContext.reduce((sum, fragment) => sum + fragment.text.length, 0) > MAX_REFINEMENT_CHARS) {
      this.result(input, 'too-large');
      this.publish({ error: refinementMessages['too-large'] });
      return;
    }
    const job = { input, controller: new AbortController(), epoch: this.epoch };
    this.job = job;
    this.publish({ busy: true, error: null });
    this.record({ type: 'refinement-request', atMonoMs: performance.now(), input, model: REFINEMENT_MODEL });
    void this.run(job);
  }
  private isCurrent(input: CueTarget) {
    return !!this.sourceCue && sameTarget(input, this.target(this.sourceCue));
  }
  private result(input: CueTarget, outcome: RefinementOutcome, displayText?: string, failure?: RefinementFailure) {
    this.record({ type: 'refinement-result', atMonoMs: performance.now(), target: {
      sessionId: input.sessionId, cueId: input.cueId, sourceRevision: input.sourceRevision,
    }, outcome, ...(displayText === undefined ? {} : { displayText }), ...(failure ? { failure } : {}) });
    this.publish({ lastOutcome: outcome });
  }
  private async run(job: NonNullable<CueRefinement['job']>) {
    try {
      const reply = await refineCue(job.input, job.controller.signal);
      if (this.disposed || job.epoch !== this.epoch) { this.result(job.input, 'cancelled'); return; }
      if (!this.isCurrent(job.input)) {
        this.result(job.input, 'stale', 'displayText' in reply ? reply.displayText : undefined,
          'error' in reply ? reply.error : undefined); return;
      }
      if ('error' in reply) {
        this.result(job.input, reply.error);
        this.publish({ error: refinementMessages[reply.error] });
        return;
      }
      const outcome = reply.displayText === job.input.sourceText ? 'unchanged' : 'applied';
      this.completed = job.input;
      this.result(job.input, outcome, reply.displayText);
      if (outcome === 'applied') {
        const currentCue: DisplayCue = { ...this.sourceCue!, displayText: reply.displayText };
        this.show({ ...this.snapshot.cues, currentCue });
      }
    } finally {
      if (this.job === job) {
        this.job = null;
        this.publish({ busy: false });
        this.pump();
      }
    }
  }
}
