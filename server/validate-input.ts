import { buildCandidates } from '../src/candidates/candidate-builder.ts';
import type { Cue } from '../src/cue/types.ts';
import type { DecisionInput } from '../src/decision/decision-provider.ts';
import { appendEvidence, emptyEvidence, MAX_FRAGMENT_CHARS, MAX_FRAGMENTS } from '../src/evidence/evidence-buffer.ts';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 512;
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

// Only accept the existing engine contract. Rebuild candidates on the trusted side
// so arbitrary browser text can never be presented as a generated source span.
export function validateInput(value: unknown): DecisionInput {
  const fail = (): never => { throw new Error('Invalid decision input.'); };
  if (!record(value) || !record(value.evidence)) return fail();
  const { version, fragments } = value.evidence;
  if (!Number.isSafeInteger(version) || (version as number) < 0 || !Array.isArray(fragments) || fragments.length > MAX_FRAGMENTS) return fail();
  const metadata = (value: unknown, max: number): value is string =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
  let evidence = emptyEvidence();
  for (const fragment of fragments) {
    if (!record(fragment) || !id(fragment.id) || typeof fragment.text !== 'string' ||
        !time(fragment.startMs) || !time(fragment.endMs) ||
        (fragment.speakerId !== undefined && !metadata(fragment.speakerId, 128)) ||
        (fragment.language !== undefined && !metadata(fragment.language, 64))) return fail();
    evidence = appendEvidence(evidence, { id: fragment.id, text: fragment.text, startMs: fragment.startMs, endMs: fragment.endMs,
      ...(fragment.speakerId !== undefined ? { speakerId: fragment.speakerId as string } : {}),
      ...(fragment.language !== undefined ? { language: fragment.language as string } : {}),
    });
  }
  if (evidence.fragments.length !== fragments.length) return fail();
  evidence = { ...evidence, version: version as number };

  let currentCue: Cue | null = null;
  if (value.currentCue !== null) {
    const cue = value.currentCue;
    if (!record(cue) || !id(cue.id) || typeof cue.text !== 'string' || !cue.text.trim() ||
        cue.text.length > MAX_FRAGMENTS * (MAX_FRAGMENT_CHARS + 1) ||
        !time(cue.createdAt) || !time(cue.updatedAt) || cue.updatedAt < cue.createdAt ||
        !Array.isArray(cue.sourceFragmentIds) || cue.sourceFragmentIds.length === 0 ||
        cue.sourceFragmentIds.length > MAX_FRAGMENTS || !cue.sourceFragmentIds.every(id) ||
        new Set(cue.sourceFragmentIds).size !== cue.sourceFragmentIds.length) return fail();
    // Historical text replay inputs predate source revisions. Live Cues always carry one.
    const sourceRevision = cue.sourceRevision === undefined ? 1 : cue.sourceRevision;
    if (!Number.isSafeInteger(sourceRevision) || (sourceRevision as number) < 1) return fail();
    currentCue = { id: cue.id, text: cue.text, sourceRevision: sourceRevision as number,
      createdAt: cue.createdAt, updatedAt: cue.updatedAt, sourceFragmentIds: cue.sourceFragmentIds };
  }
  // Eligibility is derived here, never trusted from browser candidate metadata.
  const candidates = buildCandidates(evidence, currentCue);
  if (!Array.isArray(value.candidates) || value.candidates.length !== candidates.length) return fail();
  const supplied: unknown[] = value.candidates;
  candidates.forEach((candidate, index) => {
    const item = supplied[index];
    if (!record(item) || item.id !== candidate.id || item.text !== candidate.text ||
        JSON.stringify(item.sourceFragmentIds) !== JSON.stringify(candidate.sourceFragmentIds)) fail();
  });
  return { evidence, candidates, currentCue };
}
