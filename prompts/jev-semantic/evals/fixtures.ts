import { binding } from '../../../src/alive/evidence.ts';
import { LessonStore, memoryJournal, replayLesson } from '../../../src/alive/journal.ts';
import { captureInspection, captureRelation, compileProposal, parseSemanticJudgment } from '../../../src/alive/inspection.ts';
import { mockJudgmentResponse } from '../../../src/alive/inspection-fixtures.ts';
import type { WorkingSetOptions } from '../../../src/alive/projection.ts';
import type { CueContentPart, SemanticOperation, SemanticProposal } from '../../../src/alive/types.ts';

export type LessonFixture = {
  cues?: { key: string; parts: { id: string; text: string; stance?: string }[] }[];
  source: string;
  role?: 'teacher' | 'student' | 'unknown';
  tails?: string[];
  workingSet?: WorkingSetOptions; // Explicit Cue IDs here are fixture keys, resolved below.
  relationFrom?: string; // Authored, accepted RELATION_INTENT; evaluate only its follow-up.
};

// This is scenario construction, not an interpreter. Seed events are authored facts.
// Every write, authority check, replay, projection and candidate comes from production.
export function constructFixture(fixture: LessonFixture) {
  const store = new LessonStore(memoryJournal('promptfoo-lesson'));
  let sequence = 0;
  const accept = (operations: readonly SemanticOperation[], extra: Partial<SemanticProposal> = {}) => {
    const state = store.getSnapshot();
    return store.accept({ proposalId: `setup-${++sequence}`, origin: 'host', sessionId: state.sessionId,
      sessionEpoch: state.sessionEpoch, readSet: {}, operations, processing: [], policyVersion: 'alive-foundation-v1', ...extra }, sequence);
  };
  for (const role of ['teacher', 'student', 'unknown'] as const) accept([{ type: 'BIND_ROLE', binding: {
    bindingId: role, revision: 1, subject: { kind: 'capture', id: role }, role, basis: 'configured',
    basisRefs: ['authored-lesson-fixture'], sourceRanges: [],
  } }], { readSet: { roles: { [role]: 0 } } });
  const record = (id: string, text: string, speakerId = 'teacher') => {
    accept([{ type: 'RECORD_EVIDENCE', fragments: [{ id, text, sessionId: speakerId, speakerId, startMs: sequence, endMs: sequence }] }]);
    return binding(store.getSnapshot(), id);
  };
  const cueIds: Record<string, string> = {};
  for (const cue of fixture.cues ?? []) {
    if (cueIds[cue.key]) throw new Error('Duplicate fixture Cue key.');
    const parts: CueContentPart[] = cue.parts.map(part => {
      const ref = record(`seed-${cue.key}-${part.id}`, part.text);
      return { partId: part.id, content: 'source_spans', sourceBindings: [ref], establishmentEvidence: [ref],
        stance: part.stance ?? 'asserted', roleBindingRefs: ['teacher'], adoptionIds: [] };
    });
    const refs = parts.flatMap(p => p.establishmentEvidence);
    const state = store.getSnapshot();
    const event = accept([{ type: 'CREATE', identityKey: cue.key, parts, basis: refs }], {
      readSet: { roles: { teacher: 1 }, attention: state.attention.revision,
        processing: Object.fromEntries(refs.map(r => [r.evidenceId, state.processing[r.evidenceId]!.revision])) },
      foreground: cue.key, processing: [{ kind: 'ACCOUNT', ranges: refs }],
    });
    cueIds[cue.key] = event.createdCueIds[cue.key]!;
  }
  for (const [index, tail] of (fixture.tails ?? []).entries()) {
    const ref = record(`tail-${index + 1}`, tail, fixture.role);
    accept([], { processing: [{ kind: 'WAIT', ranges: [ref] }], readSet: { processing: { [ref.evidenceId]: 0 } } });
  }
  record('source', fixture.source, fixture.role);
  const resolve = (keys: readonly string[] | undefined) => keys?.map(key => cueIds[key] ?? key);
  const options: WorkingSetOptions = { ...fixture.workingSet,
    explicitCueIds: resolve(fixture.workingSet?.explicitCueIds), recalledCueIds: resolve(fixture.workingSet?.recalledCueIds),
    explicitPartIds: Object.fromEntries(Object.entries(fixture.workingSet?.explicitPartIds ?? {}).map(([key, ids]) => [cueIds[key] ?? key, ids])),
  };
  // Exercise the portable accepted-event replay before capturing the real working set.
  const state = replayLesson(JSON.parse(JSON.stringify(store.export())));
  let input = captureInspection(state, 'evaluation', options);
  if (!input) throw new Error('Fixture has no pending source.');
  if (fixture.relationFrom) {
    const origin = cueIds[fixture.relationFrom];
    if (!origin) throw new Error('Unknown relation origin in fixture.');
    const judgment = parseSemanticJudgment(mockJudgmentResponse(input,
      c => c.action === 'RELATION_INTENT' && c.cueId === origin && c.source.alias === 'S1'), input);
    const event = store.accept(compileProposal(input, judgment), ++sequence);
    input = captureRelation(store.getSnapshot(), input, judgment, event);
    if (!input) throw new Error('Fixture has no relation follow-up.');
  }
  return { store, input, cueIds };
}
