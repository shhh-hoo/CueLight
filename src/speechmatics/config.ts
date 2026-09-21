export const ASR_TIMEOUT_MS = 12_000;
export const DECISION_DRAIN_MS = 14_000;
export type VoiceConfiguration = {
  preset: string; language: string; operatingPoint: string; audioEncoding: string;
  channels: number; voiceVersion: string; rtVersion: string; sampleRate?: number;
};
