import { readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('production demo runs without diagnostics, credentials, or external model requests', async ({ page }) => {
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
  // Alive Cue replaces the former no-persistence invariant with a tab-scoped,
  // source-only acceptance journal. Credentials/diagnostics stay out of it.
  const stored = await page.evaluate(() => ({ local: localStorage.length,
    entries: Object.keys(sessionStorage).map(key => ({ key, value: JSON.parse(sessionStorage.getItem(key)!) })) }));
  expect(stored.local).toBe(0);
  expect(stored.entries).toHaveLength(1);
  expect(stored.entries[0]!.key).toMatch(/^cuelight:alive:/);
  expect(stored.entries[0]!.value.format).toBe('alive-cue-v1');
  expect(stored.entries[0]!.value.events.length).toBeGreaterThan(0);
  expect(JSON.stringify(stored)).not.toMatch(/apiKey|Authorization|diagnostics|audioData/);
  await page.reload();
  await expect(page.getByTestId('current-cue')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);

  const js = readdirSync('dist/assets').filter(file => file.endsWith('.js')).map(file => readFileSync(`dist/assets/${file}`, 'utf8')).join('\n');
  expect(js).not.toContain('Behind the Cue');
  expect(js).not.toContain('api.typesafe.ai');
  expect(js).not.toContain('Authorization');
});

test('preview serves the local Jev configuration endpoint without leaking credentials', async ({ page, request }) => {
  const response = await request.get('/api/jev/status');
  expect(response.status()).toBe(200);
  const value = await response.json();
  expect(Object.keys(value).sort()).toEqual(['configured', 'contextVersion', 'model', 'timeoutMs']);
  expect(typeof value.configured).toBe('boolean');
  expect(typeof value.model).toBe('string');
  // No real decision calls in browser tests, including when a developer has a key configured.
  await page.route('**/api/jev/status', route => route.fulfill({ json: { configured: false, model: 'jev-latest' } }));
  await page.route('**/api/jev/decide', route => route.abort());
  await page.goto('/');
  await page.getByLabel('Decision provider', { exact: true }).selectOption('jev');
  await expect(page.getByText('Add TYPESAFE_API_KEY', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start replay' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Show diagnostics' })).toHaveCount(0);
});
