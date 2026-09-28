import { getCase } from './cases.ts';

// Deterministic grading only. No model graders, network access or confidence thresholds.
export default function assertResult(output: string | object, context: { vars?: Record<string, unknown> }) {
  const test = getCase(context.vars?.caseId);
  if (test.metadata.kind === 'exploratory') return { pass: true, score: 1, reason: 'Observation only; no semantic gold label.' };
  let actual: Record<string, unknown>;
  try { actual = typeof output === 'string' ? JSON.parse(output) : output; }
  catch { return { pass: false, score: 0, reason: 'Expected normalized JSON.' }; }
  if (!actual || typeof actual !== 'object') return { pass: false, score: 0, reason: 'Expected normalized object.' };
  const { allowed, forbidden, ...fields } = test.expected;
  const errors: string[] = [];
  if (actual.outcome !== (fields.outcome ?? 'accepted')) errors.push(`outcome: expected ${fields.outcome ?? 'accepted'}`);
  if (allowed && !allowed.some(action => action === actual.action)) errors.push(`action must be one of ${allowed.join(', ')}`);
  if (forbidden?.some(action => action === actual.action)) errors.push('forbidden action');
  for (const [key, value] of Object.entries(fields)) if (actual[key] !== value) errors.push(`unexpected ${key}`);
  if (actual.outcome === 'coverage_blocked' && actual.action !== null) errors.push('coverage block must not invent an action');
  if (actual.outcome === 'accepted' && (!Array.isArray(actual.sourceRanges) || actual.sourceRanges.length === 0)) errors.push('missing source provenance');
  return { pass: errors.length === 0, score: errors.length ? 0 : 1,
    reason: errors.join('; ') || 'Allowed grounded outcome; inspect coverage before attributing semantic error.' };
}
