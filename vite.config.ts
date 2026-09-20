import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { jevApiPlugin } from './server/jev-api.ts';
import { assertJevContext } from './src/decision/jev-context.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['TYPESAFE_', 'JEV_']);
  assertJevContext(env.JEV_CONTEXT_VERSION);
  return {
    plugins: [jevApiPlugin({ apiKey: env.TYPESAFE_API_KEY, model: env.JEV_MODEL })],
    test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.ts'], restoreMocks: true },
  };
});
