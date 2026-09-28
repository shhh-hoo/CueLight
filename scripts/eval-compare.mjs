import { readFileSync } from 'node:fs';
const paths = process.argv.slice(2);
if (paths.length !== 2) throw new Error('Usage: npm run eval:compare -- BEFORE_JSON AFTER_JSON');
const [a,b] = paths.map(p => JSON.parse(readFileSync(p,'utf8')));
if (a.format !== 'cuelight-eval-preview-v1' || b.format !== a.format || a.task !== b.task ||
    a.caseDigest !== b.caseDigest || a.evaluatorDigest !== b.evaluatorDigest || JSON.stringify(a.configuration) !== JSON.stringify(b.configuration) ||
    JSON.stringify(a.rows.map(r=>r.caseId)) !== JSON.stringify(b.rows.map(r=>r.caseId))) throw new Error('Incompatible corpus, evaluator, configuration or cases; comparison blocked. Record an explicit adaptation before comparing.');
if (a.gitSha === b.gitSha && a.dirtyDigest === b.dirtyDigest) throw new Error('Same code identity; changing labels is not a version comparison.');
console.log(JSON.stringify({ task: a.task, before: { sha:a.gitSha, dirty:a.dirty }, after: { sha:b.gitSha, dirty:b.dirty },
  caseDigest:a.caseDigest, evaluatorDigest:a.evaluatorDigest, scope:'system-version; manual diff required to attribute wording-only changes',
  changed: a.rows.flatMap((r,i)=>r.requestDigest === b.rows[i].requestDigest && r.requestStatus === b.rows[i].requestStatus ? [] : [{ caseId:r.caseId, before:r.requestDigest, after:b.rows[i].requestDigest }]),
  semantics:'NOT_RUN; request differences are not quality scores' },null,2));
