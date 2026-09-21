import type { Cue } from '../cue/types.ts';
import type { EvidenceFragment, EvidenceWindow } from '../evidence/evidence-buffer.ts';

export type Candidate = Readonly<{
  id: string;
  text: string;
  sourceFragmentIds: readonly string[];
  // Current-Cue continuation takes precedence when recent spans deduplicate.
  updateOnly?: true;
}>;

export function buildCandidates(evidence: EvidenceWindow, currentCue: Cue | null): readonly Candidate[] {
  const fragments = evidence.fragments;
  const spans: { fragments: readonly EvidenceFragment[]; updateOnly?: true }[] = [1, 2, 3]
    .filter(count => fragments.length >= count)
    .map(count => ({ fragments: fragments.slice(-count) }));

  if (currentCue) {
    const ids = currentCue.sourceFragmentIds;
    const start = fragments.findIndex(fragment => fragment.id === ids[0]);
    if (start >= 0 && ids.every((id, index) => fragments[start + index]?.id === id)) {
      spans.push({ fragments: fragments.slice(start), updateOnly: true });
    }
  }

  const candidates = new Map<string, Candidate>();
  for (const { fragments: span, updateOnly } of spans) {
    const ids = Object.freeze(span.map(fragment => fragment.id));
    const id = JSON.stringify(ids);
    candidates.set(id, Object.freeze({
      id,
      text: span.map(fragment => fragment.text).join(' '),
      sourceFragmentIds: ids,
      ...(updateOnly ? { updateOnly } : {}),
    }));
  }
  return Object.freeze([...candidates.values()]);
}
