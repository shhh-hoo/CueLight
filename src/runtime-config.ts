// Public configuration contracts only: defaults and environment parsing stay server-side.
export type JevConfiguration = Readonly<{ model: string; timeoutMs: number; contextVersion: 'structured-v3' | 'alive-jev-v1' }>;
export type RefinementConfiguration = Readonly<{ model: string; timeoutMs: number; maxInputChars: number; defaultEnabled: boolean }>;

// Copy only the allowlisted fields; never journal arbitrary status/HTTP payloads.
export function refinementConfiguration(value: unknown): RefinementConfiguration {
  const c = value as Partial<RefinementConfiguration> | null;
  if (!c || typeof c.model !== 'string' || !c.model.trim() || !Number.isSafeInteger(c.timeoutMs) || c.timeoutMs! <= 0 ||
      !Number.isSafeInteger(c.maxInputChars) || c.maxInputChars! <= 0 || typeof c.defaultEnabled !== 'boolean') throw new Error('Invalid refinement configuration.');
  return { model: c.model, timeoutMs: c.timeoutMs!, maxInputChars: c.maxInputChars!, defaultEnabled: c.defaultEnabled };
}
export function jevConfiguration(value: unknown): JevConfiguration {
  const c = value as Partial<JevConfiguration> | null;
  if (!c || typeof c.model !== 'string' || !c.model.trim() || !Number.isSafeInteger(c.timeoutMs) || c.timeoutMs! <= 0 ||
      !['structured-v3', 'alive-jev-v1'].includes(c.contextVersion!)) throw new Error('Invalid Jev configuration.');
  return { model: c.model, timeoutMs: c.timeoutMs!, contextVersion: c.contextVersion! };
}
