import { expect, it } from 'vitest';
import { buildCandidates } from '../candidates/candidate-builder';
import type { Cue } from '../cue/types';
import type { EvidenceWindow } from '../evidence/evidence-buffer';
import { validateDecision } from './decision-provider';
import { buildJevRequest } from './jev-context';

const currentCue: Cue = { id: 'old-cue', sourceRevision: 1, createdAt: 0, updatedAt: 0,
  text: 'We know things in chemistry or in science are experiment and logic. Lecture is more focused on logic and lab on experiment.',
  sourceFragmentIds: ['old'] };
const window = (texts: string[]): EvidenceWindow => ({ version: texts.length,
  fragments: texts.map((text, i) => ({ id: `f${i}`, text, startMs: i * 1000, endMs: i * 1000 + 800 })) });

it.each([
  ['a lone pair from this chlorine atom is donated', 'this is the dative covalent bonding that occurs in Al2Cl6'],
  ['Atomic radius across the period and down the group.'],
])('offers distinct recent teaching as NEW despite a stale displayed Cue (%j)', (...texts) => {
  const evidence = window(texts);
  const candidates = buildCandidates(evidence, currentCue);
  const { body, options } = buildJevRequest({ evidence, candidates, currentCue });
  const fullIndex = candidates.findIndex(c => c.text === texts.join(' '));
  expect(options.get(`NEW_CUE_${fullIndex}`)).toEqual({ action: 'NEW_CUE', candidateId: candidates[fullIndex]!.id });
  expect(body.state.currentCue).toMatchObject({ text: currentCue.text, completeSourceStillInWindow: false });
  expect(body.state.latestInput?.text).toBe(texts.at(-1));
  expect(body.state.backgroundEvidence.map(f => f.text)).toEqual(texts.slice(0, -1));
  const { instructions, criteria } = body.questions.cue;
  expect(instructions).toContain('infer what the speaker is explaining NOW');
  expect(instructions).toContain('not necessarily what the teacher is teaching now');
  expect(instructions).toContain('It may be stale');
  expect(instructions).not.toContain('helps follow the current teaching idea');
  expect(instructions).toContain('Never summarize, repair transcription, supply missing formulas, paraphrase, or use outside knowledge');
  expect(criteria[`NEW_CUE_${fullIndex}`]).toContain('materially different from the displayed reference, even if unrelated to it');
  expect(criteria.QUIET).toContain('Never choose QUIET merely because the latest teaching is unrelated');
});

it.each([2, 4])('never offers current-Cue continuation as NEW, including a duplicate recent span (%i fragments)', count => {
  const evidence = window(['Why do we quote Feynman?', ...Array<string>(count - 2).fill('An expert explains.'), 'The etymology of Expert Is.']);
  const cue: Cue = { ...currentCue, text: evidence.fragments.slice(0, -1).map(f => f.text).join(' '),
    sourceFragmentIds: evidence.fragments.slice(0, -1).map(f => f.id) };
  const candidates = buildCandidates(evidence, cue);
  const continuationIndex = candidates.findIndex(c => c.sourceFragmentIds.length === count);
  const continuation = candidates[continuationIndex]!;
  const { body, options } = buildJevRequest({ evidence, candidates, currentCue: cue });
  expect(continuation.updateOnly).toBe(true);
  expect(candidates.filter(c => c.id === continuation.id)).toHaveLength(1);
  expect(options.get(`UPDATE_CURRENT_${continuationIndex}`)).toEqual({ action: 'UPDATE_CURRENT', candidateId: continuation.id });
  expect(options.has(`NEW_CUE_${continuationIndex}`)).toBe(false);
  expect(body.questions.cue.criteria).not.toHaveProperty(`NEW_CUE_${continuationIndex}`);
  expect([...options.values()].some(d => d.action === 'NEW_CUE' && d.candidateId === continuation.id)).toBe(false);
  expect(() => validateDecision({ action: 'NEW_CUE', candidateId: continuation.id }, candidates)).toThrow();
  expect(() => validateDecision({ action: 'UPDATE_CURRENT', candidateId: continuation.id }, candidates)).not.toThrow();
  expect(options.has('NEW_CUE_0')).toBe(true);
});
