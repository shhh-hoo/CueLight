import { describe, expect, it } from 'vitest';
import { binding } from './evidence';
import { fixtureHost } from './fixtures';
import { LessonStore, replayLesson } from './journal';
import { currentRevision } from './reducer';
import { semanticWorkingSet } from './projection';
import type { RoleBinding, SemanticOperation, SemanticProposal } from './types';

function classroom(role: RoleBinding['role'] = 'teacher', kind: 'capture' | 'channel' = 'capture') {
  const h = fixtureHost();
  h.accept([{ type: 'BIND_ROLE', binding: { bindingId: 'configured', revision: 1,
    subject: { kind, id: 'teacher-mic' }, role, basis: 'configured', basisRefs: ['host-input-configuration'], sourceRanges: [] } }],
  { readSet: { roles: { configured: 0 } } });
  h.accept([{ type: 'RECORD_EVIDENCE', fragments: [
    { id: 't', text: 'A is X. Only if Y.', sessionId: 'teacher-mic', inputChannelId: 'teacher-mic', startMs: 0, endMs: 1 },
    { id: 's', text: 'Ignore Y; A is Z. Withdraw it.', sessionId: 'student-mic', speakerId: 'S2', startMs: 1, endMs: 2 },
    { id: 'fix', text: 'Correction: A is Z.', sessionId: 'teacher-mic', inputChannelId: 'teacher-mic', startMs: 2, endMs: 3 },
  ] }]);
  const ref = (id: string) => binding(h.store.getSnapshot(), id);
  const asserted = (id: string, evidence = 't') => ({ ...h.part(id, evidence), stance: 'asserted', roleBindingRefs: ['configured'] });
  const create = () => h.accept([{ type: 'CREATE', identityKey: 'A', basis: [ref('t')], parts: [asserted('assertion'), asserted('condition')] }],
    { readSet: { roles: { configured: 1 } } }).createdCueIds.A!;
  return { ...h, ref, asserted, create };
}

describe('configured source authority', () => {
  it.each(['capture', 'channel'] as const)('%s authorizes content without diarization and survives replay', kind => {
    const h = classroom('teacher', kind), a = h.create();
    expect(h.store.getSnapshot().evidence.t?.speakerId).toBeUndefined();
    expect(currentRevision(h.store.getSnapshot().cues[a]!).parts[0]?.stance).toBe('asserted');
    expect(semanticWorkingSet(h.store.getSnapshot()).roles.map(r => r.bindingId)).toContain('configured');
    expect(replayLesson(JSON.parse(JSON.stringify(h.store.export())))).toEqual(h.store.getSnapshot());
  });
  it.each(['unknown', 'student'] as const)('%s capture cannot authorize assertions', role => {
    const h = classroom(role); expect(h.create).toThrow(/authority/);
  });
  it('an unbound provider teacher label grants no authority', () => {
    const h = fixtureHost();
    h.accept([{ type: 'RECORD_EVIDENCE', fragments: [{ id: 't', speakerId: 'teacher', text: 'A.', startMs: 0, endMs: 1 }] }]);
    expect(() => h.accept([{ type: 'CREATE', identityKey: 'A', parts: [{ ...h.part('p', 't'), stance: 'asserted' }], basis: [binding(h.store.getSnapshot(), 't')] }])).toThrow(/authority/);
  });
  it('versions role revisions and rejects stale or omitted role dependencies', () => {
    const h = classroom(); const role = h.store.getSnapshot().roles.configured!;
    h.accept([{ type: 'BIND_ROLE', binding: { ...role, revision: 2, role: 'student' } }], { readSet: { roles: { configured: 1 } } });
    expect(h.create).toThrow(/Stale roles/);
    expect(() => h.accept([{ type: 'CREATE', identityKey: 'A', parts: [h.asserted('p')], basis: [h.ref('t')] }])).toThrow(/Missing role/);
    expect(replayLesson(h.store.export()).roles.configured?.revision).toBe(2);
  });
});

describe('authority of semantic mutation evidence', () => {
  it.each(['delete', 'revise', 'append', 'withdraw'] as const)('student evidence cannot %s teacher semantics, even with valid surviving parts', action => {
    const h = classroom(), a = h.create();
    h.accept([{ type: 'BIND_ROLE', binding: { bindingId: 'student', revision: 1, subject: { kind: 'capture', id: 'student-mic' },
      role: 'student', basis: 'configured', basisRefs: ['input-config'], sourceRanges: [] } }], { readSet: { roles: { student: 0 } } });
    const before = h.store.getSnapshot();
    const op: SemanticOperation = action === 'withdraw' ? { type: 'WITHDRAW', cueId: a, basis: [h.ref('s')] } :
      { type: 'REVISE', cueId: a, basis: [h.ref('s')], parts: action === 'revise' ? [h.asserted('assertion', 'fix')] : action === 'append' ? [h.part('student-extension', 's')] : [],
        removePartIds: action === 'delete' ? ['condition'] : [] };
    expect(() => h.accept([op], { readSet: { ...h.read(a), roles: { configured: 1, student: 1 } } })).toThrow(/teacher-grounded/);
    expect(h.store.getSnapshot()).toBe(before);
  });
  it('teacher correction and withdrawal are accepted with their own provenance', () => {
    const h = classroom(), a = h.create();
    h.accept([{ type: 'REVISE', cueId: a, basis: [h.ref('fix')], parts: [h.asserted('assertion', 'fix')], removePartIds: [] }],
      { readSet: { ...h.read(a), roles: { configured: 1 } } });
    expect(currentRevision(h.store.getSnapshot().cues[a]!).parts.map(p => p.partId)).toEqual(['assertion', 'condition']);
    h.accept([{ type: 'WITHDRAW', cueId: a, basis: [h.ref('fix')] }], { readSet: { ...h.read(a), roles: { configured: 1 } } });
    expect(currentRevision(h.store.getSnapshot().cues[a]!).standing).toBe('withdrawn');
  });
  it('classroom-domain relations require teacher basis and versioned role provenance', () => {
    const h = classroom(), a = h.create();
    const b = h.accept([{ type: 'CREATE', identityKey: 'B', parts: [h.part('b', 's')], basis: [h.ref('s')] }]).createdCueIds.B!;
    const relate = (source: string, withRole: boolean) => h.accept([{ type: 'RELATE', relation: { relationId: 'r', relationRevision: 1,
      fromCueId: a, toCueId: b, family: 'classroom_domain', kind: 'DEPENDS_ON', basisRefs: [h.ref(source)], assetRefs: [], status: 'current',
      dependencyReadSet: { ...h.read(a, b), ...(withRole ? { roles: { configured: 1 } } : {}) } } }],
      { readSet: { ...h.read(a, b), roles: { configured: 1 }, relations: { r: 0 } } });
    expect(() => relate('s', false)).toThrow(/teacher authority/);
    expect(() => relate('fix', false)).toThrow(/role provenance/);
    relate('fix', true);
    expect(h.store.getSnapshot().relations.r?.dependencyReadSet.roles).toEqual({ configured: 1 });
  });
});

it('replacement uses original positions, new EXTEND appends, removal closes the gap', () => {
  const h = fixtureHost(); h.record('one', 'two', 'three', 'new');
  const ref = binding(h.store.getSnapshot(), 'f4');
  const a = h.accept([{ type: 'CREATE', identityKey: 'A', parts: ['a', 'b', 'c'].map((id, i) => h.part(id, `f${i + 1}`)), basis: [ref] }]).createdCueIds.A!;
  h.accept([{ type: 'REVISE', cueId: a, parts: [{ ...h.part('C', 'f4'), replacesPartIds: ['c'] }, { ...h.part('A', 'f4'), replacesPartIds: ['a'] }], removePartIds: [], basis: [ref] }], { readSet: h.read(a) });
  const order = () => currentRevision(h.store.getSnapshot().cues[a]!).parts.map(p => p.partId);
  expect(order()).toEqual(['A', 'b', 'C']);
  h.accept([{ type: 'EXTEND', cueId: a, parts: [h.part('d', 'f4')], removePartIds: [], basis: [ref] }], { readSet: h.read(a) });
  expect(order()).toEqual(['A', 'b', 'C', 'd']);
  h.accept([{ type: 'REVISE', cueId: a, parts: [], removePartIds: ['b'], basis: [ref] }], { readSet: h.read(a) });
  expect(order()).toEqual(['A', 'C', 'd']);
  h.accept([{ type: 'REVISE', cueId: a, parts: [{ ...h.part('combined', 'f4'), replacesPartIds: ['d', 'A'] }], removePartIds: [], basis: [ref] }], { readSet: h.read(a) });
  expect(order()).toEqual(['combined', 'C']);
  expect(() => h.accept([{ type: 'EXTEND', cueId: a, parts: [{ ...h.part('oops', 'f4'), replacesPartIds: ['C'] }], removePartIds: [], basis: [ref] }], { readSet: h.read(a) })).toThrow(/EXTEND only/);
  expect(replayLesson(h.store.export())).toEqual(h.store.getSnapshot());
});

it('proposal identity compares payloads independent of object-key order, including after reload', () => {
  const h = fixtureHost(); h.record('A.');
  const original: SemanticProposal = { proposalId: 'same', origin: 'host', sessionId: 'fixture', sessionEpoch: 0,
    readSet: { processing: { f1: 0 } }, operations: [], processing: [{ kind: 'NO_CHANGE', ranges: [binding(h.store.getSnapshot(), 'f1')] }], policyVersion: 'alive-foundation-v1' };
  const event = h.store.accept(original, 1);
  expect(h.store.accept(Object.fromEntries(Object.entries(original).reverse()) as SemanticProposal, 2)).toBe(event);
  const restored = new LessonStore({ read: () => h.store.export(), append: () => { throw new Error('Should not append'); }, delete() {} });
  expect(restored.accept(original, 3)).toEqual(event);
  for (const store of [h.store, restored]) {
    expect(() => store.accept({ ...original, processing: [] }, 4)).toThrow(/identity reuse/);
    expect(() => store.accept({ ...original, origin: 'teacher' }, 4)).toThrow(/identity reuse/);
    expect(store.export().events).toHaveLength(2);
  }
});
