import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { jevApiPlugin } from './server/jev-api.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['TYPESAFE_', 'JEV_']);
  return {
    plugins: [jevApiPlugin({ apiKey: env.TYPESAFE_API_KEY, model: env.JEV_MODEL,
      contextVersion: env.JEV_CONTEXT_VERSION === 'structured-v2' ? 'structured-v2' : 'baseline-v1' })],
    test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.ts'], restoreMocks: true },
  };
});
