import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { jevApiPlugin } from './server/jev-api.ts';
import { openaiRefinementApiPlugin } from './server/openai-refinement-api.ts';
import { assertJevContext } from './src/decision/jev-context.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['TYPESAFE_', 'JEV_', 'OPENAI_']);
  assertJevContext(env.JEV_CONTEXT_VERSION);
  return {
    plugins: [jevApiPlugin({ apiKey: env.TYPESAFE_API_KEY, model: env.JEV_MODEL }),
      openaiRefinementApiPlugin({ apiKey: env.OPENAI_API_KEY })],
    server: { proxy: { '/api/voice': { target: 'http://127.0.0.1:8765', ws: true } } },
    preview: { proxy: { '/api/voice': { target: 'http://127.0.0.1:8765', ws: true } } },
    test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.ts'], restoreMocks: true },
  };
});
