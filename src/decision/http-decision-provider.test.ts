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

it('only journals allowlisted, matching choice metadata and isolates a failing observer', async () => {
  const diagnostics = { choice: 'NEW_CUE_0', confidence: 0.63, probabilities: { QUIET: 0.2, NEW_CUE_0: 0.8 } };
  const observe = vi.fn(() => { throw new Error('Sink failed'); });
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
    decision: { action: 'NEW_CUE', candidateId: 'c1' }, diagnostics: { ...diagnostics, raw: 'SECRET' },
  }));
  expect(await new HttpDecisionProvider(transport, undefined, observe).decide(input)).toEqual({ action: 'NEW_CUE', candidateId: 'c1' });
  expect(observe).toHaveBeenCalledWith(input, diagnostics);
  for (const invalid of [
    { ...diagnostics, choice: 'QUIET' },
    { ...diagnostics, choice: 'NEW_CUE_99' },
    { ...diagnostics, confidence: 2 },
    { ...diagnostics, probabilities: { QUIET: 0.1, NEW_CUE_0: 0.8, raw: 'SECRET' } },
  ]) {
    const observe = vi.fn();
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ decision: { action: 'NEW_CUE', candidateId: 'c1' }, diagnostics: invalid }));
    await expect(new HttpDecisionProvider(transport, undefined, observe).decide(input)).rejects.toThrow();
    expect(observe).not.toHaveBeenCalled();
  }
});
