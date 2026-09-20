import { describe, expect, it } from 'vitest';
import { applyDecision, expirePrevious } from './cue-reducer';
import { emptyCueState } from './types';

const candidates = [
  { id: 'a', text: 'Teacher statement.', sourceFragmentIds: ['f1'] },
  { id: 'b', text: 'Teacher statement. Clarification.', sourceFragmentIds: ['f1', 'f2'] },
  { id: 'c', text: 'Different point.', sourceFragmentIds: ['f3'] },
];

describe('Cue reducer', () => {
  it('QUIET preserves the exact state and Cue identity', () => {
    const state = applyDecision(emptyCueState(), { action: 'NEW_CUE', candidateId: 'a' }, candidates, 100, 'first');
    expect(applyDecision(state, { action: 'QUIET' }, candidates, 200, 'unused')).toBe(state);
  });

  it('updates in place and moves current to previous only for NEW_CUE', () => {
    const first = applyDecision(emptyCueState(), { action: 'NEW_CUE', candidateId: 'a' }, candidates, 100, 'first');
    const updated = applyDecision(first, { action: 'UPDATE_CURRENT', candidateId: 'b' }, candidates, 200, 'unused');
    expect(updated.currentCue).toEqual({ id: 'first', text: 'Teacher statement. Clarification.', sourceRevision: 2, sourceFragmentIds: ['f1', 'f2'], createdAt: 100, updatedAt: 200 });
    expect(updated.previousCue).toBeNull();
    expect(first.currentCue?.text).toBe('Teacher statement.');
    const next = applyDecision(updated, { action: 'NEW_CUE', candidateId: 'c' }, candidates, 300, 'second');
    expect(next.previousCue).toBe(updated.currentCue);
    expect(next.currentCue?.id).toBe('second');
    const expired = expirePrevious(next);
    expect(expired.previousCue).toBeNull();
    expect(expired.currentCue).toBe(next.currentCue);
  });

  it('treats UPDATE_CURRENT without a current Cue as NEW_CUE', () => {
    const result = applyDecision(emptyCueState(), { action: 'UPDATE_CURRENT', candidateId: 'a' }, candidates, 42, 'first');
    expect(result.currentCue?.id).toBe('first');
    expect(result.previousCue).toBeNull();
  });

  it('rejects unknown candidate IDs at the state boundary', () => {
    expect(() => applyDecision(emptyCueState(), { action: 'NEW_CUE', candidateId: 'invented' }, candidates, 0, 'id')).toThrow();
  });
});
