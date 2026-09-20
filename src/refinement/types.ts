import type { Cue } from '../cue/types.ts';
import type { EvidenceFragment } from '../evidence/evidence-buffer.ts';

export const REFINEMENT_MODEL = 'gpt-4.1-mini-2025-04-14';
export const REFINEMENT_TIMEOUT_MS = 3_000;
export const MAX_REFINEMENT_CHARS = 16_000;

export type CueTarget = Readonly<{ sessionId: string; cueId: string; sourceRevision: number }>;
export type RefinementInput = CueTarget & Readonly<{
  sourceText: string;
  sourceFragments: readonly EvidenceFragment[];
  referenceContext: readonly EvidenceFragment[];
}>;
export type RefinementFailure = 'timeout' | 'unavailable' | 'invalid' | 'refused' | 'incomplete';
export type RefinementReply = { displayText: string } | { error: RefinementFailure };
export type DisplayCue = Cue & Readonly<{ displayText: string }>;
export type DisplayState = Readonly<{ currentCue: DisplayCue | null; previousCue: DisplayCue | null }>;
export type RefinementOutcome = 'applied' | 'unchanged' | 'stale' | 'cancelled' | 'too-large' | RefinementFailure;
export type RefinementObservation =
  | { type: 'refinement-request'; atMonoMs: number; input: RefinementInput; model: string }
  | { type: 'refinement-result'; atMonoMs: number; target: CueTarget; outcome: RefinementOutcome; displayText?: string; failure?: RefinementFailure }
  | { type: 'display-state'; atMonoMs: number; sessionId: string; cues: DisplayState };

export const refinementMessages: Record<RefinementFailure | 'too-large', string> = {
  timeout: 'Text refinement timed out. The Cue is still available.',
  unavailable: 'Text refinement is unavailable. The Cue is still available.',
  invalid: 'Text refinement returned an unusable result. The source wording is kept.',
  refused: 'Text refinement was declined. The source wording is kept.',
  incomplete: 'Text refinement did not finish. The source wording is kept.',
  'too-large': 'This Cue exceeds the text refinement limit. The source wording is kept.',
};

export function sameTarget(a: CueTarget, b: CueTarget) {
  return a.sessionId === b.sessionId && a.cueId === b.cueId && a.sourceRevision === b.sourceRevision;
}
