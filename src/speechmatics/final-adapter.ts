import { MAX_FRAGMENT_CHARS, type EvidenceFragment } from '../evidence/evidence-buffer';

export type FinalResult = {
  outcome: 'accepted' | 'empty' | 'duplicate' | 'invalid';
  sequence: number;
  raw: { text: string | null; startSeconds: number | null; endSeconds: number | null };
  fragment?: EvidenceFragment;
  reason?: string;
};

export class SpeechmaticsFinalAdapter {
  private sequence = 0;
  private lastEndMs = 0;
  private seen = new Set<string>();
  constructor(readonly sessionId: string) {}

  accept(value: unknown): FinalResult | null {
    if (!value || typeof value !== 'object' || !('message' in value) || value.message !== 'AddTranscript') return null;
    const metadata = 'metadata' in value && value.metadata && typeof value.metadata === 'object'
      ? value.metadata as Record<string, unknown> : {};
    const raw = {
      text: typeof metadata.transcript === 'string' ? metadata.transcript : null,
      startSeconds: typeof metadata.start_time === 'number' && Number.isFinite(metadata.start_time) ? metadata.start_time : null,
      endSeconds: typeof metadata.end_time === 'number' && Number.isFinite(metadata.end_time) ? metadata.end_time : null,
    };
    const base = { sequence: ++this.sequence, raw };
    if (raw.text === null || raw.startSeconds === null || raw.endSeconds === null ||
        raw.startSeconds < 0 || raw.endSeconds < raw.startSeconds || !Number.isFinite(raw.endSeconds * 1000)) {
      return { ...base, outcome: 'invalid', reason: 'Speechmatics Final has invalid text or source timestamps.' };
    }
    if (!raw.text.trim()) return { ...base, outcome: 'empty' };
    if (raw.text.length > MAX_FRAGMENT_CHARS) {
      return { ...base, outcome: 'invalid', reason: 'Speechmatics Final exceeds the 4096-character evidence contract; it was not truncated.' };
    }
    const fingerprint = JSON.stringify([raw.startSeconds, raw.endSeconds, raw.text]);
    if (this.seen.has(fingerprint)) return { ...base, outcome: 'duplicate' };
    const endMs = raw.endSeconds * 1000;
    if (endMs < this.lastEndMs) return { ...base, outcome: 'invalid', reason: 'Speechmatics Final arrived out of source-time order.' };
    this.seen.add(fingerprint);
    this.lastEndMs = endMs;
    return { ...base, outcome: 'accepted', fragment: Object.freeze({
      id: `${this.sessionId}:${this.sequence}`, text: raw.text, startMs: raw.startSeconds * 1000, endMs,
    }) };
  }
}
