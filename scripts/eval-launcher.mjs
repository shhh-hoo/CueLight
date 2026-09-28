import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function launch(task, mode, args) {
  if (!['jev', 'presentation'].includes(task) || !['validate', 'live', 'view'].includes(mode)) throw new Error('Expected task and validate, live or view.');
  if (mode === 'live' && process.env.CI) throw new Error('Live evaluation is disabled in CI.');
  let config = `promptfooconfig.${task}.yaml`;
  let corpusPath;
  const pass = [];
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!value || !['--env-file', '--output', '--description', '--corpus'].includes(flag)) throw new Error('Allowed options: --env-file, --output, --description, --corpus. No repeat, provider, judge or config overrides.');
    if (flag === '--env-file' && mode !== 'live') throw new Error('Offline reading/validation never loads credentials.');
    if (flag === '--corpus') corpusPath = resolve(value);
    else pass.push(flag, value);
  }
  let maxCalls = task === 'jev' ? 20 : 12;
  if (corpusPath) {
    const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
    const evaluator = resolve(corpusPath, '..', corpus.evaluatorFile);
    if (corpus.format !== 'cuelight-eval-corpus-v1' || corpus.task !== task || corpus.fixtureContract !== (task === 'jev' ? 'lesson-fixture-v1' : 'presentation-whole-final-v1') || hash(corpus.cases) !== corpus.caseDigest || hash(readFileSync(evaluator, 'utf8')) !== corpus.evaluatorDigest) throw new Error('Incompatible or changed frozen corpus/evaluator.');
    maxCalls = corpus.cases.length; // Conservative upper bound, including blocked rows.
    const tests = corpus.cases.map(c => ({ description: c.description ?? c.id, vars: { caseId: c.id },
      metadata: { ...c.metadata, sourceKind: c.sourceKind ?? c.metadata?.sourceKind, use: c.use ?? c.metadata?.use,
        semanticGrade: task === 'presentation' || c.metadata?.kind === 'exploratory' ? 'UNSCORED' : 'ASSERTIONS_SEPARATE', review: c.review },
      ...(task === 'jev' && c.metadata.kind !== 'exploratory' ? { assert: [{ type: 'javascript', value: `file://${evaluator}` }] } : {}),
    }));
    mkdirSync(resolve(root, '.promptfoo'), { recursive: true });
    config = resolve(root, `.promptfoo/${task}-frozen-config.json`);
    writeFileSync(config, JSON.stringify({ description: `Frozen ${task} ${corpus.caseDigest}`, prompts: ['{{caseId}}'],
      providers: [{ id: `file://${resolve(root, `prompts/${task === 'jev' ? 'jev-semantic' : 'presentation-v1'}/evals/provider.ts`)}` }],
      tests, sharing: false, evaluateOptions: { maxConcurrency: 1, cache: false } }, null, 2));
  }
  const commands = { validate: ['validate', 'config', '-c', config], live: ['eval', '-c', config, '--no-cache', '--max-concurrency', '1'], view: ['view'] };
  if (mode === 'live') console.warn(`LIVE: ${task === 'jev' ? 'TypeSafe/Jev' : 'OpenAI'} cost; at most ${maxCalls} calls, no retries, no model judge. Every case at most once. Export automatic results before human scoring.`);
  const result = spawnSync(process.execPath, [resolve(root, 'node_modules/promptfoo/dist/src/entrypoint.js'), ...commands[mode], ...pass], {
    cwd: root, stdio: 'inherit', env: { ...process.env, PROMPTFOO_CONFIG_DIR: resolve(root, '.promptfoo'),
      PROMPTFOO_DISABLE_TELEMETRY: '1', PROMPTFOO_DISABLE_UPDATE: '1', PROMPTFOO_DISABLE_REMOTE_GENERATION: 'true',
      CUELIGHT_JEV_EVAL_LIVE: mode === 'live' && task === 'jev' ? '1' : '0',
      CUELIGHT_PRESENTATION_EVAL_LIVE: mode === 'live' && task === 'presentation' ? '1' : '0',
      CUELIGHT_EVAL_MAX_CALLS: String(maxCalls), CUELIGHT_EVAL_CORPUS: corpusPath ?? '',
    },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
