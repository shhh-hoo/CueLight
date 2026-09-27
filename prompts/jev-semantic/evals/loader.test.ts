import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('loads the real TS provider, corpus and assertions through Promptfoo without networking', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cuelight-promptfoo-test-'));
  try {
    const result = spawnSync(process.execPath, ['prompts/jev-semantic/evals/loader-smoke.mjs'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
      // Do not inherit credentials, dotenv files, proxies, or a live-eval opt-in.
      env: { PATH: process.env.PATH, CI: 'true', IS_TESTING: 'true',
        PROMPTFOO_CONFIG_DIR: directory, PROMPTFOO_DISABLE_TELEMETRY: '1', PROMPTFOO_DISABLE_UPDATE: '1',
        PROMPTFOO_DISABLE_REMOTE_GENERATION: 'true' },
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr + result.stdout).toBe(0);
    expect(result.stdout).toContain('zero network calls');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 35_000);
