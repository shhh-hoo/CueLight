export const SPEECHMATICS_URL = 'wss://global.rt.speechmatics.com/v2';
export const TRANSCRIPTION_CONFIG = Object.freeze({
  language: 'cmn_en', model: 'enhanced', max_delay: 2,
  max_delay_mode: 'flexible', enable_partials: false,
} as const);
export const ASR_TIMEOUT_MS = 10_000;
export const DECISION_DRAIN_MS = 14_000;

// Only these messages cross the worker boundary. Never forward SDK errors or URLs.
export type FinalMessage = {
  message: 'AddTranscript';
  metadata: { transcript: string; start_time: number; end_time: number };
};
export type WorkerCommand =
  | { type: 'start'; jwt: string; sampleRate: number }
  | { type: 'audio'; samples: Float32Array }
  | { type: 'stop' };
export type WorkerReply =
  | { type: 'started' | 'stopped' }
  | { type: 'final'; final: FinalMessage }
  | { type: 'error'; code: 'connection' | 'service' | 'disconnected' | 'audio' | 'drain' };
