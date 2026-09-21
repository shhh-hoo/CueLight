import { PCMRecorder, type InputAudioEvent } from '@speechmatics/browser-audio-input';
import workletUrl from '@speechmatics/browser-audio-input/pcm-audio-worklet.min.js?url';

export class BrowserAudioCapture {
  private readonly context = new AudioContext({ sampleRate: 16_000 });
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
