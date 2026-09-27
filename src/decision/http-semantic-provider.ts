import { SemanticProviderError, type SemanticFailureKind } from './semantic-failure';
import { parseSemanticJudgment, type SemanticInput, type SemanticJudgment, type SemanticProvider } from '../alive/inspection';
import { jevConfiguration, type JevConfiguration } from '../runtime-config';

export class HttpSemanticProvider implements SemanticProvider {
  private controllers = new Set<AbortController>();
  constructor(private readonly transport: typeof fetch = (input, init) => fetch(input, init),
    private readonly observeConfiguration?: (config: JevConfiguration) => void) {}
  cancel() { for (const controller of this.controllers) controller.abort(); }
  async inspect(input: SemanticInput): Promise<SemanticJudgment> {
    const controller = new AbortController(); this.controllers.add(controller);
    try {
      const response = await this.transport('/api/jev/inspect', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (controller.signal.aborted) throw new Error('Jev request cancelled.');
      const body = await response.json() as { judgment?: unknown; configuration?: unknown; failureKind?: SemanticFailureKind };
      if (!response.ok) {
        const kind = ['timeout', 'transport', 'http', 'invalid_choice', 'malformed_response', 'cancelled'].includes(body.failureKind!) ? body.failureKind! : 'http';
        let model: string | undefined;
        try { model = jevConfiguration(body.configuration).model; } catch { /* Configuration may be unavailable. */ }
        throw new SemanticProviderError(kind, response.status === 502 ? 'Jev could not make a decision. The source remains unresolved.'
          : response.status === 503 ? 'Jev is not configured on the local server.' : 'The local Jev service rejected the inspection.', model);
      }
      if (body.configuration) { try { this.observeConfiguration?.(jevConfiguration(body.configuration)); } catch { /* Observer is not authority. */ } }
      try { return parseSemanticJudgment(body.judgment, input); }
      catch { throw new SemanticProviderError('malformed_response', 'Invalid Jev semantic service response.'); }
    } catch (error) {
      if (error instanceof SemanticProviderError) throw error;
      throw new SemanticProviderError(controller.signal.aborted ? 'cancelled' : 'transport', controller.signal.aborted ? 'Jev request cancelled.' : 'Cannot reach the local Jev service.');
    } finally { this.controllers.delete(controller); }
  }
}
