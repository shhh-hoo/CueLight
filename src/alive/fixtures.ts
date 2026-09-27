import { binding } from './evidence';
import { LessonStore, memoryJournal } from './journal';
import type { CueContentPart, ReadSet, SemanticOperation, SemanticProposal } from './types';

// Authored, provider-free fixtures. Times describe acceptance, not simulated
// model quality or classroom latency. Returned histories are portable JSON.
export function fixtureHost(sessionId = 'fixture') {
  const store = new LessonStore(memoryJournal(sessionId));
  let sequence = 0;
  const accept = (operations: readonly SemanticOperation[], options: Partial<SemanticProposal> = {}) => store.accept({
    proposalId: `p${++sequence}`, origin: 'host', sessionId, sessionEpoch: 0,
    readSet: {}, operations, processing: [], policyVersion: 'alive-foundation-v1', ...options,
  }, sequence * 100);
  const record = (...texts: string[]) => accept([{ type: 'RECORD_EVIDENCE', fragments: texts.map((text, index) => ({
    id: `f${store.getSnapshot().evidenceOrder.length + index + 1}`, text, startMs: sequence * 100, endMs: sequence * 100,
  })) }]);
  const part = (partId: string, ...ids: string[]): CueContentPart => ({ partId, content: 'source_spans',
    sourceBindings: ids.map(id => binding(store.getSnapshot(), id)), establishmentEvidence: ids.map(id => binding(store.getSnapshot(), id)),
    stance: 'unclassified', roleBindingRefs: [], adoptionIds: [] });
  const read = (...cueIds: string[]): ReadSet => ({ cues: Object.fromEntries(cueIds.map(id => [id, store.getSnapshot().cues[id]!.currentSemanticRevision])) });
  return { store, accept, record, part, read };
}
export function foundationReplayFixture() {
  const h = fixtureHost('identity-replay');
  h.record('A is X.', 'Only when Y.', 'B is independent.', 'Return to A.', 'Use Z instead of X.');
  const ref = (id: string) => binding(h.store.getSnapshot(), id);
  const create = h.accept([{ type: 'CREATE', identityKey: 'A', parts: [h.part('definition', 'f1')], basis: [ref('f1')] }],
    { foreground: 'A', readSet: { attention: 0, processing: { f1: 0 } }, processing: [{ kind: 'ACCOUNT', ranges: [ref('f1')] }] });
  return continueFixture(h, create.createdCueIds.A!);
}
function continueFixture(h: ReturnType<typeof fixtureHost>, a: string) {
  const ref = (id: string) => binding(h.store.getSnapshot(), id);
  h.accept([{ type: 'EXTEND', cueId: a, parts: [h.part('condition', 'f2')], removePartIds: [], basis: [ref('f2')] }],
    { readSet: h.read(a) });
  const created = h.accept([{ type: 'CREATE', identityKey: 'B', parts: [h.part('definition', 'f3')], basis: [ref('f3')] }],
    { foreground: 'B', readSet: { attention: 1 } });
  const b = created.createdCueIds.B!;
  h.accept([{ type: 'RECALL', cueId: a, basis: [ref('f4')] }], { readSet: { ...h.read(a), attention: 2 }, foreground: a });
  h.accept([{ type: 'REVISE', cueId: a, parts: [h.part('definition', 'f5')], removePartIds: [], basis: [ref('f5')] }], { readSet: h.read(a) });
  return { history: h.store.export(), a, b };
}
export function sharedSourceFixture() {
  const h = fixtureHost('shared-source'); h.record('A and B are distinct objects in this comparison.');
  const ref = binding(h.store.getSnapshot(), 'f1');
  const event = h.accept([
    { type: 'CREATE', identityKey: 'A', parts: [h.part('a', 'f1')], basis: [ref] },
    { type: 'CREATE', identityKey: 'B', parts: [h.part('b', 'f1')], basis: [ref] },
  ], { readSet: { processing: { f1: 0 } }, processing: [{ kind: 'ACCOUNT', ranges: [ref] }] });
  return { history: h.store.export(), a: event.createdCueIds.A!, b: event.createdCueIds.B! };
}
