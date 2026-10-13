// Real Promptfoo loaders, no credentials and only authored mock HTTP replies.
import assert from 'node:assert/strict';
globalThis.fetch = async () => { throw new Error('Network forbidden.'); };
const { loadApiProvider, evaluate } = await import('promptfoo');
const loaded = await loadApiProvider('file://prompts/presentation-v1/evals/provider.ts');
assert.match((await loaded.callApi('')).error, /disabled/);
const { cases, constructPresentationFixture } = await import('./cases.ts');
const { buildPresentationRequest } = await import('../request.ts');
const { parseRuntimeConfig } = await import('../../../server/runtime-config.ts');
let calls = 0;
const requests = new Set(cases.filter(c => !c.partial).map(c => JSON.stringify(buildPresentationRequest(constructPresentationFixture(c).input, parseRuntimeConfig({}).refinement))));
const provider = new loaded.constructor({}, { env: { CUELIGHT_PRESENTATION_EVAL_LIVE: '1', OPENAI_API_KEY: 'offline-test-key', CUELIGHT_EVAL_MAX_CALLS: '12' },
  transport: async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.ok(requests.has(init.body)); calls++;
    return Response.json({ status: 'completed', model: 'authored-mock', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"result":{"kind":"source"}}' }] }] });
  },
});
const record = await evaluate({ prompts: ['{{caseId}}'], providers: [provider], tests: 'file://prompts/presentation-v1/evals/cases.ts', sharing: false, writeLatestResults: false }, { cache: false, maxConcurrency: 1 });
const summary = await record.toEvaluateSummary();
assert.equal(summary.results.length, cases.length);
assert.equal(summary.stats.successes, cases.length); // Transport/structure only; NOT semantic scores.
assert.equal(calls, cases.filter(c => !c.partial).length);
assert.ok(summary.results.every(r => r.testCase.metadata.semanticGrade === 'UNSCORED'));
const broken = new loaded.constructor({}, { env: { CUELIGHT_PRESENTATION_EVAL_LIVE: '1', OPENAI_API_KEY: 'offline-test-key', CUELIGHT_EVAL_MAX_CALLS: '12' }, transport: async () => Response.json({ status: 'completed', output: [] }) });
const failure = await broken.callApi('', { vars: { caseId: cases[0].id } });
assert.match(failure.error, /invalid/); assert.equal(failure.output, undefined);
console.log('Presentation Promptfoo loader smoke: 13 authored rows, 12 mock calls, zero network calls; semantics UNSCORED.');
