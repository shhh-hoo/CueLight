import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const mode = process.argv[2];
const commands = {
  validate: ['validate', 'config', '-c', 'promptfooconfig.jev.yaml'],
  live: ['eval', '-c', 'promptfooconfig.jev.yaml', '--no-cache', '--max-concurrency', '1'],
  view: ['view'],
};
if (!Object.hasOwn(commands, mode)) throw new Error('Expected validate, live or view.');
if (mode === 'live' && process.env.CI) throw new Error('Live Jev evaluation is disabled in CI.');
if (mode === 'live') console.warn('LIVE evaluation: real TypeSafe/Jev requests may incur cost. No automatic retries.');
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, [resolve(root, 'node_modules/promptfoo/dist/src/entrypoint.js'),
  ...commands[mode], ...process.argv.slice(3)], { cwd: root, stdio: 'inherit', env: {
  ...process.env, PROMPTFOO_CONFIG_DIR: resolve(root, '.promptfoo'), PROMPTFOO_DISABLE_TELEMETRY: '1',
  PROMPTFOO_DISABLE_UPDATE: '1', PROMPTFOO_DISABLE_REMOTE_GENERATION: 'true',
  CUELIGHT_JEV_EVAL_LIVE: mode === 'live' ? '1' : '0',
} });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
