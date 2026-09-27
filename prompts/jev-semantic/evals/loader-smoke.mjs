// Invoked only by loader.test.ts in a child process with no credentials.
// Promptfoo's real TS loader, test loader and JS grader run with in-memory results.
import assert from 'node:assert/strict';

globalThis.fetch = async () => { throw new Error('No network in Promptfoo loader smoke test.'); };
const { loadApiProvider, evaluate } = await import('promptfoo');
const loaded = await loadApiProvider('file://prompts/jev-semantic/evals/provider.ts');
assert.match((await loaded.callApi('')).error, /disabled/);
const { cases } = await import('./cases.ts');
const { constructFixture } = await import('./fixtures.ts');
const { buildSemanticRequest } = await import('../../../src/alive/inspection.ts');
const { mockJudgmentResponse } = await import('../../../src/alive/inspection-fixtures.ts');
const { JEV_ENDPOINT } = await import('../../../src/decision/jev-decision-provider.ts');
const replies = new Map();
for (const test of cases) {
  if (test.expected.outcome === 'coverage_blocked') continue;
  const { input, cueIds } = constructFixture(test.fixture);
  const e = test.expected;
  // Select a declared allowed fixture answer; this does not measure Jev quality.
  replies.set(JSON.stringify(buildSemanticRequest(input, 'jev-fixture')),
    mockJudgmentResponse(input, c => (e.allowed?.includes(c.action) ?? true) &&
      (!e.cueKey || c.cueId === cueIds[e.cueKey]) && (!e.mode || c.mode === e.mode) &&
      (!e.partId || c.partId === e.partId) && (!e.relationKind || c.relationKind === e.relationKind), e.stance ?? 'asserted'));
}
let calls = 0;
const provider = new loaded.constructor({}, {
  env: { CUELIGHT_JEV_EVAL_LIVE: '1', TYPESAFE_API_KEY: 'offline-test-key', JEV_MODEL: 'jev-fixture' },
  transport: async (url, init) => {
    assert.equal(url, JEV_ENDPOINT);
    assert.ok(replies.has(init.body), 'Unexpected request body; only authored responses are allowed.');
    calls++;
    return Response.json(replies.get(init.body));
  },
});
const record = await evaluate({ prompts: ['{{caseId}}'], providers: [provider],
  tests: 'file://prompts/jev-semantic/evals/cases.ts', sharing: false, writeLatestResults: false,
}, { cache: false, maxConcurrency: 1 });
const summary = await record.toEvaluateSummary();
assert.equal(summary.results.length, cases.length);
assert.equal(summary.stats.successes, cases.length, JSON.stringify(summary.results.filter(r => !r.success).map(r => r.error)));
assert.equal(calls, replies.size);
console.log('Promptfoo loader smoke passed: authored responses only; zero network calls.');
