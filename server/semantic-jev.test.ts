import { createServer, type Server } from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';
import { CueEngine } from '../src/cue/cue-engine';
import { HttpSemanticProvider } from '../src/decision/http-semantic-provider';
import { SessionDiagnostics } from '../src/speechmatics/session-diagnostics';
import { captureInspection } from '../src/alive/inspection';
import { accounting } from '../src/alive/evidence';
import { fixtureHost } from '../src/alive/fixtures';
import { createJevMiddleware } from './jev-api';
import { inspectWithJev } from './semantic-jev';

const servers: Server[] = [];
async function bridge(transport: typeof fetch) {
  const handler = createJevMiddleware({ apiKey: 'fake-local-key', model: 'jev-test', transport });
  const server = createServer((req, res) => handler(req, res, () => { res.writeHead(404); res.end(); })); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing test server');
  const url = `http://127.0.0.1:${address.port}`;
  return { url, provider: new HttpSemanticProvider((path, init) => fetch(`${url}${path}`, init)),
    post: (body: unknown) => fetch(`${url}/api/jev/inspect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) };
}
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise<void>(resolve => s.close(() => resolve())))); });
function input() {
  const h = fixtureHost(); h.record('A is X.'); return captureInspection(h.store.getSnapshot(), 'i1')!;
}
it('round trips the native contract through HTTP, compiler, acceptance and trace with server reconstructed choices', async () => {
  const transport = vi.fn<typeof fetch>(async (_url, init) => {
    const request = JSON.parse(init!.body as string);
    const key = Object.keys(request.questions.operation.criteria).find(key => request.questions.operation.criteria[key].operation === 'CREATE')!;
    return Response.json({ model: 'jev-resolved-test', privateBody: 'DO-NOT-EXPORT', answers: Object.fromEntries(
      Object.entries(request.questions).map(([name, question]) => {
        const choice = name === 'operation' ? key : name === 'relationEvidence' ? 'NONE' : 'asserted';
        return [name, { type: 'choice', choice, confidence: 0.19, privateField: 'DO-NOT-EXPORT',
          probabilities: Object.fromEntries(Object.keys((question as any).criteria).map(k => [k, k === choice ? 1 : 0])) }];
      })) });
  });
  const { provider } = await bridge(transport), engine = new CueEngine(provider), diagnostics = new SessionDiagnostics('test');
  engine.configureTeacherCapture(engine.getSnapshot().lesson.sessionId); const detach = diagnostics.attach(engine);
  engine.accept({ id: 'f', text: 'A is X.', startMs: 0, endMs: 1, language: 'en' }); await engine.drain();
  expect(engine.getSnapshot().lastSemantic?.outcome).toBe('accepted');
  expect(engine.getSnapshot().cues.currentCue?.text).toBe('A is X.');
  expect(transport).toHaveBeenCalledOnce();
  const request = JSON.parse(transport.mock.calls[0]![1]!.body as string);
  expect(request.state).not.toHaveProperty('currentCue');
  expect(request.state.sourceMetadata[0]).toMatchObject({ id: 'f', language: 'en' });
  expect(request.questions.operation.type).toBe('choice');
  expect(engine.getSnapshot().lastSemantic?.request).toEqual(request);
  expect(engine.getSnapshot().lastSemantic?.judgment?.model).toBe('jev-resolved-test');
  expect(transport.mock.calls[0]![1]?.headers).toHaveProperty('Authorization', 'Bearer fake-local-key');
  expect(diagnostics.export().uniqueSemanticProviderAttempts).toBe(1);
  expect(JSON.stringify(diagnostics.export())).not.toMatch(/fake-local-key|Authorization|DO-NOT-EXPORT|privateField/);
  expect(engine.exportLesson().events.at(-1)?.inspection?.evidenceScope[0]?.quote).toBe('A is X.');
  detach(); engine.dispose();
});
it.each(['quote', 'range', 'revision', 'too-many-sources'] as const)('rejects invalid %s before upstream', async bad => {
  const transport = vi.fn<typeof fetch>(), { post } = await bridge(transport), value = structuredClone(input()) as any;
  if (bad === 'quote') value.sources[0].ranges[0].quote = 'invented';
  if (bad === 'range') value.sources[0].ranges[0].end = 100;
  if (bad === 'revision') value.workingSet.readSet.processing.f1 = -1;
  if (bad === 'too-many-sources') value.sources = Array(4).fill(value.sources[0]);
  expect((await post(value)).status).toBe(400); expect(transport).not.toHaveBeenCalled();
});
it.each(['invalid-choice', 'malformed', 'transport'] as const)('%s is a visible failed attempt with no accounted evidence', async failure => {
  const transport = vi.fn<typeof fetch>(async () => {
    if (failure === 'transport') throw new Error('fake-local-key unsafe-error');
    return Response.json(failure === 'malformed' ? {} : { model: 'test', answers: { operation: { type: 'choice', choice: 'invented', confidence: 1, probabilities: { invented: 1 } } } });
  });
  const { provider } = await bridge(transport), engine = new CueEngine(provider);
  engine.configureTeacherCapture(engine.getSnapshot().lesson.sessionId);
  engine.accept({ id: 'f', text: 'A.', startMs: 0, endMs: 1 }); await engine.drain();
  expect(engine.getSnapshot().lastSemantic?.outcome).toBe('provider_failure');
  expect(engine.getSnapshot().lastSemantic?.failureKind).toBe(failure === 'invalid-choice' ? 'invalid_choice' : failure === 'malformed' ? 'malformed_response' : 'transport');
  expect(accounting(engine.getSnapshot().lesson).accountedCodeUnits).toBe(0);
  expect(JSON.stringify(engine.getSnapshot().lastSemantic)).not.toMatch(/fake-local-key|unsafe-error/); engine.dispose();
});
it('server timeout is a rejection even when upstream ignores cancellation', async () => {
  const transport = vi.fn<typeof fetch>(() => new Promise(() => {}));
  await expect(inspectWithJev(input(), { apiKey: 'test', model: 'test', timeoutMs: 5, transport })).rejects.toThrow(/timed out/);
  expect(transport.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
});
it('browser cancellation aborts the matching semantic request', async () => {
  let signal: AbortSignal | undefined;
  const transport = vi.fn<typeof fetch>((_path, init) => new Promise((_resolve, reject) => {
    signal = init?.signal ?? undefined; signal?.addEventListener('abort', () => reject(new Error('Cancelled')));
  }));
  const { provider } = await bridge(transport); const result = provider.inspect(input());
  await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce()); provider.cancel();
  await expect(result).rejects.toThrow(); await vi.waitFor(() => expect(signal?.aborted).toBe(true));
});
