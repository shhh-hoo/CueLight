import { describe, expect, it, vi } from 'vitest';
import { binding } from '../alive/evidence';
import { fixtureHost, foundationReplayFixture, sharedSourceFixture } from '../alive/fixtures';
import { replayLesson } from '../alive/journal';
import { semanticWorkingSet } from '../alive/projection';
import { CueEngine } from '../cue/cue-engine';
import { MockDecisionProvider } from '../decision/mock-decision-provider';
import { openTrace, readTraceFile, serializeTrace, traceMarkdown } from './archive';
import { projectTrace, revisionText, sourceInterval, sourceRoles } from './projection';
import { TraceSession } from './session';
import { unknownRecord, type TraceArchive } from './types';
import { MAX_ARCHIVE_BYTES } from './validation';

const wrap = (history = foundationReplayFixture().history): TraceArchive => ({ format: 'cuelight-trace', version: 1,
  history, workspace: { notes: {}, record: unknownRecord, presentations: [] } });

describe('teacher TRACE projection and portable history', () => {
  it('keeps A identity, every historical revision, B, recall and change basis through file round trip', () => {
    const { history, a, b } = foundationReplayFixture();
    const archive: TraceArchive = { ...wrap(history), workspace: { notes: { [a]: { text: 'Check this 🧪 条件', mismatch: true } },
      record: { source: 'demo', phase: 'finished', issues: [] }, presentations: [] } };
    const before = JSON.stringify(history);
    const opened = openTrace(serializeTrace(archive));
    expect(opened.lesson).toEqual(replayLesson(history));
    expect(opened.archive).toEqual(archive);
    const trace = projectTrace(opened.archive.history, opened.lesson);
    expect(trace.cues.map(c => c.cueId)).toEqual([a, b]);
    expect(trace.steps.map(s => s.kind)).toEqual(['CREATE', 'EXTEND', 'CREATE', 'RECALL', 'REVISE']);
    expect(trace.steps.map(s => s.revision.revision)).toEqual([1, 2, 1, 2, 3]);
    expect(revisionText(trace.steps[0]!.revision)).toBe('A is X.');
    expect(revisionText(trace.steps.at(-1)!.revision)).toBe('Use Z instead of X. Only when Y.');
    expect(trace.steps.at(-1)!.basis.map(b => b.evidenceId)).toEqual(['f5']);
    expect(trace.steps.at(-1)!.revision.parts.flatMap(p => p.content === 'source_spans' ? p.sourceBindings.map(b => b.evidenceId) : [])).toEqual(['f5', 'f2']);
    expect(JSON.stringify(history)).toBe(before);
    const md = traceMarkdown(opened);
    for (const text of ['教师工作笔记', '梳理不符标记：是', '本版本建立／变化依据', '讲授原文', '系统接受 #', 'Check this 🧪 条件']) expect(md).toContain(text);
  });

  it('reads beyond the Working Set, keeps withdrawn revisions and stale relation basis', () => {
    const h = fixtureHost('many');
    h.record(...Array.from({ length: 40 }, (_, i) => `Object ${i} 的讲授。`));
    const ids: string[] = [];
    for (let i = 1; i <= 40; i++) {
      const id = `f${i}`;
      ids.push(h.accept([{ type: 'CREATE', identityKey: id, parts: [h.part('p', id)], basis: [binding(h.store.getSnapshot(), id)] }]).createdCueIds[id]!);
    }
    const [a, b] = ids as [string, string];
    const basis = [binding(h.store.getSnapshot(), 'f1')];
    h.accept([{ type: 'RELATE', relation: { relationId: 'r', relationRevision: 1, fromCueId: a, toCueId: b,
      family: 'classroom_discourse', kind: 'CONTRASTS_WITH', basisRefs: basis, assetRefs: [], dependencyReadSet: h.read(a, b), status: 'current' } }],
    { readSet: { ...h.read(a, b), relations: { r: 0 } } });
    h.accept([{ type: 'WITHDRAW', cueId: a, basis }], { readSet: h.read(a) });
    const opened = openTrace(serializeTrace(wrap(h.store.export())));
    const trace = projectTrace(opened.archive.history, opened.lesson);
    expect(trace.cues).toHaveLength(40);
    expect(semanticWorkingSet(opened.lesson).cues.length).toBeLessThan(trace.cues.length);
    expect(trace.cues[0]!.revisions.map(r => r.standing)).toEqual(['current', 'withdrawn']);
    expect(trace.relations[0]).toMatchObject({ status: 'needs_review', basisRefs: basis });
  });

  it('keeps shared sources and coarse intervals across Finals without inventing duration or precision', () => {
    const h = fixtureHost('unicode');
    h.accept([{ type: 'RECORD_EVIDENCE', fragments: [
      { id: 'f1', text: '中文 🧪 water', startMs: 1000, endMs: 5000 },
      { id: 'f2', text: 'only if Y.', startMs: 20000, endMs: 21000 },
    ] }]);
    const s = h.store.getSnapshot();
    const refs = [binding(s, 'f1', 3, 5), binding(s, 'f2')];
    h.accept([{ type: 'CREATE', identityKey: 'A', parts: [{ ...h.part('p', 'f1'), content: 'source_spans', sourceBindings: refs }], basis: refs }]);
    const opened = openTrace(serializeTrace(wrap(h.store.export())));
    expect(sourceInterval(opened.lesson, refs[0]!)).toBe('0:01–0:05');
    expect(projectTrace(opened.archive.history, opened.lesson).steps[0]!.basis).toEqual(refs);
    const shared = sharedSourceFixture();
    expect(projectTrace(shared.history, replayLesson(shared.history)).cues).toHaveLength(2);
  });

  it('keeps delayed acceptance order separate from source order and unresolved processing', () => {
    const h = fixtureHost('delayed');
    h.accept([{ type: 'RECORD_EVIDENCE', fragments: [
      { id: 'f1', text: 'Old source.', startMs: 0, endMs: 1000 },
      { id: 'f2', text: 'New source.', startMs: 9000, endMs: 10000 },
      { id: 'f3', text: 'If that…', startMs: 11000, endMs: 12000 },
    ] }]);
    const ref = (id: string) => binding(h.store.getSnapshot(), id);
    for (const id of ['f2', 'f1']) h.accept([{ type: 'CREATE', identityKey: id, parts: [h.part('p', id)], basis: [ref(id)] }]);
    h.accept([], { readSet: { processing: { f1: 0 } }, processing: [{ kind: 'WAIT', ranges: [ref('f1')] }] });
    h.accept([{ type: 'DEFER', deferredId: 'd', ranges: [ref('f3')], reason: 'Missing context', relatedCueIds: [] }], { readSet: { processing: { f3: 0 } } });
    const opened = openTrace(serializeTrace(wrap(h.store.export())));
    const trace = projectTrace(opened.archive.history, opened.lesson);
    expect(trace.steps.map(s => s.sourceStart)).toEqual([9000, 0]);
    expect(trace.sourceSteps.map(s => s.eventSequence)).toEqual([3, 2]);
    expect(trace.processing.map(r => r.status)).toEqual(['wait', 'recorded', 'deferred']);
    expect(opened.archive.workspace.record).toEqual(unknownRecord);
  });

  it('rejects invalid versions, unknown operations, references, forged ranges and prototype keys', () => {
    const valid = JSON.stringify(wrap());
    const edits: ((value: any) => void)[] = [
      v => { v.version = 2; },
      v => { v.history.events[0].operations[0].type = 'UNKNOWN'; },
      v => { v.history.events[1].operations[0].basis[0].quote = 'forged'; },
      v => { v.history.events[1].operations[0].basis[0].evidenceId = 'missing'; },
      v => { v.history.events[1].resultingVersions.cues = {}; },
      v => { v.workspace.notes.missing = { text: 'note', mismatch: true }; },
      v => { v.history.events[0].operations[0].fragments[0].startMs = -1; },
      v => { v.history.events[0].createdCueIds.fake = 'fake'; },
      v => { v.workspace.presentations = [{ cueId: 'missing', revision: 1, result: { kind: 'source' } }]; },
    ];
    for (const edit of edits) { const v = JSON.parse(valid); edit(v); expect(() => openTrace(JSON.stringify(v))).toThrow(); }
    expect(() => openTrace(valid.replace('"notes":{}', '"notes":{"__proto__":{}}'))).toThrow(/Unsafe/);
    expect(() => openTrace(JSON.stringify({ ...wrap(), unexpectedUrl: 'https://example.invalid' }))).toThrow();
  });

  it('validates partial UTF-16 boundaries and enforces size before reading a File', async () => {
    const h = fixtureHost(); h.record('中🧪文');
    const ref = binding(h.store.getSnapshot(), 'f1');
    h.accept([{ type: 'CREATE', identityKey: 'A', parts: [h.part('p', 'f1')], basis: [ref] }]);
    const v = JSON.parse(JSON.stringify(wrap(h.store.export())));
    v.history.events[1].operations[0].basis[0] = { ...ref, start: 1, end: 2, quote: '\ud83e' };
    expect(() => openTrace(JSON.stringify(v))).toThrow(/range/);
    const read = vi.fn();
    await expect(readTraceFile({ size: MAX_ARCHIVE_BYTES + 1, text: read } as unknown as File)).rejects.toThrow(/8 MiB/);
    expect(read).not.toHaveBeenCalled();
    expect(() => openTrace(JSON.stringify({ ...wrap(), history: { ...wrap().history, events: Array(2001).fill({}) } }))).toThrow(/2,000/);
  });

  it('imports old inner history without model calls, with unknown record state and inert hostile text', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const h = fixtureHost(); h.record('<img src="https://example.invalid/tracker"> [click](javascript:bad)');
    h.accept([{ type: 'CREATE', identityKey: 'A', parts: [h.part('p', 'f1')], basis: [binding(h.store.getSnapshot(), 'f1')] }]);
    const opened = openTrace(JSON.stringify(h.store.export()));
    expect(opened.archive.workspace.record.phase).toBe('unknown');
    expect(traceMarkdown(opened)).not.toContain('<img');
    expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
  });
});

it('teacher metadata is separate; storage failure stays visible; disposal rejects late writes', () => {
  const h = fixtureHost('notes'); h.record('Original words.');
  const cueId = h.accept([{ type: 'CREATE', identityKey: 'A', parts: [h.part('p', 'f1')], basis: [binding(h.store.getSnapshot(), 'f1')] }]).createdCueIds.A!;
  const engine = new CueEngine(new MockDecisionProvider({}), undefined, h.store);
  const storage = { setItem: vi.fn(() => { throw Error('full'); }), removeItem: vi.fn() } as unknown as Storage;
  const trace = new TraceSession(engine, 'demo', storage);
  const before = engine.exportLesson();
  trace.note(cueId, { text: 'Teacher note', mismatch: true });
  expect(trace.getSnapshot().notes[cueId]).toEqual({ text: 'Teacher note', mismatch: true });
  trace.phase('capturing'); trace.issue('capture', 'Audio interrupted.');
  expect(trace.storageError).toContain('暂存失败');
  expect(trace.hasUnexported()).toBe(true);
  expect(engine.exportLesson()).toBe(before);
  trace.phase('stopped'); trace.markExported(); expect(trace.hasUnexported()).toBe(false);
  trace.dispose();
  const saved = trace.getSnapshot(); trace.issue('capture', 'late'); expect(trace.getSnapshot()).toBe(saved);
  engine.dispose();
});

it('partial source roles keep exact scope and unknown remainder without guessing from speaker identity', () => {
  const h = fixtureHost('roles');
  h.accept([{ type: 'RECORD_EVIDENCE', fragments: [{ id: 'f1', speakerId: 'S1', text: '老师 学生 未知', startMs: 0, endMs: 1000 }] }]);
  h.accept([{ type: 'BIND_ROLE', binding: { bindingId: 'teacher', revision: 1, speakerId: 'S1', role: 'teacher', basis: 'supplied_metadata', basisRefs: ['fixture'], sourceRanges: [binding(h.store.getSnapshot(), 'f1', 0, 2)] } }], { readSet: { roles: { teacher: 0 } } });
  h.accept([{ type: 'BIND_ROLE', binding: { bindingId: 'student', revision: 1, speakerId: 'S1', role: 'student', basis: 'supplied_metadata', basisRefs: ['fixture'], sourceRanges: [binding(h.store.getSnapshot(), 'f1', 3, 5)] } }], { readSet: { roles: { student: 0 } } });
  const opened = openTrace(JSON.stringify(h.store.export()));
  expect(sourceRoles(opened.lesson, binding(opened.lesson, 'f1'))).toEqual(['教师（范围 [0, 2)）', '学生（范围 [3, 5)）', '其余范围角色未知']);
});
