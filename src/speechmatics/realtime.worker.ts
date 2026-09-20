import { RealtimeClient } from '@speechmatics/real-time-client';
import { ASR_TIMEOUT_MS, SPEECHMATICS_URL, TRANSCRIPTION_CONFIG, type WorkerCommand, type WorkerReply } from './config';

// One SDK instance per worker/session. Terminating this worker is the hard-cancel
// boundary missing from the SDK's public interface; no private socket access.
const client = new RealtimeClient({ url: SPEECHMATICS_URL, connectionTimeout: ASR_TIMEOUT_MS });
const reply = (message: WorkerReply) => self.postMessage(message);
let sent = 0;
let acknowledged = 0;
let ready = false;
let stopping = false;
let eosSent = false;
let ended = false;
let failed = false;

function fail(code: Extract<WorkerReply, { type: 'error' }>['code']) {
  if (!failed && !ended) { failed = true; reply({ type: 'error', code }); }
}

function finishAudio() {
  if (!stopping || eosSent || failed || acknowledged < sent) return;
  eosSent = true;
  // SDK sends its last AudioAdded seq_no. Wait for ALL sent blocks first so its
  // EndOfStream cannot name an earlier, merely acknowledged prefix.
  void client.stopRecognition().then(() => reply({ type: 'stopped' })).catch(() => fail('drain'));
}

client.addEventListener('receiveMessage', ({ data }) => {
  if (failed || ended) return;
  if (data.message === 'AddTranscript') {
    reply({ type: 'final', final: { message: 'AddTranscript', metadata: {
      transcript: data.metadata?.transcript, start_time: data.metadata?.start_time, end_time: data.metadata?.end_time,
    } } });
  } else if (data.message === 'AudioAdded') {
    acknowledged = data.seq_no;
    finishAudio();
  } else if (data.message === 'EndOfTranscript') {
    ended = true;
  } else if (data.message === 'Error') fail('service');
  // Partials, turn boundaries and arbitrary provider payloads are never relayed.
});
client.addEventListener('socketStateChange', ({ socketState }) => {
  if (socketState === 'closed' && !ended) fail('disconnected');
});

self.onmessage = ({ data }: MessageEvent<WorkerCommand>) => {
  if (failed || ended) return;
  if (data.type === 'start') {
    void client.start(data.jwt, {
      audio_format: { type: 'raw', encoding: 'pcm_f32le', sample_rate: data.sampleRate },
      transcription_config: TRANSCRIPTION_CONFIG,
    }).then(() => { ready = true; reply({ type: 'started' }); }).catch(() => fail('connection'));
  } else if (data.type === 'audio' && ready && !stopping) {
    try { client.sendAudio(data.samples as Float32Array<ArrayBuffer>); sent++; } catch { fail('audio'); }
  } else if (data.type === 'stop' && ready && !stopping) {
    stopping = true;
    finishAudio();
  }
};
