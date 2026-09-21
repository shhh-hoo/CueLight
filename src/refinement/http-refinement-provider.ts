import { refinementConfiguration, type RefinementConfiguration } from '../runtime-config';
import { refinementMessages, type RefinementInput, type RefinementReply } from './types';
import { parsePresentationReply } from './presentation';

export async function refineCue(input: RefinementInput, signal: AbortSignal, config: RefinementConfiguration,
  observeConfiguration: (config: RefinementConfiguration) => void): Promise<RefinementReply> {
  try {
    const response = await fetch('/api/openai/refine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input), signal,
    });
    const data: unknown = await response.json();
    if (data && typeof data === 'object' && 'configuration' in data) {
      config = refinementConfiguration(data.configuration);
      observeConfiguration(config);
    }
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' &&
        Object.hasOwn(refinementMessages, data.error) && data.error !== 'too-large') {
      return { error: data.error as Exclude<keyof typeof refinementMessages, 'too-large'> };
    }
    if (!response.ok) return { error: 'unavailable' };
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'invalid' };
    const { configuration: _configuration, ...reply } = data as Record<string, unknown>;
    return parsePresentationReply(reply) ?? { error: 'invalid' };
  } catch {
    return { error: 'unavailable' };
  }
}
