import type { VoiceConfiguration } from './config';

// One socket owns one audio session. Binary frames are mono PCM; control/event
// messages carry the session ID. No provider credential reaches the browser.
export class VoiceConnection {
  private socket: WebSocket | undefined;
  private sessionId = '';
  private pending: { type: string; resolve: () => void; reject: (error: Error) => void } | undefined;
  private completed = false;

  start(sessionId: string, sampleRate: number, onSegments: (event: unknown) => void,
    onError: (message: string) => void, onConfiguration: (configuration: VoiceConfiguration) => void) {
    this.sessionId = sessionId;
    const url = new URL('/api/voice/session', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = this.socket = new WebSocket(url);
    const failure = (message: string) => {
      this.pending?.reject(new Error(message)); this.pending = undefined;
      onError(message);
    };
    socket.onopen = () => socket.send(JSON.stringify({ type: 'start', sessionId, sampleRate, encoding: 'pcm_f32le' }));
    socket.onmessage = ({ data }) => {
      let event;
      try { event = JSON.parse(data); } catch { failure('Voice gateway sent an invalid response. Restart the gateway.'); return; }
      if (!event || event.sessionId !== sessionId) return;
      if (event.type === 'segments') onSegments(event);
      else if (event.type === 'error') {
        // Never display arbitrary provider messages, URLs, or errors.
        const messages: Record<string, string> = {
          authentication: 'Speechmatics authentication failed. Check SPEECHMATICS_API_KEY and restart the Voice gateway.',
          configuration: 'Unsupported Voice audio or configuration. Check audio format and Speechmatics language access.',
          connection: 'Speechmatics Voice connection failed. Check your network and account, then start a new session.',
          drain: 'Voice SDK finalize/drain timed out. The session is incomplete.',
          protocol: 'Invalid or stale Voice session. Start a new session.',
          backpressure: 'Voice processing could not keep up with audio. Start a new session.',
        };
        failure(messages[event.code] ?? 'Speechmatics Voice reported a service error. Check your account and start a new session.');
      } else if (event.type === this.pending?.type) {
        if (event.type === 'started') onConfiguration(event.configuration);
        if (event.type === 'stopped') this.completed = true;
        this.pending?.resolve(); this.pending = undefined;
      }
      // Partial segments and underlying word transcripts never cross into evidence.
    };
    socket.onerror = () => failure('Cannot reach the Python Voice gateway. Start it with npm run voice and try again.');
    socket.onclose = () => { if (!this.completed) failure('Voice gateway WebSocket connection was lost. Start a new session.'); };
    return this.waitFor('started');
  }

  private waitFor(type: string) {
    return new Promise<void>((resolve, reject) => { this.pending = { type, resolve, reject }; });
  }
  private command(type: string, response: string) {
    if (this.socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Voice gateway connection was lost.'));
    const pending = this.waitFor(response);
    this.socket.send(JSON.stringify({ type, sessionId: this.sessionId }));
    return pending;
  }
  send(samples: Float32Array) {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('Voice gateway connection was lost.');
    if (this.socket.bufferedAmount > 2 * 1024 * 1024) throw new Error('Voice gateway cannot keep up with audio.');
    this.socket.send(samples as Float32Array<ArrayBuffer>);
  }
  stop() { return this.command('stop', 'drained'); }
  finish() { return this.command('finish', 'stopped'); }
  dispose() {
    if (this.socket) {
      this.socket.onopen = null; this.socket.onmessage = null;
      this.socket.onerror = null; this.socket.onclose = null;
      this.socket.close();
    }
    this.pending?.reject(new Error('Voice session cancelled.')); this.pending = undefined;
  }
}
