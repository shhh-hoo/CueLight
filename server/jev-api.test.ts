import { createServer, get, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCandidates } from '../src/candidates/candidate-builder';
import { CueEngine } from '../src/cue/cue-engine';
import { HttpDecisionProvider } from '../src/decision/http-decision-provider';
import { appendEvidence, emptyEvidence } from '../src/evidence/evidence-buffer';
import { replayFixtures } from '../src/replay/replay-fixtures';
import { createJevMiddleware, MAX_REQUEST_BYTES } from './jev-api';

const fragment = { id: 'f1', text: 'A Python list is mutable.', startMs: 0, endMs: 1 };
const evidence = appendEvidence(emptyEvidence(), fragment);
const input = { evidence, candidates: buildCandidates(evidence, null), currentCue: null };
const answer = { answers: { cue: { type: 'choice', choice: 'NEW_CUE_0', confidence: 1, probabilities: { QUIET: 0, NEW_CUE_0: 1 } } } };
const servers: Server[] = [];

async function bridge(options: Parameters<typeof createJevMiddleware>[0]) {
  const handler = createJevMiddleware(options);
  const server = createServer((request, response) => handler(request, response, () => { response.writeHead(404); response.end(); }));
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No local address');
  const url = `http://127.0.0.1:${address.port}`;
  return { url, post: (body: unknown = input) => fetch(`${url}/api/jev/decide`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url }, body: JSON.stringify(body) }) };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
});

describe('real local HTTP bridge with fake upstream Jev', () => {
  it('reports missing configuration and does not issue an upstream request', async () => {
    const transport = vi.fn<typeof fetch>();
    const { url, post } = await bridge({ transport });
    expect(await (await fetch(`${url}/api/jev/status`)).json()).toEqual({ configured: false, model: 'jev-latest', timeoutMs: 5000, contextVersion: 'structured-v3' });
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty('error');
    expect(transport).not.toHaveBeenCalled();
  });

  it('status reveals only readiness/model, then a validated choice reaches the Cue Engine through HTTP', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(answer));
    const { url } = await bridge({ apiKey: 'fake-local-key', model: 'jev-latest', transport });
    const response = await fetch(`${url}/api/jev/status`);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ configured: true, model: 'jev-latest', timeoutMs: 5000, contextVersion: 'structured-v3' });
    const provider = new HttpDecisionProvider((path, init) => fetch(`${url}${path}`, init));
    const engine = new CueEngine(provider);
    engine.accept(fragment);
    await vi.waitFor(() => expect(engine.getSnapshot().status).toBe('idle'));
    expect(engine.getSnapshot().cues.currentCue?.text).toBe(fragment.text);
    expect(engine.getSnapshot().lastDecision?.outcome).toBe('applied');
    expect(engine.getSnapshot().lastDecision?.durationMs).toBeGreaterThanOrEqual(0);
    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0]![0]).toBe('https://api.typesafe.ai/v1/systemone');
    expect(transport.mock.calls[0]![1]?.headers).toHaveProperty('Authorization', 'Bearer fake-local-key');
    engine.dispose();
  });

  it.each([
    { ...input, candidates: [{ ...input.candidates[0], text: 'An invented summary' }] },
    { ...input, candidates: [{ ...input.candidates[0], id: 'forged-id' }] },
    { ...input, candidates: [] },
    { ...input, evidence: { ...evidence, version: -1 } },
    { ...input, evidence: { ...evidence, fragments: Array(33).fill(fragment) } },
    { ...input, evidence: { ...evidence, fragments: [{ ...fragment, text: 'x'.repeat(4097) }] } },
    { ...input, currentCue: { id: 'c1', text: 'hello', sourceFragmentIds: [], createdAt: 0, updatedAt: 0 } },
    { ...input, currentCue: { id: 'c1', text: 'hello', sourceFragmentIds: ['f1'], createdAt: 10, updatedAt: 0 } },
    null,
  ])('rejects malformed or ungrounded browser input before the upstream call (%#)', async body => {
    const transport = vi.fn<typeof fetch>();
    const { post } = await bridge({ apiKey: 'fake-local-key', transport });
    expect((await post(body)).status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
  });

  it('accepts a full replay including current-Cue expansion through the real local HTTP boundary', async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async (_path, init) => {
      const request = JSON.parse(init!.body as string);
      const state = request.state;
      const latest = state.latestInput.id;
      const action = latest === 'science-2' || latest === 'science-5' ? 'NEW_CUE' : latest === 'science-3' ? 'UPDATE_CURRENT' : 'QUIET';
      const choice = action === 'QUIET' ? 'QUIET' : `${action}_${action === 'UPDATE_CURRENT' ? 1 : 0}`;
      return Response.json({ answers: { cue: { type: 'choice', choice, confidence: 1,
        probabilities: Object.fromEntries(Object.keys(request.questions.cue.criteria).map(key => [key, key === choice ? 1 : 0])),
      } } });
    });
    const { url } = await bridge({ apiKey: 'fake-local-key', transport });
    const engine = new CueEngine(new HttpDecisionProvider((path, init) => fetch(`${url}${path}`, init)));
    const actions: string[] = [];
    for (const entry of replayFixtures[0]!.entries) {
      engine.accept(entry.fragment);
      await vi.waitFor(() => expect(engine.getSnapshot().status).toBe('idle'));
      actions.push(engine.getSnapshot().lastDecision!.decision.action);
      expect(engine.getSnapshot().lastDecision?.error).toBeNull();
    }
    expect(actions).toEqual(['QUIET', 'NEW_CUE', 'UPDATE_CURRENT', 'QUIET', 'NEW_CUE', 'QUIET', 'QUIET']);
    expect(engine.getSnapshot().cues.previousCue?.sourceFragmentIds).toEqual(['science-2', 'science-3']);
    expect(engine.getSnapshot().cues.currentCue?.sourceFragmentIds).toEqual(['science-5']);
    expect(transport).toHaveBeenCalledTimes(7);
    engine.dispose();
  });

  it('enforces local same-origin access, method, JSON content type and body size', async () => {
    const transport = vi.fn<typeof fetch>();
    const { url } = await bridge({ apiKey: 'fake-local-key', transport });
    expect((await fetch(`${url}/api/jev/decide`, { method: 'POST', headers: { Origin: 'https://unrelated.example' } })).status).toBe(403);
    const foreignHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      get(`${url}/api/jev/status`, { headers: { Host: 'unrelated.example' } }, response => {
        response.resume(); resolve(response.statusCode);
      }).on('error', reject);
    });
    expect(foreignHostStatus).toBe(403);
    expect((await fetch(`${url}/api/jev/decide`)).status).toBe(405);
    expect((await fetch(`${url}/api/jev/decide`, { method: 'POST', body: '{}' })).status).toBe(415);
    expect((await fetch(`${url}/api/jev/decide`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' })).status).toBe(400);
    expect((await fetch(`${url}/api/jev/decide`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(MAX_REQUEST_BYTES + 1) })).status).toBe(413);
    expect(transport).not.toHaveBeenCalled();
  });

  it('upstream failure stays distinguishable from a successful QUIET and never exposes keys or raw exceptions', async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error('fake-local-key in unsafe upstream error'));
    const { url, post } = await bridge({ apiKey: 'fake-local-key', transport });
    const response = await post();
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain('fake-local-key');
    expect(text).not.toContain('unsafe upstream');
    const engine = new CueEngine(new HttpDecisionProvider((path, init) => fetch(`${url}${path}`, init)));
    engine.accept(fragment);
    await vi.waitFor(() => expect(engine.getSnapshot().status).toBe('idle'));
    expect(engine.getSnapshot().cues.currentCue).toBeNull();
    expect(engine.getSnapshot().lastDecision).toMatchObject({ decision: { action: 'QUIET' }, outcome: 'fallback' });
    engine.dispose();
  });

  it('client cancellation aborts the upstream request', async () => {
    let signal: AbortSignal | undefined;
    const transport = vi.fn<typeof fetch>().mockImplementation((_path, init) => new Promise((_resolve, reject) => {
      signal = init?.signal ?? undefined;
      signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
    }));
    const { url } = await bridge({ apiKey: 'fake-local-key', transport });
    const controller = new AbortController();
    const result = fetch(`${url}/api/jev/decide`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: controller.signal }).catch(() => null);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
    controller.abort();
    await result;
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
  });
});
