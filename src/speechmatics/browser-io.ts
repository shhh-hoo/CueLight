import { PCMRecorder, type InputAudioEvent } from '@speechmatics/browser-audio-input';
import workletUrl from '@speechmatics/browser-audio-input/pcm-audio-worklet.min.js?url';
import type { FinalMessage, WorkerCommand, WorkerReply } from './config';

export class BrowserAudioCapture {
  private readonly context = new AudioContext();
  private readonly recorder = new PCMRecorder(workletUrl);
  private listener: ((event: InputAudioEvent) => void) | undefined;
  private watch: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  get sampleRate() { return this.context.sampleRate; }

  async start(onAudio: (samples: Float32Array) => void, onLost: () => void) {
    this.listener = event => { if (!this.disposed) onAudio(event.data); };
    this.recorder.addEventListener('audio', this.listener);
    try {
      await this.recorder.startRecording({ audioContext: this.context, recordingOptions: { channelCount: 1 } });
      // getUserMedia cannot be aborted. Release a permission grant arriving after reset.
      if (this.disposed) { this.recorder.stopRecording(); throw new Error('Cancelled'); }
      this.watch = setInterval(() => {
        if (!this.recorder.isRecording || this.context.state !== 'running') onLost();
      }, 500);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  async stop() {
    clearInterval(this.watch);
    this.recorder.stopRecording();
    if (this.context.state !== 'closed') await this.context.close();
    // Preserve already-posted worklet audio messages before sealing the sender.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    this.dispose();
  }

  dispose() {
    this.disposed = true;
    clearInterval(this.watch);
    if (this.listener) this.recorder.removeEventListener('audio', this.listener);
    this.recorder.stopRecording();
    if (this.context.state !== 'closed') void this.context.close().catch(() => {});
  }
}

const errorMessages = {
  connection: 'Speechmatics connection failed. Start a new session to reconnect.',
  service: 'Speechmatics reported a service error. Check your account configuration and start a new session.',
  disconnected: 'Speechmatics disconnected. Start a new session to reconnect.',
  audio: 'Audio could not be sent to Speechmatics. Start a new session to reconnect.',
  drain: 'Speechmatics did not finish draining the final audio. The session is incomplete.',
};

export class WorkerRealtimeConnection {
  private readonly worker = new Worker(new URL('./realtime.worker.ts', import.meta.url), { type: 'module' });
  private pending: { resolve: () => void; reject: (error: Error) => void } | undefined;

  private sendCommand(command: WorkerCommand, transfer: Transferable[] = []) {
    this.worker.postMessage(command, transfer);
  }

  start(jwt: string, sampleRate: number, onFinal: (event: FinalMessage) => void, onError: (message: string) => void) {
    const failure = (message: string) => {
      this.pending?.reject(new Error(message)); this.pending = undefined;
      onError(message);
    };
    this.worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      if (data.type === 'final') onFinal(data.final);
      else if (data.type === 'error') failure(errorMessages[data.code]);
      else { this.pending?.resolve(); this.pending = undefined; }
    };
    this.worker.onerror = event => { event.preventDefault(); failure('The Speechmatics connection worker failed. Start a new session.'); };
    return new Promise<void>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.sendCommand({ type: 'start', jwt, sampleRate });
    });
  }

  send(samples: Float32Array) {
    this.sendCommand({ type: 'audio', samples }, [samples.buffer as ArrayBuffer]);
  }

  stop() {
    return new Promise<void>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.sendCommand({ type: 'stop' });
    });
  }

  dispose() {
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
    this.pending?.reject(new Error('Speechmatics session cancelled.'));
    this.pending = undefined;
  }
}

export async function requestSpeechmaticsToken(signal: AbortSignal): Promise<string> {
  const response = await fetch('/api/speechmatics/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal,
  });
  if (!response.ok) throw new Error(response.status === 503
    ? 'Speechmatics is not configured. Set SPEECHMATICS_API_KEY on the local server.'
    : 'Unable to obtain Speechmatics credentials. Check the local server and your Speechmatics account.');
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('jwt' in data) || typeof data.jwt !== 'string' || !data.jwt) {
    throw new Error('The local Speechmatics service returned an invalid response.');
  }
  return data.jwt;
}
