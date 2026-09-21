import { describe, expect, it, vi } from 'vitest';
import { CueEngine } from '../cue/cue-engine';
import { accounting, binding, pendingBindings } from './evidence';
import { fixtureHost } from './fixtures';
import { replayLesson } from './journal';
import { currentRevision } from './reducer';
import { sourceText } from './projection';
import { buildSemanticRequest, captureInspection, captureRelation, compileProposal, operationCandidates, parseSemanticJudgment,
  validateSemanticInput, type OperationCandidate, type SemanticInput, type SemanticJudgment, type SemanticTrace } from './inspection';
import { mockJudgmentResponse } from './inspection-fixtures';

function classroom() {
  const h = fixtureHost('lesson'); let request = 0;
  h.accept([{ type: 'BIND_ROLE', binding: { bindingId: 'teacher', revision: 1, subject: { kind: 'capture', id: 'lesson' },
    role: 'teacher', basis: 'configured', basisRefs: ['fixture-input'], sourceRanges: [] } }], { readSet: { roles: { teacher: 0 } } });
  const capture = () => captureInspection(h.store.getSnapshot(), `i${++request}`)!;
  const apply = (select: (c: OperationCandidate) => boolean, stance = 'asserted', relation = 'NONE', input = capture()) => {
    const judgment = parseSemanticJudgment(mockJudgmentResponse(input, select, stance, relation), input);
    const proposal = compileProposal(input, judgment), event = h.store.accept(proposal, request * 100);
    return { input, judgment, proposal, event };
  };
  const create = (text: string, relation = 'NONE') => { h.record(text); return apply(c => c.action === 'CREATE' && c.source.alias === 'S1', 'asserted', relation); };
  return { ...h, capture, apply, create };
}
const cueId = (result: ReturnType<ReturnType<typeof classroom>['create']>) => Object.values(result.event.createdCueIds)[0]!;

describe('Alive native primary compiler', () => {
  it('incomplete source WAIT remains unresolved; understood repetition NO_CHANGE accounts it', () => {
    const h = classroom(); h.record('If the missing condition');
    h.apply(c => c.action === 'WAIT');
    expect(accounting(h.store.getSnapshot()).accountedCodeUnits).toBe(0);
    expect(pendingBindings(h.store.getSnapshot())).toHaveLength(1);
    h.apply(c => c.action === 'NO_CHANGE');
    expect(pendingBindings(h.store.getSnapshot())).toHaveLength(0);
    expect(Object.keys(h.store.getSnapshot().cues)).toHaveLength(0);
  });
  it('CREATE then clarification and necessary condition REVISE same identity and preserve composition', () => {
    const h = classroom(), a = cueId(h.create('A is X.'));
    h.record('Only when Y.'); h.apply(c => c.action === 'REVISE' && c.cueId === a && c.mode === 'append');
    h.record('X means the local value.'); h.apply(c => c.action === 'REVISE' && c.cueId === a && c.mode === 'append');
    const cue = h.store.getSnapshot().cues[a]!;
    expect(cue.currentSemanticRevision).toBe(3);
    expect(currentRevision(cue).parts).toHaveLength(3);
    expect(sourceText(cue)).toBe('A is X. Only when Y. X means the local value.');
    expect(cue.revisions[0]?.revision).toBe(1);
  });
  it('CREATE B leaves A selectable; REVISE old A leaves B foreground; RECALL A adds an occurrence without duplicating', () => {
    const h = classroom(), a = cueId(h.create('A is X.')), b = cueId(h.create('B is independent.'));
    h.record('Earlier A is Z instead of X.'); const input = h.capture();
    expect(new Set(operationCandidates(input).candidates.map(c => c.cueId).filter(Boolean))).toEqual(new Set([a, b]));
    h.apply(c => c.action === 'REVISE' && c.cueId === a && c.mode === 'replace', 'asserted', 'NONE', input);
    expect(h.store.getSnapshot().attention.currentCueId).toBe(b);
    expect(sourceText(h.store.getSnapshot().cues[a]!)).toContain('Z instead of X');
    h.record('Return to A.'); h.apply(c => c.action === 'RECALL' && c.cueId === a);
    expect(h.store.getSnapshot().attention.currentCueId).toBe(a);
    expect(h.store.getSnapshot().cues[a]?.currentSemanticRevision).toBe(2);
    expect(Object.keys(h.store.getSnapshot().cues)).toEqual([a, b]);
    expect(h.store.getSnapshot().occurrences.at(-1)?.cueId).toBe(a);
    expect(replayLesson(h.store.export())).toEqual(h.store.getSnapshot());
  });
  it('WITHDRAW has exact teacher evidence; unknown/student sources have no mutation options', () => {
    const h = classroom(), a = cueId(h.create('A is X.'));
    h.record('Withdraw the earlier A claim.');
    const result = h.apply(c => c.action === 'WITHDRAW' && c.cueId === a);
    expect(currentRevision(h.store.getSnapshot().cues[a]!).standing).toBe('withdrawn');
    expect(result.event.inspection?.evidenceScope[0]?.quote).toBe('Withdraw the earlier A claim.');
    h.accept([{ type: 'RECORD_EVIDENCE', fragments: [{ id: 'student', text: 'A is Y.', sessionId: 'unknown', startMs: 5000, endMs: 5001 }] }]);
    expect(operationCandidates(h.capture()).candidates.map(c => c.action)).toEqual(['WAIT', 'NO_CHANGE']);
  });
  it('stale role/cue dependencies reject atomically and duplicate returns remain idempotent', () => {
    const h = classroom(); const a = cueId(h.create('A.')); h.record('A corrected.');
    const input = h.capture(), judgment = parseSemanticJudgment(mockJudgmentResponse(input, c => c.action === 'REVISE' && c.mode === 'replace'), input);
    const proposal = compileProposal(input, judgment);
    const accepted = h.store.accept(proposal, 1); expect(h.store.accept(proposal, 2)).toBe(accepted);
    expect(() => h.store.accept({ ...proposal, proposalId: 'new-attempt' }, 3)).toThrow(/Stale/);
    expect(h.store.getSnapshot().cues[a]?.currentSemanticRevision).toBe(2);
  });
});

describe('candidate coverage and provenance', () => {
  it('reports omitted targets, context and parts independently of returned model judgments', () => {
    const h = classroom(), a = cueId(h.create('A.')), b = cueId(h.create('B.')); h.record('Return to A.');
    const input = captureInspection(h.store.getSnapshot(), 'bounded', { maxCues: 1 })!;
    expect(operationCandidates(input).coverage.omittedCueIds).toContain(a);
    expect(operationCandidates(input).candidates.some(c => c.cueId === a)).toBe(false);
    expect(input.workingSet.cues[0]?.cueId).toBe(b);
    expect(captureInspection(h.store.getSnapshot(), 'missing', { explicitCueIds: ['absent'] })!.workingSet.coverage.contextBlocked).toBe(true);
  });
  it('display text never anchors semantics; exact source overlap and wording do not merge identities', () => {
    const h = classroom(), a = cueId(h.create('Same words.')); const b = cueId(h.create('Same words.'));
    expect(a).not.toBe(b);
    h.record('Same words again.');
    const input = h.capture(), request = buildSemanticRequest(input);
    expect(request.state.cues.map(c => c.id)).toEqual([b, a]);
    expect(request.state).not.toHaveProperty('currentCue');
    expect(operationCandidates(input).candidates.some(c => c.action === 'CREATE')).toBe(true);
    expect(JSON.stringify(input)).not.toContain('presentation');
  });
  it('rejects forged/out-of-range/surrogate-split source candidates before transport', () => {
    const h = classroom(); h.record('A 🧪 B.'); const input = h.capture();
    for (const ref of [{ ...input.sources[0]!.ranges[0]!, quote: 'forged' }, binding(h.store.getSnapshot(), 'f1', 0, 1)]) {
      const changed = structuredClone(input) as any;
      changed.sources[0].ranges[0] = ref.quote === 'forged' ? ref : { ...ref, start: 2, end: 3, quote: '\ud83e' };
      expect(() => validateSemanticInput(changed)).toThrow(/range|quote/);
    }
    expect(validateSemanticInput(input)).toEqual(input);
  });
  it('one Final supports two sequential operations with strict progress; grounding may later reuse the accounted range', () => {
    const h = classroom(); h.record('A is X. B is Y.');
    const first = h.apply(c => c.action === 'CREATE' && c.source.alias === 'S1'), a = cueId(first);
    const afterFirst = accounting(h.store.getSnapshot()).accountedCodeUnits;
    const second = h.apply(c => c.action === 'CREATE'), b = cueId(second);
    expect(afterFirst).toBe('A is X. '.length);
    expect(accounting(h.store.getSnapshot()).accountedCodeUnits).toBe('A is X. B is Y.'.length);
    expect(first.event.inspection?.evidenceScope[0]?.end).toBe(second.event.inspection?.evidenceScope[0]?.start);
    expect(captureInspection(h.store.getSnapshot(), 'done')).toBeNull();
    expect(() => h.store.accept({ ...first.proposal, proposalId: 'reuse', readSet: { ...first.proposal.readSet, attention: 2, processing: { f1: 2 } } }, 99)).toThrow();
    h.accept([{ type: 'RECALL', cueId: a, basis: first.event.inspection!.evidenceScope }], { readSet: h.read(a) });
    expect(Object.keys(h.store.getSnapshot().cues)).toEqual([a, b]);
    expect(accounting(h.store.getSnapshot()).accountedCodeUnits).toBe('A is X. B is Y.'.length);
  });
  it('offers exact cross-Final continuation while permitting independent new evidence', () => {
    const h = classroom(); h.record('Only if'); h.apply(c => c.action === 'WAIT'); h.record('Y holds.');
    const input = h.capture(); expect(input.sources).toHaveLength(2);
    h.apply(c => c.action === 'CREATE' && c.source.ranges.length === 2, 'asserted', 'NONE', input);
    expect(sourceText(Object.values(h.store.getSnapshot().cues)[0]!)).toBe('Only if Y holds.');
    expect(pendingBindings(h.store.getSnapshot())).toEqual([]);
  });
});

describe('optional relation follow-up', () => {
  function relationFixture() {
    const h = classroom(), a = cueId(h.create('A definition.'));
    const created = h.create('This is an example of A.', 'EXPLICIT'), b = cueId(created);
    const input = captureRelation(h.store.getSnapshot(), created.input, created.judgment, created.event)!;
    return { h, a, b, input };
  }
  it('CREATE then EXAMPLE_OF binds accepted versions with separate provenance and never changes foreground', () => {
    const { h, a, b, input } = relationFixture();
    const before = h.store.getSnapshot().attention;
    const result = h.apply(c => c.action === 'RELATE' && c.cueId === a && c.relationKind === 'EXAMPLE_OF', 'asserted', 'NONE', input);
    expect(result.proposal.processing).toEqual([]); expect(result.proposal.foreground).toBeUndefined();
    expect(Object.values(h.store.getSnapshot().relations)[0]).toMatchObject({ fromCueId: b, toCueId: a, kind: 'EXAMPLE_OF', dependencyReadSet: { cues: { [a]: 1, [b]: 1 } } });
    expect(h.store.getSnapshot().attention).toEqual(before);
  });
  it('NONE is valid and relation discovery needs explicit relationship evidence', () => {
    const { h, input } = relationFixture(); h.apply(c => c.action === 'NONE', 'asserted', 'NONE', input);
    expect(Object.keys(h.store.getSnapshot().relations)).toEqual([]);
    const created = h.create('Unrelated object.');
    expect(captureRelation(h.store.getSnapshot(), created.input, created.judgment, created.event)).toBeNull();
  });
  it('endpoint revisions stale the relation; unrelated Cue mutation does not', () => {
    const { h, a, input } = relationFixture();
    const judgment = parseSemanticJudgment(mockJudgmentResponse(input, c => c.action === 'RELATE' && c.cueId === a), input);
    const proposal = compileProposal(input, judgment);
    h.create('Independent C.');
    expect(() => h.store.accept(proposal, 100)).not.toThrow();
    h.record('Correct A.'); h.apply(c => c.action === 'REVISE' && c.cueId === a && c.mode === 'replace');
    expect(() => h.store.accept({ ...proposal, proposalId: 'late-relation' }, 101)).toThrow(/Stale/);
  });
});

describe('runtime inspection loop and failures', () => {
  function engineFor(inspect: (input: SemanticInput) => Promise<SemanticJudgment>) {
    const engine = new CueEngine({ inspect }); engine.configureTeacherCapture(engine.getSnapshot().lesson.sessionId);
    const traces: SemanticTrace[] = []; engine.observeSemantics(t => { if (t.outcome !== 'started') traces.push(t); });
    return { engine, traces };
  }
  it('advances through two units in one Final; low confidence is recorded without changing the chosen action', async () => {
    const inspect = vi.fn(async (input: SemanticInput) => parseSemanticJudgment(mockJudgmentResponse(input, c => c.action === 'CREATE', 'asserted', 'NONE', 0.01), input));
    const { engine, traces } = engineFor(inspect);
    engine.accept({ id: 'f', text: 'First point. Second point.', startMs: 0, endMs: 1 }); await engine.drain();
    expect(inspect).toHaveBeenCalledTimes(2); expect(Object.keys(engine.getSnapshot().lesson.cues)).toHaveLength(2);
    expect(traces.every(t => t.judgment?.operation.confidence === 0.01 && t.outcome === 'accepted')).toBe(true);
    expect(traces[0]?.input.sources[0]?.ranges[0]?.start).toBe(0);
    expect(traces[1]?.input.sources[0]?.ranges[0]?.start).toBe(13); engine.dispose();
  });
  it.each([32, 33])('bounds a %i-unit Final and reports exhaustion only when source remains', async units => {
    const inspect = vi.fn(async (input: SemanticInput) => parseSemanticJudgment(mockJudgmentResponse(input, c => c.action === 'NO_CHANGE' && c.source.alias === 'S1'), input));
    const { engine } = engineFor(inspect);
    engine.accept({ id: 'f', text: Array.from({ length: units }, () => 'Understood.').join(' '), startMs: 0, endMs: 1 });
    await engine.drain();
    expect(inspect).toHaveBeenCalledTimes(32);
    expect(pendingBindings(engine.getSnapshot().lesson)).toHaveLength(units - 32);
    if (units === 32) expect(engine.getSnapshot().inputError).toBeNull();
    else expect(engine.getSnapshot().inputError).toContain('budget reached');
    engine.dispose();
  });
  it('WAIT runs once per captured evidence state and does not block later independent content', async () => {
    const inspect = vi.fn(async (input: SemanticInput) => parseSemanticJudgment(mockJudgmentResponse(input, c =>
      c.action === (input.sources[0]!.ranges[0]!.quote.startsWith('If') ? 'WAIT' : 'CREATE')), input));
    const { engine } = engineFor(inspect);
    engine.accept({ id: 'f1', text: 'If that', startMs: 0, endMs: 1 }); await engine.drain();
    expect(inspect).toHaveBeenCalledTimes(1);
    engine.accept({ id: 'f2', text: 'Independent B.', startMs: 2, endMs: 3 }); await engine.drain();
    expect(Object.keys(engine.getSnapshot().lesson.cues)).toHaveLength(1);
    expect(engine.getSnapshot().lesson.processing.f1?.ranges[0]?.status).toBe('wait');
    expect(inspect.mock.calls.length).toBeLessThanOrEqual(3); engine.dispose();
  });
  it.each(['timeout', 'malformed', 'host-rejection'] as const)('%s never consumes source or becomes NO_CHANGE', async failure => {
    let engine: CueEngine;
    const setup = engineFor(async input => {
      if (failure === 'timeout') throw new Error('Jev request timed out.');
      if (failure === 'malformed') return { operation: { choice: 'invented' } } as SemanticJudgment;
      const role = engine.getSnapshot().lesson.roles['teacher-capture']!;
      engine.acceptProposal({ proposalId: 'revoke', origin: 'host', sessionId: input.sessionId, sessionEpoch: input.sessionEpoch,
        readSet: { roles: { 'teacher-capture': role.revision } }, operations: [{ type: 'BIND_ROLE', binding: { ...role, revision: role.revision + 1, role: 'student' } }], processing: [], policyVersion: 'alive-foundation-v1' });
      return parseSemanticJudgment(mockJudgmentResponse(input, c => c.action === 'CREATE'), input);
    });
    engine = setup.engine; engine.accept({ id: 'f', text: 'A is X.', startMs: 0, endMs: 1 }); await engine.drain();
    expect(accounting(engine.getSnapshot().lesson).accountedCodeUnits).toBe(0);
    expect(setup.traces.every(t => t.outcome !== 'accepted')).toBe(true); engine.dispose();
  });
  it('a delayed relation does not block primary creation; its stale result cannot change foreground', async () => {
    let resolve!: (j: SemanticJudgment) => void; let relation!: SemanticInput;
    const { engine, traces } = engineFor(async input => {
      if (input.stage === 'relation') { relation = input; return new Promise(r => { resolve = r; }); }
      return parseSemanticJudgment(mockJudgmentResponse(input, c => c.action === 'CREATE', 'asserted', 'EXPLICIT'), input);
    });
    engine.accept({ id: 'a', text: 'A.', startMs: 0, endMs: 1 }); await engine.drain();
    engine.accept({ id: 'b', text: 'Example of A.', startMs: 2, endMs: 3 }); await engine.drain();
    const before = engine.getSnapshot().cues.currentCue!.id;
    engine.accept({ id: 'c', text: 'C.', startMs: 4, endMs: 5 }); await engine.drain();
    expect(engine.getSnapshot().cues.currentCue!.id).not.toBe(before);
    resolve(parseSemanticJudgment(mockJudgmentResponse(relation, c => c.action === 'RELATE' && c.relationKind === 'EXAMPLE_OF'), relation));
    await vi.waitFor(() => expect(traces.some(t => t.input.stage === 'relation')).toBe(true));
    expect(engine.getSnapshot().cues.currentCue!.text).toBe('C.'); engine.dispose();
  });
});

it('frozen literature fixtures preserve insight/complexity development, distinct Darcy objects, Beloved stance, and closing recall', () => {
  const h = classroom();
  const insight = cueId(h.create('Insight reveals a deeper meaning.'));
  h.record('Insight connects an observation to an interpretation.'); h.apply(c => c.action === 'REVISE' && c.cueId === insight && c.mode === 'append');
  const darcy = h.create('Darcy refuses to dance, an example of the observation.', 'EXPLICIT'), darcyId = cueId(darcy);
  const relation = captureRelation(h.store.getSnapshot(), darcy.input, darcy.judgment, darcy.event)!;
  h.apply(c => c.action === 'RELATE' && c.cueId === insight && c.relationKind === 'EXAMPLE_OF', 'asserted', 'NONE', relation);
  const theme = cueId(h.create('Darcy exposes the tension between pride and judgment.'));
  const complexity = cueId(h.create('Acknowledge complexity.'));
  h.record('Consider more than one explanation.'); h.apply(c => c.action === 'REVISE' && c.cueId === complexity && c.mode === 'append');
  const beloved = cueId(h.create('Beloved is simply a story about the past.'));
  h.record('That earlier analysis is simplistic and incomplete.'); h.apply(c => c.action === 'REVISE' && c.cueId === beloved && c.mode === 'criticise');
  expect(currentRevision(h.store.getSnapshot().cues[beloved]!).parts[0]?.stance).toBe('criticised_example');
  h.record('Beloved explores how memory shapes identity.'); h.apply(c => c.action === 'REVISE' && c.cueId === beloved && c.mode === 'append');
  for (const [text, id] of [['Practice insight.', insight], ['Acknowledge complexity again.', complexity]]) {
    h.record(text!); h.apply(c => c.action === 'RECALL' && c.cueId === id);
  }
  expect(new Set(Object.keys(h.store.getSnapshot().cues))).toEqual(new Set([insight, darcyId, theme, complexity, beloved]));
  expect(h.store.getSnapshot().cues[insight]?.currentSemanticRevision).toBe(2);
  expect(currentRevision(h.store.getSnapshot().cues[beloved]!).parts.map(p => p.stance)).toEqual(['criticised_example', 'asserted']);
  expect(replayLesson(JSON.parse(JSON.stringify(h.store.export())))).toEqual(h.store.getSnapshot());
});

it('source overlap and the same selected Asset never force Cue identity merge', () => {
  const h = classroom(); h.record('Use this reference.'); const ref = binding(h.store.getSnapshot(), 'f1');
  const assetRef = { packId: 'p', releaseId: 'r', assetId: 'same', assetVersion: '1', digest: 'sha256:fixture' };
  for (const identityKey of ['use-a', 'use-b']) h.accept([{ type: 'CREATE', identityKey, basis: [ref], parts: [{
    partId: 'asset', content: 'selected_asset', assetRef, selectedText: 'Same selected wording.', stance: 'asserted',
    establishmentEvidence: [ref], roleBindingRefs: ['teacher'], adoptionIds: [],
  }] }], { readSet: { roles: { teacher: 1 } } });
  const input = h.capture();
  expect(input.workingSet.cues).toHaveLength(2);
  expect(operationCandidates(input).candidates.filter(c => c.action === 'RECALL')).toHaveLength(2);
  expect(operationCandidates(input).candidates.some(c => c.action === 'CREATE')).toBe(true);
  h.apply(c => c.action === 'CREATE', 'asserted', 'NONE', input);
  expect(Object.keys(h.store.getSnapshot().cues)).toHaveLength(3);
  expect(accounting(h.store.getSnapshot()).accountedCodeUnits).toBe(ref.quote.length);
});

it('option and part limits report omissions without sending omitted transcript bodies to Jev', () => {
  const h = classroom(), a = cueId(h.create('A.'));
  for (let i = 0; i < 5; i++) { h.record(`Facet ${i}.`); h.apply(c => c.action === 'REVISE' && c.cueId === a && c.mode === 'append'); }
  h.record('Correct the fifth facet.'); const input = h.capture();
  const coverage = operationCandidates(input).coverage;
  expect(coverage.omittedParts).toHaveLength(2);
  expect(buildSemanticRequest(input).state.coverage.omittedPartCount).toBe(2);
  expect(JSON.stringify(buildSemanticRequest(input))).not.toContain('revisions');
});

it('source-only omitted coverage produces a diagnostic instead of silently skipping inspection', () => {
  const h = classroom(); h.record('Some evidence.');
  const input = captureInspection(h.store.getSnapshot(), 'blocked', { maxEvidenceCodeUnits: 0 })!;
  expect(input).not.toBeNull(); expect(input.workingSet.coverage.contextBlocked).toBe(true);
  expect(() => validateSemanticInput(input)).toThrow();
});

it('Chinese punctuation exposes legal subranges without whitespace or rewriting', () => {
  const h = classroom(); h.record('甲是第一点。乙是第二点。');
  const first = h.apply(c => c.action === 'CREATE');
  expect(first.event.inspection?.evidenceScope[0]?.quote).toBe('甲是第一点。');
  h.apply(c => c.action === 'CREATE');
  expect(Object.values(h.store.getSnapshot().cues).map(sourceText)).toEqual(['甲是第一点。', '乙是第二点。']);
});
