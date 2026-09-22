import { replayReply } from './semantic-mock';
import { test, expect, type Page } from '@playwright/test';
import type { PresentationResult } from '../src/refinement/presentation';

const source = 'Osmosis is the movement of water across a partially permeable membrane.';
const clarification = 'The moving particles are water, not solute.';
const diffusion = 'Diffusion is the net movement of particles from higher to lower concentration.';
const textResult: PresentationResult = { kind: 'presentation', blocks: [{ kind: 'text', text: 'Water moves across a partially permeable membrane.' }] };
const mixedResult: PresentationResult = { kind: 'presentation', blocks: [
  { kind: 'text', text: 'Osmosis moves water.' },
  { kind: 'chain', nodes: ['Water', 'Across a partially permeable membrane'], links: [{ kind: 'moves_to', label: null }] },
] };

async function ready(page: Page) {
  await page.route('**/api/jev/status', route => route.fulfill({ json: { configured: true, model: 'jev-test' } }));
  await page.route('**/api/openai/status', route => route.fulfill({ json: {
    configured: true, model: 'presentation-test', timeoutMs: 6000, maxInputChars: 16000, defaultEnabled: false,
  } }));
  await page.route('**/api/jev/inspect', route => {
    const input = route.request().postDataJSON();
    return route.fulfill({ json: replayReply(input) });
  });
  await page.goto('/');
  await page.getByLabel('Decision provider', { exact: true }).selectOption('jev');
  await expect(page.getByText('Jev ready', { exact: false })).toBeVisible();
}

async function fitsWithoutClipping(page: Page) {
  const layout = await page.getByRole('region', { name: 'Learner surface' }).evaluate(surface => {
    const rect = surface.getBoundingClientRect();
    const nodes = [surface, ...surface.querySelectorAll('.current-cue, .cue-presentation, .cue-text, .cue-list, .cue-chain, .cue-chain-node, .cue-chain-link')];
    return {
      pageFits: document.documentElement.scrollWidth <= innerWidth,
      allInside: nodes.every(node => {
        const bounds = node.getBoundingClientRect();
        return bounds.left >= rect.left - 1 && bounds.right <= rect.right + 1;
      }),
      noClipping: nodes.every(node => {
        const style = getComputedStyle(node);
        return !['hidden', 'clip'].includes(style.overflowX) && !['hidden', 'clip'].includes(style.overflowY)
          && !['hidden', 'clip'].includes(style.overflow) && !['1', '2', '3'].includes(style.webkitLineClamp);
      }),
    };
  });
  expect(layout).toEqual({ pageFits: true, allInside: true, noClipping: true });
}

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`presentation forms remain readable at ${viewport.width} with reduced motion`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    let result: PresentationResult = { kind: 'source' };
    let calls = 0;
    await page.route('**/api/openai/refine', route => { calls++; return route.fulfill({ json: { result } }); });
    await ready(page);
    await page.getByRole('button', { name: 'Start replay' }).click();
    await page.clock.runFor(2_250);
    await page.getByRole('button', { name: 'Pause replay' }).click();
    const cue = page.getByTestId('current-cue');
    const checkbox = page.getByRole('checkbox', { name: 'Text refinement', exact: false });
    await expect(cue).toContainText(source);
    expect(calls).toBe(0);
    await cue.evaluate(element => { element.setAttribute('data-identity-marker', 'stable'); });

    await checkbox.check();
    await expect.poll(() => calls).toBe(1);
    await expect(cue).toContainText(source);
    await expect(cue.locator('.cue-presentation')).toHaveCount(0);
    await checkbox.uncheck();

    result = textResult;
    await checkbox.check();
    await expect(cue).toContainText('Water moves across');
    await expect(cue.locator('.cue-presentation > p')).toHaveCount(1);
    await fitsWithoutClipping(page);
    await checkbox.uncheck();
    await expect(cue).toContainText(source);

    result = { kind: 'presentation', blocks: [{ kind: 'list', items: [
      { label: 'Moving particles', text: 'Water' }, { label: null, text: 'A partially permeable membrane' },
    ] }] };
    await checkbox.check();
    await expect(cue.getByRole('listitem')).toHaveCount(2);
    await expect(cue.getByRole('list')).toContainText('Moving particles');
    await fitsWithoutClipping(page);
    await page.screenshot({ path: `artifacts/presentation-list-${viewport.width}.png`, fullPage: true });
    await checkbox.uncheck();

    result = { kind: 'presentation', blocks: [
      { kind: 'chain', nodes: ['First observation', 'Next observation', 'Result'], links: [
        { kind: 'sequence', label: 'Order only' }, { kind: 'causes', label: 'Explicit cause' },
      ] },
      { kind: 'chain', nodes: ['Initial form', 'New form', 'New place'], links: [
        { kind: 'becomes', label: null }, { kind: 'moves_to', label: null },
      ] },
    ] };
    await checkbox.check();
    await expect(cue.getByRole('list', { name: 'Connected ideas' })).toHaveCount(2);
    for (const word of ['then', 'causes', 'becomes', 'moves to']) await expect(cue.getByText(word, { exact: true })).toBeVisible();
    const sequence = cue.locator('[data-link-kind="sequence"]');
    await expect(sequence).not.toContainText(/causes|⇒|→|↦/);
    const accessible = await cue.ariaSnapshot();
    for (const word of ['then', 'causes', 'becomes', 'moves to']) expect(accessible).toContain(word);
    const direction = await cue.locator('.cue-chain').first().evaluate(node => getComputedStyle(node).flexDirection);
    expect(direction).toBe(viewport.width < 640 ? 'column' : 'row');
    await fitsWithoutClipping(page);
    await page.screenshot({ path: `artifacts/presentation-chain-${viewport.width}.png`, fullPage: true });
    await checkbox.uncheck();

    result = mixedResult;
    await checkbox.check();
    await expect(cue.locator('.cue-presentation > *')).toHaveCount(2);
    await expect(cue).toContainText('Osmosis moves water.');
    await fitsWithoutClipping(page);
    await page.screenshot({ path: `artifacts/presentation-mixed-${viewport.width}.png`, fullPage: true });
    await checkbox.uncheck();

    // Exactly 1,200 code points across three blocks, including an unbroken label and mixed-language text.
    result = { kind: 'presentation', blocks: [
      { kind: 'text', text: '水water '.repeat(40) },
      { kind: 'list', items: [
        { label: 'L'.repeat(80), text: '甲'.repeat(280) },
        { label: null, text: '乙'.repeat(80) },
        { label: null, text: '丙'.repeat(40) },
        { label: null, text: '丁'.repeat(40) },
        { label: null, text: '戊'.repeat(40) },
      ] },
      { kind: 'chain', nodes: ['壹'.repeat(120), '贰'.repeat(80), '叁'.repeat(80), '肆'.repeat(80)], links: [
        { kind: 'sequence', label: null }, { kind: 'becomes', label: null }, { kind: 'moves_to', label: null },
      ] },
    ] };
    await checkbox.check();
    await expect(cue.locator('.cue-presentation > *')).toHaveCount(3);
    await expect(cue.locator('.cue-list > li')).toHaveCount(5);
    await fitsWithoutClipping(page);
    await expect(cue).toHaveAttribute('data-identity-marker', 'stable');
    await page.screenshot({ path: `artifacts/presentation-limits-${viewport.width}.png`, fullPage: true });
    expect(calls).toBe(6);
  });
}

test('source is first, each revision replaces atomically, and UPDATE preserves the article', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.clock.install();
  const pending: (() => void)[] = [];
  const replies = [textResult, mixedResult];
  await page.route('**/api/openai/refine', async route => {
    const result = replies[pending.length] ?? { kind: 'source' };
    await new Promise<void>(resolve => { pending.push(resolve); });
    await route.fulfill({ json: { result } }).catch(() => {});
  });
  await ready(page);
  await page.getByRole('checkbox', { name: 'Text refinement', exact: false }).check();
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(2_250);
  const cue = page.getByTestId('current-cue');
  await expect(cue).toContainText(source);
  await expect.poll(() => pending.length).toBe(1);
  await cue.evaluate(element => { element.setAttribute('data-identity-marker', 'stable'); });
  pending[0]!();
  await expect(cue).toContainText('Water moves across');
  await page.clock.runFor(3_600);
  await expect(cue).toContainText(`${source} ${clarification}`);
  await expect(cue.locator('.cue-presentation')).toHaveCount(0);
  await expect.poll(() => pending.length).toBe(2);
  await cue.evaluate(element => {
    const snapshots: string[] = [];
    Object.assign(window, { presentationPaints: snapshots });
    new MutationObserver(() => snapshots.push(element.textContent ?? '')).observe(element, { childList: true, subtree: true, characterData: true });
  });
  pending[1]!();
  await expect(cue.locator('.cue-presentation > *')).toHaveCount(2);
  await expect(cue).toContainText('Osmosis moves water.');
  await expect(cue).toHaveAttribute('data-identity-marker', 'stable');
  const paints = await page.evaluate(() => (window as unknown as { presentationPaints: string[] }).presentationPaints);
  expect(paints.length).toBeGreaterThan(0);
  expect(paints.every(paint => paint.includes('Osmosis moves water.') && paint.includes('Across a partially permeable membrane'))).toBe(true);
  await page.clock.runFor(6_200);
  await expect(cue).toContainText(diffusion);
  await expect(page.getByTestId('previous-cue')).toContainText('Osmosis moves water.');
  await expect(cue).not.toHaveAttribute('data-identity-marker', 'stable');
});

test('late cancelled response cannot revise the previous Cue', async ({ page }) => {
  await page.clock.install();
  const pending: (() => void)[] = [];
  await page.route('**/api/openai/refine', async route => {
    await new Promise<void>(resolve => { pending.push(resolve); });
    await route.fulfill({ json: { result: textResult } }).catch(() => {});
  });
  await ready(page);
  await page.getByRole('checkbox', { name: 'Text refinement', exact: false }).check();
  await page.getByRole('button', { name: 'Start replay' }).click();
  await page.clock.runFor(2_250);
  await expect.poll(() => pending.length).toBe(1);
  await page.clock.runFor(3_600);
  await expect(page.getByTestId('current-cue')).toContainText(clarification);
  await expect.poll(() => pending.length).toBe(2);
  await page.clock.runFor(6_200);
  await expect(page.getByTestId('current-cue')).toContainText(diffusion);
  await expect(page.getByTestId('previous-cue')).toContainText(`${source} ${clarification}`);
  pending[0]!();
  pending[1]!();
  await page.clock.runFor(50);
  await expect(page.getByTestId('current-cue')).toContainText(diffusion);
  await expect(page.getByTestId('previous-cue')).toContainText(`${source} ${clarification}`);
  await expect(page.getByTestId('previous-cue')).not.toContainText('Water moves across');
});
