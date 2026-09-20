import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CueEngine } from '../cue/cue-engine';
import { MockDecisionProvider } from '../decision/mock-decision-provider';
import type { EvidenceFragment } from '../evidence/evidence-buffer';
import { replayFixtures } from './replay-fixtures';
import { ReplayEvidenceSource, type TeachingEvidenceSource } from './replay-source';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('replay source', () => {
  it('start/pause/continue preserves the remaining delay without duplicate emissions', async () => {
    const source = new ReplayEvidenceSource(replayFixtures[0]!.entries);
    const seen = vi.fn();
    const unsubscribe = source.subscribe(seen);
    source.start(); source.start();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(seen).toHaveBeenCalledTimes(1);
    source.pause(); source.pause();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(seen).toHaveBeenCalledTimes(1);
    source.start();
    await vi.advanceTimersByTimeAsync(1_199);
    expect(seen).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(seen.mock.calls[1]![0].id).toBe('science-2');
    unsubscribe();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(source.getStatus()).toBe('finished');
    source.start();
    expect(vi.getTimerCount()).toBe(0);
    source.dispose();
  });

  it('reset clears timers and returns both source and engine to their initial states', async () => {
    const fixture = replayFixtures[0]!;
    const source = new ReplayEvidenceSource(fixture.entries);
    const engine = new CueEngine(new MockDecisionProvider(fixture.script));
    engine.connect(source);
    source.start();
    await vi.advanceTimersByTimeAsync(12_001);
    expect(engine.getSnapshot().cues.previousCue).not.toBeNull();
    source.reset(); engine.reset();
    expect(source.getStatus()).toBe('ready');
    expect(engine.getSnapshot().evidence).toEqual({ version: 0, fragments: [] });
    expect(engine.getSnapshot().cues).toEqual({ currentCue: null, previousCue: null });
    expect(engine.getSnapshot().lastDecision).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    source.start();
    await vi.advanceTimersByTimeAsync(2_200);
    expect(engine.getSnapshot().cues.currentCue?.text).toBe('Osmosis is the movement of water across a partially permeable membrane.');
    expect(engine.getSnapshot().cues.previousCue).toBeNull();
    engine.dispose(); source.dispose();
  });

  it('an alternative finalized-input source uses the exact same engine boundary', async () => {
    let deliver: ((fragment: EvidenceFragment) => void) | undefined;
    const manualSource: TeachingEvidenceSource = {
      subscribe(callback) { deliver = callback; return () => { deliver = undefined; }; },
    };
    const engine = new CueEngine({ decide: async input => ({ action: 'NEW_CUE', candidateId: input.candidates[0]!.id }) });
    engine.connect(manualSource);
    deliver!({ id: 'manual-final', text: 'Source adapters do not make Cue decisions.', startMs: 0, endMs: 500 });
    await Promise.resolve();
    expect(engine.getSnapshot().cues.currentCue?.sourceFragmentIds).toEqual(['manual-final']);
    engine.dispose();
    expect(deliver).toBeUndefined();
  });
});

// Expected actions are an independently stated behavior contract, not derived from scripts.
describe.each(replayFixtures)('$subject vertical slice', fixture => {
  it('filler → NEW → UPDATE → QUIET → NEW, with exact grounded spans', async () => {
    const source = new ReplayEvidenceSource(fixture.entries);
    const engine = new CueEngine(new MockDecisionProvider(fixture.script));
    engine.connect(source);
    source.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getSnapshot().lastDecision?.decision.action).toBe('QUIET');
    expect(engine.getSnapshot().cues.currentCue).toBeNull();
    await vi.advanceTimersByTimeAsync(2_200);
    expect(engine.getSnapshot().lastDecision?.decision.action).toBe('NEW_CUE');
    const first = engine.getSnapshot().cues.currentCue!;
    expect(first.sourceFragmentIds).toEqual([`${fixture.id}-2`]);
    expect(first.text).toBe(fixture.entries[1]!.fragment.text);
    await vi.advanceTimersByTimeAsync(3_600);
    expect(engine.getSnapshot().lastDecision?.decision.action).toBe('UPDATE_CURRENT');
    const updated = engine.getSnapshot().cues.currentCue!;
    expect(updated.id).toBe(first.id);
    expect(updated.createdAt).toBe(first.createdAt);
    expect(updated.sourceFragmentIds).toEqual([`${fixture.id}-2`, `${fixture.id}-3`]);
    expect(updated.text).toBe(`${fixture.entries[1]!.fragment.text} ${fixture.entries[2]!.fragment.text}`);
    await vi.advanceTimersByTimeAsync(2_700);
    expect(engine.getSnapshot().lastDecision?.decision.action).toBe('QUIET');
    expect(engine.getSnapshot().cues.currentCue).toBe(updated);
    await vi.advanceTimersByTimeAsync(3_500);
    expect(engine.getSnapshot().lastDecision?.decision.action).toBe('NEW_CUE');
    expect(engine.getSnapshot().cues.previousCue).toBe(updated);
    expect(engine.getSnapshot().cues.currentCue?.sourceFragmentIds).toEqual([`${fixture.id}-5`]);
    await vi.advanceTimersByTimeAsync(4_800);
    expect(engine.getSnapshot().cues.previousCue).toBeNull();
    expect(engine.getSnapshot().cues.currentCue?.text).toBe(fixture.entries[4]!.fragment.text);
    expect(source.getStatus()).toBe('finished');
    engine.dispose(); source.dispose();
  });
});
