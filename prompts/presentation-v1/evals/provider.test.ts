import { expect, it, vi } from 'vitest';
import type { CallApiContextParams } from 'promptfoo';
import Provider from './provider.ts';
import { cases, constructPresentationFixture } from './cases.ts';
import { buildPresentationRequest, parsePresentationResponse } from '../request.ts';
import { parseRuntimeConfig } from '../../../server/runtime-config.ts';
const context = (caseId: string): CallApiContextParams => ({ vars: { caseId }, prompt: { raw: '{{caseId}}', label: 'fixture' } });
const env = { CUELIGHT_PRESENTATION_EVAL_LIVE: '1', OPENAI_API_KEY: 'offline-test-key' };
const completed = (result: unknown) => ({ model: 'returned-model', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ result }) }] }] });
it.each(cases)('$id uses production eligibility, builder and parser without sending review expectations', async c => {
  const transport = vi.fn(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual(buildPresentationRequest(constructPresentationFixture(c).input!, parseRuntimeConfig({}).refinement));
    expect(String(init?.body)).not.toContain(c.review);
    expect(body).not.toHaveProperty('expected');
    return Response.json(completed({ kind: 'source' }));
  }) as unknown as typeof fetch;
  const result = await new Provider({}, { env, transport }).callApi('ignored text is not a second prompt version', context(c.id));
  expect(result.error).toBeUndefined();
  if (c.partial) {
    expect(transport).not.toHaveBeenCalled();
    expect(result.metadata).toMatchObject({ requestStatus: 'blocked', callStatus: 'NOT_RUN' });
  } else {
    expect(transport).toHaveBeenCalledOnce();
    expect(JSON.parse(String(result.output))).toMatchObject({ result: { kind: 'source' }, semanticGrade: 'UNSCORED' });
    expect(result.metadata).toMatchObject({ requestStatus: 'sent', callStatus: 'completed', cacheStatus: 'disabled', actualModel: 'returned-model' });
  }
});
it.each([
  [{ status: 'incomplete', output: [] }, 'incomplete'],
  [{ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }, 'refused'],
  [completed({ kind: 'presentation', blocks: [{ kind: 'text', text: 'x'.repeat(281) }] }), 'invalid'],
  [completed({ kind: 'source', extra: 'not-allowed' }), 'invalid'],
])('does not turn parser failures into a successful fallback', async (raw, failure) => {
  expect(parsePresentationResponse(raw)).toEqual({ error: failure });
  const result = await new Provider({}, { env, transport: async () => Response.json(raw) }).callApi('', context('numbers-units'));
  expect(result.error).toContain(String(failure)); expect(result.output).toBeUndefined();
  expect(result.metadata).toMatchObject({ callStatus: 'failed', failure });
});
it.each([{ ...env, CI: 'true' }, { OPENAI_API_KEY: 'offline-test-key' }, { CUELIGHT_PRESENTATION_EVAL_LIVE: '1' }])('requires explicit local opt-in and credentials', async env => {
  const transport = vi.fn();
  expect((await new Provider({}, { env, transport }).callApi('', context('numbers-units'))).error).toBeTruthy();
  expect(transport).not.toHaveBeenCalled();
});
it('limits repeated attempts and preserves transport failure', async () => {
  const transport = vi.fn(async () => { throw new Error('private upstream error'); });
  const provider = new Provider({}, { env, transport });
  const first = await provider.callApi('', context('numbers-units'));
  expect(first.error).toContain('unavailable'); expect(first.error).not.toContain('private');
  expect(first.metadata).toMatchObject({ requestStatus: 'sent', callStatus: 'failed' });
  expect((await provider.callApi('', context('numbers-units'))).error).toContain('limit');
  expect(transport).toHaveBeenCalledOnce();
});

it.each(['transport', 'body'] as const)('settles at the deadline while %s ignores abort and discards its late success', async stage => {
  vi.useFakeTimers();
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  let signal: AbortSignal | undefined;
  const transport = vi.fn(async (_url, init) => {
    signal = init?.signal ?? undefined;
    if (stage === 'transport') await delayed;
    const response = Response.json(completed({ kind: 'source' }));
    if (stage === 'body') vi.spyOn(response, 'json').mockImplementation(async () => {
      await delayed;
      return completed({ kind: 'source' });
    });
    return response;
  }) as unknown as typeof fetch;
  try {
    const provider = new Provider({}, { env: { ...env, OPENAI_REFINEMENT_TIMEOUT_MS: '100' }, transport });
    let observed: Awaited<ReturnType<Provider['callApi']>> | undefined;
    const pending = provider.callApi('', context('numbers-units')).then(result => { observed = result; return result; });
    await vi.advanceTimersByTimeAsync(100);
    // Do not release the ignored-abort operation until the timeout has settled.
    expect(observed).toBeDefined();
    expect(signal?.aborted).toBe(true);
    const result = await pending;
    expect(result.error).toContain('timeout');
    expect(result.output).toBeUndefined();
    expect(result.metadata).toMatchObject({ requestStatus: 'sent', callStatus: 'failed', failure: 'timeout', actualModel: null, modelBehavior: 'NOT_RUN' });
    const recorded = JSON.stringify(result);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.stringify(result)).toBe(recorded);
    expect((await provider.callApi('', context('numbers-units'))).error).toContain('limit');
    expect(transport).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    release();
    vi.useRealTimers();
  }
});
