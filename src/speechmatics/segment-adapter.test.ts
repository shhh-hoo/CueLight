import { describe, expect, it, vi } from 'vitest';
import { VoiceSegmentAdapter } from './segment-adapter';
import { CueEngine } from '../cue/cue-engine';
import { SessionDiagnostics } from './session-diagnostics';
const segment = (sequence: number, text = 'A coherent finalized sentence.') => ({ sequence, text,
  startSeconds: sequence, endSeconds: sequence + .8, speakerId: 'S1', language: 'en' });
const event = (cycle: number, ...segments: ReturnType<typeof segment>[]) => ({ type: 'segments', sessionId: 'test', cycle, segments });

describe('Voice ADD_SEGMENT boundary', () => {
  it('preserves wording, provenance and a whole-event decision cycle', async () => {
    const adapter = new VoiceSegmentAdapter('test');
    const journal = new SessionDiagnostics('test');
    const decide = vi.fn(async () => ({ action: 'QUIET' as const }));
    const engine = new CueEngine({ decide: input => journal.decide(input, () => decide()) });
    const detach = journal.attach(engine);
    const result = adapter.accept(event(1, segment(1, '  Exact wording.  '), segment(2)), 123)!;
    journal.observe({ type: 'voice-segments', atMonoMs: 123, result });
    engine.acceptBatch(result.fragments);
    await engine.drain();
    expect(decide).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().evidence.fragments).toHaveLength(2);
    expect(result.fragments[0]).toMatchObject({ text: '  Exact wording.  ', startMs: 1000, endMs: 1800,
      sessionId: 'test', sequence: 1, cycle: 1, speakerId: 'S1', receivedAtMonoMs: 123 });
    expect(journal.export().segmentDecisions.every(item => item.triggeredRequestIds.length === 1)).toBe(true);
    detach(); engine.dispose();
  });
  it('ignores partial, legacy transcript and foreign-session events', () => {
    const adapter = new VoiceSegmentAdapter('test');
    for (const type of ['AddPartialSegment', 'AddTranscript', 'partial']) {
      expect(adapter.accept({ ...event(1, segment(1)), type }, 1)).toBeNull();
    }
    expect(adapter.accept({ ...event(1, segment(1)), sessionId: 'old' }, 1)).toBeNull();
  });
  it('rejects malformed events and treats exact retransmissions idempotently', () => {
    const adapter = new VoiceSegmentAdapter('test');
    expect(adapter.accept(event(1, segment(1), { ...segment(2), text: 'x'.repeat(4097) }), 1)?.outcome).toBe('invalid');
    expect(adapter.accept(event(1, segment(1)), 2)?.outcome).toBe('accepted');
    expect(adapter.accept(event(1, segment(1)), 3)?.fragments).toEqual([]);
    expect(adapter.accept(event(1, segment(1, 'Changed source')), 3)?.outcome).toBe('invalid');
    expect(adapter.accept(event(2, segment(2)), 4)?.fragments[0]?.id).toBe('test:2');
  });
});
