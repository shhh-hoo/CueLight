import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';
import { openaiRefinementApiPlugin } from './openai-refinement-api';
import { parseRuntimeConfig } from './runtime-config';
import { presentationSchema } from '../src/refinement/presentation';

const input = { sessionId: 's', cueId: 'c', sourceRevision: 1, sourceText: 'Teaching text.',
  sourceFragments: [{ id: 'f', text: 'Teaching text.', startMs: 0, endMs: 1 }], referenceContext: [] };
const source = { result: { kind: 'source' } };
const presentation = { result: { kind: 'presentation', blocks: [{ kind: 'text', text: 'Clear text.' }] } };
const completed = (value: unknown) => ({ status: 'completed', output: [
  { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] },
] });
function harness(env: Record<string, string> = {}, apiKey = 'fake-secret') {
  const config = parseRuntimeConfig(env).refinement;
  let handler!: (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
  const plugin = openaiRefinementApiPlugin({ apiKey, config });
  (plugin.configureServer as Function)({ middlewares: { use: (fn: typeof handler) => { handler = fn; } } });
  function request(path: string, body?: unknown) {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as IncomingMessage;
    req.url = path; req.method = body === undefined ? 'GET' : 'POST';
    req.headers = { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173', 'content-type': 'application/json' };
    const res = Object.assign(new EventEmitter(), { writableEnded: false, destroyed: false, headersSent: false,
      status: 0, body: null as any,
      writeHead(status: number) { this.status = status; this.headersSent = true; },
      end(raw: string) { this.body = JSON.parse(raw); this.writableEnded = true; },
    });
    handler(req, res as unknown as ServerResponse, () => {});
    return res;
  }
  return { config, request };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('status and upstream use overrides, validate input, and never expose keys', async () => {
  const transport = vi.fn().mockResolvedValue(Response.json(completed(presentation)));
  vi.stubGlobal('fetch', transport);
  const { config, request } = harness({ OPENAI_REFINEMENT_MODEL: 'model-test', OPENAI_REFINEMENT_MAX_INPUT_CHARS: '20', OPENAI_REFINEMENT_ENABLED_DEFAULT: 'true' });
  const status = request('/api/openai/status');
  expect(status.body).toEqual({ configured: true, ...config });
  const response = request('/api/openai/refine', input);
  await vi.waitFor(() => expect(response.writableEnded).toBe(true));
  const body = JSON.parse(transport.mock.calls[0]![1].body);
  expect(body.model).toBe('model-test');
  expect(body).not.toHaveProperty('reasoning');
  expect(body).toMatchObject({ store: false, stream: false, background: false, max_output_tokens: 2048,
    text: { format: { type: 'json_schema', name: 'cue_presentation_v1', strict: true, schema: presentationSchema } } });
  expect(body).not.toHaveProperty('tools');
  expect(response.body.result).toEqual(presentation.result);
  expect(response.body.configuration).toEqual(config);
  expect(JSON.stringify(response.body)).not.toContain('fake-secret');
  const invalid = request('/api/openai/refine', { ...input, sourceText: 'x'.repeat(21), sourceFragments: [{ ...input.sourceFragments[0], text: 'x'.repeat(21) }] });
  await vi.waitFor(() => expect(invalid.status).toBe(400));
  expect(transport).toHaveBeenCalledOnce();
  expect(harness({ OPENAI_REFINEMENT_ENABLED_DEFAULT: 'true' }, '').request('/api/openai/status').body.configured).toBe(false);
});

it('uses the Luna profile and passes only sourceText and earlier context text to the model', async () => {
  const transport = vi.fn().mockResolvedValue(Response.json(completed(source)));
  vi.stubGlobal('fetch', transport);
  const { request } = harness();
  const response = request('/api/openai/refine', { ...input,
    referenceContext: [{ id: 'earlier', text: 'Earlier context.', startMs: 0, endMs: 0 }] });
  await vi.waitFor(() => expect(response.writableEnded).toBe(true));
  expect(transport.mock.calls[0]![0]).toBe('https://api.openai.com/v1/responses');
  const body = JSON.parse(transport.mock.calls[0]![1].body);
  expect(body.model).toBe('gpt-5.6-luna');
  expect(body.reasoning).toEqual({ effort: 'none' });
  expect(JSON.parse(body.input)).toEqual({ sourceText: 'Teaching text.', referenceContext: [{ text: 'Earlier context.' }] });
  expect(response.body.result).toEqual(source.result);
});

it.each([
  { ...input, sourceFragments: undefined }, { ...input, sourceFragments: [] },
  { ...input, sourceText: 'Teaching text. Added point.' },
])('rejects missing/incomplete reconstruction before any model call', async value => {
  const transport = vi.fn();
  vi.stubGlobal('fetch', transport);
  const response = harness().request('/api/openai/refine', value);
  await vi.waitFor(() => expect(response.writableEnded).toBe(true));
  expect(response.body.error).toBe('incomplete-source');
  expect(transport).not.toHaveBeenCalled();
});

it.each([
  { ...input, referenceContext: Array.from({ length: 3 }, (_, i) => ({ id: `f${i}`, text: 'Context.', startMs: 0, endMs: 0 })) },
  { ...input, sourceFragments: [{ ...input.sourceFragments[0], endMs: -1 }] },
])('rejects invalid source metadata/context before any model call', async value => {
  const transport = vi.fn();
  vi.stubGlobal('fetch', transport);
  const response = harness().request('/api/openai/refine', value);
  await vi.waitFor(() => expect(response.writableEnded).toBe(true));
  expect(response.body.error).toBe('invalid');
  expect(transport).not.toHaveBeenCalled();
});

it.each([
  [completed({ result: { kind: 'presentation', blocks: [{ kind: 'text', text: 'x'.repeat(281) }] } }), 'invalid'],
  [completed({ result: { kind: 'source' }, extra: true }), 'invalid'],
  [completed({ displayText: 'Legacy response.' }), 'invalid'],
  [{ status: 'incomplete', output: [] }, 'incomplete'],
  [{ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No.' }] }] }, 'refused'],
  [{ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{' }] }] }, 'invalid'],
])('returns an explicit source-fallback failure for unusable model output', async (upstream, error) => {
  const transport = vi.fn().mockResolvedValue(Response.json(upstream));
  vi.stubGlobal('fetch', transport);
  const response = harness().request('/api/openai/refine', input);
  await vi.waitFor(() => expect(response.writableEnded).toBe(true));
  expect(response.status).toBe(502);
  expect(response.body.error).toBe(error);
  expect(transport).toHaveBeenCalledOnce();
});

it('aborts upstream work when the client leaves and cannot write a late response', async () => {
  let resolve!: (response: Response) => void;
  const transport = vi.fn().mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
  vi.stubGlobal('fetch', transport);
  const response = harness().request('/api/openai/refine', input);
  await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
  response.emit('close');
  expect(transport.mock.calls[0]![1].signal.aborted).toBe(true);
  resolve(Response.json(completed(presentation)));
  await new Promise(done => setImmediate(done));
  expect(response.writableEnded).toBe(false);
});

it('6000 ms is the single effective server deadline, including exported response config; no retry', async () => {
  vi.useFakeTimers();
  const transport = vi.fn().mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal('fetch', transport);
  const { request } = harness({ OPENAI_REFINEMENT_TIMEOUT_MS: '6000' });
  const response = request('/api/openai/refine', input);
  await vi.advanceTimersByTimeAsync(5999);
  expect(response.writableEnded).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(response.status).toBe(504);
  expect(response.body).toMatchObject({ error: 'timeout', configuration: { timeoutMs: 6000 } });
  expect(transport.mock.calls[0]![1].signal.aborted).toBe(true);
  expect(transport).toHaveBeenCalledOnce();
});
