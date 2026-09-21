import type { DecisionInput } from './decision-provider.ts';
import { QUIET, type CueDecision } from './types.ts';

export type JevChoiceDiagnostics = Readonly<{
  choice: string;
  confidence: number;
  probabilities: Readonly<Record<string, number>>;
}>;

// Shared by request construction and response validation on both sides of HTTP.
export function buildJevOptions(input: DecisionInput): ReadonlyMap<string, CueDecision> {
  const options = new Map<string, CueDecision>([['QUIET', QUIET]]);
  input.candidates.forEach((candidate, index) => {
    if (!candidate.updateOnly) options.set(`NEW_CUE_${index}`, { action: 'NEW_CUE', candidateId: candidate.id });
    if (input.currentCue) options.set(`UPDATE_CURRENT_${index}`, { action: 'UPDATE_CURRENT', candidateId: candidate.id });
  });
  return options;
}

// Copy only validated choice metadata, never a raw provider/server object.
export function parseJevChoice(value: unknown, options: ReadonlyMap<string, CueDecision>): JevChoiceDiagnostics {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !('choice' in value) || typeof value.choice !== 'string' || !options.has(value.choice)) {
    throw new Error('Jev selected an option not supplied in this request.');
  }
  if (!('confidence' in value) || typeof value.confidence !== 'number' ||
      !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1 ||
      !('probabilities' in value) || !value.probabilities || typeof value.probabilities !== 'object' ||
      Array.isArray(value.probabilities)) throw new Error('Invalid Jev choice metadata.');
  const probabilities = value.probabilities as Record<string, unknown>;
  const keys = [...options.keys()];
  const values = keys.map(key => probabilities[key]);
  if (Object.keys(probabilities).length !== options.size ||
      keys.some(key => !Object.hasOwn(probabilities, key)) ||
      values.some(p => typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) ||
      Math.abs((values as number[]).reduce((sum, p) => sum + p, 0) - 1) > 0.01) {
    throw new Error('Invalid Jev probabilities.');
  }
  return Object.freeze({ choice: value.choice, confidence: value.confidence,
    probabilities: Object.freeze(Object.fromEntries(keys.map(key => [key, probabilities[key] as number]))) });
}
