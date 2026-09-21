import { latestSourceId, replayReply, semanticReply } from './semantic-mock';
import { test, expect, type Page } from '@playwright/test';

const osmosis = 'Osmosis is the movement of water across a partially permeable membrane.';
async function ready(page: Page) {
  await page.route('**/api/jev/status', route => route.fulfill({ json: { configured: true, model: 'jev-test-transport' } }));
  await page.goto('/');
  await page.getByLabel('Decision provider', { exact: true }).selectOption('jev');
  await expect(page.getByText('Jev ready', { exact: false })).toBeVisible();
}

test('Jev configuration is explicit; default demo and missing key never request a decision', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/jev/inspect', route => { calls++; return route.abort(); });
  await page.route('**/api/jev/status', route => route.fulfill({ json: { configured: false, model: 'jev-latest' } }));
  await page.goto('/');
  await expect(page.getByLabel('Decision provider', { exact: true })).toHaveValue('mock');
  await page.getByLabel('Decision provider', { exact: true }).selectOption('jev');
  await expect(page.getByText('Add TYPESAFE_API_KEY', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start replay' })).toBeDisabled();
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('button', { name: 'Start replay' })).toBeDisabled();
  await page.getByLabel('Decision provider', { exact: true }).selectOption('mock');
  await expect(page.getByRole('button', { name: 'Start replay' })).toBeEnabled();
  expect(calls).toBe(0);
});

test('Jev HTTP decisions drive the existing Engine and preserve Cue identity on REVISE', async ({ page }) => {
  await page.clock.install();
  const payloadKeys: string[][] = [];
  await page.route('**/api/jev/inspect', route => {
    const input = route.request().postDataJSON();
    payloadKeys.push(Object.keys(input).sort());
    expect(route.request().headers()).not.toHaveProperty('authorization');
    return route.fulfill({ json: replayReply(input) });
  });
  await ready(page);
  await page.getByRole('button', { name: 'Show diagnostics' }).click();
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(2_250);
  await expect(page.getByTestId('current-cue')).toContainText(osmosis);
  const id = await page.getByTestId('current-cue').getAttribute('data-cue-id');
  await page.clock.runFor(3_600);
  await expect(page.getByTestId('current-cue')).toContainText('The moving particles are water, not solute.');
  await expect(page.getByTestId('current-cue')).toHaveAttribute('data-cue-id', id!);
  await expect(page.getByTestId('returned-action')).toHaveText('REVISE');
  await expect(page.getByText('Jev provider', { exact: false })).toBeVisible();
  await expect(page.getByText('Decision latency', { exact: true })).toBeVisible();
  await page.clock.runFor(6_200);
  await expect(page.getByTestId('current-cue')).toContainText('Diffusion is the net movement');
  await expect(page.getByTestId('previous-cue')).toContainText(osmosis);
  expect(payloadKeys.every(keys => JSON.stringify(keys) === JSON.stringify(['contract', 'inspectionId', 'sessionEpoch', 'sessionId', 'sources', 'stage', 'workingSet']))).toBe(true);
});

test('Jev failure keeps the existing Cue and shows a service error outside the learner surface', async ({ page }) => {
  await page.clock.install();
  await page.route('**/api/jev/inspect', route => {
    const input = route.request().postDataJSON();
    const latest = latestSourceId(input);
    return latest === 'science-2'
      ? route.fulfill({ json: semanticReply(input) })
      : latest === 'science-3'
        ? route.fulfill({ status: 502, json: { error: 'Upstream unavailable' } })
        : route.fulfill({ json: semanticReply(input, 'NO_CHANGE') });
  });
  await ready(page);
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(2_250);
  await expect(page.getByTestId('current-cue')).toContainText(osmosis);
  await page.clock.runFor(3_600);
  await expect(page.getByRole('alert')).toContainText('Jev could not make a decision');
  await expect(page.getByTestId('current-cue')).not.toContainText('The moving particles');
  await expect(page.getByRole('region', { name: 'Learner surface' })).not.toContainText('Jev');
});

test('reset and provider switch abort delayed Jev work without writing into a new session', async ({ page }) => {
  await page.clock.install();
  let received = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/jev/inspect', async route => {
    received++;
    const input = route.request().postDataJSON();
    await gate;
    await route.fulfill({ json: semanticReply(input) }).catch(() => {});
  });
  await ready(page);
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(100);
  await expect.poll(() => received).toBe(1);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByLabel('Decision provider', { exact: true }).selectOption('mock');
  release();
  await page.clock.runFor(20_000);
  await expect(page.getByTestId('current-cue')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(2_250);
  await expect(page.getByTestId('current-cue')).toContainText(osmosis);
  expect(received).toBe(1);
});

test('configuration service failure is recoverable without making a model request', async ({ page }) => {
  let available = false;
  await page.route('**/api/jev/status', route => available
    ? route.fulfill({ json: { configured: true, model: 'jev-test-transport' } })
    : route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await page.route('**/api/jev/inspect', route => route.abort());
  await page.goto('/');
  await page.getByLabel('Decision provider', { exact: true }).selectOption('jev');
  await expect(page.getByText('Jev is unavailable', { exact: false })).toBeVisible();
  available = true;
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('button', { name: 'Start replay' })).toBeEnabled();
});
