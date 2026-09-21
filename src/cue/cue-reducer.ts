import type { Candidate } from '../candidates/candidate-builder';
import { validateDecision } from '../decision/decision-provider';
import type { CueDecision } from '../decision/types';
import type { CueState } from './types';

export function applyDecision(
  state: CueState, decision: CueDecision, candidates: readonly Candidate[], now: number, newCueId: string,
): CueState {
  const valid = validateDecision(decision, candidates);
  if (valid.action === 'QUIET') return state;
  const candidate = candidates.find(item => item.id === valid.candidateId)!;
  if (valid.action === 'UPDATE_CURRENT' && state.currentCue) {
    return Object.freeze({
      ...state,
      currentCue: Object.freeze({
        ...state.currentCue, text: candidate.text,
        sourceRevision: state.currentCue.sourceRevision + 1,
        sourceFragmentIds: candidate.sourceFragmentIds, updatedAt: now,
      }),
    });
  }
  return Object.freeze({
    previousCue: state.currentCue,
    currentCue: Object.freeze({
      id: newCueId, text: candidate.text, sourceFragmentIds: candidate.sourceFragmentIds,
      sourceRevision: 1,
      createdAt: now, updatedAt: now,
    }),
  });
}

export function expirePrevious(state: CueState): CueState {
  return state.previousCue ? Object.freeze({ ...state, previousCue: null }) : state;
}
