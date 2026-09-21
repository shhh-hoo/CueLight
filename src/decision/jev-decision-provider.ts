import { parseRuntimeConfig } from '../../server/runtime-config.ts';
// Server-only: do not import this module from App or any browser entrypoint.
import type { CueDecisionProvider, DecisionInput } from './decision-provider.ts';
import { QUIET, type CueDecision } from './types.ts';
import { buildJevRequest } from './jev-context.ts';
export { buildJevRequest } from './jev-context.ts';

export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

function parseAnswer(value: unknown, options: ReadonlyMap<string, CueDecision>): CueDecision {
  if (!value || typeof value !== 'object' || !('answers' in value)) throw new Error('Missing Jev answers.');
  const answers = value.answers;
  if (!answers || typeof answers !== 'object' || !('cue' in answers)) throw new Error('Missing Jev cue answer.');
  const cue = answers.cue;
  if (!cue || typeof cue !== 'object' || !('type' in cue) || cue.type !== 'choice' ||
      !('choice' in cue) || typeof cue.choice !== 'string') throw new Error('Invalid Jev choice answer.');
  const decision = options.get(cue.choice);
  if (!decision) throw new Error('Jev selected an option not supplied in this request.');
  if (!('confidence' in cue) || typeof cue.confidence !== 'number' ||
      !Number.isFinite(cue.confidence) || cue.confidence < 0 || cue.confidence > 1 ||
      !('probabilities' in cue) || !cue.probabilities || typeof cue.probabilities !== 'object') {
    throw new Error('Invalid Jev choice metadata.');
  }
  const probabilities = cue.probabilities as Record<string, unknown>;
  const values = Object.values(probabilities);
  if (Object.keys(probabilities).length !== options.size ||
      [...options.keys()].some(key => !(key in probabilities)) ||
      values.some(p => typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) ||
      Math.abs((values as number[]).reduce((sum, p) => sum + p, 0) - 1) > 0.01) {
    throw new Error('Invalid Jev probabilities.');
  }
  return decision;
}

export class JevDecisionProvider implements CueDecisionProvider {
  constructor(private readonly options: {
    apiKey: string;
    model?: string;
    timeoutMs?: number;
    transport?: typeof fetch;
    signal?: AbortSignal;
    onError?: (message: string) => void;
  }) {
    if (typeof window !== 'undefined') throw new Error('Jev credentials must stay server-side.');
  }

  async decide(input: DecisionInput): Promise<CueDecision> {
    if (input.candidates.length === 0) return QUIET;
    const controller = new AbortController();
    const abort = () => controller.abort();
    this.options.signal?.addEventListener('abort', abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (this.options.signal?.aborted) throw new Error('Jev request cancelled.');
      if (!this.options.apiKey.trim()) throw new Error('Missing TypeSafe API key.');
      const request = buildJevRequest(input, this.options.model);
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Jev request timed out.'));
          controller.abort();
        }, this.options.timeoutMs ?? parseRuntimeConfig({}).jev.timeoutMs);
      });
      const call = async () => {
        const response = await (this.options.transport ?? fetch)(JEV_ENDPOINT, {
          method: 'POST', signal: controller.signal,
          headers: { Authorization: `Bearer ${this.options.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        });
        if (!response.ok) throw new Error(`Jev HTTP ${response.status}.`);
        return parseAnswer(await response.json(), request.options);
      };
      return await Promise.race([call(), timeout]);
    } catch (error) {
      // Report safe diagnostics only; never include credentials or response bodies.
      const message = error instanceof Error ? error.message : 'Jev request failed.';
      try { this.options.onError?.(message); } catch { /* Diagnostics must not change the QUIET fallback. */ }
      return QUIET;
    } finally {
      this.options.signal?.removeEventListener('abort', abort);
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
