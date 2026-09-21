import { afterEach, expect, it, vi } from 'vitest';
import { HttpDecisionProvider } from './http-decision-provider';

const input = { evidence: { version: 1, fragments: [{ id: 'f1', text: 'Teacher text.', startMs: 0, endMs: 1 }] }, candidates: [{ id: 'c1', text: 'Teacher text.', sourceFragmentIds: ['f1'] }], currentCue: null };
afterEach(() => vi.useRealTimers());

it('calls only the same-origin decision endpoint with evidence, candidates and current Cue', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ decision: { action: 'NEW_CUE', candidateId: 'c1' } }));
  expect(await new HttpDecisionProvider(transport).decide(input)).toEqual({ action: 'NEW_CUE', candidateId: 'c1' });
  expect(transport.mock.calls[0]![0]).toBe('/api/jev/decide');
  expect(transport.mock.calls[0]![1]?.headers).toEqual({ 'Content-Type': 'application/json' });
  expect(JSON.parse(transport.mock.calls[0]![1]!.body as string)).toEqual(input);
});

it.each([400, 502, 503])('HTTP %s rejects for the Engine to record an observable QUIET fallback', async status => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('secret upstream body', { status }));
  await expect(new HttpDecisionProvider(transport).decide(input)).rejects.not.toThrow('secret upstream body');
  expect(transport).toHaveBeenCalledOnce();
});

it('rejects unknown candidates and missing decisions', async () => {
  for (const value of [{}, { decision: { action: 'NEW_CUE', candidateId: 'invented' } }]) {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(value));
    await expect(new HttpDecisionProvider(transport).decide(input)).rejects.toThrow();
  }
});

it('cancel aborts the browser request without retrying; the server owns the deadline', async () => {
  vi.useFakeTimers();
  const transport = vi.fn<typeof fetch>().mockImplementation((_path, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const provider = new HttpDecisionProvider(transport);
  const result = expect(provider.decide(input)).rejects.toThrow('cancelled or timed out');
  await vi.advanceTimersByTimeAsync(6_500);
  expect(transport.mock.calls[0]![1]?.signal?.aborted).toBe(false);
  provider.cancel();
  await result;
  expect(transport).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
