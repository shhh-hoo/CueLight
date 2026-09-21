import type { TeachingEvidenceSource } from '../replay/replay-source';
import type { EvidenceFragment } from '../evidence/evidence-buffer';
import { BrowserAudioCapture } from './browser-io';
import { VoiceConnection } from './voice-connection';
import { ASR_TIMEOUT_MS, type VoiceConfiguration } from './config';
import { VoiceSegmentAdapter, type SegmentResult } from './segment-adapter';

export type MicrophoneStatus = 'ready' | 'connecting' | 'running' | 'stopping' | 'stopped' | 'error';
export type SourceSnapshot = Readonly<{ status: MicrophoneStatus; error: string | null; inputError: string | null }>;
export type SourceObservation =
  | { type: 'voice-segments'; atMonoMs: number; result: SegmentResult }
  | { type: 'voice-configuration'; atMonoMs: number; configuration: VoiceConfiguration }
  | { type: 'source-state'; atMonoMs: number; state: SourceSnapshot };
type Options = {
  sessionId: string;
  drainDecisions: () => Promise<void>;
  abandonDecisions: () => void;
  observe?: (event: SourceObservation) => void;
};

export class SpeechmaticsEvidenceSource implements TeachingEvidenceSource {
  private snapshot: SourceSnapshot = { status: 'ready', error: null, inputError: null };
  private fragments = new Set<(fragment: EvidenceFragment) => void>();
  private batches = new Set<(fragments: readonly EvidenceFragment[]) => void>();
  private listeners = new Set<() => void>();
  private readonly adapter: VoiceSegmentAdapter;
  private readonly cancellation = new AbortController();
  private capture: BrowserAudioCapture | undefined;
  private connection: VoiceConnection | undefined;
  private disposed = false;
  private sending = false;
  private acceptingSegments = false;
  private stopping: Promise<void> | undefined;

  constructor(private readonly options: Options) { this.adapter = new VoiceSegmentAdapter(options.sessionId); }
  getSnapshot = () => this.snapshot;
  subscribeStatus = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribe = (listener: (fragment: EvidenceFragment) => void) => { this.fragments.add(listener); return () => { this.fragments.delete(listener); }; };
  subscribeBatch = (listener: (fragments: readonly EvidenceFragment[]) => void) => { this.batches.add(listener); return () => { this.batches.delete(listener); }; };
  private observe(event: SourceObservation) { try { this.options.observe?.(event); } catch { /* Diagnostics never control the pipeline. */ } }
  private publish(changes: Partial<SourceSnapshot>) {
    if (this.disposed) return;
    this.snapshot = Object.freeze({ ...this.snapshot, ...changes });
    this.observe({ type: 'source-state', atMonoMs: performance.now(), state: this.snapshot });
    for (const listener of this.listeners) listener();
  }

  private async bounded<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    const signal = this.cancellation.signal;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel = () => {};
    const interrupted = new Promise<never>((_, reject) => {
      cancel = () => reject(new Error('Session cancelled.'));
      timer = setTimeout(() => reject(new Error(message)), ms);
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    });
    try { return await Promise.race([promise, interrupted]); }
    finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
  }

  async start(): Promise<void> {
    if (this.disposed || this.snapshot.status !== 'ready') return;
    this.publish({ status: 'connecting', error: null });
    let phase: 'microphone' | 'connection' = 'microphone';
    try {
      this.capture = new BrowserAudioCapture();
      await this.capture.start(samples => {
        if (this.disposed || !this.sending) return;
        try { this.connection?.send(samples); }
        catch { this.fail('Audio could not be sent to Speechmatics. Start a new session.'); }
      }, () => this.fail('Microphone input stopped or was interrupted. Start a new session.'));
      if (this.cancellation.signal.aborted) { this.capture.dispose(); return; }
      phase = 'connection';
      this.connection = new VoiceConnection();
      this.acceptingSegments = true;
      await this.bounded(this.connection.start(this.options.sessionId, this.capture.sampleRate, this.receiveSegments,
        message => this.fail(message), configuration => this.observe({ type: 'voice-configuration', atMonoMs: performance.now(), configuration })), ASR_TIMEOUT_MS, 'Speechmatics connection timed out. Start a new session.');
      if (this.disposed || this.getSnapshot().status === 'error') return;
      this.sending = true;
      this.publish({ status: 'running' });
    } catch (error) {
      if (this.disposed) return;
      this.fail(phase === 'microphone'
        ? error instanceof Error && error.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow microphone access and start a new session.'
          : 'Microphone could not start. Check the input device and browser audio support, then start a new session.'
        : error instanceof Error ? error.message : 'Speechmatics could not start.');
    }
  }

  private receiveSegments = (message: unknown) => {
    if (this.disposed || !this.acceptingSegments) return;
    const atMonoMs = performance.now();
    const result = this.adapter.accept(message, atMonoMs);
    if (!result) return;
    this.observe({ type: 'voice-segments', atMonoMs, result });
    if (result.outcome === 'invalid') this.publish({ inputError: result.reason! });
    if (result.fragments.length) {
      for (const listener of this.batches) listener(result.fragments);
      for (const fragment of result.fragments) for (const listener of this.fragments) listener(fragment);
    }
  };

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    if (this.snapshot.status !== 'running' || this.disposed) return Promise.resolve();
    this.publish({ status: 'stopping' });
    this.stopping = (async () => {
      try {
        await this.bounded((async () => {
          await this.capture!.stop();
          if (this.disposed) return;
          this.sending = false;
          await this.connection!.stop();
          this.acceptingSegments = false;
        })(), ASR_TIMEOUT_MS, 'Speechmatics did not finish draining the final audio. The session is incomplete.');
        if (this.disposed) return;
        await this.options.drainDecisions();
        if (this.disposed || this.snapshot.status === 'error') return;
        await this.bounded(this.connection!.finish(), ASR_TIMEOUT_MS, 'Voice gateway did not close the drained session.');
        this.connection?.dispose();
        this.publish({ status: 'stopped' });
      } catch (error) {
        if (!this.disposed) {
          this.fail(error instanceof Error ? error.message : 'The session did not finish draining.');
        }
      }
    })();
    return this.stopping;
  }

  private fail(message: string) {
    if (this.disposed || this.snapshot.status === 'error') return;
    this.sending = false;
    this.acceptingSegments = false;
    this.capture?.dispose();
    this.connection?.dispose();
    this.cancellation.abort();
    this.options.abandonDecisions();
    this.publish({ status: 'error', error: message });
  }

  dispose() {
    this.disposed = true;
    this.sending = false;
    this.acceptingSegments = false;
    this.cancellation.abort();
    this.capture?.dispose();
    this.connection?.dispose();
    this.fragments.clear();
    this.batches.clear();
    this.listeners.clear();
  }
}
