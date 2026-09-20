import { readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('production runs replay without diagnostics, a backend, or external model requests', async ({ page }) => {
  const errors: string[] = [];
  const remote: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173/')) remote.push(request.url()); });
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Show diagnostics' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(16_850);
  await expect(page.getByTestId('current-cue')).toContainText('Diffusion is the net movement');
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  await page.reload();
  await expect(page.getByTestId('current-cue')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);

  const js = readdirSync('dist/assets').filter(file => file.endsWith('.js')).map(file => readFileSync(`dist/assets/${file}`, 'utf8')).join('\n');
  expect(js).not.toContain('Behind the Cue');
  expect(js).not.toContain('api.typesafe.ai');
  expect(js).not.toContain('Authorization');
});
