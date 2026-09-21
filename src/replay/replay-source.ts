import { systemClock, type Clock } from '../clock';
import type { EvidenceFragment } from '../evidence/evidence-buffer';

export interface TeachingEvidenceSource {
  subscribeBatch?(onFinalSegments: (fragments: readonly EvidenceFragment[]) => void): () => void;
  subscribe(onFinalFragment: (fragment: EvidenceFragment) => void): () => void;
}

export type ReplayEntry = Readonly<{ at: number; fragment: EvidenceFragment }>;
export type ReplayStatus = 'ready' | 'playing' | 'paused' | 'finished';

export class ReplayEvidenceSource implements TeachingEvidenceSource {
  private fragmentListeners = new Set<(fragment: EvidenceFragment) => void>();
  private statusListeners = new Set<() => void>();
  private status: ReplayStatus = 'ready';
  private index = 0;
  private elapsedMs = 0;
  private startedAt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly entries: readonly ReplayEntry[], private readonly clock: Clock = systemClock) {}

  subscribe(onFinalFragment: (fragment: EvidenceFragment) => void): () => void {
    this.fragmentListeners.add(onFinalFragment);
    return () => { this.fragmentListeners.delete(onFinalFragment); };
  }

  getStatus = (): ReplayStatus => this.status;
  subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener);
    return () => { this.statusListeners.delete(listener); };
  };

  start(): void {
    if (this.status === 'playing' || this.status === 'finished') return;
    this.startedAt = this.clock.now();
    this.setStatus('playing');
    this.scheduleNext();
  }

  pause(): void {
    if (this.status !== 'playing') return;
    this.elapsedMs += this.clock.now() - this.startedAt;
    this.clearTimer();
    this.setStatus('paused');
  }

  reset(): void {
    this.clearTimer();
    this.index = 0;
    this.elapsedMs = 0;
    this.setStatus('ready');
  }

  dispose(): void {
    this.reset();
    this.fragmentListeners.clear();
    this.statusListeners.clear();
  }

  private setStatus(status: ReplayStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) listener();
  }

  private clearTimer(): void {
    if (this.timer !== undefined) this.clock.clearTimeout(this.timer);
    this.timer = undefined;
  }

  private scheduleNext(): void {
    const entry = this.entries[this.index];
    if (!entry) { this.setStatus('finished'); return; }
    const elapsed = this.elapsedMs + this.clock.now() - this.startedAt;
    this.timer = this.clock.setTimeout(() => {
      this.timer = undefined;
      this.index++;
      for (const listener of this.fragmentListeners) listener(entry.fragment);
      if (this.status === 'playing') this.scheduleNext();
    }, Math.max(0, entry.at - elapsed));
  }
}
