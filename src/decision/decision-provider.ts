import type { Candidate } from '../candidates/candidate-builder';
import type { Cue } from '../cue/types';
import type { EvidenceWindow } from '../evidence/evidence-buffer';
import type { CueDecision } from './types';

export type DecisionInput = Readonly<{
  evidence: EvidenceWindow;
  candidates: readonly Candidate[];
  currentCue: Cue | null;
}>;

export interface CueDecisionProvider {
  decide(input: DecisionInput): Promise<CueDecision>;
}

export function validateDecision(value: unknown, candidates: readonly Candidate[]): CueDecision {
  if (!value || typeof value !== 'object' || !('action' in value)) {
    throw new Error('Provider returned an invalid decision.');
  }
  if (value.action === 'QUIET') return { action: 'QUIET' };
  if ((value.action === 'NEW_CUE' || value.action === 'UPDATE_CURRENT') &&
      'candidateId' in value && typeof value.candidateId === 'string' &&
      candidates.some(candidate => candidate.id === value.candidateId &&
        (value.action !== 'NEW_CUE' || !candidate.updateOnly))) {
    return { action: value.action, candidateId: value.candidateId };
  }
  throw new Error('Provider action or candidate ID is not valid for this request.');
}
