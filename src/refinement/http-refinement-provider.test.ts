import { afterEach, expect, it, vi } from 'vitest';
import { parseRuntimeConfig } from '../../server/runtime-config';
import { refineCue } from './http-refinement-provider';

const config = parseRuntimeConfig({}).refinement;
const input = { sessionId: 's', cueId: 'c', sourceRevision: 1, sourceText: 'Teaching text.',
  sourceFragments: [{ id: 'f', text: 'Teaching text.', startMs: 0, endMs: 1 }], referenceContext: [] };
afterEach(() => vi.unstubAllGlobals());

it.each([{ result: { kind: 'source' } }, { result: { kind: 'presentation', blocks: [{ kind: 'text', text: 'Clear text.' }] } }])(
  'validates shared presentation output and copies configuration separately', async reply => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ...reply, configuration: config }));
    vi.stubGlobal('fetch', fetch);
    const observe = vi.fn();
    const signal = new AbortController().signal;
    expect(await refineCue(input, signal, config, observe)).toEqual(reply);
    expect(observe).toHaveBeenCalledWith(config);
    expect(fetch).toHaveBeenCalledWith('/api/openai/refine', expect.objectContaining({ body: JSON.stringify(input), signal }));
  });

it.each([
  { result: { kind: 'source' }, extra: true }, { displayText: 'Legacy text.' },
  { result: { kind: 'presentation', blocks: [{ kind: 'text', text: 'x'.repeat(281) }] } },
  { result: { kind: 'presentation', blocks: [{ kind: 'chain', nodes: ['A', 'B'], links: [] }] } },
])('rejects invalid browser-bound output without truncation: %j', async reply => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(reply)));
  expect(await refineCue(input, new AbortController().signal, config, () => {})).toEqual({ error: 'invalid' });
});

it.each(['incomplete-source', 'refused', 'incomplete', 'timeout', 'unavailable', 'invalid'])(
  'preserves an allowlisted failure %s', async error => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error }, { status: 502 })));
    expect(await refineCue(input, new AbortController().signal, config, () => {})).toEqual({ error });
  });
