import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DecisionInput } from './decision-provider';
import { buildJevRequest, JevDecisionProvider, JEV_ENDPOINT } from './jev-decision-provider';
import { assertJevContext, JEV_CONTEXT_VERSION } from './jev-context';

const input: DecisionInput = {
  evidence: { version: 1, fragments: [{ id: 'f1', text: 'A list is mutable.', startMs: 0, endMs: 1 }] },
  candidates: [{ id: '["f1"]', text: 'A list is mutable.', sourceFragmentIds: ['f1'] }],
  currentCue: null,
};
function answer(choice = 'NEW_CUE_0', probabilities = { QUIET: 0.1, NEW_CUE_0: 0.9 }) {
  return { model: 'jev-1.13.0', answers: { cue: { type: 'choice', choice, confidence: 0.9, probabilities } }, usage: { input_tokens: 20, output_tokens: 10 } };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Jev contract, fake transport only', () => {
  it('labels only arrived evidence and preserves current provenance without inventing evicted source text', () => {
    const currentCue = { id: 'c1', text: 'Earlier point.', sourceRevision: 1, sourceFragmentIds: ['f0'], createdAt: 0, updatedAt: 0 };
    const request = buildJevRequest({ ...input, currentCue });
    expect(request.body.state).toMatchObject({
      latestInput: input.evidence.fragments[0], backgroundEvidence: [],
      currentCue: { text: 'Earlier point.', sourceFragmentIds: ['f0'], sourceEvidenceStillInWindow: [], completeSourceStillInWindow: false },
    });
    expect(request.options.get('UPDATE_CURRENT_0')).toEqual({ action: 'UPDATE_CURRENT', candidateId: '["f1"]' });
    expect(request.body.state.candidates[0]?.text).toBe(input.candidates[0]!.text);
  });

  it('constructs one bounded choice question with no generated-text output path', () => {
    const request = buildJevRequest(input);
    expect(request.body.model).toBe('jev-latest');
    expect(Object.keys(request.body.questions)).toEqual(['cue']);
    expect(request.body.questions.cue.type).toBe('choice');
    expect(request.body.questions.cue.instructions).toContain('`latestInput.text`');
    expect(request.body.questions.cue.criteria.NEW_CUE_0).toContain('`candidates[0].text`');
    expect([...request.options.keys()]).toEqual(['QUIET', 'NEW_CUE_0']);
    expect(request.body.state.currentCue).toBeNull();
    expect(request.body.state.candidates[0]?.text).toBe(input.candidates[0]!.text);
    expect(request.options.get('NEW_CUE_0')).toEqual({ action: 'NEW_CUE', candidateId: '["f1"]' });
    const withCurrent = buildJevRequest({ ...input, currentCue: { id: 'c1', text: 'Earlier point.', sourceRevision: 1, sourceFragmentIds: ['f0'], createdAt: 0, updatedAt: 0 } });
    expect([...withCurrent.options.keys()]).toEqual(['QUIET', 'NEW_CUE_0', 'UPDATE_CURRENT_0']);
    expect(withCurrent.options.get('UPDATE_CURRENT_0')).toEqual({ action: 'UPDATE_CURRENT', candidateId: '["f1"]' });
    expect(withCurrent.body.questions.cue.criteria.UPDATE_CURRENT_0).toContain('does not append');
    const empty = buildJevRequest({ evidence: { version: 0, fragments: [] }, candidates: [], currentCue: null });
    for (const { body } of [request, withCurrent, empty]) {
      const question = body.questions.cue;
      for (const text of [question.instructions, ...Object.values(question.criteria)]) {
        for (const [, path] of text.matchAll(/`([^`]+)`/g)) {
          let value: unknown = body.state;
          for (const key of path!.replace(/\[(\d+)\]/g, '.$1').split('.')) {
            value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
          }
          expect(value, `Unresolved state path: ${path}`).not.toBeUndefined();
        }
      }
    }
  });

  it('uses only V3 and rejects stale or invalid environment configuration', () => {
    expect(JEV_CONTEXT_VERSION).toBe('structured-v3');
    for (const value of [undefined, '', ' ', 'structured-v3']) expect(() => assertJevContext(value)).not.toThrow();
    for (const value of ['baseline-v1', 'structured-v2', 'typo']) {
      expect(() => assertJevContext(value)).toThrow('Only structured-v3 is supported');
    }
  });

  it('sends the verified endpoint, Bearer authentication and selectable model, and maps a choice to a supplied ID', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(answer()));
    const provider = new JevDecisionProvider({ apiKey: 'fake-test-key', model: 'test-model', transport });
    expect(await provider.decide(input)).toEqual({ action: 'NEW_CUE', candidateId: '["f1"]' });
    expect(transport).toHaveBeenCalledOnce();
    const [url, init] = transport.mock.calls[0]!;
    expect(url).toBe(JEV_ENDPOINT);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ Authorization: 'Bearer fake-test-key', 'Content-Type': 'application/json' });
    expect(JSON.parse(init!.body as string).model).toBe('test-model');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('accepts QUIET and a valid UPDATE choice', async () => {
    const quiet = new JevDecisionProvider({ apiKey: 'test', transport: vi.fn<typeof fetch>().mockResolvedValue(Response.json(answer('QUIET', { QUIET: 1, NEW_CUE_0: 0 }))) });
    expect(await quiet.decide(input)).toEqual({ action: 'QUIET' });
    const withCurrent = { ...input, currentCue: { id: 'c1', text: 'Earlier point.', sourceRevision: 1, sourceFragmentIds: ['f0'], createdAt: 0, updatedAt: 0 } };
    const update = new JevDecisionProvider({ apiKey: 'test', transport: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ answers: { cue: { type: 'choice', choice: 'UPDATE_CURRENT_0', confidence: 1, probabilities: { QUIET: 0, NEW_CUE_0: 0, UPDATE_CURRENT_0: 1 } } } })) });
    expect(await update.decide(withCurrent)).toEqual({ action: 'UPDATE_CURRENT', candidateId: '["f1"]' });
  });

  it.each([401, 422, 429, 529])('HTTP %s falls back to QUIET, with no retries', async status => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('error', { status }));
    const onError = vi.fn();
    expect(await new JevDecisionProvider({ apiKey: 'test', transport, onError }).decide(input)).toEqual({ action: 'QUIET' });
    expect(onError).toHaveBeenCalledWith(`Jev HTTP ${status}.`);
    expect(transport).toHaveBeenCalledOnce();
  });

  it.each([
    {}, { answers: { cue: { type: 'choice', choice: 'NEW_CUE_0' } } },
    answer('NEW_CUE_99'), answer('UPDATE_CURRENT_0'),
    { answers: { cue: { type: 'text', text: 'Invented summary' } } },
    answer('NEW_CUE_0', { QUIET: -1, NEW_CUE_0: 2 }),
    answer('NEW_CUE_0', { QUIET: 0.9, NEW_CUE_0: 0.9 }),
  ])('invalid responses cannot alter Cue text (%j)', async value => {
    const onError = vi.fn();
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(value));
    expect(await new JevDecisionProvider({ apiKey: 'test', transport, onError }).decide(input)).toEqual({ action: 'QUIET' });
    expect(onError).toHaveBeenCalledOnce();
  });

  it('network rejection and non-JSON response are safe fallbacks', async () => {
    for (const transport of [
      vi.fn<typeof fetch>().mockRejectedValue(new Error('Offline')),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('not JSON')),
    ]) {
      expect(await new JevDecisionProvider({ apiKey: 'test', transport }).decide(input)).toEqual({ action: 'QUIET' });
      expect(transport).toHaveBeenCalledOnce();
    }
  });

  it('times out after 5 seconds even if transport ignores cancellation, without retrying', async () => {
    vi.useFakeTimers();
    const transport = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const onError = vi.fn();
    const result = new JevDecisionProvider({ apiKey: 'test', transport, onError }).decide(input);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await result).toEqual({ action: 'QUIET' });
    expect(transport.mock.calls[0]![1]!.signal?.aborted).toBe(true);
    expect(onError).toHaveBeenCalledWith('Jev request timed out.');
    expect(transport).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not call transport without candidates or credentials, and rejects browser construction', async () => {
    const transport = vi.fn<typeof fetch>();
    expect(await new JevDecisionProvider({ apiKey: '', transport }).decide(input)).toEqual({ action: 'QUIET' });
    expect(await new JevDecisionProvider({ apiKey: 'test', transport }).decide({ ...input, candidates: [] })).toEqual({ action: 'QUIET' });
    expect(transport).not.toHaveBeenCalled();
    vi.stubGlobal('window', {});
    expect(() => new JevDecisionProvider({ apiKey: 'test', transport })).toThrow('server-side');
  });

  it('a throwing diagnostic callback cannot change the QUIET fallback', async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error('Offline'));
    const provider = new JevDecisionProvider({ apiKey: 'test', transport, onError: () => { throw new Error('Diagnostic sink failed'); } });
    expect(await provider.decide(input)).toEqual({ action: 'QUIET' });
  });

  it('an already-cancelled caller does not issue an upstream request', async () => {
    const transport = vi.fn<typeof fetch>();
    const controller = new AbortController();
    controller.abort();
    expect(await new JevDecisionProvider({ apiKey: 'test', transport, signal: controller.signal }).decide(input)).toEqual({ action: 'QUIET' });
    expect(transport).not.toHaveBeenCalled();
  });
});
