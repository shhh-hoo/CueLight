import { expect, test, type Page } from '@playwright/test';
import { foundationReplayFixture, fixtureHost } from '../src/alive/fixtures';
import { binding } from '../src/alive/evidence';
import type { LessonHistory } from '../src/alive/types';

async function downloaded(page: Page, button: string) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  const stream = (await (await download).createReadStream())!;
  let json = ''; for await (const chunk of stream) json += chunk;
  return json;
}

test('offline TRACE → source/version → notes → export → new page opens identically without providers', async ({ page, context }) => {
  await page.clock.install(); await page.goto('/');
  await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(16_850);
  await page.getByTestId('cue-choice').first().click();
  await page.getByLabel('教师备注').fill('原话需核对 🧪'); await page.getByLabel('梳理不符', { exact: true }).check();
  const id = await page.getByTestId('cue-detail').getAttribute('data-cue-id');
  await page.getByLabel('Cue 版本').selectOption('1');
  await page.getByTestId('cue-detail').getByRole('button', { name: /原文/ }).first().click();
  await expect(page.locator('#live-source mark')).toContainText('Osmosis');
  const json = await downloaded(page, '导出 TRACE 文件');
  const archive = JSON.parse(json);
  expect(archive.history.format).toBe('alive-cue-v1');
  expect(archive.workspace.notes[id!]).toEqual({ text: '原话需核对 🧪', mismatch: true });
  const md = await downloaded(page, '导出 Markdown'); expect(md).toContain('教师工作笔记'); expect(md).toContain('原话需核对');
  const fresh = await context.newPage(); const requests: string[] = [];
  await fresh.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw Error('Microphone must not start'); }; });
  fresh.on('request', request => { if (request.url().includes('/api/') || !request.url().startsWith('http://127.0.0.1:')) requests.push(request.url()); });
  await fresh.goto('/');
  await fresh.getByLabel('打开 TRACE 文件').setInputFiles({ name: 'trace.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  const view = fresh.getByRole('region', { name: '教师 TRACE' }).filter({ visible: true });
  await expect(view.getByTestId('cue-choice')).toHaveCount(2);
  await expect(view.getByTestId('cue-detail')).toHaveAttribute('data-cue-id', id!);
  await expect(view.getByLabel('教师备注')).toHaveValue('原话需核对 🧪'); await expect(view.getByLabel('教师备注')).toHaveAttribute('readonly', '');
  await expect(view.getByLabel('梳理不符', { exact: true })).toBeChecked();
  await view.getByLabel('Cue 版本').selectOption('1');
  await expect(view.getByTestId('cue-detail')).not.toContainText('The moving particles');
  await view.getByTestId('cue-detail').getByRole('button', { name: /原文/ }).first().click();
  await expect(fresh.locator('#file-source mark')).toContainText('Osmosis');
  expect(await fresh.evaluate(() => sessionStorage.length)).toBe(0);
  expect(requests).toEqual([]);
  await fresh.screenshot({ path: 'artifacts/trace-import.png', fullPage: true }); await fresh.close();
});

test('foundation import shows accepted versions and recall; browsing writes no events', async ({ page }) => {
  const fixture = foundationReplayFixture(); await page.goto('/');
  await page.getByLabel('打开 TRACE 文件').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture.history)) });
  const view = page.getByRole('region', { name: '教师 TRACE' }).filter({ visible: true });
  await expect(view.getByTestId('trace-step')).toHaveCount(5);
  await view.getByTestId('trace-step').first().click(); await expect(view.getByTestId('cue-detail')).toContainText('A is X.');
  await expect(view.getByTestId('cue-detail')).not.toContainText('Only when Y.');
  await view.getByTestId('trace-step').nth(3).click(); await expect(view.getByTestId('cue-detail')).toContainText('Only when Y.');
  await view.getByTestId('trace-step').nth(4).click(); await expect(view.getByTestId('cue-detail')).toContainText('Use Z instead of X.');
  await view.getByTestId('cue-choice').nth(1).click(); await expect(view.getByTestId('cue-detail')).toContainText('B is independent.');
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
});

test('bad imports and failed downloads preserve an active lesson and its unsaved guard', async ({ page }) => {
  await page.clock.install(); await page.goto('/'); await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(2_250);
  await page.getByLabel('教师备注').fill('Keep me');
  const before = await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('cuelight:alive:')).map(k => sessionStorage.getItem(k)));
  await page.getByLabel('打开 TRACE 文件').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"cuelight-trace","version":9}') });
  await expect(page.getByRole('alert')).toContainText('当前会话未更改');
  await expect(page.getByLabel('教师备注')).toHaveValue('Keep me');
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('cuelight:alive:')).map(k => sessionStorage.getItem(k)))).toEqual(before);
  await page.evaluate(() => { URL.createObjectURL = () => { throw Error('Download unavailable'); }; });
  await page.getByRole('button', { name: '导出 TRACE 文件', exact: true }).click();
  await expect(page.getByText('导出失败，尚未保存', { exact: false })).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('教师备注')).toHaveValue('Keep me');
});

test('storage failure cannot claim a record was accepted; metadata failure is explicit', async ({ page }) => {
  await page.clock.install(); await page.goto('/');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Lesson storage is full.'); }; });
  await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(2_250);
  await expect(page.getByTestId('cue-choice')).toHaveCount(0);
  await expect(page.getByText('工作台本地暂存失败', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Show diagnostics' }).click(); await expect(page.getByTestId('evidence-version')).toHaveText('0');
});

test('delete stops replay, removes just this local record and cannot resurrect on timers', async ({ page }) => {
  await page.clock.install(); await page.goto('/'); await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(2_250);
  await page.getByLabel('教师备注').fill('delete me');
  const keys = await page.evaluate(() => Object.keys(sessionStorage));
  await page.evaluate(() => sessionStorage.setItem('unrelated', 'retain'));
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '删除当前本地记录' }).click(); await page.clock.runFor(30_000);
  await expect(page.getByTestId('cue-choice')).toHaveCount(0);
  expect(await page.evaluate(keys => keys.map(k => sessionStorage.getItem(k)), keys)).toEqual(keys.map(() => null));
  expect(await page.evaluate(() => sessionStorage.getItem('unrelated'))).toBe('retain');
});

test('long original text is inert and partial UTF-16 quotation highlights only its source span', async ({ page }) => {
  const h = fixtureHost('long'); const original = `前文 ${'中文 water '.repeat(180)}🧪 <img src="https://example.invalid/"> 后文`;
  h.accept([{ type: 'RECORD_EVIDENCE', fragments: [{ id: 'f1', text: original, startMs: 1000, endMs: 9000 }] }]);
  const ref = binding(h.store.getSnapshot(), 'f1', original.indexOf('🧪'), original.indexOf('🧪') + 2);
  h.accept([{ type: 'CREATE', identityKey: 'A', parts: [{ ...h.part('p', 'f1'), content: 'source_spans', sourceBindings: [ref] }], basis: [ref] }]);
  const requests: string[] = []; page.on('request', r => { if (r.url().includes('example.invalid')) requests.push(r.url()); });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByLabel('打开 TRACE 文件').setInputFiles({ name: 'long.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(h.store.export() as LessonHistory)) });
  await page.getByTestId('cue-detail').filter({ visible: true }).getByRole('button', { name: /原文/ }).first().click();
  await expect(page.locator('#file-source mark')).toHaveText('🧪');
  await expect(page.locator('#file-source blockquote').first()).toHaveText(original);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(requests).toEqual([]); await expect(page.locator('#file-source img')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/trace-long-source.png', fullPage: true });
});

test('opening a file preserves a running capture, and returning resumes the same view and notes', async ({ page }) => {
  await page.clock.install(); await page.goto('/'); await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(2_250);
  const id = await page.getByTestId('cue-detail').getAttribute('data-cue-id'); await page.getByLabel('教师备注').fill('Live note');
  await page.getByLabel('打开 TRACE 文件').setInputFiles({ name: 'history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(foundationReplayFixture().history)) });
  await expect(page.getByText('只读文件 · 不调用模型或麦克风。', { exact: false })).toBeVisible();
  await page.clock.runFor(14_600); await page.getByRole('button', { name: '返回当前会话' }).click();
  await expect(page.getByTestId('cue-detail')).toHaveAttribute('data-cue-id', id!);
  await expect(page.getByLabel('教师备注')).toHaveValue('Live note'); await expect(page.getByTestId('cue-choice')).toHaveCount(2);
});

test('failed local deletion reports failure and keeps an exportable view with all tasks cancelled', async ({ page }) => {
  await page.clock.install(); await page.goto('/'); await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(2_250);
  await page.evaluate(() => { Storage.prototype.removeItem = () => { throw Error('unavailable'); }; });
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '删除当前本地记录' }).click();
  await expect(page.getByRole('alert')).toContainText('本地删除失败');
  await page.clock.runFor(30_000); await expect(page.getByTestId('cue-choice')).toHaveCount(1);
  const json = await downloaded(page, '导出 TRACE 文件'); expect(JSON.parse(json).history.events.length).toBeGreaterThan(0);
});
