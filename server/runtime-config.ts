import type { RefinementConfiguration, JevConfiguration } from '../src/runtime-config.ts';

type Env = Record<string, string | undefined>;
function model(env: Env, name: string, fallback: string): string {
  const value = env[name] ?? fallback;
  if (!value.trim() || value !== value.trim()) throw new Error(`${name} must be a non-empty model string without surrounding whitespace.`);
  return value;
}
function integer(env: Env, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if ((raw !== undefined && !/^\d+$/.test(raw)) || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}
function boolean(env: Env, name: string, fallback: boolean): boolean {
  const value = env[name];
  if (value === undefined) return fallback;
  if (value !== 'true' && value !== 'false') throw new Error(`${name} must be true or false.`);
  return value === 'true';
}
export function parseRuntimeConfig(env: Env) {
  const jev: JevConfiguration = Object.freeze({
    model: model(env, 'JEV_MODEL', 'jev-latest'),
    timeoutMs: integer(env, 'JEV_TIMEOUT_MS', 5000, 100, 60000), contextVersion: 'structured-v3',
  });
  const refinement: RefinementConfiguration = Object.freeze({
    model: model(env, 'OPENAI_REFINEMENT_MODEL', 'gpt-4.1-mini-2025-04-14'),
    timeoutMs: integer(env, 'OPENAI_REFINEMENT_TIMEOUT_MS', 6000, 100, 60000),
    maxInputChars: integer(env, 'OPENAI_REFINEMENT_MAX_INPUT_CHARS', 16000, 1, 32000),
    defaultEnabled: boolean(env, 'OPENAI_REFINEMENT_ENABLED_DEFAULT', false),
  });
  return { jev, refinement };
}
