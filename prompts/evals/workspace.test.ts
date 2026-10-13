import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { tasks } from '../catalog.ts';
const root = process.cwd();
const run = (args: string[], cwd = root, extra = {}) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 60_000,
  env: { PATH: process.env.PATH, CI: 'true', IS_TESTING: 'true', PROMPTFOO_CONFIG_DIR: join(cwd, '.promptfoo'),
    PROMPTFOO_DISABLE_TELEMETRY: '1', PROMPTFOO_DISABLE_UPDATE: '1', PROMPTFOO_DISABLE_REMOTE_GENERATION: 'true', ...extra } });
const script = (name: string, args: string[] = [], cwd = root) => run(['--import', resolve(root, 'scripts/register-ts.mjs'), resolve(root, 'scripts/' + name), ...args], cwd);
function passed(result: ReturnType<typeof run>) { expect(result.error).toBeUndefined(); expect(result.status, result.stdout + result.stderr).toBe(0); }
it('loads Presentation through real Promptfoo loaders and keeps malformed output a failure', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cuelight-presentation-loader-'));
  try {
    const result = run(['prompts/presentation-v1/evals/loader-smoke.mjs'], root, { PROMPTFOO_CONFIG_DIR: directory });
    passed(result); expect(result.stdout).toContain('zero network calls');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 65_000);
it('renders the full handbook with no credentials and every network entry blocked', () => {
  const result = run(['--import', './prompts/evals/no-network.mjs', '--import', './scripts/register-ts.mjs', 'scripts/prompt-handbook.mjs', '--no-open']);
  passed(result);
  const html = readFileSync('.promptfoo/handbook/index.html', 'utf8');
  for (const task of tasks) expect(html).toContain(`id="${task.id}"`);
  expect(html).toContain('原文没有 Y'); expect(html).toContain('NOT_RUN');
  expect(html).toContain('PRIMARY_OPERATION_INSTRUCTIONS'); expect(html).toContain('preview / 未发送');
  expect(html).not.toMatch(/<script|<iframe|<img|<link|href="https?:/);
}, 65_000);
it('compares two isolated Git builders on one frozen corpus; reflects changed conditions and safely escapes source text', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cuelight-version-contract-'));
  try {
    const checkout = join(directory, 'checkout'); mkdirSync(checkout);
    for (const file of ['src','server','prompts','scripts','voice_gateway','package.json','.gitignore']) cpSync(join(root,file),join(checkout,file),{ recursive: true });
    const git = (...args: string[]) => execFileSync('git', args, { cwd: checkout, encoding: 'utf8', env: { ...process.env,
      GIT_AUTHOR_NAME: 'Offline Test', GIT_AUTHOR_EMAIL: 'offline@example.invalid', GIT_COMMITTER_NAME: 'Offline Test', GIT_COMMITTER_EMAIL: 'offline@example.invalid' } });
    git('init'); git('add','.'); git('commit','-m','offline baseline');
    const frozen = join(directory,'frozen'); passed(script('eval-freeze.mjs',['jev',frozen]));
    const corpus = join(frozen,'corpus.json');
    const before = join(directory,'before.json'), after = join(directory,'after.json');
    passed(script('eval-preview.mjs',[checkout,corpus,before]));
    // Same builder/code, two labels must not pass as version comparison.
    expect(script('eval-compare.mjs',[before,before]).status).not.toBe(0);
    const instruction = join(checkout,'prompts/jev-semantic/instructions.ts');
    const old = readFileSync(instruction,'utf8');
    const marker = '<script>alert("offline")</script>';
    writeFileSync(instruction, old.replace('Completion, clarification, added condition', marker + ' Completion, clarification, added condition'));
    git('add','.'); git('commit','-m','offline candidate condition change');
    passed(script('eval-preview.mjs',[checkout,corpus,after]));
    const compared = script('eval-compare.mjs',[before,after]); passed(compared);
    const report = JSON.parse(compared.stdout); expect(report.changed.length).toBeGreaterThan(0);
    const a = JSON.parse(readFileSync(before,'utf8')), b = JSON.parse(readFileSync(after,'utf8'));
    expect(a.gitSha).not.toBe(b.gitSha); expect(a.caseDigest).toBe(b.caseDigest); expect(a.evaluatorDigest).toBe(b.evaluatorDigest);
    expect(JSON.stringify(b.rows)).toContain(marker.replaceAll('"','\\"'));
    const reader = run(['--import', resolve(root,'prompts/evals/no-network.mjs'), '--import',resolve(root,'scripts/register-ts.mjs'),join(checkout,'scripts/prompt-handbook.mjs'),'--no-open'],checkout);
    passed(reader);
    const html = readFileSync(join(checkout,'.promptfoo/handbook/index.html'),'utf8');
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>');
    const changed = { ...b, caseDigest: 'incompatible' }; writeFileSync(after,JSON.stringify(changed));
    expect(script('eval-compare.mjs',[before,after]).status).not.toBe(0);
  } finally { rmSync(directory,{ recursive:true,force:true }); }
}, 65_000);
it.each(['jev','presentation'])('uses the same frozen %s corpus and evaluator through the actual provider loader', task => {
  const directory = mkdtempSync(join(tmpdir(), 'cuelight-frozen-loader-'));
  try {
    passed(script('eval-freeze.mjs',[task,directory]));
    const corpus = join(directory,'corpus.json');
    passed(run([`scripts/${task === 'jev' ? 'jev' : 'presentation'}-eval.mjs`,'validate','--corpus',corpus]));
    const result = run(['prompts/evals/frozen-smoke.mjs'],root,{ CUELIGHT_EVAL_CORPUS:corpus, PROMPTFOO_CONFIG_DIR:join(directory,'db') });
    passed(result); expect(result.stdout).toContain('zero network calls');
  } finally { rmSync(directory,{ recursive:true,force:true }); }
},65_000);
