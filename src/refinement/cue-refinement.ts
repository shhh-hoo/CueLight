import { refinementConfiguration, type RefinementConfiguration } from '../runtime-config';
import type { CueEngine } from '../cue/cue-engine';
import type { Cue } from '../cue/types';
import { refineCue } from './http-refinement-provider';
import type { PresentationResult } from './presentation';
import { refinementMessages, sameTarget,
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
  private config: RefinementConfiguration | null = null;
  private available = false;
  private initialized = false;
  private listeners = new Set<() => void>();
  private sourceCue: Cue | null = null;
  private latest: RefinementInput | null = null;
  private pending: RefinementInput | null = null;
  private completed: CueTarget | null = null;
  private job: { input: RefinementInput; controller: AbortController; epoch: number; config: RefinementConfiguration } | null = null;
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
  private source(cue: Cue): DisplayCue { return { ...cue, presentation: { kind: 'source' } }; }

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
    // Invalidate immediately, but keep the active slot until its finally runs.
    // A transport that ignores abort must not overlap or apply an obsolete result.
    this.cancel();
    this.latest = null;
    this.completed = null;
    this.show({ currentCue: currentCue ? this.source(currentCue) : null,
      previousCue: previousCue ? previous ?? this.source(previousCue) : null });
    this.publish({ error: null, lastOutcome: null });
    if (!currentCue) return;

    // The Engine publishes accepted source Cues while request still holds the
    // exact decision input. Do not substitute a newer evidence window here.
    const fragments = snapshot.request?.evidence.fragments;
    const first = fragments?.findIndex(fragment => fragment.id === currentCue.sourceFragmentIds[0]) ?? -1;
    const sourceFragments = fragments?.slice(first, first + currentCue.sourceFragmentIds.length) ?? [];
    if (!fragments || first < 0 || sourceFragments.length === 0 || sourceFragments.length !== currentCue.sourceFragmentIds.length ||
        !sourceFragments.every((fragment, index) => fragment.id === currentCue.sourceFragmentIds[index]) ||
        sourceFragments.map(fragment => fragment.text).join(' ') !== currentCue.text) {
      this.result(this.target(currentCue), 'incomplete-source');
      this.publish({ lastOutcome: 'incomplete-source' });
      return;
    }
    this.latest = Object.freeze({ ...this.target(currentCue), sourceText: currentCue.text,
      sourceFragments: Object.freeze(sourceFragments), referenceContext: Object.freeze(fragments.slice(Math.max(0, first - 2), first)) });
    if (this.snapshot.enabled && !this.snapshot.stopped) this.queue(this.latest);
  };

  configure(value: unknown, configured: boolean) {
    if (this.disposed) return;
    this.config = refinementConfiguration(value);
    this.available = configured;
    this.record({ type: 'refinement-configuration', atMonoMs: performance.now(), configuration: this.config });
    if (!this.initialized) {
      this.initialized = true;
      this.setEnabled(configured && this.config.defaultEnabled);
    } else if (!configured) this.setEnabled(false);
  }

  setEnabled(enabled: boolean) {
    if (enabled && (!this.available || !this.config)) return;
    if (this.disposed || (enabled && this.snapshot.stopped) || enabled === this.snapshot.enabled) return;
    this.publish({ enabled, error: null, lastOutcome: null });
    if (!enabled) {
      this.cancel();
      this.completed = null;
      const { currentCue, previousCue } = this.engine.getSnapshot().cues;
      this.show({ currentCue: currentCue ? this.source(currentCue) : null,
        previousCue: previousCue ? this.source(previousCue) : null });
    }
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
    if (this.disposed || this.snapshot.stopped || !this.snapshot.enabled || this.job || !this.pending || !this.config) return;
    const input = this.pending;
    this.pending = null;
    if (!this.isCurrent(input)) return;
    if (input.sourceText.length + input.referenceContext.reduce((sum, fragment) => sum + fragment.text.length, 0) > this.config.maxInputChars) {
      this.result(input, 'too-large');
      this.publish({ lastOutcome: 'too-large', error: refinementMessages['too-large'] });
      return;
    }
    const job = { input, controller: new AbortController(), epoch: this.epoch, config: this.config };
    this.job = job;
    this.publish({ busy: true, error: null });
    this.record({ type: 'refinement-request', atMonoMs: performance.now(), input, model: job.config.model, style: 'presentation-v1' });
    void this.run(job);
  }
  private isCurrent(input: CueTarget) {
    return !!this.sourceCue && sameTarget(input, this.target(this.sourceCue));
  }
  private result(input: CueTarget, outcome: RefinementOutcome, result?: PresentationResult, failure?: RefinementFailure) {
    this.record({ type: 'refinement-result', atMonoMs: performance.now(), target: {
      sessionId: input.sessionId, cueId: input.cueId, sourceRevision: input.sourceRevision,
    }, outcome, ...(result === undefined ? {} : { result }), ...(failure ? { failure } : {}), style: 'presentation-v1' });
  }
  private async run(job: NonNullable<CueRefinement['job']>) {
    try {
      const reply = await refineCue(job.input, job.controller.signal, job.config, configuration => {
        this.record({ type: 'refinement-configuration', atMonoMs: performance.now(), configuration });
      });
      if (this.disposed || job.epoch !== this.epoch || !this.isCurrent(job.input)) {
        this.result(job.input, this.disposed || job.epoch !== this.epoch ? 'cancelled' : 'stale', 'result' in reply ? reply.result : undefined,
          'error' in reply ? reply.error : undefined); return;
      }
      if ('error' in reply) {
        this.result(job.input, reply.error);
        this.publish({ lastOutcome: reply.error, error: refinementMessages[reply.error] });
        return;
      }
      const outcome = reply.result.kind === 'source' ? 'unchanged' : 'applied';
      this.completed = job.input;
      this.result(job.input, outcome, reply.result);
      this.publish({ lastOutcome: outcome });
      if (outcome === 'applied') {
        const currentCue: DisplayCue = { ...this.sourceCue!, presentation: reply.result };
        this.show({ ...this.snapshot.cues, currentCue });
      }
    } catch {
      const current = !this.disposed && job.epoch === this.epoch && this.isCurrent(job.input);
      this.result(job.input, current ? 'unavailable' : 'cancelled', undefined, 'unavailable');
      if (current) this.publish({ lastOutcome: 'unavailable', error: refinementMessages.unavailable });
    } finally {
      if (this.job === job) {
        this.job = null;
        this.publish({ busy: false });
        this.pump();
      }
    }
  }
}
