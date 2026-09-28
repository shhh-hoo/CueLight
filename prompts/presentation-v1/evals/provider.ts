import type { ApiProvider, CallApiContextParams, ProviderOptions, ProviderResponse } from 'promptfoo';
import { parseRuntimeConfig } from '../../../server/runtime-config.ts';
import { buildPresentationRequest, parsePresentationResponse, validatePresentationInput, IncompleteSource } from '../request.ts';
import { cases, constructPresentationFixture, type PresentationCase } from './cases.ts';
import { evaluationRecord, frozenCases, blockedRecord } from '../../evals/record.ts';

type Dependencies = { env?: NodeJS.ProcessEnv; transport?: typeof fetch };
export default class PresentationProvider implements ApiProvider {
  private readonly attempted = new Set<unknown>();
  constructor(private readonly options: ProviderOptions = {}, private readonly dependencies: Dependencies = {}) {}
  id() { return this.options.id ?? 'cuelight:presentation-v1'; }
  async callApi(_prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    const env = this.dependencies.env ?? process.env;
    if (env.CI || env.CUELIGHT_PRESENTATION_EVAL_LIVE !== '1') return { error: 'Live Presentation evaluation is disabled; use npm run eval:presentation for an explicit paid run.', metadata: blockedRecord('accepted-expression', 'disabled') };
    if (!env.OPENAI_API_KEY?.trim()) return { error: 'Live evaluation requires OPENAI_API_KEY.', metadata: blockedRecord('accepted-expression', 'missing_credentials') };
    try {
      const config = parseRuntimeConfig({ OPENAI_REFINEMENT_MODEL: env.OPENAI_REFINEMENT_MODEL,
        OPENAI_REFINEMENT_TIMEOUT_MS: env.OPENAI_REFINEMENT_TIMEOUT_MS, OPENAI_REFINEMENT_MAX_INPUT_CHARS: env.OPENAI_REFINEMENT_MAX_INPUT_CHARS }).refinement;
      const corpus = frozenCases('presentation', cases, env) as PresentationCase[];
      const test = corpus.find(c => c.id === context?.vars.caseId);
      if (!test) throw new Error('Unknown case');
      const limit = Number(env.CUELIGHT_EVAL_MAX_CALLS ?? corpus.length);
      const fixture = constructPresentationFixture(test);
      if (!fixture.current || !fixture.input) return { output: JSON.stringify({ outcome: 'input_blocked', reason: 'current-only/whole-Final', semanticGrade: 'UNSCORED' }),
        metadata: { ...evaluationRecord('presentation', null, corpus, config), requestStatus: 'blocked' } };
      try { validatePresentationInput(fixture.input, config.maxInputChars); }
      catch (error) { return { output: JSON.stringify({ outcome: 'input_blocked', reason: error instanceof IncompleteSource ? 'incomplete-source' : 'input-limit', semanticGrade: 'UNSCORED' }),
        metadata: { ...evaluationRecord('presentation', null, corpus, config), requestStatus: 'blocked' } }; }
      if (!Number.isSafeInteger(limit) || limit < 1 || this.attempted.size >= limit || this.attempted.has(test.id)) return { error: 'Evaluation call budget or single-attempt limit reached.', metadata: blockedRecord('accepted-expression', 'call_limit') };
      this.attempted.add(test.id);
      const body = buildPresentationRequest(fixture.input, config);
      const metadata = evaluationRecord('presentation', body, corpus, config);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        metadata.requestStatus = 'sent'; metadata.callStatus = 'attempted';
        const response = await (this.dependencies.transport ?? fetch)('https://api.openai.com/v1/responses', {
          method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal: controller.signal,
        });
        if (!response.ok) { await response.body?.cancel(); throw new Error('unavailable'); }
        const raw: unknown = await response.json();
        if (raw && typeof raw === 'object' && 'model' in raw && typeof raw.model === 'string') metadata.actualModel = raw.model;
        const reply = parsePresentationResponse(raw);
        if ('error' in reply) return { prompt: JSON.stringify(body), error: `Presentation failure (${reply.error}).`,
          metadata: { ...metadata, callStatus: 'failed', failure: reply.error } };
        return { prompt: JSON.stringify(body), output: JSON.stringify({ ...reply, semanticGrade: 'UNSCORED',
          usefulness: reply.result.kind === 'source' ? 'fallback; human review required' : 'human review required' }),
          metadata: { ...metadata, callStatus: 'completed', modelBehavior: 'UNSCORED' } };
      } catch { return { prompt: JSON.stringify(body), error: controller.signal.aborted ? 'Presentation failure (timeout).' : 'Presentation failure (unavailable).',
        metadata: { ...metadata, callStatus: 'failed', failure: controller.signal.aborted ? 'timeout' : 'unavailable' } }; }
      finally { clearTimeout(timer); }
    } catch { return { error: 'Cannot construct the frozen Presentation fixture or configuration.', metadata: blockedRecord('accepted-expression', 'construction_failure') }; }
  }
}
