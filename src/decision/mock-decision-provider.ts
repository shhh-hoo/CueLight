import type { CueDecisionProvider, DecisionInput } from './decision-provider';
import { QUIET, type CueDecision } from './types';

export type ScriptedDecision =
  | { action: 'QUIET' }
  | { action: 'NEW_CUE' | 'UPDATE_CURRENT'; sourceFragmentIds: readonly string[] };

export type DecisionScript = Readonly<Record<string, ScriptedDecision>>;

// Explicit product-development oracle, not a semantic classifier.
// The script can select supplied spans; it cannot supply Cue text.
export class MockDecisionProvider implements CueDecisionProvider {
  constructor(private readonly script: DecisionScript) {}

  async decide(input: DecisionInput): Promise<CueDecision> {
    const latestId = input.evidence.fragments.at(-1)?.id;
    const entry = latestId ? this.script[latestId] : undefined;
    if (!entry || entry.action === 'QUIET') return QUIET;
    const candidate = input.candidates.find(item =>
      item.sourceFragmentIds.length === entry.sourceFragmentIds.length &&
      item.sourceFragmentIds.every((id, index) => id === entry.sourceFragmentIds[index]));
    return candidate ? { action: entry.action, candidateId: candidate.id } : QUIET;
  }
}
