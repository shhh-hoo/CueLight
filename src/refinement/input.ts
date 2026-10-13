import type { Cue } from '../cue/types.ts';
import type { EvidenceFragment } from '../evidence/evidence-buffer.ts';
import type { RefinementInput } from './types.ts';

// Shared by current-only scheduling and offline request previews. This reconstructs
// whole Finals; it does not grant eligibility to arbitrary selected subranges.
export function presentationInput(sessionId: string, cue: Cue, fragments: readonly EvidenceFragment[]): RefinementInput | null {
  const first = fragments.findIndex(fragment => fragment.id === cue.sourceFragmentIds[0]);
  const sourceFragments = fragments.slice(first, first + cue.sourceFragmentIds.length);
  if (first < 0 || sourceFragments.length === 0 || sourceFragments.length !== cue.sourceFragmentIds.length ||
      !sourceFragments.every((fragment, index) => fragment.id === cue.sourceFragmentIds[index]) ||
      sourceFragments.map(fragment => fragment.text).join(' ') !== cue.text) return null;
  return Object.freeze({ sessionId, cueId: cue.id, sourceRevision: cue.sourceRevision, sourceText: cue.text,
    sourceFragments: Object.freeze(sourceFragments), referenceContext: Object.freeze(fragments.slice(Math.max(0, first - 2), first)) });
}
