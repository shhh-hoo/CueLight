import { describe, expect, it } from 'vitest';
import { appendEvidence, emptyEvidence, MAX_FRAGMENT_CHARS, MAX_FRAGMENTS } from './evidence-buffer';

const fragment = (id: number, endMs = id * 100) => ({ id: String(id), text: `Teacher ${id}.`, startMs: endMs, endMs });

describe('rolling evidence', () => {
  it('copies finalized input, increments versions, and leaves captured snapshots immutable', () => {
    const initial = emptyEvidence();
    const source = fragment(1);
    const first = appendEvidence(initial, source);
    source.text = 'Changed outside the engine';
    const second = appendEvidence(first, fragment(2));
    expect(initial).toEqual({ version: 0, fragments: [] });
    expect(first).toEqual({ version: 1, fragments: [fragment(1)] });
    expect(second.version).toBe(2);
    expect(second.fragments).toHaveLength(2);
    expect(Object.isFrozen(first.fragments[0])).toBe(true);
  });

  it('keeps the 20-second boundary and evicts older fragments by finalized timestamp', () => {
    let window = appendEvidence(emptyEvidence(), fragment(1, 0));
    window = appendEvidence(window, fragment(2, 20_000));
    expect(window.fragments.map(item => item.id)).toEqual(['1', '2']);
    window = appendEvidence(window, fragment(3, 20_001));
    expect(window.fragments.map(item => item.id)).toEqual(['2', '3']);
    expect(window.version).toBe(3);
  });

  it('remains bounded even when 1000 fragments share a timestamp', () => {
    let window = emptyEvidence();
    for (let i = 0; i < 1_000; i++) window = appendEvidence(window, fragment(i, 0));
    expect(window.version).toBe(1_000);
    expect(window.fragments).toHaveLength(MAX_FRAGMENTS);
    expect(window.fragments[0]?.id).toBe('968');
    expect(window.fragments.at(-1)?.id).toBe('999');
  });

  it('rejects malformed, oversized, duplicate and out-of-order fragments without altering evidence', () => {
    const window = appendEvidence(emptyEvidence(), fragment(1, 100));
    for (const bad of [
      fragment(1, 200), fragment(2, 50), { ...fragment(2), text: '' },
      { ...fragment(2), text: 'a'.repeat(MAX_FRAGMENT_CHARS + 1) },
      { ...fragment(2), startMs: -1 }, { ...fragment(2), endMs: Number.NaN },
      { ...fragment(2), startMs: 300 },
    ]) expect(() => appendEvidence(window, bad)).toThrow();
    expect(window.version).toBe(1);
    expect(window.fragments).toHaveLength(1);
  });
});
