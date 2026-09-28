// Launched with the repository TypeScript loader (see package.json).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { cases as jev } from '../prompts/jev-semantic/evals/cases.ts';
import { cases as presentation } from '../prompts/presentation-v1/evals/cases.ts';
import { digest, codeIdentity, fixtureContracts } from '../prompts/evals/record.ts';
const [task, destination] = process.argv.slice(2);
if (!['jev', 'presentation'].includes(task) || !destination) throw new Error('Usage: npm run eval:freeze -- jev|presentation DIRECTORY');
const cases = task === 'jev' ? jev : presentation;
const directory = resolve(destination);
mkdirSync(directory, { recursive: true });
if (existsSync(join(directory, 'corpus.json')) || existsSync(join(directory, 'evaluator.ts'))) throw new Error('Frozen destination already exists; choose a new directory.');
// Freeze executable evaluator, not merely a label. No repository imports remain.
const evaluator = task === 'jev' ? readFileSync(new URL('../prompts/jev-semantic/evals/assertions.ts', import.meta.url), 'utf8')
  .replace("import { getCase } from './cases.ts';", `import { readFileSync } from 'node:fs';\nfunction getCase(id: unknown): any {\n const found = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8')).cases.find((c: any) => c.id === id);\n if (!found) throw new Error('Unknown frozen case');\n return found;\n}`)
  : 'export default function humanReviewOnly() { throw new Error("Presentation semantics are UNSCORED; no automated semantic evaluator."); }\n';
const corpus = { format: 'cuelight-eval-corpus-v1', task, fixtureContract: fixtureContracts[task], cases, caseDigest: digest(cases), evaluatorFile: 'evaluator.ts',
  evaluatorDigest: digest(evaluator), frozenFrom: codeIdentity(), holdout: 'NOT_ESTABLISHED' };
writeFileSync(join(directory, 'evaluator.ts'), evaluator);
writeFileSync(join(directory, 'corpus.json'), JSON.stringify(corpus, null, 2));
console.log(join(directory, 'corpus.json'));
