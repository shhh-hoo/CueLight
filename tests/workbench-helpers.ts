import { type Page, type Locator } from '@playwright/test';
type Scope = Page | Locator;
export const activeTrace = (page: Page) => page.getByRole('region', { name: '教师 TRACE' }).filter({ visible: true });
export async function flow(scope: Scope) {
  const button = scope.getByRole('button', { name: /^Lesson Flow/ });
  if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
}
export async function inspect(scope: Scope, index = 0) {
  await flow(scope);
  // Close an overlay before selecting another Cue on a narrow viewport.
  const close = scope.getByRole('button', { name: '关闭工作栏' });
  if (await close.isVisible()) await close.click();
  await scope.getByTestId('cue-choice').nth(index).click();
}
export async function notes(scope: Scope) {
  const sheet = scope.getByRole('navigation', { name: 'Cue 工作', exact: true });
  await (await sheet.isVisible() ? sheet : scope.locator('.workbench-tools')).getByRole('button', { name: 'Note', exact: true }).click();
}
export async function cueTab(scope: Scope) {
  await scope.getByRole('navigation', { name: 'Cue 工作', exact: true }).getByRole('button', { name: 'Cue', exact: true }).click();
}
export async function records(scope: Scope) {
  const menu = scope.locator('.trace-save').filter({ visible: true });
  if (await menu.getAttribute('open') === null) await menu.locator('summary').click();
}
export async function noteText(scope: Scope, text: string) {
  await notes(scope); await scope.getByLabel('教师备注').fill(text);
}
