import { describe, expect, it } from 'vitest';
import type { Cue } from '../cue/types';
import type { EvidenceWindow } from '../evidence/evidence-buffer';
import { buildCandidates } from './candidate-builder';

const evidence: EvidenceWindow = {
  version: 6,
  fragments: ['One,', 'two?', 'THREE!', 'four.', 'x squared', 'is six.'].map((text, i) => ({
    id: `f${i}`, text, startMs: i * 100, endMs: i * 100,
  })),
};
const cue: Cue = { id: 'cue', text: 'One, two?', sourceRevision: 1, sourceFragmentIds: ['f0', 'f1'], createdAt: 0, updatedAt: 0 };

describe('source-span candidates', () => {
  it('creates at most four exact, contiguous source spans without generating text', () => {
    const candidates = buildCandidates(evidence, cue);
    expect(candidates.map(candidate => candidate.sourceFragmentIds)).toEqual([
      ['f5'], ['f4', 'f5'], ['f3', 'f4', 'f5'], ['f0', 'f1', 'f2', 'f3', 'f4', 'f5'],
    ]);
    expect(candidates.map(candidate => candidate.text)).toEqual([
      'is six.', 'x squared is six.', 'four. x squared is six.', 'One, two? THREE! four. x squared is six.',
    ]);
    for (const candidate of candidates) {
      const indexes = candidate.sourceFragmentIds.map(id => evidence.fragments.findIndex(item => item.id === id));
      expect(indexes.every((index, i) => index === indexes[0]! + i)).toBe(true);
      expect(candidate.text).toBe(indexes.map(index => evidence.fragments[index]!.text).join(' '));
    }
  });

  it('deduplicates ranges, returns fewer candidates with little evidence, and has stable source-derived IDs', () => {
    expect(buildCandidates({ version: 0, fragments: [] }, null)).toEqual([]);
    expect(buildCandidates({ ...evidence, fragments: evidence.fragments.slice(0, 1) }, null)).toHaveLength(1);
    const small = { ...evidence, fragments: evidence.fragments.slice(0, 2) };
    expect(buildCandidates(small, cue)).toHaveLength(2);
    expect(buildCandidates(small, cue)).toEqual(buildCandidates({ ...small, version: 99 }, cue));
  });

  it('does not stitch an evicted or incomplete current-Cue range back into evidence', () => {
    expect(buildCandidates({ ...evidence, fragments: evidence.fragments.slice(1) }, cue)).toHaveLength(3);
    expect(buildCandidates(evidence, { ...cue, sourceFragmentIds: ['f0', 'missing'] })).toHaveLength(3);
    expect(buildCandidates(evidence, { ...cue, sourceFragmentIds: ['f0', 'f2'] })).toHaveLength(3);
  });
});
