// Legacy structured-v3 / scripted compatibility only. Live Jev uses alive/inspection and /api/jev/inspect.
import { parseRuntimeConfig } from '../../server/runtime-config.ts';
// Server-only: do not import this module from App or any browser entrypoint.
import type { CueDecisionProvider, DecisionInput } from './decision-provider.ts';
import { QUIET, type CueDecision } from './types.ts';
import { buildJevRequest } from './jev-context.ts';
import { parseJevChoice, type JevChoiceDiagnostics } from './jev-choice.ts';
export { buildJevRequest } from './jev-context.ts';

export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

function parseAnswer(value: unknown, options: ReadonlyMap<string, CueDecision>): JevChoiceDiagnostics {
  if (!value || typeof value !== 'object' || !('answers' in value)) throw new Error('Missing Jev answers.');
  const answers = value.answers;
  if (!answers || typeof answers !== 'object' || !('cue' in answers)) throw new Error('Missing Jev cue answer.');
  const cue = answers.cue;
  if (!cue || typeof cue !== 'object' || !('type' in cue) || cue.type !== 'choice' ||
      !('choice' in cue) || typeof cue.choice !== 'string') throw new Error('Invalid Jev choice answer.');
  return parseJevChoice(cue, options);
}

export class JevDecisionProvider implements CueDecisionProvider {
  constructor(private readonly options: {
    apiKey: string;
    model?: string;
    timeoutMs?: number;
    transport?: typeof fetch;
    signal?: AbortSignal;
    onError?: (message: string) => void;
    onChoice?: (diagnostics: JevChoiceDiagnostics) => void;
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
      const diagnostics = await Promise.race([call(), timeout]);
      if (controller.signal.aborted) throw new Error('Jev request cancelled.');
      // Observe only the winning response, never a late response after timeout.
      try { this.options.onChoice?.(diagnostics); } catch { /* Diagnostics cannot change Cue application. */ }
      return request.options.get(diagnostics.choice)!;
    } catch (error) {
      // Report safe diagnostics only; never include credentials or response bodies.
      const message = error instanceof Error ? error.message : 'Jev request failed.';
      const safeMessage = /^Jev HTTP \d{3}\.$/.test(message) ||
        ['Jev request timed out.', 'Jev request cancelled.', 'Missing TypeSafe API key.'].includes(message)
        ? message : 'Jev returned no usable decision.';
      try { this.options.onError?.(safeMessage); } catch { /* Diagnostics must not change the QUIET fallback. */ }
      return QUIET;
    } finally {
      this.options.signal?.removeEventListener('abort', abort);
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
