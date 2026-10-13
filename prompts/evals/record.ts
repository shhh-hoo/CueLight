import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
export const digest = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const fileDigest = (file: string) => createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');
export function codeIdentity() {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const status = git('status', '--porcelain');
  return { gitSha: git('rev-parse', 'HEAD'), dirty: !!status,
    // Include new files too; never omit semantically relevant fields from request hashes.
    dirtyDigest: digest(git('diff', 'HEAD') + '\n' + git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean)
      .map(file => file + ':' + fileDigest(file)).join('\n')) };
}
export const fixtureContracts = { jev: 'lesson-fixture-v1', presentation: 'presentation-whole-final-v1' } as const;
export function frozenCases(task: 'jev' | 'presentation', fallback: unknown[], env = process.env) {
  if (!env.CUELIGHT_EVAL_CORPUS) return fallback;
  const corpus = JSON.parse(readFileSync(env.CUELIGHT_EVAL_CORPUS, 'utf8'));
  if (corpus.format !== 'cuelight-eval-corpus-v1' || corpus.task !== task || corpus.fixtureContract !== fixtureContracts[task] || !Array.isArray(corpus.cases) ||
      digest(corpus.cases) !== corpus.caseDigest) throw new Error('Incompatible or changed frozen corpus.');
  return corpus.cases as unknown[];
}
export function evaluationRecord(task: 'jev' | 'presentation', request: unknown, corpus: unknown[], config: unknown) {
  const files = task === 'jev'
    ? ['prompts/jev-semantic/instructions.ts', 'src/alive/inspection.ts', 'src/decision/jev-choice.ts']
    : ['prompts/presentation-v1/request.ts', 'src/refinement/presentation.ts', 'src/refinement/input.ts'];
  const evaluator = task === 'jev' ? 'prompts/jev-semantic/evals/assertions.ts' : 'prompts/presentation-v1/evals/cases.ts';
  const frozen = process.env.CUELIGHT_EVAL_CORPUS ? JSON.parse(readFileSync(process.env.CUELIGHT_EVAL_CORPUS, 'utf8')) : null;
  if (frozen && (frozen.task !== task || frozen.caseDigest !== digest(corpus) ||
      digest(readFileSync(resolve(dirname(process.env.CUELIGHT_EVAL_CORPUS!), frozen.evaluatorFile), 'utf8')) !== frozen.evaluatorDigest)) {
    throw new Error('Frozen evaluator or corpus changed.');
  }
  return { taskId: task === 'jev' ? 'teaching-understanding' : 'accepted-expression', ...codeIdentity(),
    sourceIdentities: Object.fromEntries(files.map(file => [file, fileDigest(file)])), requestDigest: digest(request),
    caseDigest: digest(corpus), evaluatorDigest: frozen?.evaluatorDigest ?? fileDigest(evaluator), configuration: config,
    requestStatus: 'preview', callStatus: 'NOT_RUN', cacheStatus: 'disabled', failure: null,
    requestedModel: (request as { model?: string })?.model ?? null, actualModel: null as string | null,
    modelBehavior: 'NOT_RUN', humanReview: 'NOT_RUN' };
}

export function blockedRecord(taskId: string, failure: string) {
  return { taskId, ...codeIdentity(), sourceIdentities: null, requestDigest: null, caseDigest: null,
    evaluatorDigest: null, configuration: null, requestedModel: null, actualModel: null,
    requestStatus: 'blocked', callStatus: 'NOT_RUN', cacheStatus: 'disabled', failure,
    modelBehavior: 'NOT_RUN', humanReview: 'NOT_RUN' };
}
