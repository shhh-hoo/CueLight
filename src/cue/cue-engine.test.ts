import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CueDecisionProvider, DecisionInput } from '../decision/decision-provider';
import type { CueDecision } from '../decision/types';
import { CueEngine, PREVIOUS_CUE_MS } from './cue-engine';

const fragment = (n: number) => ({ id: `f${n}`, text: `Teacher ${n}.`, startMs: n * 100, endMs: n * 100 });
const newest = (input: DecisionInput): CueDecision => ({ action: 'NEW_CUE', candidateId: input.candidates[0]!.id });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function deferred() {
  let resolve!: (value: CueDecision) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<CueDecision>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let engines: CueEngine[];
function engineFor(provider: CueDecisionProvider) { const engine = new CueEngine(provider); engines.push(engine); return engine; }

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); engines = []; });
afterEach(() => { engines.forEach(engine => engine.dispose()); vi.useRealTimers(); });

describe('one in-flight decision and one dirty bit', () => {
  it('discards stale results and collapses 100 arrivals into one latest follow-up without a queue', async () => {
    const first = deferred();
    const second = deferred();
    const inputs: DecisionInput[] = [];
    const decide = vi.fn((input: DecisionInput) => { inputs.push(input); return inputs.length === 1 ? first.promise : second.promise; });
    const engine = engineFor({ decide });
    engine.accept(fragment(1));
    for (let n = 2; n <= 101; n++) engine.accept(fragment(n));
    expect(decide).toHaveBeenCalledTimes(1);
    expect(inputs[0]!.evidence.fragments).toHaveLength(1);
    first.resolve(newest(inputs[0]!));
    await flush();
    expect(engine.getSnapshot().cues.currentCue).toBeNull();
    expect(engine.getSnapshot().lastDecision?.outcome).toBe('discarded');
    expect(decide).toHaveBeenCalledTimes(2);
    expect(inputs[1]!.evidence.version).toBe(101);
    expect(inputs[1]!.evidence.fragments).toHaveLength(32);
    second.resolve(newest(inputs[1]!));
    await flush();
    expect(engine.getSnapshot().cues.currentCue?.text).toBe('Teacher 101.');
    expect(engine.getSnapshot().status).toBe('idle');
    expect(decide).toHaveBeenCalledTimes(2);
  });

  it('reset prevents an old response with the same evidence version from writing into a new session', async () => {
    const pending = deferred();
    const inputs: DecisionInput[] = [];
    const decide = vi.fn((input: DecisionInput) => { inputs.push(input); return inputs.length === 1 ? pending.promise : Promise.resolve(newest(input)); });
    const engine = engineFor({ decide });
    engine.accept(fragment(1));
    engine.reset();
    expect(engine.getSnapshot().evidence.version).toBe(0);
    expect(engine.getSnapshot().cues.currentCue).toBeNull();
    engine.accept(fragment(2));
    expect(engine.getSnapshot().evidence.version).toBe(1);
    expect(decide).toHaveBeenCalledTimes(1);
    pending.resolve(newest(inputs[0]!));
    await flush();
    expect(decide).toHaveBeenCalledTimes(2);
    expect(engine.getSnapshot().cues.currentCue?.text).toBe('Teacher 2.');
    expect(engine.getSnapshot().cues.previousCue).toBeNull();
  });

  it('reset without new evidence settles silently and does not issue another decision', async () => {
    const pending = deferred();
    const decide = vi.fn(() => pending.promise);
    const engine = engineFor({ decide });
    engine.accept(fragment(1));
    engine.reset();
    pending.resolve({ action: 'NEW_CUE', candidateId: '["f1"]' });
    await flush();
    expect(engine.getSnapshot().lastDecision).toBeNull();
    expect(engine.getSnapshot().status).toBe('idle');
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it('disposal detaches the evidence source and ignores late results', async () => {
    const pending = deferred();
    const engine = engineFor({ decide: () => pending.promise });
    const unsubscribe = vi.fn();
    engine.connect({ subscribe: callback => { callback(fragment(1)); return unsubscribe; } });
    const subscriber = vi.fn();
    engine.subscribe(subscriber);
    engine.dispose();
    pending.resolve({ action: 'NEW_CUE', candidateId: '["f1"]' });
    await flush();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(subscriber).not.toHaveBeenCalled();
    expect(engine.getSnapshot().cues.currentCue).toBeNull();
  });

  it.each([
    { action: 'NEW_CUE', candidateId: 'unknown' },
    { action: 'SUMMARIZE', text: 'Invented content' },
    null,
  ])('invalid output becomes observable QUIET and the next fragment still works (%j)', async invalid => {
    const decide = vi.fn().mockResolvedValueOnce(invalid).mockImplementation(async (input: DecisionInput) => newest(input));
    const engine = engineFor({ decide });
    engine.accept(fragment(1)); await flush();
    expect(engine.getSnapshot().cues.currentCue).toBeNull();
    expect(engine.getSnapshot().lastDecision).toMatchObject({ decision: { action: 'QUIET' }, outcome: 'fallback' });
    expect(engine.getSnapshot().lastDecision?.error).toBeTruthy();
    engine.accept(fragment(2)); await flush();
    expect(engine.getSnapshot().cues.currentCue?.text).toBe('Teacher 2.');
  });

  it('rejection releases the in-flight slot and evaluates the newest dirty evidence', async () => {
    const pending = deferred();
    const decide = vi.fn().mockReturnValueOnce(pending.promise).mockImplementation(async (input: DecisionInput) => newest(input));
    const engine = engineFor({ decide });
    engine.accept(fragment(1)); engine.accept(fragment(2));
    pending.reject(new Error('Offline')); await flush();
    expect(decide).toHaveBeenCalledTimes(2);
    expect(engine.getSnapshot().cues.currentCue?.text).toBe('Teacher 2.');
  });
});

describe('display lifecycle', () => {
  it('expires previous during QUIET and UPDATE without extending its four-second lifetime', async () => {
    const decide = vi.fn()
      .mockImplementationOnce(async (input: DecisionInput) => newest(input))
      .mockImplementationOnce(async (input: DecisionInput) => newest(input))
      .mockResolvedValueOnce({ action: 'QUIET' })
      .mockImplementationOnce(async (input: DecisionInput) => ({ action: 'UPDATE_CURRENT', candidateId: input.candidates[0]!.id }));
    const engine = engineFor({ decide });
    engine.accept(fragment(1)); await flush();
    engine.accept(fragment(2)); await flush();
    const currentId = engine.getSnapshot().cues.currentCue?.id;
    await vi.advanceTimersByTimeAsync(1_000);
    engine.accept(fragment(3)); await flush();
    engine.accept(fragment(4)); await flush();
    await vi.advanceTimersByTimeAsync(2_999);
    expect(engine.getSnapshot().cues.previousCue?.text).toBe('Teacher 1.');
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.getSnapshot().cues.previousCue).toBeNull();
    expect(engine.getSnapshot().cues.currentCue?.id).toBe(currentId);
    expect(engine.getSnapshot().cues.currentCue?.text).toBe('Teacher 4.');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(engine.getSnapshot().cues.currentCue?.text).toBe('Teacher 4.');
  });

  it('a newer transition replaces the old expiry timer; reset cancels it', async () => {
    const engine = engineFor({ decide: async input => newest(input) });
    engine.accept(fragment(1)); await flush();
    engine.accept(fragment(2)); await flush();
    await vi.advanceTimersByTimeAsync(2_000);
    engine.accept(fragment(3)); await flush();
    await vi.advanceTimersByTimeAsync(PREVIOUS_CUE_MS - 1);
    expect(engine.getSnapshot().cues.previousCue?.text).toBe('Teacher 2.');
    engine.reset();
    expect(vi.getTimerCount()).toBe(0);
    expect(engine.getSnapshot().cues).toEqual({ currentCue: null, previousCue: null });
  });

  it('invalid evidence is diagnosed without making a provider request', () => {
    const decide = vi.fn();
    const engine = engineFor({ decide });
    engine.accept({ ...fragment(1), text: '' });
    expect(engine.getSnapshot().inputError).toBeTruthy();
    expect(engine.getSnapshot().evidence.version).toBe(0);
    expect(decide).not.toHaveBeenCalled();
  });
});
