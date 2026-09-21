import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { jevApiPlugin } from './server/jev-api.ts';
import { openaiRefinementApiPlugin } from './server/openai-refinement-api.ts';
import { parseRuntimeConfig } from './server/runtime-config.ts';
import { execFileSync } from 'node:child_process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['TYPESAFE_', 'JEV_', 'OPENAI_']);
  let buildRevision = 'unknown';
  try { buildRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) buildRevision += '-dirty';
  } catch { /* Source archives may have no Git metadata. */ }
  const config = parseRuntimeConfig(env);
  return {
    define: { 'import.meta.env.VITE_BUILD_REVISION': JSON.stringify(buildRevision) },
    plugins: [jevApiPlugin({ apiKey: env.TYPESAFE_API_KEY, config: config.jev }),
      openaiRefinementApiPlugin({ apiKey: env.OPENAI_API_KEY, config: config.refinement })],
    server: { proxy: { '/api/voice': { target: 'http://127.0.0.1:8765', ws: true } } },
    preview: { proxy: { '/api/voice': { target: 'http://127.0.0.1:8765', ws: true } } },
    test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.ts'], restoreMocks: true },
  };
});
