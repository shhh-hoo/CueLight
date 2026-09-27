import type { ApiProvider, CallApiContextParams, ProviderOptions, ProviderResponse } from 'promptfoo';
import { inspectWithJev } from '../../../server/semantic-jev.ts';
import { parseRuntimeConfig } from '../../../server/runtime-config.ts';
import { buildSemanticRequest, compileProposal, MAX_REQUEST_CODE_UNITS, operationCandidates,
  validateSemanticInput, type SemanticInput, type SemanticJudgment } from '../../../src/alive/inspection.ts';
import { SemanticProviderError } from '../../../src/decision/semantic-failure.ts';
import { constructFixture, type LessonFixture } from './fixtures.ts';
import { getCase } from './cases.ts';

type Inspector = (input: SemanticInput) => Promise<SemanticJudgment>;
export async function evaluateFixture(fixture: LessonFixture, inspect: Inspector, model = 'jev-latest'): Promise<ProviderResponse> {
  const { store, input, cueIds } = constructFixture(fixture);
  const request = buildSemanticRequest(input, model);
  const coverage = request.state.coverage;
  const diagnostic = { stage: input.stage, ...coverage, action: null, cueId: null, cueRevision: null, partId: null,
    mode: null, relationKind: null, sourceAlias: null, sourceRanges: [] };
  const response = (output: object): ProviderResponse => ({ output: JSON.stringify(output), prompt: JSON.stringify(request) });
  // Same transport bounds as production. Coverage blocking is not a Jev WAIT judgment.
  if (operationCandidates(input).coverage.contextBlocked || JSON.stringify(request).length > MAX_REQUEST_CODE_UNITS) {
    return response({ ...diagnostic, outcome: 'coverage_blocked' });
  }
  try { validateSemanticInput(input); }
  catch { return { ...response({ ...diagnostic, outcome: 'validation_failure' }), error: 'Invalid captured semantic input.' }; }
  let judgment: SemanticJudgment;
  try { judgment = await inspect(input); }
  catch (error) {
    const failureKind = error instanceof SemanticProviderError ? error.kind : 'transport';
    return { ...response({ ...diagnostic, outcome: 'provider_failure', failureKind }), error: `Jev provider failure (${failureKind}).` };
  }
  let proposal;
  try { proposal = compileProposal(input, judgment); }
  catch { return { ...response({ ...diagnostic, outcome: 'invalid_judgment' }), error: 'Invalid semantic judgment.' }; }
  try {
    const event = store.accept(proposal, store.getSnapshot().sequence + 1);
    const selected = proposal.inspection!.selectedCandidate;
    const cueId = selected.cueId ?? Object.values(event.createdCueIds)[0] ?? null;
    const after = store.getSnapshot();
    return response({ ...diagnostic, outcome: 'accepted', action: selected.action, cueId,
      cueKey: Object.entries(cueIds).find(([, id]) => id === cueId)?.[0] ?? null,
      cueRevision: selected.cueRevision ?? null, resultingCueRevision: cueId ? after.cues[cueId]!.currentSemanticRevision : null,
      partId: selected.partId ?? null, mode: selected.mode ?? null, relationKind: selected.relationKind ?? null,
      sourceAlias: selected.source.alias,
      sourceRanges: selected.source.ranges.map(({ evidenceId, start, end }) => ({ evidenceId, start, end })),
      stance: judgment.stances[selected.source.alias]?.choice ?? null,
      relationEvidence: judgment.relationEvidence?.choice ?? null,
      model: judgment.model, requestModel: judgment.requestModel ?? model, confidence: judgment.operation.confidence,
      foregroundCueId: after.attention.currentCueId,
    });
  } catch { return { ...response({ ...diagnostic, outcome: 'host_rejection' }), error: 'Semantic acceptance rejected the proposal.' }; }
}

// No environment files are loaded implicitly. The CLI may explicitly pass --env-file.
// A second constructor argument is only an offline test seam; Promptfoo supplies one.
type Dependencies = { env?: NodeJS.ProcessEnv; transport?: typeof fetch };
export default class CueLightProvider implements ApiProvider {
  constructor(private readonly options: ProviderOptions = {}, private readonly dependencies: Dependencies = {}) {}
  id() { return this.options.id ?? 'cuelight:alive-jev-v1'; }
  async callApi(_prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    const env = this.dependencies.env ?? process.env;
    if (env.CI || env.CUELIGHT_JEV_EVAL_LIVE !== '1') {
      return { error: 'Live Jev evaluation is disabled. Run npm run eval:jev locally to explicitly allow TypeSafe/Jev cost.' };
    }
    if (!env.TYPESAFE_API_KEY?.trim()) return { error: 'Live evaluation requires TYPESAFE_API_KEY.' };
    try {
      const { jev } = parseRuntimeConfig({ JEV_MODEL: env.JEV_MODEL, JEV_TIMEOUT_MS: env.JEV_TIMEOUT_MS });
      const fixture = getCase(context?.vars.caseId).fixture;
      return await evaluateFixture(fixture, input => inspectWithJev(input, { ...jev, apiKey: env.TYPESAFE_API_KEY!,
        transport: this.dependencies.transport }), jev.model);
    } catch {
      // Do not echo arbitrary exceptions, environment values or upstream response bodies.
      return { error: 'Cannot construct the curated lesson fixture or Jev configuration.' };
    }
  }
}
