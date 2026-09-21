import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CueEngine, PREVIOUS_CUE_MS } from '../cue/cue-engine';
import type { Cue } from '../cue/types';
import type { CueDecisionProvider, DecisionInput } from '../decision/decision-provider';
import { buildJevRequest } from '../decision/jev-context';
import { MockDecisionProvider } from '../decision/mock-decision-provider';
import type { CueDecision } from '../decision/types';
import { replayFixtures } from '../replay/replay-fixtures';
import { ReplayEvidenceSource } from '../replay/replay-source';
import { CueRefinement } from './cue-refinement';
import { refineCue } from './http-refinement-provider';
import type { PresentationReply } from './presentation';
import type { RefinementInput, RefinementObservation, RefinementReply } from './types';

vi.mock('./http-refinement-provider', () => ({ refineCue: vi.fn() }));

const config = { model: 'gpt-5.6-luna', timeoutMs: 6000, maxInputChars: 12000, defaultEnabled: false };
const fragment = (n: number) => ({ id: `f${n}`, text: `Teacher ${n}.`, startMs: n * 100, endMs: n * 100 });
const newest = (input: DecisionInput): CueDecision => ({ action: 'NEW_CUE', candidateId: input.candidates[0]!.id });
const update = (input: DecisionInput): CueDecision => ({ action: input.currentCue ? 'UPDATE_CURRENT' : 'NEW_CUE', candidateId: input.candidates[0]!.id });
const source: RefinementReply = { result: { kind: 'source' } };
const generated = (text = 'Readable teaching point.'): PresentationReply => ({ result: {
  kind: 'presentation', blocks: [{ kind: 'text', text }],
} });
const flush = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

let engines: CueEngine[];
let controllers: CueRefinement[];
let calls: { input: RefinementInput; signal: AbortSignal; pending: ReturnType<typeof deferred<RefinementReply>> }[];
function engineFor(provider: CueDecisionProvider = { decide: async input => newest(input) }) {
  const engine = new CueEngine(provider); engines.push(engine); return engine;
}
function attach(engine: CueEngine, enabled = true) {
  const events: RefinementObservation[] = [];
  const refinement = new CueRefinement('session', engine, event => events.push(event));
  controllers.push(refinement);
  refinement.configure(config, true);
  if (enabled) refinement.setEnabled(true);
  return { refinement, events };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  vi.setSystemTime(0);
  engines = []; controllers = []; calls = [];
  vi.mocked(refineCue).mockReset().mockImplementation((input, signal) => {
    const pending = deferred<RefinementReply>();
    calls.push({ input, signal, pending });
    return pending.promise;
  });
});
afterEach(() => {
  controllers.forEach(controller => controller.dispose());
  engines.forEach(engine => engine.dispose());
  vi.restoreAllMocks(); vi.useRealTimers();
});

describe('source-only input authority', () => {
  it('reconstructs the accepted span and two earlier references from the original decision input', async () => {
    const decision = deferred<CueDecision>();
    let original!: DecisionInput;
    const engine = engineFor({ decide: vi.fn().mockImplementationOnce((input: DecisionInput) => {
      original = input; return decision.promise;
    }).mockResolvedValue({ action: 'QUIET' }) });
    const { refinement } = attach(engine);
    engine.acceptBatch([1, 2, 3, 4, 5, 6].map(fragment));
    engine.accept(fragment(7));
    decision.resolve({ action: 'NEW_CUE', candidateId: original.candidates[2]!.id });
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.input.sourceFragments.map(f => f.id)).toEqual(['f4', 'f5', 'f6']);
    expect(calls[0]!.input.referenceContext.map(f => f.id)).toEqual(['f2', 'f3']);
    expect(calls[0]!.input.sourceFragments.map(f => f.text).join(' ')).toBe(calls[0]!.input.sourceText);
    expect(refinement.getSnapshot().cues.currentCue?.presentation).toEqual({ kind: 'source' });
    calls[0]!.pending.resolve(source); await flush();
    expect(refinement.getSnapshot().lastOutcome).toBe('unchanged');
    expect(refinement.getSnapshot().cues.currentCue?.text).toBe('Teacher 4. Teacher 5. Teacher 6.');
  });

  it.each([
    { name: 'missing original snapshot', ids: ['f1'], text: 'Teacher 1.', fragments: null },
    { name: 'missing fragment', ids: ['f1', 'f2'], text: 'Teacher 1. Teacher 2.', fragments: [fragment(1)] },
    { name: 'wrong source order', ids: ['f2', 'f1'], text: 'Teacher 2. Teacher 1.', fragments: [fragment(1), fragment(2)] },
    { name: 'mismatched source wording', ids: ['f1'], text: 'A changed teaching claim.', fragments: [fragment(1)] },
    { name: 'empty source selection', ids: [], text: 'Teacher 1.', fragments: [fragment(1)] },
  ])('records incomplete-source and makes zero calls: $name', async ({ ids, text, fragments }) => {
    const engine = engineFor();
    const snapshot = engine.getSnapshot();
    const cue: Cue = { id: 'cue', sourceRevision: 1, sourceFragmentIds: ids, text, createdAt: 0, updatedAt: 0 };
    vi.spyOn(engine, 'getSnapshot').mockReturnValue({ ...snapshot, cues: { currentCue: cue, previousCue: null },
      request: fragments ? { evidence: { version: 1, fragments }, candidates: [], currentCue: null } : null });
    const { refinement, events } = attach(engine);
    await flush();
    expect(refineCue).not.toHaveBeenCalled();
    expect(events).toContainEqual(expect.objectContaining({ type: 'refinement-result', outcome: 'incomplete-source' }));
    expect(refinement.getSnapshot().cues.currentCue).toMatchObject({ text, presentation: { kind: 'source' } });
  });
});

describe('one active presentation and latest pending revision', () => {
  it('keeps the entire source visible when validation rejects a current generated result', async () => {
    const engine = engineFor(); const { refinement, events } = attach(engine);
    engine.accept(fragment(1)); await flush();
    const sourceCue = refinement.getSnapshot().cues.currentCue;
    const sourceDisplay = events.findIndex(event => event.type === 'display-state' && event.cues.currentCue?.text === 'Teacher 1.');
    const requested = events.findIndex(event => event.type === 'refinement-request');
    expect(sourceDisplay).toBeGreaterThanOrEqual(0);
    expect(sourceDisplay).toBeLessThan(requested);
    calls[0]!.pending.resolve({ error: 'invalid' }); await flush();
    expect(refinement.getSnapshot().cues.currentCue).toBe(sourceCue);
    expect(sourceCue).toMatchObject({ text: 'Teacher 1.', presentation: { kind: 'source' } });
    expect(refinement.getSnapshot()).toMatchObject({ busy: false, lastOutcome: 'invalid' });
    expect(refinement.getSnapshot().error).toContain('source wording is kept');
    expect(calls).toHaveLength(1);
  });

  it.each(['success', 'failure', 'throw'] as const)('aborts obsolete work, waits for finally, and journals stale %s without changing current state', async outcome => {
    const engine = engineFor({ decide: async input => update(input) });
    const { refinement, events } = attach(engine);
    engine.accept(fragment(1)); await flush();
    const id = refinement.getSnapshot().cues.currentCue!.id;
    engine.accept(fragment(2)); await flush();
    engine.accept(fragment(3)); await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.signal.aborted).toBe(true);
    expect(refinement.getSnapshot()).toMatchObject({ busy: true, error: null, lastOutcome: null,
      cues: { currentCue: { id, sourceRevision: 3, text: 'Teacher 3.', presentation: { kind: 'source' } } } });
    if (outcome === 'throw') calls[0]!.pending.reject(new Error('Late rejection'));
    else calls[0]!.pending.resolve(outcome === 'success' ? generated('Obsolete text.') : { error: 'invalid' });
    await flush();
    expect(calls).toHaveLength(2);
    expect(calls[1]!.input.sourceRevision).toBe(3);
    expect(refinement.getSnapshot()).toMatchObject({ error: null, lastOutcome: null,
      cues: { currentCue: { presentation: { kind: 'source' } } } });
    expect(events).toContainEqual(expect.objectContaining({ type: 'refinement-result', outcome: 'cancelled',
      ...(outcome === 'success' ? { result: generated('Obsolete text.').result } : { failure: outcome === 'throw' ? 'unavailable' : 'invalid' }) }));
    calls[1]!.pending.resolve(generated('Current text.')); await flush();
    expect(refinement.getSnapshot()).toMatchObject({ busy: false, lastOutcome: 'applied',
      cues: { currentCue: { id, sourceRevision: 3, text: 'Teacher 3.', presentation: generated('Current text.').result } } });
  });

  it('disable restores current and previous source; re-enable compiles the current revision exactly once', async () => {
    const engine = engineFor();
    const { refinement } = attach(engine);
    engine.accept(fragment(1)); await flush();
    calls[0]!.pending.resolve(generated('First point.')); await flush();
    engine.accept(fragment(2)); await flush();
    calls[1]!.pending.resolve(generated('Second point.')); await flush();
    expect(refinement.getSnapshot().cues.previousCue?.presentation.kind).toBe('presentation');
    refinement.setEnabled(false);
    expect(refinement.getSnapshot()).toMatchObject({ enabled: false, error: null, lastOutcome: null,
      cues: { currentCue: { text: 'Teacher 2.', presentation: { kind: 'source' } },
        previousCue: { text: 'Teacher 1.', presentation: { kind: 'source' } } } });
    refinement.setEnabled(true); refinement.setEnabled(true); await flush();
    expect(calls).toHaveLength(3);
    expect(calls[2]!.input).toEqual(calls[1]!.input);
    calls[2]!.pending.resolve(source); await flush();
    refinement.configure(config, true); refinement.setEnabled(true); await flush();
    expect(calls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(PREVIOUS_CUE_MS);
    expect(refinement.getSnapshot().cues.previousCue).toBeNull();
  });

  it('disable clears pending; an ignored abort cannot complete a revision or prevent its fresh re-enable attempt', async () => {
    const engine = engineFor({ decide: async input => update(input) });
    const { refinement } = attach(engine);
    engine.accept(fragment(1)); await flush();
    engine.accept(fragment(2)); await flush();
    refinement.setEnabled(false);
    calls[0]!.pending.resolve(generated()); await flush();
    expect(calls).toHaveLength(1);
    expect(refinement.getSnapshot()).toMatchObject({ enabled: false, lastOutcome: null, error: null });
    refinement.setEnabled(true); await flush();
    expect(calls).toHaveLength(2);
    refinement.setEnabled(false); refinement.setEnabled(true); await flush();
    expect(calls).toHaveLength(2);
    calls[1]!.pending.resolve(source); await flush();
    expect(calls).toHaveLength(3);
    expect(refinement.getSnapshot().lastOutcome).toBeNull();
    calls[2]!.pending.resolve(source); await flush();
    expect(refinement.getSnapshot().lastOutcome).toBe('unchanged');
  });

  it('a late response cannot revise the previous Cue', async () => {
    const engine = engineFor(); const { refinement } = attach(engine);
    engine.accept(fragment(1)); await flush();
    engine.accept(fragment(2)); await flush();
    const previous = refinement.getSnapshot().cues.previousCue;
    calls[0]!.pending.resolve(generated('Late old Cue.')); await flush();
    expect(refinement.getSnapshot().cues.previousCue).toBe(previous);
    expect(previous?.presentation.kind).toBe('source');
    calls[1]!.pending.resolve(generated()); await flush();
    expect(refinement.getSnapshot().cues.previousCue).toBe(previous);
  });

  it('keeps an accepted Cue eligible while replay is paused', async () => {
    const engine = engineFor(); const { refinement } = attach(engine);
    const replay = new ReplayEvidenceSource([{ at: 0, fragment: fragment(1) }, { at: 1000, fragment: fragment(2) }]);
    engine.connect(replay); replay.start(); await vi.advanceTimersByTimeAsync(0);
    replay.pause();
    expect(calls[0]!.signal.aborted).toBe(false);
    calls[0]!.pending.resolve(generated()); await flush();
    expect(refinement.getSnapshot().lastOutcome).toBe('applied');
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toHaveLength(1);
    replay.dispose();
  });

  it('Stop cancels work and prevents later compilation, while disabling still restores source', async () => {
    const engine = engineFor(); const { refinement } = attach(engine);
    engine.accept(fragment(1)); await flush();
    calls[0]!.pending.resolve(generated()); await flush();
    refinement.finish(); refinement.setEnabled(false); refinement.setEnabled(true);
    expect(refinement.getSnapshot()).toMatchObject({ stopped: true, enabled: false, busy: false,
      cues: { currentCue: { presentation: { kind: 'source' } } } });
    engine.accept(fragment(2)); await flush();
    expect(calls).toHaveLength(1);
  });

  it.each(['stop', 'reset', 'dispose'] as const)('%s prevents an ignored abort from writing any current outcome', async action => {
    const engine = engineFor(); const { refinement, events } = attach(engine);
    engine.accept(fragment(1)); await flush();
    if (action === 'stop') refinement.finish();
    else if (action === 'reset') engine.reset();
    else refinement.dispose();
    expect(calls[0]!.signal.aborted).toBe(true);
    const before = refinement.getSnapshot();
    calls[0]!.pending.resolve({ error: 'timeout' }); await flush();
    expect(refinement.getSnapshot().cues).toBe(before.cues);
    expect(refinement.getSnapshot().error).toBe(before.error);
    expect(refinement.getSnapshot().lastOutcome).toBe(before.lastOutcome);
    expect(events).toContainEqual(expect.objectContaining({ type: 'refinement-result', outcome: 'cancelled', failure: 'timeout' }));
    expect(calls).toHaveLength(1);
  });
});

it('presentation enabled and disabled produce identical candidates, Jev inputs/decisions, and source Cue revisions', async () => {
  const fixture = replayFixtures.find(f => f.id === 'science')!;
  const records: unknown[][] = [[], []];
  const sessions = [false, true].map((enabled, index) => {
    const scripted = new MockDecisionProvider(fixture.script);
    const engine = engineFor({ decide: async input => {
      const decision = await scripted.decide(input);
      records[index]!.push({ input, jev: buildJevRequest(input).body, decision });
      return decision;
    } });
    return { engine, ...attach(engine, enabled) };
  });
  const cues: unknown[][] = [[], []];
  for (const entry of fixture.entries) {
    sessions.forEach(session => session.engine.accept(entry.fragment)); await flush();
    for (const call of calls) call.pending.resolve(generated('DISPLAY ONLY: cannot become source evidence.'));
    await flush();
    sessions.forEach((session, index) => cues[index]!.push(session.engine.getSnapshot().cues));
  }
  expect(calls.length).toBeGreaterThan(0);
  expect(records[1]).toEqual(records[0]);
  expect(cues[1]).toEqual(cues[0]);
  expect(JSON.stringify(records[1])).not.toContain('DISPLAY ONLY');
  expect(sessions[1]!.refinement.getSnapshot().cues.currentCue?.presentation.kind).toBe('presentation');
});
