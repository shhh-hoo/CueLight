import { foundationReplayFixture } from '../src/alive/fixtures';
import { inspect, notes, records, cueTab, activeTrace } from './workbench-helpers';
import { readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('production demo runs without diagnostics, credentials, or external model requests', async ({ page }) => {
  const errors: string[] = [];
  const remote: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173/')) remote.push(request.url()); });
  await page.clock.install();
  await page.goto('/dev');
  await expect(page.getByRole('button', { name: 'Show diagnostics' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(16_850);
  await inspect(page, 1);
  await expect(page.getByTestId('cue-detail')).toContainText('Diffusion is the net movement');
  // Alive Cue replaces the former no-persistence invariant with a tab-scoped,
  // source-only acceptance journal. Credentials/diagnostics stay out of it.
  const stored = await page.evaluate(() => ({ local: localStorage.length,
    entries: Object.keys(sessionStorage).map(key => ({ key, value: JSON.parse(sessionStorage.getItem(key)!) })) }));
  expect(stored.local).toBe(0);
  expect(stored.entries).toHaveLength(2);
  stored.entries.sort((a, b) => a.key.localeCompare(b.key));
  expect(stored.entries[0]!.key).toMatch(/^cuelight:alive:/);
  expect(stored.entries[0]!.value.format).toBe('alive-cue-v1');
  expect(stored.entries[0]!.value.events.length).toBeGreaterThan(0);
  expect(JSON.stringify(stored)).not.toMatch(/apiKey|Authorization|diagnostics|audioData/);
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.getByTestId('cue-detail')).toHaveCount(0);
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
  await page.goto('/dev');
  await page.getByLabel('Decision provider', { exact: true }).selectOption('jev');
  await expect(page.getByText('Add TYPESAFE_API_KEY', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start replay' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Show diagnostics' })).toHaveCount(0);
});

test('production provides portable TRACE export/import and source navigation without DebugPanel', async ({ page, context }) => {
  await page.clock.install(); await page.goto('/dev');
  await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(16_850);
  await inspect(page); await notes(page); await page.getByLabel('教师备注').fill('Production note');
  await records(page); const wait = page.waitForEvent('download'); await page.getByRole('button', { name: '导出 TRACE 文件', exact: true }).click();
  const stream = (await (await wait).createReadStream())!;
  let json = ''; for await (const chunk of stream) json += chunk;
  const fresh = await context.newPage(); const apiCalls: string[] = [];
  fresh.on('request', r => { if (r.url().includes('/api/')) apiCalls.push(r.url()); });
  await fresh.goto('/dev'); await fresh.getByLabel('打开 TRACE 文件').setInputFiles({ name: 'trace.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  const view = fresh.getByRole('region', { name: '教师 TRACE' }).filter({ visible: true });
  await inspect(view); await notes(view); await expect(view.getByLabel('教师备注')).toHaveValue('Production note'); await cueTab(view);
  await view.getByTestId('cue-detail').getByRole('button', { name: /原文/ }).first().click();
  await expect(fresh.locator('#file-source mark')).toContainText('Osmosis');
  await expect(fresh.getByRole('button', { name: 'Show diagnostics' })).toHaveCount(0);
  expect(apiCalls).toEqual([]); expect(await fresh.evaluate(() => sessionStorage.length)).toBe(0); await fresh.close();
});

 test('normal production entry is the teacher Display with no development controls', async ({ page }) => {
  const paid: string[] = [];
  await page.route('**/api/**', route => {
    if (route.request().method() !== 'GET') paid.push(route.request().url());
    return route.fulfill({ json: { configured: false, model: 'test' } });
  });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Current Display' })).toBeVisible();
  await expect(page.getByTestId('flow-view')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Start microphone', exact: true })).toBeDisabled();
  for (const label of ['Input source', 'Decision provider', 'Lesson']) await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
  for (const name of ['Start replay', 'Show diagnostics']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  const before = await page.evaluate(() => Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)]));
  await page.getByLabel('打开 TRACE 文件').setInputFiles({ name: 'history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(foundationReplayFixture().history)) });
  const archive = activeTrace(page); await inspect(archive); await notes(archive);
  await expect(archive.getByLabel('教师备注')).toHaveAttribute('readonly', '');
  await expect(archive.getByLabel('梳理不符', { exact: true })).toBeDisabled();
  expect(await page.evaluate(() => Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)]))).toEqual(before);
  expect(paid).toEqual([]);
});
