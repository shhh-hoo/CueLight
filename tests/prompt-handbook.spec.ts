import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('offline handbook exposes every responsibility and source-backed previews without remote resources', async ({ page }) => {
  execFileSync(process.execPath, ['--import','./prompts/evals/no-network.mjs','--import','./scripts/register-ts.mjs','scripts/prompt-handbook.mjs','--no-open'], {
    env: { PATH: process.env.PATH, CI: 'true' }, cwd: process.cwd(),
  });
  const remote: string[] = [];
  await page.route(/^https?:/, route => { remote.push(route.request().url()); return route.abort(); });
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(pathToFileURL(resolve('.promptfoo/handbook/index.html')).href);
  await expect(page.locator('table tbody tr')).toHaveCount(11);
  await expect(page.getByRole('heading', { name: '完整任务总览' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/prompt-handbook-overview.png' });
  await page.getByRole('link', { name: '原讲授的语义复核与后台补认', exact: true }).click();
  const section = page.locator('#source-semantic-review');
  await expect(section).toContainText('原文没有 Y');
  await expect(section).toContainText('未启用通用后台语义写入');
  await section.screenshot({ path: 'artifacts/prompt-handbook-review.png' });
  await page.locator('#accepted-expression').getByText('Presentation · 完整请求（preview／未发送）', { exact: true }).click();
  await expect(page.locator('#accepted-expression details').first()).toContainText('sourceText');
  await expect(page.locator('#accepted-expression')).toContainText('PRESENTATION_INSTRUCTIONS');
  expect(remote).toEqual([]);
});
