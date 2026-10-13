// Launched with the repository TypeScript loader (see package.json).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const [checkout, corpusFile, output] = process.argv.slice(2);
if (!checkout || !corpusFile || !output) throw new Error('Usage: npm run eval:preview -- CHECKOUT CORPUS_JSON OUTPUT_JSON');
globalThis.fetch = async () => { throw new Error('No networking in preview.'); };
const corpusPath = resolve(corpusFile), corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
const digest = v => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
if (corpus.format !== 'cuelight-eval-corpus-v1' || !['jev','presentation'].includes(corpus.task) || digest(corpus.cases) !== corpus.caseDigest || digest(readFileSync(resolve(dirname(corpusPath), corpus.evaluatorFile), 'utf8')) !== corpus.evaluatorDigest) throw new Error('Incompatible or changed corpus/evaluator.');
const load = path => import(pathToFileURL(resolve(checkout, path)).href);
const { parseRuntimeConfig } = await load('server/runtime-config.ts');
const config = parseRuntimeConfig({});
const { codeIdentity, evaluationRecord, fixtureContracts } = await load('prompts/evals/record.ts');
if (corpus.fixtureContract !== fixtureContracts[corpus.task]) throw new Error('Incompatible fixture contract; explicit adaptation required.');
process.env.CUELIGHT_EVAL_CORPUS = corpusPath;
const identity = codeIdentity();
const rows = [];
for (const c of corpus.cases) {
  let request, blocked = false;
  if (corpus.task === 'jev') {
    const { constructFixture } = await load('prompts/jev-semantic/evals/fixtures.ts');
    const { buildSemanticRequest, validateSemanticInput, MAX_REQUEST_CODE_UNITS } = await load('src/alive/inspection.ts');
    const { input } = constructFixture(c.fixture);
    request = buildSemanticRequest(input, config.jev.model);
    blocked = request.state.coverage.contextBlocked || JSON.stringify(request).length > MAX_REQUEST_CODE_UNITS;
    if (!blocked) validateSemanticInput(input);
  } else {
    const { constructPresentationFixture } = await load('prompts/presentation-v1/evals/cases.ts');
    const { buildPresentationRequest, validatePresentationInput } = await load('prompts/presentation-v1/request.ts');
    const { input, current } = constructPresentationFixture(c);
    blocked = !input || !current;
    if (!blocked) { validatePresentationInput(input, config.refinement.maxInputChars); request = buildPresentationRequest(input, config.refinement); }
  }
  rows.push({ ...evaluationRecord(corpus.task, request ?? null, corpus.cases, corpus.task === 'jev' ? config.jev : config.refinement), caseId: c.id, requestStatus: blocked ? 'blocked' : 'preview', callStatus: 'NOT_RUN',
    request: request ?? null, requestDigest: digest(request ?? null) });
}
const path = resolve(output); mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify({ format: 'cuelight-eval-preview-v1', task: corpus.task, ...identity,
  caseDigest: corpus.caseDigest, evaluatorDigest: corpus.evaluatorDigest, configuration: config,
  rows, semantics: 'NOT_RUN', comparisonScope: 'system-version (inspect candidate/state/schema differences before attributing to wording)' }, null, 2));
console.log(path);
