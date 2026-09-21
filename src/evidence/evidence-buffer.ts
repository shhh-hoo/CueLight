export type EvidenceFragment = Readonly<{
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  sessionId?: string;
  sequence?: number;
  cycle?: number;
  receivedAtMonoMs?: number;
  speakerId?: string;
  inputChannelId?: string;
  language?: string;
}>;

export type EvidenceWindow = Readonly<{
  version: number;
  fragments: readonly EvidenceFragment[];
}>;

export const EVIDENCE_WINDOW_MS = 20_000;
export const MAX_FRAGMENTS = 32;
export const MAX_FRAGMENT_CHARS = 4_096;

export function emptyEvidence(): EvidenceWindow {
  return Object.freeze({ version: 0, fragments: Object.freeze([]) });
}

// Source adapters supply unique, finalized fragments in chronological order.
// Reject invalid input rather than silently truncating teacher-provided text.
export function appendEvidence(window: EvidenceWindow, fragment: EvidenceFragment): EvidenceWindow {
  if (!fragment.id || !fragment.text.trim() || fragment.text.length > MAX_FRAGMENT_CHARS ||
      !Number.isFinite(fragment.startMs) || !Number.isFinite(fragment.endMs) ||
      fragment.startMs < 0 || fragment.endMs < fragment.startMs) {
    throw new Error('Invalid finalized fragment (nonempty text, <=4096 characters, valid timestamps required).');
  }
  if (window.fragments.some(item => item.id === fragment.id)) {
    throw new Error('Duplicate fragment ID in the evidence window.');
  }
  if (fragment.endMs < (window.fragments.at(-1)?.endMs ?? 0)) {
    throw new Error('Finalized fragments must arrive in timestamp order.');
  }
  const cutoff = fragment.endMs - EVIDENCE_WINDOW_MS;
  const fragments = [...window.fragments, Object.freeze({ ...fragment })]
    .filter(item => item.endMs >= cutoff)
    .slice(-MAX_FRAGMENTS);
  return Object.freeze({ version: window.version + 1, fragments: Object.freeze(fragments) });
}
