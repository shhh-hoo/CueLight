import { expect, it } from 'vitest';
import { buildCandidates } from '../src/candidates/candidate-builder';
import { buildJevRequest } from '../src/decision/jev-context';
import { VoiceSegmentAdapter } from '../src/speechmatics/segment-adapter';
import { validateInput } from './validate-input';

const fragments = new VoiceSegmentAdapter('voice-test').accept({ type: 'segments', sessionId: 'voice-test', cycle: 1,
  segments: [
    { sequence: 1, text: 'A lone pair is donated.', startSeconds: 0, endSeconds: 1, speakerId: 'S1', language: 'en' },
    { sequence: 2, text: 'This is dative covalent bonding.', startSeconds: 1, endSeconds: 2, speakerId: 'S2', language: 'cmn_en' },
  ],
}, 100)!.fragments;
const evidence = { version: 1, fragments };
const input = { evidence, candidates: buildCandidates(evidence, null), currentCue: null };

it('preserves Voice speaker/language through JSON and trusted reconstruction into Jev state', () => {
  const trusted = validateInput(JSON.parse(JSON.stringify(input)));
  const state = buildJevRequest(trusted).body.state;
  expect(state.latestInput).toMatchObject({ speakerId: 'S2', language: 'cmn_en', text: fragments[1]!.text });
  expect(state.backgroundEvidence[0]).toMatchObject({ speakerId: 'S1', language: 'en', text: fragments[0]!.text });
  expect(buildJevRequest(trusted).body.questions.cue.instructions).toContain('does not establish teacher/student roles or authority');
  expect(JSON.stringify(state)).not.toMatch(/"role":/);
});

it('rejects malformed or unbounded metadata and accepts absent optional metadata', () => {
  for (const [key, values] of Object.entries({ speakerId: [1, {}, null, '', ' ', 'S1\n', 'x'.repeat(129)],
    language: [[], false, null, '', '\u0000en', 'x'.repeat(65)] })) {
    for (const value of values) {
      expect(() => validateInput({ ...input, evidence: { ...evidence,
        fragments: [{ ...fragments[0], [key]: value }, fragments[1]] } })).toThrow();
    }
  }
  expect(() => validateInput({ ...input, evidence: { ...evidence,
    fragments: fragments.map(({ speakerId: _speaker, language: _language, ...f }) => f) } })).not.toThrow();
});

it('reconstructs continuation eligibility despite forged browser flags and strips display metadata', () => {
  const currentCue = { id: 'cue', text: fragments[0]!.text, sourceRevision: 1, createdAt: 0, updatedAt: 0,
    sourceFragmentIds: [fragments[0]!.id], displayText: 'NOT SOURCE EVIDENCE' };
  const candidates = buildCandidates(evidence, currentCue).map(c => ({ ...c, updateOnly: false }));
  const trusted = validateInput({ evidence, candidates, currentCue });
  const continuation = trusted.candidates.find(c => c.sourceFragmentIds.length === 2)!;
  expect(continuation.updateOnly).toBe(true);
  const request = buildJevRequest(trusted);
  expect(request.options.has('NEW_CUE_1')).toBe(false);
  expect(JSON.stringify(request.body.state)).not.toContain('NOT SOURCE EVIDENCE');
  expect(() => validateInput({ evidence, currentCue, candidates: candidates.map(c => ({ ...c, text: 'NOT SOURCE EVIDENCE' })) })).toThrow();
});
