import { SemanticProviderError } from '../src/decision/semantic-failure.ts';
import { buildSemanticRequest, parseSemanticJudgment, type SemanticInput, type SemanticJudgment } from '../src/alive/inspection.ts';
import { JEV_ENDPOINT } from '../src/decision/jev-decision-provider.ts';

// HTTP v1, no SDK installed. Errors reject; no semantic fallback or retry policy.
export async function inspectWithJev(input: SemanticInput, options: {
  apiKey: string; model: string; timeoutMs: number; transport?: typeof fetch; signal?: AbortSignal;
}): Promise<SemanticJudgment> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: () => void = () => {};
  try {
    const cancelled = new Promise<never>((_, reject) => {
      cancel = () => { controller.abort(); reject(new SemanticProviderError('cancelled', 'Jev request cancelled.', options.model)); };
      options.signal?.addEventListener('abort', cancel, { once: true });
      if (options.signal?.aborted) cancel();
      timer = setTimeout(() => { controller.abort(); reject(new SemanticProviderError('timeout', 'Jev request timed out.', options.model)); }, options.timeoutMs);
    });
    const call = async () => {
      if (!options.apiKey.trim()) throw new Error('Missing TypeSafe API key.');
      const response = await (options.transport ?? fetch)(JEV_ENDPOINT, { method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSemanticRequest(input, options.model)) });
      if (!response.ok) throw new SemanticProviderError('http', `Jev HTTP ${response.status}.`, options.model);
      try {
        const judgment = parseSemanticJudgment(await response.json(), input);
        return { ...judgment, requestModel: options.model };
      } catch (error) {
        const invalidChoice = error instanceof Error && error.message.includes('option not supplied');
        throw new SemanticProviderError(invalidChoice ? 'invalid_choice' : 'malformed_response', 'Jev returned no usable semantic judgment.', options.model);
      }
    };
    return await Promise.race([cancelled, call()]);
  } catch (error) {
    if (error instanceof SemanticProviderError) throw error;
    throw new SemanticProviderError('transport', 'Cannot reach the Jev provider.', options.model);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}
