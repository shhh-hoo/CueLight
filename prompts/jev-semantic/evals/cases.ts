import type { LessonFixture } from './fixtures.ts';
import type { SemanticAction } from '../../../src/alive/inspection.ts';

type Expected = {
  allowed?: SemanticAction[]; forbidden?: SemanticAction[]; cueKey?: string; mode?: string; partId?: string;
  stance?: string; relationKind?: string; outcome?: 'accepted' | 'coverage_blocked';
  contextComplete?: boolean; candidateComplete?: boolean; sourceAlias?: string;
};
export type EvalCase = {
  id: string; description: string;
  metadata: { kind: 'invariant' | 'boundary' | 'regression' | 'exploratory';
    area: 'identity' | 'revision' | 'wait' | 'authority' | 'recall' | 'relation' | 'coverage' | 'compound';
    principle: string; motivation: string; severity: 'P0' | 'P1' | 'P2' | 'P3' };
  fixture: LessonFixture; expected: Expected;
};
const cue = (key: string, text: string) => ({ key, parts: [{ id: 'definition', text }] });
const a = cue('A', 'A is X.');
const b = cue('B', 'B is independent.');
const insight = cue('insight', 'Insight goes beyond an observation to explain its significance.');
const complexity = cue('complexity', 'Acknowledge complexity by considering more than one explanation.');

// Authored scenarios, not recorded provider results. Expected fields never enter the Jev request.
export const cases: EvalCase[] = [
  { id: 'same-object-clarification', description: 'Clarify X within A without creating a duplicate',
    metadata: { kind: 'regression', area: 'identity', principle: 'Clarification preserves identity.', motivation: 'inspection.test.ts: clarification and necessary condition sequence.', severity: 'P0' },
    fixture: { cues: [a], source: 'In that definition of A, X means the local value.' },
    expected: { allowed: ['REVISE'], cueKey: 'A', mode: 'append' } },
  { id: 'distinct-darcy-object', description: 'One literary topic contains distinct teaching objects',
    metadata: { kind: 'boundary', area: 'identity', principle: 'Shared topic does not establish identity.', motivation: 'inspection.test.ts: distinct Darcy observation and theme.', severity: 'P1' },
    fixture: { cues: [cue('observation', 'Darcy refuses to dance at the ball.')], source: 'A separate teaching point: the novel explores the tension between pride and judgment.' },
    expected: { allowed: ['CREATE'], forbidden: ['REVISE'] } },
  { id: 'return-old-cue', description: 'Return to Insight while Complexity is displayed',
    metadata: { kind: 'regression', area: 'recall', principle: 'Recall preserves identity and semantic revision.', motivation: 'inspection.test.ts: closing literature recall and old A recall.', severity: 'P0' },
    fixture: { cues: [insight, complexity], source: 'Return to our earlier definition of Insight, exactly as stated.' },
    expected: { allowed: ['RECALL'], cueKey: 'insight' } },
  { id: 'return-with-new-meaning', description: 'Develop old A while B remains displayed',
    metadata: { kind: 'regression', area: 'revision', principle: 'New meaning on an old identity is revision.', motivation: 'inspection.test.ts: offscreen A revision leaves B foreground.', severity: 'P0' },
    fixture: { cues: [a, b], source: 'Add a necessary condition to our earlier A definition: it applies only when Y holds.' },
    expected: { allowed: ['REVISE'], cueKey: 'A', mode: 'append' } },
  { id: 'incomplete-condition', description: 'An unfinished condition remains unresolved',
    metadata: { kind: 'invariant', area: 'wait', principle: 'Incomplete evidence is retained.', motivation: 'inspection.test.ts: incomplete source WAIT.', severity: 'P0' },
    fixture: { source: 'Only if the missing condition' }, expected: { allowed: ['WAIT'] } },
  { id: 'missing-referent', description: 'A referent is unavailable in an empty lesson',
    metadata: { kind: 'boundary', area: 'wait', principle: 'Missing referents do not justify invention.', motivation: 'Primary operation instructions explicitly require WAIT for missing referents.', severity: 'P1' },
    fixture: { source: 'Change that earlier definition to the other one.' }, expected: { allowed: ['WAIT'] } },
  { id: 'understood-repetition', description: 'Explicit repetition adds no semantic content',
    metadata: { kind: 'invariant', area: 'wait', principle: 'Understood repetition can be accounted as NO_CHANGE.', motivation: 'inspection.test.ts: WAIT versus NO_CHANGE accounting.', severity: 'P1' },
    fixture: { cues: [a], source: 'Again, A is X, exactly as I just said, with nothing to add.' }, expected: { allowed: ['NO_CHANGE'] } },
  { id: 'administration', description: 'Classroom administration is understood without a Cue',
    metadata: { kind: 'boundary', area: 'wait', principle: 'Administration need not create teaching objects.', motivation: 'Primary operation instructions name filler and administration.', severity: 'P2' },
    fixture: { source: 'Please wait while I adjust the microphone volume.' }, expected: { allowed: ['NO_CHANGE'] } },
  { id: 'teacher-correction', description: 'Teacher explicitly corrects A from X to Z',
    metadata: { kind: 'regression', area: 'revision', principle: 'Grounded correction revises the same object.', motivation: 'inspection.test.ts: Earlier A is Z instead of X.', severity: 'P0' },
    fixture: { cues: [a, b], source: 'Correction to our earlier definition of A: replace X with Z.' },
    expected: { allowed: ['REVISE'], cueKey: 'A', mode: 'replace', partId: 'definition' } },
  { id: 'part-replacement', description: 'Replace a definition and preserve its condition',
    metadata: { kind: 'regression', area: 'revision', principle: 'Local correction preserves unrelated parts.', motivation: 'inspection.test.ts and foundation-fixes.test.ts: part-level corrections.', severity: 'P0' },
    fixture: { cues: [{ key: 'A', parts: [{ id: 'definition', text: 'A is X.' }, { id: 'condition', text: 'A applies only when Y holds.' }] }], source: 'In A, replace the definition X with Z; keep the condition that Y must hold.' },
    expected: { allowed: ['REVISE'], cueKey: 'A', mode: 'replace', partId: 'definition' } },
  { id: 'student-assertion', description: 'Student assertion has no independent mutation authority',
    metadata: { kind: 'invariant', area: 'authority', principle: 'Student evidence cannot independently authorize factual mutation.', motivation: 'operationCandidates authority filter and reducer teacher grounding.', severity: 'P0' },
    fixture: { cues: [a], role: 'student', source: 'A is actually Z, and I say this is the correct definition.' },
    expected: { allowed: ['WAIT', 'NO_CHANGE', 'RECALL'], forbidden: ['CREATE', 'REVISE', 'WITHDRAW', 'RELATION_INTENT'] } },
  { id: 'unknown-assertion', description: 'Unknown source cannot establish an asserted fact',
    metadata: { kind: 'invariant', area: 'authority', principle: 'Unknown is not teacher authority.', motivation: 'inspection.test.ts: unknown/student sources have no mutation options.', severity: 'P0' },
    fixture: { role: 'unknown', source: 'The new definition is that A equals Z.' },
    expected: { allowed: ['WAIT', 'NO_CHANGE'], forbidden: ['CREATE', 'REVISE'] } },
  { id: 'teacher-question', description: 'Teacher authority does not turn a question into an assertion',
    metadata: { kind: 'boundary', area: 'authority', principle: 'Stance and authority are independent.', motivation: 'Independent stance instructions and Slice III stance contract.', severity: 'P1' },
    fixture: { source: 'Our new discussion question is: why does memory shape identity?' },
    expected: { allowed: ['CREATE'], stance: 'question' } },
  { id: 'relation-only-intent', description: 'Explicit contrast selects a starting Cue without a content revision',
    metadata: { kind: 'regression', area: 'relation', principle: 'Relation-only evidence does not revise or recall endpoints.', motivation: 'stabilization.test.ts: relation-only evidence leaves meaning, occurrences and foreground unchanged.', severity: 'P1' },
    fixture: { cues: [a, b], source: 'The relation between our existing A and B is contrast; neither definition changes.' },
    expected: { allowed: ['RELATION_INTENT'], forbidden: ['CREATE', 'REVISE', 'RECALL'] } },
  { id: 'explicit-contrast-followup', description: 'Relation stage chooses the contrast endpoint and kind',
    metadata: { kind: 'regression', area: 'relation', principle: 'Relations bind accepted endpoints with original evidence.', motivation: 'stabilization.test.ts: accepted RELATION_INTENT followed by CONTRASTS_WITH.', severity: 'P1' },
    fixture: { cues: [a, b], source: 'A and B are contrasting cases.', relationFrom: 'A' },
    expected: { allowed: ['RELATE'], cueKey: 'B', relationKind: 'CONTRASTS_WITH' } },
  { id: 'relation-none', description: 'An optional relation inspection may legitimately find none',
    metadata: { kind: 'boundary', area: 'relation', principle: 'Temporal adjacency does not imply a relationship.', motivation: 'inspection.test.ts: NONE is valid in optional relation inspection. Origin is deliberately seeded.', severity: 'P1' },
    fixture: { cues: [a, b], source: 'A was discussed, then B; no relationship between them is being asserted.', relationFrom: 'A' },
    expected: { allowed: ['NONE'] } },
  { id: 'required-target-omitted', description: 'An explicitly required Cue cannot fit the bounded view',
    metadata: { kind: 'invariant', area: 'coverage', principle: 'Required context omission blocks transport.', motivation: 'projection and validateSemanticInput required-context guard.', severity: 'P0' },
    fixture: { cues: [a, b], source: 'Return to A.', workingSet: { maxCues: 1, explicitCueIds: ['B', 'A'] } },
    expected: { outcome: 'coverage_blocked', contextComplete: false } },
  { id: 'required-source-omitted', description: 'Source exceeds the available evidence budget',
    metadata: { kind: 'invariant', area: 'coverage', principle: 'Missing source is not successful semantic silence.', motivation: 'inspection.test.ts: source-only omitted coverage diagnostic.', severity: 'P0' },
    fixture: { source: 'Some evidence.', workingSet: { maxEvidenceCodeUnits: 0 } },
    expected: { outcome: 'coverage_blocked', contextComplete: false } },
  { id: 'bounded-old-cue', description: 'An omitted old Cue is not evidence that it never existed',
    metadata: { kind: 'boundary', area: 'coverage', principle: 'Omission is not semantic absence.', motivation: 'inspection.test.ts: maxCues 1 omits old A but retains B.', severity: 'P1' },
    fixture: { cues: [a, b], source: 'Return to the earlier A definition, unchanged.', workingSet: { maxCues: 1 } },
    expected: { allowed: ['WAIT'], contextComplete: false, candidateComplete: true } },
  { id: 'bounded-parts', description: 'The requested old part lies beyond the four part-target limit',
    metadata: { kind: 'boundary', area: 'coverage', principle: 'Candidate completeness is separate from context completeness.', motivation: 'inspection.test.ts: omitted part targets are reported, not silently absent.', severity: 'P1' },
    fixture: { cues: [{ key: 'A', parts: [1, 2, 3, 4, 5, 6].map(n => ({ id: `facet-${n}`, text: `Facet ${n} of A has value ${n}.` })) }], source: 'Replace only facet 6 of A with value 60, keeping every other facet.' },
    expected: { allowed: ['WAIT'], contextComplete: true, candidateComplete: false } },
  { id: 'explicit-withdrawal', description: 'Direct teacher invalidation withdraws A',
    metadata: { kind: 'invariant', area: 'revision', principle: 'Withdrawal requires explicit grounded invalidation.', motivation: 'inspection.test.ts: exact teacher withdrawal evidence.', severity: 'P0' },
    fixture: { cues: [a], source: 'Withdraw our earlier A claim entirely; it is invalid.' },
    expected: { allowed: ['WITHDRAW'], cueKey: 'A' } },
  { id: 'compound-development', description: 'One utterance develops Insight and introduces a literary example',
    metadata: { kind: 'exploratory', area: 'compound', principle: 'One primary operation may not capture all semantic changes.', motivation: 'Slice III and stabilization notes explicitly defer compound/background semantics.', severity: 'P3' },
    fixture: { cues: [insight], source: 'Insight explains significance, and Darcy refusing to dance illustrates how observation can lead to a separate claim about pride.' },
    expected: {} },
];

export function getCase(id: unknown): EvalCase {
  const found = cases.find(c => c.id === id);
  if (!found) throw new Error('Unknown curated evaluation case.');
  return found;
}
// Promptfoo loads this as a test generator; the prompt only carries the case ID.
export default function promptfooTests() {
  return cases.map(c => ({ description: c.description, vars: { caseId: c.id }, metadata: c.metadata,
    ...(c.metadata.kind === 'exploratory' ? {} : { assert: [{ type: 'javascript', value: 'file://prompts/jev-semantic/evals/assertions.ts' }] }),
  }));
}
