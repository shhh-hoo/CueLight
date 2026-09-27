import { describe, expect, it } from 'vitest';
import { buildCandidates } from '../candidates/candidate-builder';
import { fixtureHost } from '../alive/fixtures';
import { legacyProposal } from '../alive/legacy-adapter';
import { projectDisplay, projectEvidenceWindow } from '../alive/projection';
import type { CueDecision } from '../decision/types';

// Migrated from the slot reducer: the same display regressions now exercise the
// real acceptance owner. The old reducer could not recover a departed Cue.
function setup() {
  const h = fixtureHost();
  const run = (decision: CueDecision, at: number) => {
    const state = h.store.getSnapshot();
    const cues = projectDisplay(state, at);
    const evidence = projectEvidenceWindow(state);
    const input = { evidence, candidates: buildCandidates(evidence, cues.currentCue), currentCue: cues.currentCue };
    const proposal = legacyProposal(state, input, decision, `decision-${at}`);
    if (proposal) h.store.accept(proposal, at);
    return projectDisplay(h.store.getSnapshot(), at, 4_000, cues);
  };
  return { ...h, run };
}
describe('legacy display projection through canonical acceptance', () => {
  it('QUIET preserves Cue identity and display, while its evidence remains unresolved', () => {
    const h = setup(); h.record('Teacher statement.');
    const state = h.run({ action: 'NEW_CUE', candidateId: '["f1"]' }, 100);
    h.run({ action: 'QUIET' }, 200);
    expect(projectDisplay(h.store.getSnapshot(), 200, 4_000, state)).toBe(state);
  });
  it('updates in place, projects previous on NEW, and expiry keeps all Cues in lesson history', () => {
    const h = setup(); h.record('Teacher statement.');
    const first = h.run({ action: 'NEW_CUE', candidateId: '["f1"]' }, 100);
    h.record('Clarification.');
    const updated = h.run({ action: 'UPDATE_CURRENT', candidateId: '["f1","f2"]' }, 200);
    expect(updated.currentCue).toEqual({ ...first.currentCue, text: 'Teacher statement. Clarification.', sourceRevision: 2, sourceFragmentIds: ['f1', 'f2'], updatedAt: 200 });
    expect(updated.previousCue).toBeNull(); expect(first.currentCue?.text).toBe('Teacher statement.');
    h.record('Different point.');
    const next = h.run({ action: 'NEW_CUE', candidateId: '["f3"]' }, 300);
    expect(next.previousCue).toEqual(updated.currentCue);
    expect(next.currentCue?.id).not.toBe(first.currentCue?.id);
    const expired = projectDisplay(h.store.getSnapshot(), 4_300, 4_000, next);
    expect(expired.previousCue).toBeNull(); expect(expired.currentCue).toBe(next.currentCue);
    expect(Object.keys(h.store.getSnapshot().cues)).toHaveLength(2);
  });
  it('adapts UPDATE_CURRENT without a current Cue to CREATE', () => {
    const h = setup(); h.record('Teacher statement.');
    const result = h.run({ action: 'UPDATE_CURRENT', candidateId: '["f1"]' }, 42);
    expect(result.currentCue?.sourceRevision).toBe(1); expect(result.previousCue).toBeNull();
  });
  it('rejects unknown candidate IDs before acceptance', () => {
    const h = setup(); h.record('Teacher statement.');
    expect(() => h.run({ action: 'NEW_CUE', candidateId: 'invented' }, 0)).toThrow();
  });
});
