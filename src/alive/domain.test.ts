import { describe, expect, it, vi } from 'vitest';
import { accounting, binding, pendingBindings } from './evidence';
import { fixtureHost, foundationReplayFixture, sharedSourceFixture } from './fixtures';
import { browserJournal, LessonStore, memoryJournal, replayLesson, type LessonJournal } from './journal';
import { checkReadSet, currentRevision } from './reducer';
import { lookupLessonCues, matchesCueRevision, projectDisplay, semanticWorkingSet, sourceText } from './projection';
import type { CueContentPart, LessonHistory, SemanticProposal } from './types';

function seed() {
  const h = fixtureHost(); h.record('A is X.', 'Only when Y.', 'B is independent.');
  const a = h.accept([{ type: 'CREATE', identityKey: 'A', parts: [h.part('a', 'f1')], basis: [binding(h.store.getSnapshot(), 'f1')] }],
    { foreground: 'A', readSet: { attention: 0 } }).createdCueIds.A!;
  return { ...h, a, ref: (id = 'f1') => binding(h.store.getSnapshot(), id) };
}
function proposal(store: LessonStore, id = 'proposal'): SemanticProposal {
  const s = store.getSnapshot();
  return { proposalId: id, origin: 'host', sessionId: s.sessionId, sessionEpoch: s.sessionEpoch,
    readSet: {}, operations: [], processing: [], policyVersion: 'alive-foundation-v1' };
}

describe('persistent Cue identity and partial revision', () => {
  it('replays CREATE A → EXTEND A → CREATE B → RECALL A → REVISE A without A2 or lost conditions', () => {
    const { history, a, b } = foundationReplayFixture();
    const state = replayLesson(JSON.parse(JSON.stringify(history)));
    expect(Object.keys(state.cues)).toEqual([a, b]);
    expect(state.cues[a]!.revisions.map(r => r.revision)).toEqual([1, 2, 3]);
    expect(state.occurrences).toEqual([expect.objectContaining({ cueId: a, kind: 'RECALL' })]);
    expect(currentRevision(state.cues[a]!).parts.map(p => p.partId)).toEqual(['definition', 'condition']);
    expect(sourceText(state.cues[a]!)).toBe('Use Z instead of X. Only when Y.');
    expect(state.cues[b]!.development).toBe('open');
    expect(projectDisplay(state, 650)).toMatchObject({ currentCue: { id: a, sourceRevision: 3 }, previousCue: { id: b } });
    expect(projectDisplay(state, 999_999).previousCue).toBeNull();
    expect(Object.keys(state.cues)).toHaveLength(2);
  });
  it('settles and reopens without changing meaning; withdrawal appends history and cannot be resurrected', () => {
    const h = seed();
    for (const type of ['SETTLE', 'REOPEN'] as const) {
      const cue = h.store.getSnapshot().cues[h.a]!;
      h.accept([{ type, cueId: h.a, basis: [h.ref()] }], { readSet: { ...h.read(h.a), lifecycle: { [h.a]: cue.lastLifecycleEventId } } });
      expect(h.store.getSnapshot().cues[h.a]).toMatchObject({ cueId: h.a, currentSemanticRevision: 1, development: type === 'SETTLE' ? 'settled' : 'open' });
    }
    h.accept([{ type: 'WITHDRAW', cueId: h.a, basis: [h.ref()] }], { readSet: h.read(h.a) });
    const state = h.store.getSnapshot();
    expect(state.cues[h.a]!.revisions).toHaveLength(2);
    expect(currentRevision(state.cues[h.a]!).standing).toBe('withdrawn');
    expect(projectDisplay(state, 1_000).currentCue).toBeNull();
    expect(matchesCueRevision(state, h.a, 2)).toBe(false);
    expect(() => h.accept([{ type: 'REVISE', cueId: h.a, parts: [h.part('a', 'f2')], removePartIds: [], basis: [h.ref('f2')] }], { readSet: h.read(h.a) })).toThrow(/Withdrawn/);
  });
  it('rejects the same semantic identity even with different candidate evidence windows', () => {
    const h = seed();
    expect(() => h.accept([{ type: 'CREATE', identityKey: 'A', parts: [h.part('a', 'f1', 'f2')], basis: [h.ref('f2')] }])).toThrow(/identity already exists/);
    expect(Object.keys(h.store.getSnapshot().cues)).toHaveLength(1);
  });
  it('requires evidence for lifecycle changes; time alone cannot settle a Cue', () => {
    const h = seed(); const cue = h.store.getSnapshot().cues[h.a]!;
    expect(() => h.accept([{ type: 'SETTLE', cueId: h.a, basis: [] }], { readSet: { ...h.read(h.a), lifecycle: { [h.a]: cue.lastLifecycleEventId } } })).toThrow(/basis/);
    projectDisplay(h.store.getSnapshot(), 9_999_999);
    expect(h.store.getSnapshot().cues[h.a]!.development).toBe('open');
  });
});

describe('immutable evidence and separate processing/grounding', () => {
  it('records duplicate provider identity once, rejects changed payloads, keeps identical text with a new identity', () => {
    const h = fixtureHost(); const f = { id: 'f1', text: 'Same words.', startMs: 0, endMs: 0 };
    h.accept([{ type: 'RECORD_EVIDENCE', fragments: [f, f, { ...f, id: 'f2' }] }]);
    expect(h.store.getSnapshot().evidenceOrder).toEqual(['f1', 'f2']);
    expect(() => h.accept([{ type: 'RECORD_EVIDENCE', fragments: [{ ...f, text: 'Changed' }] }])).toThrow(/reused/);
    expect(h.store.getSnapshot().evidence.f1?.text).toBe('Same words.');
    f.text = 'External mutation'; expect(h.store.getSnapshot().evidence.f1?.text).toBe('Same words.');
  });
  it('WAIT remains unresolved and NO_CHANGE accounts understood evidence without creating a Cue', () => {
    const h = fixtureHost(); h.record('If the condition…'); const ref = binding(h.store.getSnapshot(), 'f1');
    h.accept([], { readSet: { processing: { f1: 0 } }, processing: [{ kind: 'WAIT', ranges: [ref] }] });
    expect(semanticWorkingSet(h.store.getSnapshot()).unresolvedTail).toEqual([ref]);
    expect(accounting(h.store.getSnapshot()).accountedFrontier).toBe(0);
    h.accept([], { readSet: { processing: { f1: 1 } }, processing: [{ kind: 'NO_CHANGE', ranges: [ref] }] });
    expect(accounting(h.store.getSnapshot())).toMatchObject({ accountedFrontier: 1, accountedCodeUnits: ref.quote.length });
    expect(Object.keys(h.store.getSnapshot().cues)).toEqual([]);
  });
  it('deferred unresolved speech does not block later independent content and survives reload', () => {
    const h = fixtureHost(); h.record('If that…', 'B is independent.');
    const ref = (id: string) => binding(h.store.getSnapshot(), id);
    h.accept([{ type: 'DEFER', deferredId: 'd1', ranges: [ref('f1')], reason: 'Missing referent', relatedCueIds: [] }], { readSet: { processing: { f1: 0 } } });
    h.accept([{ type: 'CREATE', identityKey: 'B', parts: [h.part('b', 'f2')], basis: [ref('f2')] }],
      { readSet: { processing: { f2: 0 } }, processing: [{ kind: 'ACCOUNT', ranges: [ref('f2')] }] });
    const replay = replayLesson(JSON.parse(JSON.stringify(h.store.export())));
    expect(replay).toEqual(h.store.getSnapshot());
    expect(replay.deferred.d1?.status).toBe('open');
    expect(replay.processing.f2?.ranges[0]?.status).toBe('accounted');
    h.accept([{ type: 'RESOLVE_DEFERRED', deferredId: 'd1', status: 'resolved', basis: [ref('f2')] }],
      { readSet: { deferred: { d1: 1 }, processing: { f1: 1 } } });
    expect(h.store.getSnapshot().deferred.d1?.status).toBe('resolved');
    expect(accounting(h.store.getSnapshot()).accountedFrontier).toBe(2);
  });
  it('the same source grounds two distinct Cues while processing is counted once', () => {
    const { history, a, b } = sharedSourceFixture(); const state = replayLesson(history);
    expect(sourceText(state.cues[a]!)).toBe(sourceText(state.cues[b]!));
    expect(accounting(state).accountedCodeUnits).toBe(state.evidence.f1!.text.length);
    expect(state.cues[a]!.cueId).not.toBe(state.cues[b]!.cueId);
  });
  it('allows already-accounted sources for recall/grounding but rejects double consumption', () => {
    const h = seed();
    h.accept([], { readSet: { processing: { f1: 0 } }, processing: [{ kind: 'NO_CHANGE', ranges: [h.ref()] }] });
    h.accept([{ type: 'CREATE', identityKey: 'different-question', parts: [h.part('question', 'f1')], basis: [h.ref()] }]);
    expect(() => h.accept([], { readSet: { processing: { f1: 1 } }, processing: [{ kind: 'ACCOUNT', ranges: [h.ref()] }] })).toThrow(/already accounted/);
    expect(accounting(h.store.getSnapshot()).accountedCodeUnits).toBe(h.ref().quote.length);
  });
  it('preserves UTF-16 original ranges, rejects surrogate splits, and spans Finals', () => {
    const h = fixtureHost(); h.record('  中🧪é  ', 'only if Y');
    const state = h.store.getSnapshot();
    expect(binding(state, 'f1', 2, 5).quote).toBe('中🧪');
    expect(() => binding(state, 'f1', 2, 4)).toThrow(/range/);
    expect(() => binding(state, 'f1', 4, 5)).toThrow(/range/);
    const event = h.accept([{ type: 'CREATE', identityKey: 'A', parts: [h.part('a', 'f1', 'f2')], basis: [binding(state, 'f1')] }]);
    expect(sourceText(h.store.getSnapshot().cues[event.createdCueIds.A!]!)).toBe('  中🧪é   only if Y');
    expect(h.store.getSnapshot().evidence.f1?.text).toBe('  中🧪é  ');
  });
  it('tracks partial processing coverage without consuming the other part of a Final', () => {
    const h = fixtureHost(); h.record('A. B.');
    h.accept([], { readSet: { processing: { f1: 0 } }, processing: [{ kind: 'NO_CHANGE', ranges: [binding(h.store.getSnapshot(), 'f1', 0, 2)] }] });
    expect(pendingBindings(h.store.getSnapshot()).map(r => r.quote)).toEqual([' B.']);
    expect(accounting(h.store.getSnapshot()).accountedCodeUnits).toBe(2);
  });
});

describe('atomic acceptance and dependency isolation', () => {
  it('duplicate proposalId is idempotent, including after reload', () => {
    const journal = memoryJournal('session'); const store = new LessonStore(journal);
    const p = proposal(store); const first = store.accept(p, 1);
    expect(store.accept(p, 2)).toBe(first);
    const restored = new LessonStore(journal);
    expect(restored.accept(p, 3)).toEqual(first);
    expect(restored.export().events).toHaveLength(1);
  });
  it('rejects stale and missing Cue revisions but not an unrelated B mutation', () => {
    const h = seed(); const captured = h.read(h.a);
    const b = h.accept([{ type: 'CREATE', identityKey: 'B', parts: [h.part('b', 'f3')], basis: [h.ref('f3')] }]).createdCueIds.B!;
    h.accept([{ type: 'REVISE', cueId: b, parts: [h.part('b', 'f2')], removePartIds: [], basis: [h.ref('f2')] }], { readSet: h.read(b) });
    expect(() => checkReadSet(h.store.getSnapshot(), captured)).not.toThrow();
    h.accept([{ type: 'EXTEND', cueId: h.a, parts: [h.part('condition', 'f2')], removePartIds: [], basis: [h.ref('f2')] }], { readSet: captured });
    expect(() => h.accept([{ type: 'MENTION', cueId: h.a, basis: [h.ref()] }], { readSet: captured })).toThrow(/Stale/);
    expect(() => h.accept([{ type: 'MENTION', cueId: h.a, basis: [h.ref()] }])).toThrow(/Missing Cue/);
  });
  it('rejects a stale session and disallowed LLM/role operations', () => {
    const h = seed();
    expect(() => h.accept([], { sessionEpoch: 1 })).toThrow(/epoch/);
    expect(() => h.accept([{ type: 'MENTION', cueId: h.a, basis: [h.ref()] }], { origin: 'llm', readSet: h.read(h.a) })).toThrow(/not enabled/);
    expect(() => h.accept([{ type: 'SETTLE', cueId: h.a, basis: [h.ref()] }], { origin: 'jev', readSet: h.read(h.a) })).toThrow(/not enabled/);
  });
  it('does not publish any operation or processing effect when persistence fails', () => {
    const backing = memoryJournal('session'); let fail = false;
    const journal: LessonJournal = { ...backing, append: (e, n) => { if (fail) throw new Error('disk full'); backing.append(e, n); } };
    const store = new LessonStore(journal);
    store.accept({ ...proposal(store, 'capture'), operations: [{ type: 'RECORD_EVIDENCE', fragments: [{ id: 'f', text: 'A.', startMs: 0, endMs: 1 }] }] }, 0);
    const before = store.getSnapshot(); fail = true;
    expect(() => store.accept({ ...proposal(store), readSet: { processing: { f: 0 } }, processing: [{ kind: 'NO_CHANGE', ranges: [binding(before, 'f')] }] }, 1)).toThrow(/disk full/);
    expect(store.getSnapshot()).toBe(before); expect(store.export().events).toHaveLength(1);
  });
  it('keeps check and write indivisible under a deterministic persistence reentrancy race', () => {
    const backing = memoryJournal('session'); let store: LessonStore; let competing: SemanticProposal;
    const race = vi.fn();
    store = new LessonStore({ ...backing, append(e, n) {
      if (competing) { try { store.accept(competing, 2); } catch (error) { race(error); } }
      backing.append(e, n);
    } });
    competing = proposal(store, 'competitor'); store.accept(proposal(store, 'winner'), 1);
    expect(race).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('in progress') }));
    expect(store.export().events.map(e => e.proposalId)).toEqual(['winner']);
  });
  it('serializes competing captured writes: one succeeds, the stale one cannot partially commit', async () => {
    const h = seed(); const readSet = h.read(h.a);
    const update = { type: 'REVISE' as const, cueId: h.a, parts: [h.part('a', 'f2')], removePartIds: [], basis: [h.ref('f2')] };
    const results = await Promise.allSettled([Promise.resolve().then(() => h.accept([update], { readSet })), Promise.resolve().then(() => h.accept([update], { readSet }))]);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(h.store.getSnapshot().cues[h.a]!.currentSemanticRevision).toBe(2);
  });
  it('recovers a persisted event when only its acknowledgement failed', () => {
    const backing = memoryJournal('session');
    const store = new LessonStore({ ...backing, append(e, n) { backing.append(e, n); throw new Error('ack lost'); } });
    const p = proposal(store); store.accept(p, 1); store.accept(p, 2);
    expect(store.export().events).toHaveLength(1); expect(store.getSnapshot().sequence).toBe(1);
  });
  it('rejects the entire group on an invalid range instead of publishing a partial Cue', () => {
    const h = seed(); const before = h.store.getSnapshot();
    expect(() => h.accept([
      { type: 'CREATE', identityKey: 'B', parts: [h.part('b', 'f3')], basis: [h.ref('f3')] },
      { type: 'MENTION', cueId: h.a, basis: [{ ...h.ref(), quote: 'forged' }] },
    ], { readSet: h.read(h.a) })).toThrow(/quote/);
    expect(h.store.getSnapshot()).toBe(before);
  });
});

describe('relations, source roles, and adoption', () => {
  it('replays relations and lifecycle; revision of an endpoint requires relation review without withdrawing the other Cue', () => {
    const h = seed(); const b = h.accept([{ type: 'CREATE', identityKey: 'B', parts: [h.part('b', 'f3')], basis: [h.ref('f3')] }]).createdCueIds.B!;
    h.accept([{ type: 'RELATE', relation: { relationId: 'r', relationRevision: 1, fromCueId: b, toCueId: h.a,
      family: 'classroom_discourse', kind: 'EXAMPLE_OF', basisRefs: [h.ref('f3')], assetRefs: [], dependencyReadSet: h.read(h.a, b), status: 'current' } }],
      { readSet: { ...h.read(h.a, b), relations: { r: 0 } } });
    h.accept([{ type: 'SETTLE', cueId: b, basis: [h.ref('f3')] }], { readSet: { ...h.read(b), lifecycle: { [b]: h.store.getSnapshot().cues[b]!.lastLifecycleEventId } } });
    expect(h.store.getSnapshot().relations.r?.status).toBe('current');
    h.accept([{ type: 'REVISE', cueId: h.a, parts: [h.part('a', 'f2')], removePartIds: [], basis: [h.ref('f2')] }], { readSet: h.read(h.a) });
    const restored = replayLesson(JSON.parse(JSON.stringify(h.store.export())));
    expect(restored).toEqual(h.store.getSnapshot());
    expect(restored.relations.r).toMatchObject({ status: 'needs_review', relationRevision: 2 });
    expect(restored.cues[b]).toMatchObject({ development: 'settled', currentSemanticRevision: 1 });
    expect(() => checkReadSet(restored, { relations: { r: 1 } })).toThrow(/Stale/);
  });
  it('unknown speakers cannot authorize assertions; questions, hypotheses, and criticised examples retain stance', () => {
    const h = fixtureHost(); h.record('Could X be true?');
    for (const stance of ['question', 'hypothetical', 'quoted_example', 'criticised_example']) {
      const e = h.accept([{ type: 'CREATE', identityKey: stance, parts: [{ ...h.part('p', 'f1'), stance }], basis: [binding(h.store.getSnapshot(), 'f1')] }]);
      expect(currentRevision(h.store.getSnapshot().cues[e.createdCueIds[stance]!]!).parts[0]?.stance).toBe(stance);
    }
    expect(() => h.accept([{ type: 'CREATE', identityKey: 'claim', parts: [{ ...h.part('p', 'f1'), stance: 'asserted' }], basis: [binding(h.store.getSnapshot(), 'f1')] }])).toThrow(/authority/);
    expect(Object.values(h.store.getSnapshot().roles)).toEqual([]);
  });
  it('adopts only the teacher-confirmed part of student speech and replays exact dual provenance', () => {
    const h = fixtureHost();
    h.accept([{ type: 'RECORD_EVIDENCE', fragments: [
      { id: 's', text: 'X and Y', speakerId: 'S2', startMs: 0, endMs: 1 },
      { id: 't', text: 'X is right; Y is not.', speakerId: 'S1', startMs: 1, endMs: 2 },
    ] }]);
    const ref = (id: string, start?: number, end?: number) => binding(h.store.getSnapshot(), id, start, end);
    h.accept(['s', 't'].map((id, index) => ({ type: 'BIND_ROLE' as const, binding: {
      bindingId: id, revision: 1, speakerId: index === 0 ? 'S2' : 'S1', role: index === 0 ? 'student' as const : 'teacher' as const,
      basis: 'configured' as const, basisRefs: ['teacher-configuration'], sourceRanges: [ref(id)],
    } })), { readSet: { roles: { s: 0, t: 0 } } });
    const question: CueContentPart = { ...h.part('answer', 's'), stance: 'question', roleBindingRefs: ['s'] };
    const a = h.accept([{ type: 'CREATE', identityKey: 'A', parts: [question], basis: [ref('s')] }], { readSet: { roles: { s: 1 } } }).createdCueIds.A!;
    h.accept([{ type: 'ADOPT', adoption: { adoptionId: 'adopt-x', contributionSourceRefs: [ref('s')], teacherEvidenceRefs: [ref('t')],
      adoptedRanges: [ref('s', 0, 1)], excludedRanges: [ref('s', 6, 7)], targetCueParts: [{ cueId: a, partId: 'answer' }], roleBindingRefs: ['s', 't'] } },
    { type: 'REVISE', cueId: a, parts: [{ ...question, stance: 'asserted', sourceBindings: [ref('s', 0, 1)], adoptionIds: ['adopt-x'] } as CueContentPart], removePartIds: [], basis: [ref('t')] }],
    { readSet: { ...h.read(a), roles: { s: 1, t: 1 } } });
    expect(sourceText(h.store.getSnapshot().cues[a]!)).toBe('X');
    const working = semanticWorkingSet(h.store.getSnapshot(), { explicitCueIds: [a] });
    expect(working.roles.map(role => role.bindingId)).toEqual(['s', 't']);
    expect(working.evidence.map(e => e.id)).toEqual(['s', 't']);
    expect(working.adoptions[0]?.adoptedRanges.map(ref => ref.quote)).toEqual(['X']);
    expect(replayLesson(JSON.parse(JSON.stringify(h.store.export())))).toEqual(h.store.getSnapshot());
    expect(() => h.accept([{ type: 'REVISE', cueId: a, parts: [{ ...question, stance: 'asserted', adoptionIds: ['adopt-x'] }], removePartIds: [], basis: [ref('t')] }],
      { readSet: { ...h.read(a), roles: { s: 1, t: 1 } } })).toThrow(/authority/);
  });
});

describe('working set and portable recovery', () => {
  it('recovers an older Cue after ten minutes without a new identity, with explicit coverage', () => {
    const { history, a, b } = foundationReplayFixture(); const state = replayLesson(history);
    expect(lookupLessonCues(state, 'Only when Y').map(c => c.cueId)).toEqual([a]);
    const set = semanticWorkingSet(state, { recalledCueIds: [a], maxCues: 1, maxEvidenceCodeUnits: 1_000 });
    expect(set.cues.map(c => c.cueId)).toEqual([a]);
    expect(set.coverage.omittedCueIds).toContain(b);
    expect(set.cues[0]!.currentSemanticRevision).toBe(3);
    expect(semanticWorkingSet(state, { explicitCueIds: [a], maxEvidenceCodeUnits: 1 }).coverage.contextBlocked).toBe(true);
    expect(semanticWorkingSet(state, { explicitCueIds: ['absent'] }).coverage.missingExplicitCueIds).toEqual(['absent']);
  });
  it('replay has no provider dependency and rejects damaged event order/version results', () => {
    const originalFetch = globalThis.fetch; globalThis.fetch = vi.fn(() => { throw new Error('No network during replay'); });
    try {
      const { history } = foundationReplayFixture(); const loaded: LessonHistory = JSON.parse(JSON.stringify(history));
      expect(replayLesson(loaded)).toEqual(replayLesson(history));
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(() => replayLesson({ ...loaded, events: [...loaded.events].reverse() })).toThrow(/order/);
      expect(() => replayLesson({ ...loaded, events: [{ ...loaded.events[0]!, resultingVersions: {} }] })).toThrow(/version/);
    } finally { globalThis.fetch = originalFetch; }
  });
  it('reloads tab storage, fails closed on quota, and deletion blocks late writes', () => {
    const data = new Map<string, string>(); let fail = false;
    const storage = { getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { if (fail) throw new Error('Quota exceeded'); data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); } } as Storage;
    const store = new LessonStore(browserJournal('session', 0, storage));
    store.accept(proposal(store), 1);
    expect(new LessonStore(browserJournal('session', 0, storage)).getSnapshot()).toEqual(store.getSnapshot());
    fail = true; expect(() => store.accept(proposal(store, 'fail'), 2)).toThrow(/Quota/);
    expect(store.getSnapshot().sequence).toBe(1);
    store.delete(); expect(data.size).toBe(0);
    expect(() => store.accept({ ...proposal(store), sessionEpoch: 0 }, 3)).toThrow(/unavailable/);
  });
});

it('persists an exact selected Asset version separately from what the teacher said', () => {
  const h = fixtureHost();
  h.accept([{ type: 'RECORD_EVIDENCE', fragments: [{ id: 't', text: 'Use the standard definition here.', speakerId: 'teacher-channel', startMs: 0, endMs: 1 }] }]);
  const ref = binding(h.store.getSnapshot(), 't');
  h.accept([{ type: 'BIND_ROLE', binding: { bindingId: 'teacher', revision: 1, speakerId: 'teacher-channel', role: 'teacher',
    basis: 'configured', basisRefs: ['session-config'], sourceRanges: [ref] } }], { readSet: { roles: { teacher: 0 } } });
  const assetRef = { packId: 'chemistry', releaseId: 'r13', assetId: 'definition', assetVersion: '3', digest: 'sha256:fixture' };
  const e = h.accept([{ type: 'CREATE', identityKey: 'selected-definition', basis: [ref], parts: [{
    partId: 'definition', content: 'selected_asset', assetRef, selectedText: 'Selected reference wording.',
    stance: 'asserted', establishmentEvidence: [ref], roleBindingRefs: ['teacher'], adoptionIds: [],
  }] }], { readSet: { roles: { teacher: 1 } } });
  const cue = replayLesson(h.store.export()).cues[e.createdCueIds['selected-definition']!]!;
  expect(currentRevision(cue).parts[0]).toMatchObject({ assetRef });
  expect(sourceText(cue)).toBe('Selected reference wording.');
  expect(h.store.getSnapshot().evidence.t?.text).toBe('Use the standard definition here.');
});

it('requires current role revisions and omits relations whose endpoints do not fit the bounded Working Set', () => {
  const h = seed();
  const b = h.accept([{ type: 'CREATE', identityKey: 'B', parts: [h.part('b', 'f3')], basis: [h.ref('f3')] }]).createdCueIds.B!;
  h.accept([{ type: 'RELATE', relation: { relationId: 'r', relationRevision: 1, fromCueId: b, toCueId: h.a,
    family: 'classroom_discourse', kind: 'REFERENCES', basisRefs: [h.ref('f3')], assetRefs: [], dependencyReadSet: h.read(h.a, b), status: 'current' } }],
    { readSet: { ...h.read(h.a, b), relations: { r: 0 } } });
  const working = semanticWorkingSet(h.store.getSnapshot(), { explicitCueIds: [b], maxCues: 1 });
  expect(working.cues.map(cue => cue.cueId)).toEqual([b]);
  expect(working.coverage.contextBlocked).toBe(false);
  expect(working.coverage.omittedRelationIds).toEqual(['r']);
  expect(working.readSet.relations).toEqual({});
  expect(() => checkReadSet(h.store.getSnapshot(), { roles: { unknown: 1 } })).toThrow(/Stale/);
});
