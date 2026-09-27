import { inspect, flow, notes } from './workbench-helpers';
import { test, expect, type Page } from '@playwright/test';
import { semanticReply } from './semantic-mock';
import { configuration, setup, send, segments } from './microphone-helpers';

test.beforeEach(({ page }) => { page.on('dialog', dialog => dialog.accept()); });

const text = 'Electronegativity is the ability of an atom to attract a bonding pair of electrons.';

test('real recorder → batch evidence → bounded semantic steps; stop waits for trailing Cue before finish', async ({ page }) => {
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/jev/inspect', async route => {
    calls++;
    const input = route.request().postDataJSON();
    if (calls === 3) await pending;
    await route.fulfill({ json: semanticReply(input, input.sources[0].ranges[0].quote === 'Okay, moving on.' ? 'NO_CHANGE' : 'CREATE') });
  });
  const sessions = await setup(page, undefined, { ...configuration, preset: 'scribe' });
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  await expect(page.getByText('Microphone live · you can speak now')).toBeVisible();
  const session = sessions[0]!;
  await expect.poll(() => session.audio).toBeGreaterThan(0); // actual PCMRecorder / AudioWorklet
  send(session, 'AddPartialSegment', segments(1, ['Never displayed']));
  send(session, 'AddTranscript', segments(1, ['word']));
  send(session, 'segments', segments(1, ['Okay, moving on.', text]));
  await expect(page.getByTestId('current-cue')).toContainText(text);
  expect(calls).toBe(2);
  await expect(page.getByRole('region', { name: '教师 TRACE' })).not.toContainText('Never displayed');
  await page.getByRole('button', { name: 'Stop microphone' }).click();
  await expect.poll(() => session.commands).toContain('stop');
  send(session, 'segments', segments(2, ['The last sentence is retained.']));
  send(session, 'drained');
  await expect.poll(() => calls).toBe(3);
  expect(session.commands).not.toContain('finish');
  await expect(page.getByRole('button', { name: 'Finishing session…' })).toBeVisible();
  release();
  await expect(page.getByText('Session stopped', { exact: true })).toBeVisible();
  expect(session.commands).toEqual(['start', 'stop', 'finish']);
  await expect(page.getByTestId('cue-choice')).toHaveCount(2);
  await inspect(page);
  await expect(page.getByTestId('cue-detail')).toContainText(text);
  await inspect(page, 1);
  await expect(page.getByTestId('current-cue')).toContainText('The last sentence is retained.');
  await page.getByRole('button', { name: 'Show diagnostics' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export session diagnostics' }).click();
  const download = await downloadPromise;
  const stream = (await download.createReadStream())!;
  let json = ''; for await (const chunk of stream) json += chunk;
  const trace = JSON.parse(json);
  expect(trace.configuration.preset).toBe('scribe');
  expect(trace.jev).toEqual({ model: 'jev-test', timeoutMs: 5000, contextVersion: 'alive-jev-v1' });
  expect(trace.schemaVersion).toBe(4);
  expect(trace.refinement).toMatchObject({ model: 'refinement-test', timeoutMs: 6000, maxInputChars: 16000, defaultEnabled: false, style: 'presentation-v1' });
  expect(json).not.toMatch(/apiKey|Authorization|API_KEY/);
  expect(trace.fragments).toHaveLength(3);
  expect(trace.uniqueSemanticProviderAttempts).toBe(3);
  expect(trace.semanticAttempts).toHaveLength(3);
  for (const attempt of trace.semanticAttempts) {
    expect(attempt.trace.judgment.operation.confidence).toBe(0.73);
    expect(attempt.trace.outcome).toBe('accepted');
    expect(attempt.trace.proposal.inspection.contractVersion).toBe('alive-jev-v1');
    expect(attempt.trace.request.questions.operation.type).toBe('choice');
  }
});

test('reset cancels old Jev; a second session rejects old events; gateway loss is visible', async ({ page }) => {
  let release!: () => void;
  let calls = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/jev/inspect', async route => {
    calls++;
    const input = route.request().postDataJSON();
    if (calls === 1) await gate;
    await route.fulfill({ json: semanticReply(input) }).catch(() => {});
  });
  const sessions = await setup(page);
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  await expect(page.getByText('Microphone live · you can speak now')).toBeVisible();
  send(sessions[0]!, 'segments', segments(1, ['Old session.']));
  await expect.poll(() => calls).toBe(1);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  release();
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  await expect.poll(() => sessions.length).toBe(2);
  const fresh = sessions[1]!;
  expect(fresh.id).not.toBe(sessions[0]!.id);
  send(fresh, 'segments', { ...segments(1, ['Wrong session.']), sessionId: sessions[0]!.id });
  send(fresh, 'segments', segments(1, [text]));
  await expect(page.getByTestId('current-cue')).toContainText(text);
  expect(calls).toBe(2);
  fresh.ws.close();
  await expect(page.getByRole('alert')).toContainText('WebSocket connection was lost');
  await expect(page.getByTestId('current-cue')).toContainText(text);
});

test('Jev error leaves the Cue intact while provider errors interrupt with an actionable message', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/jev/inspect', route => {
    const input = route.request().postDataJSON();
    return ++calls === 1 ? route.fulfill({ json: semanticReply(input) })
      : route.fulfill({ status: 502, json: { error: 'unavailable' } });
  });
  const sessions = await setup(page);
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  await expect(page.getByText('Microphone live · you can speak now')).toBeVisible();
  send(sessions[0]!, 'segments', segments(1, [text]));
  await expect(page.getByTestId('current-cue')).toContainText(text);
  send(sessions[0]!, 'segments', segments(2, ['Another sentence.']));
  await expect(page.getByRole('alert')).toContainText('Jev could not make a decision');
  await expect(page.getByTestId('current-cue')).toContainText(text);
  send(sessions[0]!, 'error', { code: 'authentication', message: 'do-not-reflect-provider-body' });
  await expect(page.getByRole('alert')).toContainText('Speechmatics authentication failed');
  await expect(page.getByRole('alert')).not.toContainText('do-not-reflect');
});

test('missing gateway and denied microphone permission are explicit', async ({ page }) => {
  await setup(page);
  await page.route('**/api/voice/status', route => route.fulfill({ status: 502, body: 'Unavailable' }));
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByText('Python Voice gateway is unavailable.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start microphone', exact: true })).toBeDisabled();
  await page.route('**/api/voice/status', route => route.fulfill({ json: { configured: true, configuration } }));
  await page.getByRole('button', { name: 'Check Voice gateway again' }).click();
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); }; });
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone permission was denied');
});

test('slow optional refinement cannot block later segments, raw Cues, or stop', async ({ page }) => {
  const sessions = await setup(page);
  await page.route('**/api/openai/status', route => route.fulfill({ json: { configured: true, model: 'refinement-test', timeoutMs: 6000, maxInputChars: 16000, defaultEnabled: false } }));
  let release!: () => void;
  let refinements = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/openai/refine', async route => {
    refinements++;
    await gate;
    await route.fulfill({ json: { result: { kind: 'presentation', blocks: [{ kind: 'text', text: 'Stale refined wording.' }] } } }).catch(() => {});
  });
  await page.route('**/api/jev/inspect', route => {
    const input = route.request().postDataJSON();
    return route.fulfill({ json: semanticReply(input) });
  });
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Text refinement', exact: false }).check();
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  await expect(page.getByText('Microphone live · you can speak now')).toBeVisible();
  send(sessions[0]!, 'segments', segments(1, [text]));
  await expect(page.getByTestId('current-cue')).toContainText(text);
  await expect.poll(() => refinements).toBe(1);
  send(sessions[0]!, 'segments', segments(2, ['A new concept remains visible.']));
  await expect(page.getByTestId('cue-choice')).toHaveCount(2);
  await inspect(page, 1);
  await expect(page.getByTestId('current-cue')).toContainText('A new concept remains visible.');
  await page.getByRole('button', { name: 'Stop microphone' }).click();
  await expect.poll(() => sessions[0]!.commands).toContain('stop');
  send(sessions[0]!, 'drained');
  await expect(page.getByText('Session stopped', { exact: true })).toBeVisible();
  release();
  await expect(page.getByTestId('current-cue')).toContainText('A new concept remains visible.');
});


test('safe refinement defaults apply per new session, enforce input limit, and require credentials', async ({ page }) => {
  let refinementCalls = 0;
  await page.route('**/api/openai/refine', route => { refinementCalls++; return route.fulfill({ json: { result: { kind: 'source' } } }); });
  await page.route('**/api/jev/inspect', route => {
    const input = route.request().postDataJSON();
    return route.fulfill({ json: semanticReply(input) });
  });
  const publicConfig = { configured: true, model: 'experiment-model', timeoutMs: 6000, maxInputChars: 10, defaultEnabled: true };
  const sessions = await setup(page, publicConfig);
  const checkbox = page.getByRole('checkbox', { name: 'Text refinement', exact: false });
  await expect(checkbox).toBeChecked();
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  await expect.poll(() => sessions.length).toBe(1);
  send(sessions[0]!, 'segments', segments(1, [text]));
  await expect(page.getByTestId('current-cue')).toContainText(text);
  await expect(page.getByText('This Cue exceeds the presentation input limit. The source wording is kept.')).toBeVisible();
  expect(refinementCalls).toBe(0);
  await checkbox.uncheck();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(checkbox).toBeChecked();
  await page.route('**/api/openai/status', route => route.fulfill({ json: { ...publicConfig, configured: false } }));
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeDisabled();
  expect(refinementCalls).toBe(0);
});

const journal = (page: Page) => page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('cuelight:alive:')).map(key => sessionStorage.getItem(key)));
for (const width of [1440, 1100]) test(`teacher workbench: independent Display, pinned context, note focus and stop at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/jev/inspect', route => route.fulfill({ json: semanticReply(route.request().postDataJSON()) }));
  await page.route('**/api/openai/refine', route => {
    const source = route.request().postDataJSON().sourceText as string;
    return route.fulfill({ json: { result: { kind: 'presentation', blocks: source.startsWith('Osmosis') ? [
      { kind: 'text', text: 'Osmosis moves water.' },
      { kind: 'chain', nodes: ['Water', 'Partially permeable membrane'], links: [{ kind: 'moves_to', label: null }] },
    ] : [{ kind: 'text', text: source }] } } });
  });
  const sessions = await setup(page, { configured: true, model: 'mock-presentation', timeoutMs: 6000, maxInputChars: 16000, defaultEnabled: true }, configuration, '/');
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  await expect.poll(() => sessions.length).toBe(1);
  const session = sessions[0]!;
  send(session, 'segments', segments(1, ['Osmosis is the movement of water across a partially permeable membrane.']));
  await expect(page.getByTestId('current-cue').locator('.cue-chain')).toBeVisible();
  const oldId = await page.getByTestId('current-cue').getAttribute('data-cue-id');
  send(session, 'segments', segments(2, ['Diffusion is the net movement of particles from higher to lower concentration.']));
  await expect(page.getByTestId('current-cue')).toContainText('Diffusion');
  await expect(page.getByTestId('previous-cue').locator('.cue-chain')).toBeVisible();
  await expect(page.getByTestId('flow-view')).toBeHidden();
  await page.screenshot({ path: `artifacts/workbench-display-${width}.png` });
  await page.getByRole('button', { name: 'Just before ↗' }).click();
  await expect(page.getByTestId('cue-detail')).toHaveAttribute('data-cue-id', oldId!);
  await expect(page.getByTestId('current-cue')).toContainText('Diffusion');
  await page.screenshot({ path: `artifacts/workbench-sheet-${width}.png` });
  await flow(page);
  await expect(page.getByTestId('display-view')).toBeHidden();
  await page.screenshot({ path: `artifacts/workbench-flow-${width}.png` });
  const beforeBrowse = await journal(page);
  await page.getByLabel('Cue 版本').selectOption('1');
  await page.getByTestId('cue-detail').getByRole('button', { name: /原文/ }).first().click();
  await expect(page.locator('#live-source mark')).toContainText('Osmosis');
  await page.getByRole('button', { name: '返回当前 Display ↗' }).click();
  await expect(page.getByTestId('current-cue')).toContainText('Diffusion');
  expect(await journal(page)).toEqual(beforeBrowse);
  await notes(page);
  const draft = 'Keep my own wording.\n' + 'Compare with the source before changing this note.\n'.repeat(40);
  const editor = page.getByLabel('教师备注'); await editor.fill(draft);
  await editor.evaluate((element: HTMLTextAreaElement) => { element.setSelectionRange(8, 13); element.scrollTop = 150; });
  const body = page.getByTestId('sheet-body'); await body.evaluate(element => { element.scrollTop = 45; });
  const scroll = await body.evaluate(element => element.scrollTop);
  send(session, 'segments', segments(3, ['A concentration gradient determines the direction of net movement.']));
  await expect(page.getByTestId('current-cue')).toContainText('concentration gradient');
  await expect(editor).toHaveValue(draft); await expect(editor).toBeFocused();
  expect(await editor.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd, element.scrollTop])).toEqual([8, 13, 150]);
  expect(await body.evaluate(element => element.scrollTop)).toBe(scroll);
  await expect(page.getByTestId('note-detail')).toHaveAttribute('data-cue-id', oldId!);
  const beforeSwitch = await journal(page);
  await flow(page); await expect(editor).toHaveValue(draft);
  await page.getByRole('button', { name: '返回当前 Display ↗' }).click(); await expect(editor).toHaveValue(draft);
  expect(await journal(page)).toEqual(beforeSwitch);
  // A reference task stays pinned even while another live Cue arrives.
  await page.getByRole('navigation', { name: 'Cue 工作', exact: true }).getByRole('button', { name: 'Reference', exact: true }).click();
  await page.getByRole('button', { name: '关闭工作栏' }).focus();
  send(session, 'segments', segments(4, ['Temperature changes the rate of diffusion.']));
  await expect(page.getByTestId('current-cue')).toContainText('Temperature');
  await expect(page.getByRole('button', { name: '关闭工作栏' })).toBeFocused();
  await expect(page.getByRole('button', { name: '获取参考' })).toBeDisabled();
  await expect(page.locator('.sheet-heading')).toContainText('Cue 1');
  await notes(page); await expect(editor).toHaveValue(draft);
  if (width === 1100) await flow(page);
  await page.getByRole('button', { name: 'Stop microphone' }).click();
  await expect.poll(() => session.commands).toContain('stop'); send(session, 'drained');
  await expect(page.getByText('Session stopped', { exact: true })).toBeVisible();
  await expect(page.getByTestId(width === 1100 ? 'flow-view' : 'display-view')).toBeVisible();
  await expect(editor).toHaveValue(draft);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});


test('closed sheets cannot capture Display tools; Flow keeps its own explicit target', async ({ page }) => {
  await page.route('**/api/jev/inspect', route => route.fulfill({ json: semanticReply(route.request().postDataJSON()) }));
  const sessions = await setup(page, undefined, configuration, '/');
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  await expect.poll(() => sessions.length).toBe(1);
  send(sessions[0]!, 'segments', segments(1, ['Old Cue A.']));
  await expect(page.getByTestId('current-cue')).toContainText('Old Cue A.');
  const oldId = (await page.getByTestId('current-cue').getAttribute('data-cue-id'))!;
  const tools = page.locator('.workbench-tools');
  const close = page.getByRole('button', { name: '关闭工作栏' });
  await tools.getByRole('button', { name: 'Note', exact: true }).click();
  await page.getByLabel('教师备注').fill('Note belonging to A');
  await close.click();
  send(sessions[0]!, 'segments', segments(2, ['New Cue B.']));
  await expect(page.getByTestId('current-cue')).toContainText('New Cue B.');
  const newId = (await page.getByTestId('current-cue').getAttribute('data-cue-id'))!;
  expect(newId).not.toBe(oldId);
  const beforeBrowse = await journal(page);
  await tools.getByRole('button', { name: 'Note', exact: true }).click();
  await expect(page.getByTestId('note-detail')).toHaveAttribute('data-cue-id', newId);
  await expect(page.getByLabel('教师备注')).toHaveValue('');
  await page.getByLabel('教师备注').fill('Note belonging to B');
  await close.click();
  await tools.getByRole('button', { name: 'Reference', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Reference', exact: true })).toHaveAttribute('data-cue-id', newId);
  await close.click();
  await tools.getByRole('button', { name: 'Evidence', exact: true }).click();
  await expect(page.locator('#live-source mark')).toHaveText('New Cue B.');
  await expect(page.locator('.sheet-heading')).toContainText('Cue 2 · v1');
  await close.click();
  await inspect(page);
  await notes(page); await expect(page.getByLabel('教师备注')).toHaveValue('Note belonging to A');
  await close.click();
  await expect(page.getByTestId('cue-choice').first()).toHaveAttribute('aria-pressed', 'true');
  await tools.getByRole('button', { name: 'Note', exact: true }).click();
  await expect(page.getByTestId('note-detail')).toHaveAttribute('data-cue-id', oldId);
  await close.click();
  await page.getByRole('button', { name: '返回当前 Display ↗' }).click();
  await tools.getByRole('button', { name: 'Note', exact: true }).click();
  await expect(page.getByTestId('note-detail')).toHaveAttribute('data-cue-id', newId);
  await expect(page.getByLabel('教师备注')).toHaveValue('Note belonging to B');
  expect(await journal(page)).toEqual(beforeBrowse);
});

test('same-Cue updates leave sheet and Flow revisions pinned; closed Display uses the live revision', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/jev/inspect', route => route.fulfill({ json: semanticReply(route.request().postDataJSON(), ++calls === 1 ? 'CREATE' : 'REVISE') }));
  const sessions = await setup(page, undefined, configuration, '/');
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  await expect.poll(() => sessions.length).toBe(1);
  send(sessions[0]!, 'segments', segments(1, ['A is X.']));
  await expect(page.getByTestId('current-cue')).toContainText('A is X.');
  await inspect(page);
  send(sessions[0]!, 'segments', segments(2, ['Only when Y.']));
  await expect(page.getByTestId('cue-choice').first()).toContainText('版本 2 · 已选 v1');
  await expect(page.getByLabel('Cue 版本')).toHaveValue('1');
  await expect(page.getByTestId('cue-detail')).not.toContainText('Only when Y.');
  const beforeBrowse = await journal(page);
  await page.getByRole('button', { name: '关闭工作栏' }).click();
  await page.locator('.workbench-tools').getByRole('button', { name: 'Reference', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Reference', exact: true })).toHaveAttribute('data-revision', '1');
  const tabs = page.getByRole('navigation', { name: 'Cue 工作', exact: true });
  for (const name of ['Note', 'Reference', 'Evidence', 'Cue']) {
    const tab = tabs.getByRole('button', { name, exact: true });
    await tab.focus(); await page.keyboard.press('Enter');
    await expect(tab).toBeFocused();
  }
  await page.getByRole('button', { name: '关闭工作栏' }).click();
  await page.getByRole('button', { name: '返回当前 Display ↗' }).click();
  await page.locator('.workbench-tools').getByRole('button', { name: 'Reference', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Reference', exact: true })).toHaveAttribute('data-revision', '2');
  expect(await journal(page)).toEqual(beforeBrowse);
});
