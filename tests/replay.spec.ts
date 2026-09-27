import { test, expect } from '@playwright/test';
const osmosis = 'Osmosis is the movement of water across a partially permeable membrane.';
const clarification = 'The moving particles are water, not solute.';
const diffusion = 'Diffusion is the net movement of particles from higher to lower concentration.';

test('offline replay keeps every Cue and revision; new Cues do not steal the teacher selection', async ({ page }) => {
  const errors: string[] = []; const remote: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:')) remote.push(r.url()); });
  await page.clock.install(); await page.goto('/');
  await expect(page.getByRole('region', { name: 'Learner surface' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(2_250);
  const detail = page.getByTestId('cue-detail');
  await expect(detail).toContainText(osmosis);
  const id = await detail.getAttribute('data-cue-id');
  await detail.evaluate(e => e.setAttribute('data-marker', 'stable'));
  await page.clock.runFor(3_600);
  await expect(detail).toContainText(clarification);
  await expect(detail).toHaveAttribute('data-cue-id', id!);
  await expect(detail).toHaveAttribute('data-marker', 'stable');
  await page.getByLabel('Cue 版本').selectOption('1');
  await expect(detail).not.toContainText(clarification);
  await page.clock.runFor(11_000);
  await expect(page.getByTestId('cue-choice')).toHaveCount(2);
  await expect(detail).toHaveAttribute('data-cue-id', id!);
  await expect(detail).not.toContainText(diffusion);
  await expect(detail).not.toContainText(clarification);
  await expect(page.getByRole('button', { name: 'Replay complete' })).toBeDisabled();
  await page.getByTestId('cue-choice').nth(1).click();
  await expect(detail).toContainText(diffusion);
  await page.getByTestId('cue-choice').first().click();
  await expect(detail).toContainText(clarification);
  await page.screenshot({ path: 'artifacts/trace-desktop.png', fullPage: true });
  expect(errors).toEqual([]); expect(remote).toEqual([]);
});

test('pause, cancelled leave, confirmed switch and reset preserve session isolation', async ({ page }) => {
  await page.clock.install(); await page.goto('/');
  await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(2_250);
  await page.getByRole('button', { name: 'Pause replay' }).click(); await page.clock.runFor(60_000);
  await expect(page.getByTestId('cue-detail')).not.toContainText(clarification);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByLabel('Lesson', { exact: true }).selectOption('programming');
  await expect(page.getByLabel('Lesson', { exact: true })).toHaveValue('science');
  await page.getByRole('button', { name: 'Continue replay' }).click(); await page.clock.runFor(3_600);
  await expect(page.getByTestId('cue-detail')).toContainText(clarification);
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('Lesson', { exact: true }).selectOption('programming'); await page.clock.runFor(20_000);
  await expect(page.getByTestId('cue-choice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(2_250);
  await expect(page.getByTestId('cue-detail')).toContainText('A Python list is mutable.');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); await page.clock.runFor(20_000);
  await expect(page.getByTestId('cue-choice')).toHaveCount(0);
});
for (const [subject, expected] of [
  ['history', 'The League of Nations was established in 1920.'],
  ['literature', 'A soliloquy lets a character speak their thoughts aloud while alone on stage.'],
  ['programming', 'A Python tuple is immutable: you cannot replace its elements after creation.'],
  ['mathematics', 'If a product of two factors is zero, at least one factor must be zero.'],
]) test(`${subject} remains readable after replay ends`, async ({ page }) => {
  await page.clock.install(); await page.goto('/'); await page.getByLabel('Lesson', { exact: true }).selectOption(subject!);
  await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(16_850);
  await expect(page.getByTestId('cue-choice')).toHaveCount(2);
  await page.getByTestId('cue-choice').nth(1).click(); await expect(page.getByTestId('cue-detail')).toContainText(expected!);
  await expect(page.getByRole('button', { name: 'Replay complete' })).toBeDisabled();
});

test('narrow TRACE supports keyboard selection, notes and full source without horizontal clipping', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install(); await page.goto('/');
  await page.getByRole('button', { name: 'Start replay' }).focus(); await page.keyboard.press('Enter'); await page.clock.runFor(16_850);
  await page.getByTestId('cue-choice').nth(1).focus(); await page.keyboard.press('Enter');
  await expect(page.getByTestId('cue-detail')).toContainText(diffusion);
  await page.getByLabel('教师备注').fill('课后核对');
  await page.getByTestId('cue-detail').getByRole('button', { name: /原文/ }).first().focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#live-source mark')).toHaveText(diffusion);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/trace-mobile.png', fullPage: true });
});
