import { expect, test } from '@playwright/test';
import type { CueRecord, LessonHistory } from '../src/alive/types';

// The visible product uses its normal scripted source and real tab storage.
// No provider endpoint is called by this test.
test('lesson history survives foreground expiry and browser reload without model replay', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(16_850);
  const current = page.getByTestId('current-cue');
  await expect(current).toContainText('Diffusion');
  await expect(page.getByTestId('previous-cue')).toHaveCount(0);
  const visibleId = await current.getAttribute('data-cue-id');
  const saved = await page.evaluate(() => {
    const key = Object.keys(sessionStorage).find(key => key.startsWith('cuelight:alive:'))!;
    return { key, history: JSON.parse(sessionStorage.getItem(key)!) as LessonHistory };
  });
  expect(saved.history.events.some(event => event.operations.some(op => op.type === 'CREATE'))).toBe(true);
  await page.reload();
  const recovered = await page.evaluate(async ({ key }) => {
    const modulePath = '/src/alive/journal.ts';
    const { replayLesson } = await import(/* @vite-ignore */ modulePath);
    const history = JSON.parse(sessionStorage.getItem(key)!);
    const state = replayLesson(history);
    return { ids: Object.keys(state.cues), current: state.attention.currentCueId,
      revisions: (Object.values(state.cues) as CueRecord[]).map((cue: CueRecord) => cue.currentSemanticRevision),
      recorded: state.evidenceOrder.length };
  }, saved);
  expect(recovered.ids).toHaveLength(2);
  expect(recovered.current).toBe(visibleId);
  expect(recovered.revisions).toEqual([2, 1]);
  expect(recovered.recorded).toBeGreaterThan(2);
  // Reload opens a fresh capture session; recovery does not silently call Jev.
  await expect(page.getByRole('button', { name: 'Start replay' })).toBeEnabled();
});

test('storage failure leaves the learner surface and evidence acceptance unchanged', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Lesson storage is full.'); }; });
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(2_250);
  await expect(page.getByTestId('current-cue')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show diagnostics' }).click();
  await expect(page.getByTestId('evidence-version')).toHaveText('0');
});
