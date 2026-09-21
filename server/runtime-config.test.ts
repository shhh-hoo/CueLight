import { expect, it } from 'vitest';
import { parseRuntimeConfig } from './runtime-config';
import { SessionDiagnostics } from '../src/speechmatics/session-diagnostics';
import { refinementConfiguration } from '../src/runtime-config';

it('defaults, overrides, and allowlisted diagnostics share the effective configuration', () => {
  const defaults = parseRuntimeConfig({});
  expect(defaults.jev).toEqual({ model: 'jev-latest', timeoutMs: 5000, contextVersion: 'structured-v3' });
  expect(defaults.refinement).toEqual({ model: 'gpt-5.6-luna', timeoutMs: 6000, maxInputChars: 16000, defaultEnabled: false });
  const config = parseRuntimeConfig({ JEV_MODEL: 'jev-test', JEV_TIMEOUT_MS: '7200', OPENAI_REFINEMENT_MODEL: 'openai-test',
    OPENAI_REFINEMENT_TIMEOUT_MS: '6000', OPENAI_REFINEMENT_MAX_INPUT_CHARS: '8000', OPENAI_REFINEMENT_ENABLED_DEFAULT: 'true', OPENAI_API_KEY: 'secret-test' });
  const journal = new SessionDiagnostics('test');
  journal.observeJevConfiguration(config.jev);
  journal.observeRefinement({ type: 'refinement-configuration', atMonoMs: 0,
    configuration: refinementConfiguration({ ...config.refinement, apiKey: 'secret-test' }) });
  journal.observe({ type: 'voice-configuration', atMonoMs: 0, configuration: {
    preset: 'scribe', language: 'cmn_en', operatingPoint: 'enhanced', audioEncoding: 'pcm_f32le', channels: 1, voiceVersion: '0.2.8', rtVersion: '1.1.1', sampleRate: 16000,
  } });
  const snapshot = journal.export();
  expect(snapshot.jev).toEqual(config.jev);
  expect(snapshot.refinement).toMatchObject(config.refinement);
  expect(snapshot.configuration?.preset).toBe('scribe');
  expect(JSON.stringify(snapshot)).not.toMatch(/secret-test|apiKey|Authorization/);
});

it.each([
  ['JEV_MODEL', ''], ['OPENAI_REFINEMENT_MODEL', '  '], ['JEV_MODEL', ' jev'],
  ['JEV_TIMEOUT_MS', '0'], ['JEV_TIMEOUT_MS', 'Infinity'], ['JEV_TIMEOUT_MS', '60001'],
  ['OPENAI_REFINEMENT_TIMEOUT_MS', '3.5'], ['OPENAI_REFINEMENT_TIMEOUT_MS', '1e3'],
  ['OPENAI_REFINEMENT_MAX_INPUT_CHARS', '-1'], ['OPENAI_REFINEMENT_MAX_INPUT_CHARS', '32001'],
  ['OPENAI_REFINEMENT_MAX_INPUT_CHARS', ''], ['OPENAI_REFINEMENT_ENABLED_DEFAULT', 'yes'], ['OPENAI_REFINEMENT_ENABLED_DEFAULT', 'FALSE'],
])('%s rejects malformed values without reflecting their content', (name, value) => {
  expect(() => parseRuntimeConfig({ [name]: value })).toThrow(name);
});
