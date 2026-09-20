import { expect, it } from 'vitest';
import { buildCandidates } from '../candidates/candidate-builder';
import { appendEvidence, emptyEvidence } from '../evidence/evidence-buffer';
import { MockDecisionProvider } from './mock-decision-provider';

it('unmatched scripts and unknown input cannot invent candidates or text', async () => {
  const evidence = appendEvidence(emptyEvidence(), { id: 'f1', text: 'Actual teacher text.', startMs: 0, endMs: 1 });
  const input = { evidence, candidates: buildCandidates(evidence, null), currentCue: null };
  expect(await new MockDecisionProvider({}).decide(input)).toEqual({ action: 'QUIET' });
  expect(await new MockDecisionProvider({ f1: { action: 'NEW_CUE', sourceFragmentIds: ['missing'] } }).decide(input)).toEqual({ action: 'QUIET' });
  expect(await new MockDecisionProvider({ f1: { action: 'NEW_CUE', sourceFragmentIds: ['f1'] } }).decide(input)).toEqual({ action: 'NEW_CUE', candidateId: '["f1"]' });
});
