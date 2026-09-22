import { MAX_FRAGMENT_CHARS, type EvidenceFragment } from '../evidence/evidence-buffer';

export type SegmentResult = {
  cycle: number;
  outcome: 'accepted' | 'invalid';
  fragments: readonly EvidenceFragment[];
  reason?: string;
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isFinite(value * 1000);

export class VoiceSegmentAdapter {
  private acceptedCycles = new Map<number, string>();
  private sequence = 0;
  private cycle = 0;
  private lastEndMs = 0;
  constructor(readonly sessionId: string) {}

  accept(value: unknown, receivedAtMonoMs: number): SegmentResult | null {
    if (!record(value) || value.type !== 'segments' || value.sessionId !== this.sessionId) return null;
    // Whole event is atomic: a malformed member cannot cause a partial decision.
    const invalid = (): SegmentResult => ({ cycle: typeof value.cycle === 'number' ? value.cycle : 0,
      outcome: 'invalid', fragments: [], reason: 'Voice SDK segment has invalid text, sequence, or source timestamps; it was not rewritten or truncated.' });
    if (!Number.isSafeInteger(value.cycle) || !Array.isArray(value.segments)) return invalid();
    const original = this.acceptedCycles.get(value.cycle as number);
    if (original !== undefined) return original === JSON.stringify(value.segments)
      ? { cycle: value.cycle as number, outcome: 'accepted', fragments: Object.freeze([]) } : invalid();
    if ((value.cycle as number) <= this.cycle) return invalid();
    let sequence = this.sequence;
    let endMs = this.lastEndMs;
    const fragments: EvidenceFragment[] = [];
    for (const segment of value.segments) {
      if (!record(segment) || !Number.isSafeInteger(segment.sequence) || (segment.sequence as number) <= sequence ||
          typeof segment.text !== 'string' || segment.text.length > MAX_FRAGMENT_CHARS ||
          !time(segment.startSeconds) || !time(segment.endSeconds) || segment.endSeconds < segment.startSeconds || segment.endSeconds * 1000 < endMs ||
          (segment.speakerId != null && typeof segment.speakerId !== 'string') ||
          (segment.language != null && typeof segment.language !== 'string')) return invalid();
      sequence = segment.sequence as number;
      endMs = segment.endSeconds * 1000;
      if (segment.text.trim()) fragments.push(Object.freeze({
        id: `${this.sessionId}:${sequence}`, sessionId: this.sessionId, sequence, cycle: value.cycle as number,
        text: segment.text, startMs: segment.startSeconds * 1000, endMs, receivedAtMonoMs,
        ...(typeof segment.speakerId === 'string' ? { speakerId: segment.speakerId } : {}),
        ...(typeof segment.language === 'string' ? { language: segment.language } : {}),
      }));
    }
    this.acceptedCycles.set(value.cycle as number, JSON.stringify(value.segments));
    this.sequence = sequence; this.lastEndMs = endMs; this.cycle = value.cycle as number;
    return { cycle: this.cycle, outcome: 'accepted', fragments: Object.freeze(fragments) };
  }
}
