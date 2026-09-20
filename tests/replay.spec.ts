import { test, expect } from '@playwright/test';

const osmosis = 'Osmosis is the movement of water across a partially permeable membrane.';
const clarification = 'The moving particles are water, not solute.';
const diffusion = 'Diffusion is the net movement of particles from higher to lower concentration.';

test('one real-time replay: filler stays hidden, UPDATE stays in place, NEW transitions, previous expires', async ({ page }) => {
  const errors: string[] = [];
  const remoteRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5173/')) remoteRequests.push(request.url()); });
  await page.goto('/');
  const surface = page.getByRole('region', { name: 'Learner surface' });
  await expect(surface).toContainText('A little space');
  await expect(page.getByRole('complementary', { name: 'Developer diagnostics' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show diagnostics' }).click();
  await page.getByRole('button', { name: 'Start replay' }).click();
  await expect(page.getByTestId('returned-action')).toHaveText('QUIET');
  await expect(surface).not.toContainText('All right');
  await expect(page.getByTestId('current-cue')).toContainText(osmosis);
  const id = await page.getByTestId('current-cue').getAttribute('data-cue-id');
  await page.getByTestId('current-cue').evaluate(element => { element.setAttribute('data-identity-marker', 'same-element'); });
  await expect(page.getByTestId('current-cue')).toContainText(clarification, { timeout: 6_000 });
  await expect(page.getByTestId('current-cue')).toHaveAttribute('data-cue-id', id!);
  await expect(page.getByTestId('current-cue')).toHaveAttribute('data-identity-marker', 'same-element');
  await expect(page.getByTestId('returned-action')).toHaveText('UPDATE_CURRENT');
  await expect(page.getByTestId('current-cue')).toContainText(diffusion, { timeout: 9_000 });
  await expect(page.getByTestId('previous-cue')).toContainText(`${osmosis} ${clarification}`);
  await expect(page.getByTestId('current-cue')).not.toHaveAttribute('data-cue-id', id!);
  await page.screenshot({ path: 'artifacts/replay-transition-desktop.png', fullPage: true });
  await expect(page.getByTestId('previous-cue')).toHaveCount(0, { timeout: 6_000 });
  await expect(page.getByRole('button', { name: 'Replay complete' })).toBeDisabled();
  await expect(surface).not.toContainText('Okay, let us pause');
  await expect(surface).not.toContainText('We will look at an example');
  expect(errors).toEqual([]);
  expect(remoteRequests).toEqual([]);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(surface).toContainText('A little space');
  await expect(page.getByTestId('evidence-version')).toHaveText('0');
});

test('pause/continue, reset, and lesson switch are deterministic', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(2_250);
  await expect(page.getByTestId('current-cue')).toContainText(osmosis);
  await page.getByRole('button', { name: 'Pause replay' }).click();
  await page.clock.runFor(60_000);
  await expect(page.getByTestId('current-cue')).not.toContainText(clarification);
  await page.getByRole('button', { name: 'Continue replay' }).click();
  await page.clock.runFor(3_600);
  await expect(page.getByTestId('current-cue')).toContainText(clarification);
  await page.getByLabel('Lesson', { exact: true }).selectOption('programming');
  await expect(page.getByTestId('current-cue')).toHaveCount(0);
  await page.clock.runFor(20_000);
  await expect(page.getByTestId('current-cue')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(2_250);
  await expect(page.getByTestId('current-cue')).toContainText('A Python list is mutable.');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.clock.runFor(20_000);
  await expect(page.getByTestId('current-cue')).toHaveCount(0);
});

for (const [subject, expected] of [
  ['history', 'The League of Nations was established in 1920.'],
  ['literature', 'A soliloquy lets a character speak their thoughts aloud while alone on stage.'],
  ['programming', 'A Python tuple is immutable: you cannot replace its elements after creation.'],
  ['mathematics', 'If a product of two factors is zero, at least one factor must be zero.'],
]) {
  test(`${subject} plays through the same product path`, async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.getByLabel('Lesson', { exact: true }).selectOption(subject!);
    await page.getByRole('button', { name: 'Start replay' }).click();
    await page.clock.runFor(16_850);
    await expect(page.getByTestId('current-cue')).toContainText(expected!);
    await expect(page.getByTestId('previous-cue')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Replay complete' })).toBeDisabled();
  });
}

test('narrow layout stays readable, works by keyboard and tolerates reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  const start = page.getByRole('button', { name: 'Start replay' });
  await start.focus();
  await page.keyboard.press('Enter');
  await page.clock.runFor(12_050);
  await expect(page.getByTestId('current-cue')).toContainText(diffusion);
  await expect(page.getByTestId('previous-cue')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const surface = await page.getByRole('region', { name: 'Learner surface' }).boundingBox();
  const current = await page.getByTestId('current-cue').boundingBox();
  expect(current!.x).toBeGreaterThanOrEqual(surface!.x);
  expect(current!.x + current!.width).toBeLessThanOrEqual(surface!.x + surface!.width);
  await page.screenshot({ path: 'artifacts/replay-transition-mobile.png', fullPage: true });
});
