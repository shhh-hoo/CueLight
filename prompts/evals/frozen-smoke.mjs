import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
globalThis.fetch = async () => { throw new Error('Network forbidden.'); };
const corpusPath = process.env.CUELIGHT_EVAL_CORPUS;
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
const { loadApiProvider, evaluate } = await import('promptfoo');
const isJev = corpus.task === 'jev';
const loaded = await loadApiProvider(`file://prompts/${isJev ? 'jev-semantic' : 'presentation-v1'}/evals/provider.ts`);
const { constructFixture } = await import('../jev-semantic/evals/fixtures.ts');
const { buildSemanticRequest } = await import('../../src/alive/inspection.ts');
const { mockJudgmentResponse } = await import('../../src/alive/inspection-fixtures.ts');
const replies = new Map();
if (isJev) for (const c of corpus.cases) {
  if (c.expected.outcome === 'coverage_blocked') continue;
  const { input, cueIds } = constructFixture(c.fixture), e = c.expected;
  replies.set(JSON.stringify(buildSemanticRequest(input)), mockJudgmentResponse(input, o =>
    (e.allowed?.includes(o.action) ?? true) && (!e.cueKey || o.cueId === cueIds[e.cueKey]) &&
    (!e.mode || o.mode === e.mode) && (!e.partId || o.partId === e.partId) && (!e.relationKind || o.relationKind === e.relationKind), e.stance ?? 'asserted'));
}
let calls = 0;
const provider = new loaded.constructor({}, { env: { CUELIGHT_JEV_EVAL_LIVE: '1', CUELIGHT_PRESENTATION_EVAL_LIVE: '1', TYPESAFE_API_KEY: 'offline', OPENAI_API_KEY: 'offline', CUELIGHT_EVAL_CORPUS: corpusPath },
  transport: async (_url, init) => { calls++; if (isJev) { assert.ok(replies.has(init.body)); return Response.json(replies.get(init.body)); }
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"result":{"kind":"source"}}' }] }] }); },
});
const config = JSON.parse(readFileSync(`.promptfoo/${corpus.task}-frozen-config.json`, 'utf8'));
const record = await evaluate({ ...config, providers: [provider], writeLatestResults: false }, { cache: false, maxConcurrency: 1 });
const summary = await record.toEvaluateSummary();
assert.equal(summary.results.length, corpus.cases.length);
assert.equal(summary.stats.successes, corpus.cases.length);
assert.equal(calls, isJev ? 20 : 12);
for (const result of summary.results) {
  assert.equal(result.response.metadata.caseDigest, corpus.caseDigest);
  assert.equal(result.response.metadata.evaluatorDigest, corpus.evaluatorDigest);
}
// A changed evaluator must block before transport, even when case IDs are unchanged.
const evaluator = resolve(dirname(corpusPath), corpus.evaluatorFile), original = readFileSync(evaluator,'utf8');
try {
  writeFileSync(evaluator, original + '\n// changed');
  const fresh = new loaded.constructor({}, { env: { CUELIGHT_JEV_EVAL_LIVE:'1', CUELIGHT_PRESENTATION_EVAL_LIVE:'1', TYPESAFE_API_KEY:'offline', OPENAI_API_KEY:'offline', CUELIGHT_EVAL_CORPUS:corpusPath }, transport: async () => { throw new Error('Should never call transport'); } });
  const result = await fresh.callApi('', { vars: { caseId:corpus.cases[0].id } });
  assert.ok(result.error);
} finally { writeFileSync(evaluator,original); }
console.log(`Frozen ${corpus.task} corpus/evaluator loaded by Promptfoo; zero network calls.`);
