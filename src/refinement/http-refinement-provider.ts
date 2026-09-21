import { MAX_REFINEMENT_CHARS, REFINEMENT_TIMEOUT_MS, refinementMessages, type RefinementInput, type RefinementReply } from './types';

export async function refineCue(input: RefinementInput, signal: AbortSignal): Promise<RefinementReply> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, REFINEMENT_TIMEOUT_MS);
  try {
    const response = await fetch('/api/openai/refine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input), signal: controller.signal,
    });
    const data: unknown = await response.json();
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' &&
        Object.hasOwn(refinementMessages, data.error) && data.error !== 'too-large') {
      return { error: data.error as Exclude<keyof typeof refinementMessages, 'too-large'> };
    }
    if (!response.ok) return { error: 'unavailable' };
    if (!data || typeof data !== 'object' || !('displayText' in data) ||
        typeof data.displayText !== 'string' || !data.displayText.trim() || data.displayText.length > MAX_REFINEMENT_CHARS) {
      return { error: 'invalid' };
    }
    return { displayText: data.displayText };
  } catch {
    return { error: controller.signal.aborted ? 'timeout' : 'unavailable' };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}
