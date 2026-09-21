import { jevConfiguration, type JevConfiguration } from '../runtime-config';
import { validateDecision, type CueDecisionProvider, type DecisionInput } from './decision-provider';
import type { CueDecision } from './types';

export class HttpDecisionProvider implements CueDecisionProvider {
  private controller: AbortController | null = null;

  constructor(private readonly transport: typeof fetch = (input, init) => fetch(input, init),
    private readonly observeConfiguration?: (config: JevConfiguration) => void) {}

  cancel(): void { this.controller?.abort(); }

  async decide(input: DecisionInput): Promise<CueDecision> {
    const controller = new AbortController();
    this.controller = controller;
    try {
      const response = await this.transport('/api/jev/decide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: controller.signal, body: JSON.stringify(input),
      });
      const data: unknown = await response.json().catch(() => null);
      if (data && typeof data === 'object' && 'configuration' in data) {
        this.observeConfiguration?.(jevConfiguration(data.configuration));
      }
      if (!response.ok) {
        const message = response.status === 503 ? 'Jev is not configured on the local server.' :
          response.status === 502 ? 'Jev could not make a decision. The screen is unchanged.' :
          'The local Jev service rejected the request.';
        throw new Error(message);
      }
      if (!data || typeof data !== 'object' || !('decision' in data)) throw new Error('Invalid Jev service response.');
      return validateDecision(data.decision, input.candidates);
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Jev request cancelled or timed out.');
      if (error instanceof TypeError) throw new Error('Cannot reach the local Jev service.');
      throw error;
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }
}
