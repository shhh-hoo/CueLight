import type { RefinementConfiguration } from '../runtime-config';
import type { Cue } from '../cue/types.ts';
import type { EvidenceFragment } from '../evidence/evidence-buffer.ts';
import type { PresentationReply, PresentationResult } from './presentation';

export type CueTarget = Readonly<{ sessionId: string; cueId: string; sourceRevision: number }>;
export type RefinementInput = CueTarget & Readonly<{
  sourceText: string;
  sourceFragments: readonly EvidenceFragment[];
  referenceContext: readonly EvidenceFragment[];
}>;
export type RefinementFailure = 'timeout' | 'unavailable' | 'invalid' | 'refused' | 'incomplete' | 'incomplete-source';
export type RefinementReply = PresentationReply | { error: RefinementFailure };
export type DisplayCue = Cue & Readonly<{ presentation: PresentationResult }>;
export type DisplayState = Readonly<{ currentCue: DisplayCue | null; previousCue: DisplayCue | null }>;
export type RefinementOutcome = 'applied' | 'unchanged' | 'stale' | 'cancelled' | 'too-large' | RefinementFailure;
export type RefinementObservation =
  | { type: 'refinement-configuration'; atMonoMs: number; configuration: RefinementConfiguration }
  | { type: 'refinement-request'; atMonoMs: number; input: RefinementInput; model: string; style: 'presentation-v1' }
  | { type: 'refinement-result'; atMonoMs: number; target: CueTarget; outcome: RefinementOutcome; result?: PresentationResult; failure?: RefinementFailure; style: 'presentation-v1' }
  | { type: 'display-state'; atMonoMs: number; sessionId: string; cues: DisplayState };

export const refinementMessages: Record<RefinementFailure | 'too-large', string> = {
  timeout: 'Cue presentation timed out. The source wording is kept.',
  unavailable: 'Cue presentation is unavailable. The source wording is kept.',
  invalid: 'Cue presentation returned an unusable result. The source wording is kept.',
  refused: 'Cue presentation was declined. The source wording is kept.',
  incomplete: 'Cue presentation did not finish. The source wording is kept.',
  'too-large': 'This Cue exceeds the presentation input limit. The source wording is kept.',
  'incomplete-source': 'The complete source could not be recovered. The source wording is kept.',
};

export function sameTarget(a: CueTarget, b: CueTarget) {
  return a.sessionId === b.sessionId && a.cueId === b.cueId && a.sourceRevision === b.sourceRevision;
}
