import { inspect } from './workbench-helpers';
import { replayReply } from './semantic-mock';
import { test, expect, type Page } from '@playwright/test';
import type { PresentationResult } from '../src/refinement/presentation';

const source = 'Osmosis is the movement of water across a partially permeable membrane.';
const clarification = 'The moving particles are water, not solute.';
const textResult: PresentationResult = { kind: 'presentation', blocks: [{ kind: 'text', text: 'Water moves across a partially permeable membrane.' }] };
const mixedResult: PresentationResult = { kind: 'presentation', blocks: [
  { kind: 'text', text: 'Osmosis moves water.' },
  { kind: 'chain', nodes: ['Water', 'Across a partially permeable membrane'], links: [{ kind: 'moves_to', label: null }] },
] };
async function ready(page: Page) {
  await page.route('**/api/jev/status', route => route.fulfill({ json: { configured: true, model: 'jev-test' } }));
  await page.route('**/api/openai/status', route => route.fulfill({ json: { configured: true, model: 'presentation-test', timeoutMs: 6000, maxInputChars: 16000, defaultEnabled: false } }));
  await page.route('**/api/jev/inspect', route => route.fulfill({ json: replayReply(route.request().postDataJSON()) }));
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/dev'); await page.getByLabel('Decision provider', { exact: true }).selectOption('jev');
  await expect(page.getByText('Jev ready', { exact: false })).toBeVisible();
}
async function fits(page: Page) {
  const layout = await page.getByTestId('cue-detail').evaluate(surface => {
    const rect = surface.getBoundingClientRect();
    const nodes = [surface, ...surface.querySelectorAll('.cue-presentation, .cue-text, .cue-list, .cue-chain, .cue-chain-node, .cue-chain-link')];
    return { pageFits: document.documentElement.scrollWidth <= innerWidth, inside: nodes.every(node => {
      const r = node.getBoundingClientRect(); const style = getComputedStyle(node);
      return r.left >= rect.left - 1 && r.right <= rect.right + 1 && !['hidden', 'clip'].includes(style.overflow);
    }) };
  });
  expect(layout).toEqual({ pageFits: true, inside: true });
}
for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`derived presentation forms retain source alongside at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.clock.install();
    let result: PresentationResult = { kind: 'source' }; let calls = 0;
    await page.route('**/api/openai/refine', route => { calls++; return route.fulfill({ json: { result } }); }); await ready(page);
    const variants: PresentationResult[] = [result, textResult,
      { kind: 'presentation', blocks: [{ kind: 'list', items: [{ label: 'Moving particles', text: 'Water' }, { label: null, text: 'A partially permeable membrane' }] }] },
      { kind: 'presentation', blocks: [
        { kind: 'chain', nodes: ['First', 'Next', 'Result'], links: [{ kind: 'sequence', label: 'Order only' }, { kind: 'causes', label: 'Explicit cause' }] },
        { kind: 'chain', nodes: ['Initial', 'New form', 'New place'], links: [{ kind: 'becomes', label: null }, { kind: 'moves_to', label: null }] },
      ] }, mixedResult,
      { kind: 'presentation', blocks: [
        { kind: 'text', text: '水water '.repeat(40) },
        { kind: 'list', items: [{ label: 'L'.repeat(80), text: '甲'.repeat(280) }, { label: null, text: '乙'.repeat(80) }, { label: null, text: '丙'.repeat(40) }, { label: null, text: '丁'.repeat(40) }, { label: null, text: '戊'.repeat(40) }] },
        { kind: 'chain', nodes: ['壹'.repeat(120), '贰'.repeat(80), '叁'.repeat(80), '肆'.repeat(80)], links: [{ kind: 'sequence', label: null }, { kind: 'becomes', label: null }, { kind: 'moves_to', label: null }] },
      ] },
    ];
    for (let i = 0; i < variants.length; i++) {
      result = variants[i]!;
      if (i) {
        await page.getByRole('button', { name: '关闭工作栏' }).click();
        await page.getByRole('button', { name: 'Reset', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(2_250);
      await page.getByRole('button', { name: 'Pause replay' }).click();
      await inspect(page); const detail = page.getByTestId('cue-detail'); await expect(detail).toContainText(source);
      // Narrow sheets isolate the background; close before using provider controls.
      if (viewport.width < 800) await page.getByRole('button', { name: '关闭工作栏' }).click();
      await page.getByRole('checkbox', { name: 'Text refinement', exact: false }).check(); await expect.poll(() => calls).toBe(i + 1);
      if (viewport.width < 800) await inspect(page);
      if (result.kind === 'source') await expect(detail.locator('.cue-presentation')).toHaveCount(0);
      else {
        await expect(detail.locator('.cue-presentation > *')).toHaveCount(result.blocks.length);
        await expect(detail).toContainText('派生呈现，不是讲授原话'); await expect(detail).toContainText(source);
        if (i === 3) {
          for (const word of ['then', 'causes', 'becomes', 'moves to']) await expect(detail.getByText(word, { exact: true })).toBeVisible();
          await expect(detail.locator('[data-link-kind="sequence"]')).not.toContainText(/causes|⇒|→|↦/);
          expect(await detail.locator('.cue-chain').first().evaluate(n => getComputedStyle(n).flexDirection)).toBe(viewport.width < 640 ? 'column' : 'row');
        }
      }
      await fits(page);
    }
    await page.screenshot({ path: `artifacts/trace-presentation-${viewport.width}.png`, fullPage: true });
  });
}

test('source is first; derived replacement is atomic and keyed to the selected historical version', async ({ page }) => {
  await page.clock.install(); const pending: (() => void)[] = []; const replies = [textResult, mixedResult];
  await page.route('**/api/openai/refine', async route => {
    const result = replies[pending.length] ?? { kind: 'source' };
    await new Promise<void>(resolve => pending.push(resolve)); await route.fulfill({ json: { result } }).catch(() => {});
  }); await ready(page);
  await page.getByRole('checkbox', { name: 'Text refinement', exact: false }).check();
  await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(2_250);
  await inspect(page); const detail = page.getByTestId('cue-detail'); await expect(detail).toContainText(source); await expect.poll(() => pending.length).toBe(1);
  await detail.evaluate(e => e.setAttribute('data-marker', 'stable')); pending[0]!(); await expect(detail).toContainText('Water moves across');
  await page.clock.runFor(3_600); await page.getByLabel('Cue 版本').selectOption('2'); await expect(detail).toContainText(clarification);
  await expect(detail.locator('.cue-presentation')).toHaveCount(0); await expect.poll(() => pending.length).toBe(2);
  await detail.evaluate(element => {
    const snapshots: string[] = []; Object.assign(window, { presentationPaints: snapshots });
    new MutationObserver(() => snapshots.push(element.textContent ?? '')).observe(element, { childList: true, subtree: true, characterData: true });
  }); pending[1]!(); await expect(detail.locator('.cue-presentation > *')).toHaveCount(2);
  await expect(detail).toHaveAttribute('data-marker', 'stable');
  const paints = await page.evaluate(() => (window as unknown as { presentationPaints: string[] }).presentationPaints);
  expect(paints.length).toBeGreaterThan(0); expect(paints.every(p => p.includes('Osmosis moves water.') && p.includes('Across a partially permeable membrane'))).toBe(true);
  await page.getByLabel('Cue 版本').selectOption('1'); await expect(detail).toContainText('Water moves across'); await expect(detail).not.toContainText(clarification);
  await page.clock.runFor(6_200); await expect(page.getByTestId('cue-choice')).toHaveCount(2);
  await expect(detail).toHaveAttribute('data-marker', 'stable');
});

test('late cancelled presentation cannot overwrite any historical Cue', async ({ page }) => {
  await page.clock.install(); const pending: (() => void)[] = [];
  await page.route('**/api/openai/refine', async route => {
    await new Promise<void>(resolve => pending.push(resolve)); await route.fulfill({ json: { result: textResult } }).catch(() => {});
  }); await ready(page); await page.getByRole('checkbox', { name: 'Text refinement', exact: false }).check();
  await page.getByRole('button', { name: 'Start replay' }).click(); await page.clock.runFor(2_250); await expect.poll(() => pending.length).toBe(1);
  await page.clock.runFor(3_600); await inspect(page); await expect(page.getByTestId('cue-detail')).toContainText(clarification); await expect.poll(() => pending.length).toBe(2);
  await page.clock.runFor(6_200); await expect(page.getByTestId('cue-choice')).toHaveCount(2);
  pending[0]!(); pending[1]!(); await page.clock.runFor(50);
  await expect(page.getByTestId('cue-detail')).not.toContainText('Water moves across');
  await page.getByLabel('Cue 版本').selectOption('1'); await expect(page.getByTestId('cue-detail')).not.toContainText('Water moves across');
});
