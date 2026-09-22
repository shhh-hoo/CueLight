import { describe, expect, it, vi } from 'vitest';
import { CueEngine } from '../cue/cue-engine';
import { accounting, binding, pendingBindings } from './evidence';
import { fixtureHost } from './fixtures';
import { buildSemanticRequest, captureInspection, captureRelation, compileProposal, operationCandidates, parseSemanticJudgment,
  validateSemanticInput, type OperationCandidate, type SemanticInput, type SemanticJudgment, type SemanticTrace } from './inspection';
import { mockJudgmentResponse } from './inspection-fixtures';
import { InspectionSuspensions, MAX_SUSPENSIONS } from './inspection-suspension';
import { semanticWorkingSet } from './projection';
import { currentRevision } from './reducer';
import type { EvidenceBinding } from './types';

const judge = (input: SemanticInput, select: (c: OperationCandidate) => boolean, relation = 'NONE') =>
  parseSemanticJudgment(mockJudgmentResponse(input, select, 'asserted', relation), input);
function classroom() {
  const h = fixtureHost('stabilization');
  h.accept([{ type: 'BIND_ROLE', binding: { bindingId: 'teacher', revision: 1, subject: { kind: 'capture', id: 'stabilization' },
    role: 'teacher', basis: 'configured', basisRefs: ['teacher-mic'], sourceRanges: [] } }], { readSet: { roles: { teacher: 0 } } });
  const record = (text: string) => { h.record(text); return binding(h.store.getSnapshot(), h.store.getSnapshot().evidenceOrder.at(-1)!); };
  const part = (id: string, ref: EvidenceBinding) => ({ ...h.part(id, ref.evidenceId), roleBindingRefs: ['teacher'], stance: 'asserted' });
  const create = (name: string, foreground = true) => {
    const ref = record(`${name} definition.`), s = h.store.getSnapshot();
    return h.accept([{ type: 'CREATE', identityKey: name, parts: [part('p1', ref)], basis: [ref] }], {
      ...(foreground ? { foreground: name } : {}), readSet: { roles: { teacher: 1 }, processing: { [ref.evidenceId]: 0 }, attention: s.attention.revision },
      processing: [{ kind: 'ACCOUNT', ranges: [ref] }] }).createdCueIds[name]!;
  };
  const revise = (cueId: string, partId = 'p1') => {
    const ref = record(`${partId} corrected.`);
    return h.accept([{ type: 'REVISE', cueId, parts: [part(partId, ref)], removePartIds: [], basis: [ref] }], {
      readSet: { ...h.read(cueId), roles: { teacher: 1 }, processing: { [ref.evidenceId]: 0 } }, processing: [{ kind: 'ACCOUNT', ranges: [ref] }] });
  };
  const relate = (from: string, to: string, id: string) => {
    const ref = binding(h.store.getSnapshot(), h.store.getSnapshot().evidenceOrder.at(-1)!);
    return h.accept([{ type: 'RELATE', relation: { relationId: id, relationRevision: 1, fromCueId: from, toCueId: to,
      family: 'classroom_discourse', kind: 'CONTRASTS_WITH', basisRefs: [ref], assetRefs: [], dependencyReadSet: h.read(from, to), status: 'current' } }],
    { readSet: { ...h.read(from, to), relations: { [id]: 0 } } });
  };
  const wait = (ref: EvidenceBinding) => h.accept([], { readSet: { processing: { [ref.evidenceId]: h.store.getSnapshot().processing[ref.evidenceId]!.revision } },
    processing: [{ kind: 'WAIT', ranges: [ref] }] });
  return { ...h, record, create, revise, relate, wait };
}
function engineFor(inspect: (input: SemanticInput) => Promise<SemanticJudgment>) {
  const engine = new CueEngine({ inspect }); engine.configureTeacherCapture(engine.getSnapshot().lesson.sessionId);
  const traces: SemanticTrace[] = []; engine.observeSemantics(t => traces.push(t));
  const add = async (id: string, text: string) => { engine.accept({ id, text, startMs: 0, endMs: 1 }); await engine.drain(); };
  return { engine, traces, add };
}

describe('bounded relevance and allocation', () => {
  it.each(['revision', 'mention'] as const)('keeps C9 after a recent %s ahead of old open Cues in a ten-Cue lesson', kind => {
    const h = classroom(), ids = Array.from({ length: 10 }, (_, i) => h.create(`C${i + 1}`));
    if (kind === 'revision') h.revise(ids[8]!);
    else h.accept([{ type: 'MENTION', cueId: ids[8]!, basis: [binding(h.store.getSnapshot(), 'f9')] }], { readSet: h.read(ids[8]!) });
    const set = semanticWorkingSet(h.store.getSnapshot(), { maxCues: 8 });
    expect(set.cues.map(c => c.cueId).slice(0, 2)).toEqual([ids[9], ids[8]]);
    expect(set.cues).toHaveLength(8); expect(set.coverage.omittedCueIds).toContain(ids[0]);
    expect(semanticWorkingSet(h.store.getSnapshot(), { explicitCueIds: [ids[0]!], maxCues: 8 }).cues[0]?.cueId).toBe(ids[0]);
  });
  it('uses accepted ordering for settled Cues even when timestamps and insertion order are misleading', () => {
    const h = classroom(), a = h.create('A'), b = h.create('B');
    h.accept([{ type: 'SETTLE', cueId: a, basis: [binding(h.store.getSnapshot(), 'f1')] }, { type: 'SETTLE', cueId: b, basis: [binding(h.store.getSnapshot(), 'f2')] }], { readSet: { ...h.read(a, b), lifecycle: Object.fromEntries([a, b].map(id => [id, h.store.getSnapshot().cues[id]!.lastLifecycleEventId])) } });
    h.revise(a);
    const state = h.store.getSnapshot();
    const set = semanticWorkingSet({ ...state, attention: { ...state.attention, currentCueId: null } });
    expect(set.cues.map(c => c.cueId)).toEqual([a, b]);
  });
  it('targets recently established and later modified P6 while retaining explicit part priority', () => {
    const h = classroom(), a = h.create('A');
    for (let i = 2; i <= 6; i++) h.revise(a, `p${i}`);
    h.record('That last condition was wrong.');
    let input = captureInspection(h.store.getSnapshot(), 'recent')!;
    expect(input.workingSet.partTargetOrder[a]?.[0]).toBe('p6');
    expect(operationCandidates(input).candidates.some(c => c.mode === 'replace' && c.partId === 'p6')).toBe(true);
    h.revise(a, 'p5'); h.revise(a, 'p6');
    input = captureInspection(h.store.getSnapshot(), 'modified', { explicitPartIds: { [a]: ['p1'] } })!;
    expect(input.workingSet.partTargetOrder[a]?.slice(0, 3)).toEqual(['p1', 'p6', 'p5']);
    expect(operationCandidates(input).coverage.omittedParts).toHaveLength(2);
    expect(currentRevision(h.store.getSnapshot().cues[a]!).parts.map(p => p.partId)).toEqual(['p1','p2','p3','p4','p5','p6']);
  });
  it('does not let ancient modifications crowd out the newest established condition', () => {
    const h = classroom(), a = h.create('A');
    for (let i = 2; i <= 5; i++) h.revise(a, `p${i}`);
    for (let i = 1; i <= 4; i++) h.revise(a, `p${i}`);
    h.revise(a, 'p6'); h.record('That last condition was wrong.');
    const input = captureInspection(h.store.getSnapshot(), 'latest-established')!;
    expect(input.workingSet.partTargetOrder[a]?.[0]).toBe('p6');
    expect(operationCandidates(input).candidates.some(c => c.partId === 'p6' && c.mode === 'replace')).toBe(true);
  });
  it('allocates three sources and eight Cues fairly within 128, with exact omission counts', () => {
    const h = classroom();
    for (let i = 0; i < 8; i++) { const id = h.create(`C${i}`); for (let p = 2; p <= 6; p++) h.revise(id, `p${p}`); }
    h.wait(h.record('Only if')); h.wait(h.record('Provided that')); h.record('New completion.');
    const input = captureInspection(h.store.getSnapshot(), 'balanced')!;
    expect(input.sources).toHaveLength(3);
    const { candidates, coverage } = operationCandidates(input);
    expect(candidates).toHaveLength(128);
    expect(coverage.omittedOperations).toHaveLength(169); // 9 basic + 96 Cue + 192 part = 297.
    expect(coverage.omittedParts).toHaveLength(16);
    for (const source of input.sources) {
      const options = candidates.filter(c => c.source.alias === source.alias);
      for (const action of ['WAIT', 'NO_CHANGE', 'CREATE', 'RECALL', 'WITHDRAW', 'RELATION_INTENT']) expect(options.some(c => c.action === action)).toBe(true);
      expect(options.filter(c => c.mode === 'append')).toHaveLength(8);
      expect(options.some(c => c.mode === 'replace')).toBe(true);
    }
    expect(coverage).toMatchObject({ contextComplete: true, candidateComplete: false, complete: false, contextBlocked: false });
    expect(buildSemanticRequest(input).state.coverage).toMatchObject({ contextComplete: true, candidateComplete: false, complete: false, omittedOperationCount: 169 });
    expect(() => validateSemanticInput(input)).not.toThrow();
    expect(operationCandidates({ ...input, stage: 'relation', sources: [input.sources[0]!], relationFromCueId: input.workingSet.cues[0]!.cueId }).candidates).toHaveLength(36);
    expect(() => validateSemanticInput({ ...input, stage: 'relation', relationFromCueId: input.workingSet.cues[0]!.cueId, parentInspectionId: 'parent' })).toThrow(/relation source\/origin bounds/);
    const overflow = { ...input, sources: Array.from({ length: 43 }, (_, i) => ({ ...input.sources[0]!, alias: `S${i + 1}` })) };
    expect(operationCandidates(overflow)).toMatchObject({ candidates: [], coverage: { mandatoryOverflow: true, contextBlocked: true, candidateComplete: false } });
  });
  it('reports omitted continuation alternatives without joining independent WAIT tails', () => {
    const h = classroom(); h.wait(h.record('A if')); h.wait(h.record('B if')); h.record('First. Second.');
    const input = captureInspection(h.store.getSnapshot(), 'tails')!;
    expect(input.sources.map(s => s.ranges.length)).toEqual([1, 1, 2]);
    expect(input.omittedSourceAlternatives).toHaveLength(1);
    expect(operationCandidates(input).coverage.omittedSourceAlternatives).toHaveLength(1);
    expect(operationCandidates(input).coverage).toMatchObject({ candidateComplete: false, complete: false });
  });
  it('omits oversized optional relation provenance without displacing the primary source', () => {
    const h = classroom(), a = h.create('A'), b = h.create('B');
    const ref = h.record('Long relation explanation. '.repeat(30));
    h.relate(a, b, 'large');
    h.accept([], { readSet: { processing: { [ref.evidenceId]: 0 } }, processing: [{ kind: 'ACCOUNT', ranges: [ref] }] });
    h.record('Clarify A.');
    const input = captureInspection(h.store.getSnapshot(), 'large-context', { explicitCueIds: [a], maxEvidenceCodeUnits: 256 })!;
    expect(input.workingSet.coverage).toMatchObject({ omittedRelationIds: ['large'], contextBlocked: false, contextComplete: false });
    expect(() => validateSemanticInput(input)).not.toThrow();
    expect(() => validateSemanticInput({ ...input, workingSet: { ...input.workingSet, coverage: { ...input.workingSet.coverage, contextComplete: true } } })).toThrow(/coverage/);
  });
  it('does not block clarification solely because its Cue has more neighbors than the budget', () => {
    const h = classroom(), a = h.create('A');
    for (let i = 0; i < 12; i++) { const b = h.create(`B${i}`); h.relate(a, b, `r${i}`); }
    h.record('Clarify A.');
    const input = captureInspection(h.store.getSnapshot(), 'hub', { explicitCueIds: [a] })!;
    expect(input.workingSet.cues).toHaveLength(8);
    expect(input.workingSet.relations).toHaveLength(7); // A and seven neighbors fit; the other five relations are omitted.
    expect(input.workingSet.coverage.contextBlocked).toBe(false);
    expect(input.workingSet.coverage.omittedRelationIds.length).toBeGreaterThan(0);
    expect(() => validateSemanticInput(input)).not.toThrow();
    expect(operationCandidates(input).candidates.some(c => c.action === 'REVISE' && c.cueId === a)).toBe(true);
  });
});

describe('provider-visible dependency snapshot', () => {
  it('rejects changes to a visible comparison Cue even when another Cue was selected', () => {
    const h = classroom(), a = h.create('A'), b = h.create('B'); h.record('A clarification.');
    const input = captureInspection(h.store.getSnapshot(), 'comparison')!;
    const proposal = compileProposal(input, judge(input, c => c.cueId === a && c.mode === 'append'));
    expect(proposal.readSet.attention).toBeUndefined();
    h.revise(b);
    expect(() => h.store.accept(proposal, 0)).toThrow(/Stale cues/);
  });
  it('allows a hidden Cue to change without invalidating visible-only work', () => {
    const h = classroom(), a = h.create('A'), b = h.create('B'); h.record('A clarification.');
    const input = captureInspection(h.store.getSnapshot(), 'hidden', { explicitCueIds: [a], maxCues: 1 })!;
    const proposal = compileProposal(input, judge(input, c => c.cueId === a && c.mode === 'append'));
    h.revise(b);
    expect(() => h.store.accept(proposal, 0)).not.toThrow();
  });
  it('binds visible relation versions and every supplied source processing alternative', () => {
    const h = classroom(), a = h.create('A'), b = h.create('B'); h.relate(a, b, 'r');
    const tail = h.record('Only if'); h.wait(tail); h.record('Independent.');
    const input = captureInspection(h.store.getSnapshot(), 'all-sources')!;
    const proposal = compileProposal(input, judge(input, c => c.action === 'NO_CHANGE' && c.source.alias === 'S1'));
    expect(proposal.readSet.relations).toEqual({ r: 1 });
    expect(proposal.readSet.processing).toHaveProperty(tail.evidenceId);
    h.wait(tail);
    expect(() => h.store.accept(proposal, 0)).toThrow(/Stale processing/);
    const again = captureInspection(h.store.getSnapshot(), 'relation-version')!;
    const relationProposal = compileProposal(again, judge(again, c => c.action === 'NO_CHANGE'));
    const old = h.store.getSnapshot().relations.r!;
    h.accept([{ type: 'RELATE', relation: { ...old, relationRevision: 2, kind: 'REFERENCES' } }], { readSet: { ...h.read(a, b), relations: { r: 1 } } });
    expect(() => h.store.accept(relationProposal, 0)).toThrow(/Stale relations/);
  });
});

describe('suspension and fresh recapture', () => {
  it('WAIT stays suspended across idle and unrelated input; continuation context remains supplied', async () => {
    const inspect = vi.fn(async (input: SemanticInput) => judge(input, c => c.source.alias === 'S1' && c.action === (input.sources[0]!.ranges[0]!.quote === 'Only if' ? 'WAIT' : 'CREATE')));
    const { engine, add } = engineFor(inspect);
    await add('a', 'Only if'); await engine.drain(); expect(inspect).toHaveBeenCalledTimes(1);
    await add('b', 'Unrelated.'); await add('c', 'Still unrelated.');
    expect(inspect).toHaveBeenCalledTimes(3);
    expect(inspect.mock.calls[1]![0].sources.some(s => s.ranges.map(r => r.evidenceId).join(',') === 'a,b')).toBe(true);
    expect(engine.getSnapshot().lesson.processing.a?.ranges[0]?.status).toBe('wait'); engine.dispose();
  });
  it('resolves A + new while independent WAIT B remains suspended', async () => {
    const { engine, add, traces } = engineFor(async input => judge(input, c => input.sources[0]!.ranges[0]!.evidenceId === 'c'
      ? c.action === 'CREATE' && c.source.ranges.map(r => r.evidenceId).join(',') === 'a,c'
      : c.action === 'WAIT' && c.source.alias === 'S1'));
    await add('a', 'Only if'); await add('b', 'Provided that'); await add('c', 'Y is present.');
    const calls = traces.filter(t => t.outcome === 'started');
    expect(calls).toHaveLength(3);
    expect(calls[2]!.input.sources.map(s => s.ranges.map(r => r.evidenceId))).toEqual([['c'], ['b','c'], ['a','c']]);
    expect(pendingBindings(engine.getSnapshot().lesson).map(r => r.evidenceId)).toEqual(['b']); engine.dispose();
  });
  it('authority revision re-enables a WAIT without unrelated lesson changes doing so', async () => {
    const inspect = vi.fn(async (input: SemanticInput) => judge(input, c => c.action === 'WAIT'));
    const { engine, add } = engineFor(inspect); await add('a', 'Only if');
    const state = engine.getSnapshot().lesson, role = state.roles['teacher-capture']!;
    engine.acceptProposal({ proposalId: 'role-change', origin: 'host', sessionId: state.sessionId, sessionEpoch: state.sessionEpoch,
      readSet: { roles: { [role.bindingId]: role.revision } }, operations: [{ type: 'BIND_ROLE', binding: { ...role, revision: role.revision + 1 } }], processing: [], policyVersion: 'alive-foundation-v1' });
    await engine.drain(); expect(inspect).toHaveBeenCalledTimes(2); engine.dispose();
  });
  it('provider failure is suspended across bursts, and reset/dispose invalidates scheduling', async () => {
    const inspect = vi.fn(async (input: SemanticInput) => { if (input.sources[0]!.ranges[0]!.evidenceId === 'a') throw new Error('transport'); return judge(input, c => c.action === 'NO_CHANGE'); });
    const { engine, add } = engineFor(inspect); await add('a', 'Failed.'); await add('b', 'Independent.');
    expect(inspect).toHaveBeenCalledTimes(2); expect(accounting(engine.getSnapshot().lesson).accountedCodeUnits).toBe('Independent.'.length);
    engine.reset(); engine.configureTeacherCapture(engine.getSnapshot().lesson.sessionId); await add('a', 'Failed.');
    expect(inspect).toHaveBeenCalledTimes(3); engine.dispose(); engine.accept({ id: 'c', text: 'Late.', startMs: 2, endMs: 3 });
    expect(inspect).toHaveBeenCalledTimes(3);
  });
  it('caps suspension storage without evicting unchanged WAIT into eligibility', () => {
    const h = classroom(), suspensions = new InspectionSuspensions();
    const refs = Array.from({ length: MAX_SUSPENSIONS + 1 }, () => h.record('Incomplete'));
    for (const ref of refs) { h.wait(ref); suspensions.suspend(h.store.getSnapshot(), [ref]); }
    expect(suspensions.atCapacity).toBe(true); expect(suspensions.excluded(h.store.getSnapshot()).size).toBe(MAX_SUSPENSIONS);
    suspensions.clear(); expect(suspensions.atCapacity).toBe(false);
  });
  it('stops a repeatedly stale lineage after one fresh recapture', async () => {
    let engine: CueEngine, calls = 0;
    const setup = engineFor(async input => {
      calls++;
      const s = engine.getSnapshot().lesson, role = s.roles['teacher-capture']!;
      engine.acceptProposal({ proposalId: `repeated-race-${calls}`, origin: 'host', sessionId: s.sessionId, sessionEpoch: s.sessionEpoch,
        readSet: { roles: { [role.bindingId]: role.revision } }, operations: [{ type: 'BIND_ROLE', binding: { ...role, revision: role.revision + 1 } }], processing: [], policyVersion: 'alive-foundation-v1' });
      return judge(input, c => c.action === 'NO_CHANGE');
    });
    engine = setup.engine; await setup.add('a', 'A.');
    expect(calls).toBe(2); expect(accounting(engine.getSnapshot().lesson).accountedCodeUnits).toBe(0); engine.dispose();
  });
  it('gives each of two stale inspections its own one-recapture lineage within one burst', async () => {
    let engine: CueEngine; const counts = new Map<string, number>(); const ids: string[] = [];
    const setup = engineFor(async input => {
      const id = input.sources[0]!.ranges[0]!.evidenceId; counts.set(id, (counts.get(id) ?? 0) + 1); ids.push(input.inspectionId);
      const result = judge(input, c => c.action === 'NO_CHANGE' && c.source.alias === 'S1');
      if (counts.get(id) === 1) {
        const s = engine.getSnapshot().lesson, role = s.roles['teacher-capture']!;
        engine.acceptProposal({ proposalId: `race-${id}`, origin: 'host', sessionId: s.sessionId, sessionEpoch: s.sessionEpoch,
          readSet: { roles: { [role.bindingId]: role.revision } }, operations: [{ type: 'BIND_ROLE', binding: { ...role, revision: role.revision + 1 } }], processing: [], policyVersion: 'alive-foundation-v1' });
      }
      return result;
    }); engine = setup.engine;
    engine.acceptBatch([{ id: 'a', text: 'A.', startMs: 0, endMs: 1 }, { id: 'b', text: 'B.', startMs: 2, endMs: 3 }]); await engine.drain();
    expect(Object.fromEntries(counts)).toEqual({ a: 2, b: 2 }); expect(new Set(ids).size).toBe(4);
    expect(setup.traces.filter(t => t.outcome === 'stale')).toHaveLength(2);
    expect(setup.traces.filter(t => t.outcome === 'accepted').map(t => t.input.parentInspectionId)).toEqual([ids[0], ids[2]]);
    expect(pendingBindings(engine.getSnapshot().lesson)).toHaveLength(0); engine.dispose();
  });
});

describe('optional relation scheduling', () => {
  it('accepts relation-only evidence without changing Cue meaning, occurrence, or foreground', () => {
    const h = classroom(), a = h.create('A'), b = h.create('B'); h.record('A and B are contrasting cases.');
    const input = captureInspection(h.store.getSnapshot(), 'relation-only')!;
    const judgment = judge(input, c => c.action === 'RELATION_INTENT' && c.cueId === a);
    const before = h.store.getSnapshot(), proposal = compileProposal(input, judgment);
    expect(proposal.operations).toEqual([]); expect(proposal.foreground).toBeUndefined();
    const accepted = h.store.accept(proposal, 0), relationInput = captureRelation(h.store.getSnapshot(), input, judgment, accepted)!;
    const relation = compileProposal(relationInput, judge(relationInput, c => c.action === 'RELATE' && c.cueId === b && c.relationKind === 'CONTRASTS_WITH'));
    h.store.accept(relation, 1);
    const after = h.store.getSnapshot();
    expect(after.cues).toEqual(before.cues); expect(after.occurrences).toEqual(before.occurrences); expect(after.attention).toEqual(before.attention);
    expect(Object.values(after.relations)[0]).toMatchObject({ fromCueId: a, toCueId: b, kind: 'CONTRASTS_WITH' });
  });
  it('keeps R2 pending while R1 is active, without blocking primary processing', async () => {
    const resolvers: { input: SemanticInput; resolve: (j: SemanticJudgment) => void }[] = [];
    const { engine, add, traces } = engineFor(async input => {
      if (input.stage === 'relation') return new Promise(resolve => resolvers.push({ input, resolve }));
      return judge(input, c => c.action === 'CREATE', 'EXPLICIT');
    });
    await add('a', 'A.'); await add('b', 'B is an example of A.'); await add('c', 'C contrasts with A.');
    expect(Object.keys(engine.getSnapshot().lesson.cues)).toHaveLength(3);
    expect(resolvers).toHaveLength(1); expect(traces.filter(t => t.outcome === 'queued')).toHaveLength(1);
    resolvers[0]!.resolve(judge(resolvers[0]!.input, c => c.action === 'NONE'));
    await vi.waitFor(() => expect(resolvers).toHaveLength(2));
    expect(resolvers[1]!.input.sources[0]!.ranges[0]!.evidenceId).toBe('c');
    const foreground = engine.getSnapshot().lesson.attention;
    resolvers[1]!.resolve(judge(resolvers[1]!.input, c => c.action === 'RELATE'));
    await vi.waitFor(() => expect(Object.keys(engine.getSnapshot().lesson.relations)).toHaveLength(1));
    expect(engine.getSnapshot().lesson.attention).toEqual(foreground); engine.dispose();
  });
  it('coalesces to the latest pending relation with explicit supersession and invalidates it on stop', async () => {
    const { engine, add, traces } = engineFor(async input => input.stage === 'relation' ? new Promise(() => {}) : judge(input, c => c.action === 'CREATE', 'EXPLICIT'));
    await add('a', 'A.'); await add('b', 'B relation.'); await add('c', 'C relation.'); await add('d', 'D relation.');
    expect(traces.filter(t => t.outcome === 'superseded').map(t => t.input.sources[0]!.ranges[0]!.evidenceId)).toEqual(['c']);
    engine.stopOptionalInspections();
    expect(traces.filter(t => t.outcome === 'invalidated').map(t => t.input.sources[0]!.ranges[0]!.evidenceId)).toContain('d'); engine.dispose();
  });
  it('invalidates stale pending endpoints before a provider call and ignores late active work after reset', async () => {
    let active!: { input: SemanticInput; resolve: (j: SemanticJudgment) => void }; let relationCalls = 0;
    const { engine, add, traces } = engineFor(async input => {
      if (input.stage === 'relation') { relationCalls++; return new Promise(resolve => { active = { input, resolve }; }); }
      return judge(input, c => c.action === 'CREATE', 'EXPLICIT');
    });
    await add('a', 'A.'); await add('b', 'B relation.'); await add('c', 'C relation.');
    const s = engine.getSnapshot().lesson, id = s.attention.currentCueId!;
    engine.acceptProposal({ proposalId: 'withdraw-c', origin: 'teacher', sessionId: s.sessionId, sessionEpoch: s.sessionEpoch,
      readSet: { cues: { [id]: 1 }, roles: { 'teacher-capture': 1 } }, operations: [{ type: 'WITHDRAW', cueId: id, basis: [binding(s, 'c')] }], processing: [], policyVersion: 'alive-foundation-v1' });
    active.resolve(judge(active.input, c => c.action === 'NONE'));
    await vi.waitFor(() => expect(traces.some(t => t.outcome === 'invalidated' && t.input.sources[0]!.ranges[0]!.evidenceId === 'c')).toBe(true));
    expect(relationCalls).toBe(1);
    await add('d', 'D relation.'); engine.reset(); active.resolve(judge(active.input, c => c.action === 'RELATE'));
    await Promise.resolve(); await Promise.resolve(); expect(Object.keys(engine.getSnapshot().lesson.relations)).toHaveLength(0); engine.dispose();
  });
});
