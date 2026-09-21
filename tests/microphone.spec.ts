import { test, expect, type Page, type WebSocketRoute } from '@playwright/test';

const configuration = { preset: 'captions', language: 'cmn_en', operatingPoint: 'enhanced',
  audioEncoding: 'pcm_f32le', channels: 1, voiceVersion: '0.2.8', rtVersion: '1.1.1', sampleRate: 16000 };
const text = 'Electronegativity is the ability of an atom to attract a bonding pair of electrons.';
async function setup(page: Page) {
  const sessions: { ws: WebSocketRoute; id: string; commands: string[]; audio: number }[] = [];
  await page.route('**/api/jev/status', route => route.fulfill({ json: { configured: true, model: 'jev-test' } }));
  await page.route('**/api/voice/status', route => route.fulfill({ json: { configured: true, configuration } }));
  await page.route('**/api/openai/status', route => route.fulfill({ json: { configured: false } }));
  await page.routeWebSocket('**/api/voice/session', ws => {
    ws.onMessage(data => {
      if (typeof data !== 'string') { sessions.at(-1)!.audio++; return; }
      const event = JSON.parse(data);
      if (event.type === 'start') {
        expect(event.sampleRate).toBe(16000);
        expect(event.encoding).toBe('pcm_f32le');
        sessions.push({ ws, id: event.sessionId, commands: ['start'], audio: 0 });
        ws.send(JSON.stringify({ type: 'started', sessionId: event.sessionId, configuration }));
      } else {
        const session = sessions.find(session => session.id === event.sessionId)!;
        session.commands.push(event.type);
        if (event.type === 'finish') ws.send(JSON.stringify({ type: 'stopped', sessionId: event.sessionId }));
      }
    });
  });
  await page.goto('/');
  await page.getByLabel('Input source').selectOption('microphone');
  await expect(page.getByRole('button', { name: 'Start microphone', exact: true })).toBeEnabled();
  return sessions;
}
function send(session: { ws: WebSocketRoute; id: string }, type: string, fields = {}) {
  session.ws.send(JSON.stringify({ type, sessionId: session.id, ...fields }));
}
function segments(cycle: number, texts: string[]) {
  return { cycle, segments: texts.map((text, index) => ({ text, sequence: cycle * 10 + index,
    startSeconds: cycle * 3 + index, endSeconds: cycle * 3 + index + .8, speakerId: 'S1', language: 'en' })) };
}

test('real recorder → batch evidence → one Jev cycle; stop waits for trailing Cue before finish', async ({ page }) => {
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/jev/decide', async route => {
    calls++;
    const input = route.request().postDataJSON();
    if (calls === 2) await pending;
    await route.fulfill({ json: { decision: { action: 'NEW_CUE', candidateId: input.candidates[0].id } } });
  });
  const sessions = await setup(page);
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  await expect(page.getByText('Microphone live · you can speak now')).toBeVisible();
  const session = sessions[0]!;
  await expect.poll(() => session.audio).toBeGreaterThan(0); // actual PCMRecorder / AudioWorklet
  send(session, 'AddPartialSegment', segments(1, ['Never displayed']));
  send(session, 'AddTranscript', segments(1, ['word']));
  send(session, 'segments', segments(1, ['Okay, moving on.', text]));
  await expect(page.getByTestId('current-cue')).toContainText(text);
  expect(calls).toBe(1);
  await expect(page.getByRole('region', { name: 'Learner surface' })).not.toContainText('Never displayed');
  await page.getByRole('button', { name: 'Stop microphone' }).click();
  await expect.poll(() => session.commands).toContain('stop');
  send(session, 'segments', segments(2, ['The last sentence is retained.']));
  send(session, 'drained');
  await expect.poll(() => calls).toBe(2);
  expect(session.commands).not.toContain('finish');
  await expect(page.getByRole('button', { name: 'Finishing session…' })).toBeVisible();
  release();
  await expect(page.getByText('Session stopped', { exact: true })).toBeVisible();
  expect(session.commands).toEqual(['start', 'stop', 'finish']);
  await expect(page.getByTestId('current-cue')).toContainText('The last sentence is retained.');
  await page.getByRole('button', { name: 'Show diagnostics' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export session diagnostics' }).click();
  const download = await downloadPromise;
  const stream = (await download.createReadStream())!;
  let json = ''; for await (const chunk of stream) json += chunk;
  const trace = JSON.parse(json);
  expect(trace.fragments).toHaveLength(3);
  expect(trace.events.filter((e: { type: string }) => e.type === 'jev-request')).toHaveLength(2);
  expect(trace.segmentDecisions.map((s: { triggeredRequestIds: number[] }) => s.triggeredRequestIds.length)).toEqual([1, 1, 1]);
});

test('reset cancels old Jev; a second session rejects old events; gateway loss is visible', async ({ page }) => {
  let release!: () => void;
  let calls = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/jev/decide', async route => {
    calls++;
    const input = route.request().postDataJSON();
    if (calls === 1) await gate;
    await route.fulfill({ json: { decision: { action: 'NEW_CUE', candidateId: input.candidates[0].id } } }).catch(() => {});
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
  await page.route('**/api/jev/decide', route => {
    const input = route.request().postDataJSON();
    return ++calls === 1 ? route.fulfill({ json: { decision: { action: 'NEW_CUE', candidateId: input.candidates[0].id } } })
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
  await page.route('**/api/openai/status', route => route.fulfill({ json: { configured: true } }));
  let release!: () => void;
  let refinements = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/openai/refine', async route => {
    refinements++;
    await gate;
    await route.fulfill({ json: { displayText: 'Stale refined wording.' } }).catch(() => {});
  });
  await page.route('**/api/jev/decide', route => {
    const input = route.request().postDataJSON();
    return route.fulfill({ json: { decision: { action: 'NEW_CUE', candidateId: input.candidates[0].id } } });
  });
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Text refinement', exact: false }).check();
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  await expect(page.getByText('Microphone live · you can speak now')).toBeVisible();
  send(sessions[0]!, 'segments', segments(1, [text]));
  await expect(page.getByTestId('current-cue')).toContainText(text);
  await expect.poll(() => refinements).toBe(1);
  send(sessions[0]!, 'segments', segments(2, ['A new concept remains visible.']));
  await expect(page.getByTestId('current-cue')).toContainText('A new concept remains visible.');
  await page.getByRole('button', { name: 'Stop microphone' }).click();
  await expect.poll(() => sessions[0]!.commands).toContain('stop');
  send(sessions[0]!, 'drained');
  await expect(page.getByText('Session stopped', { exact: true })).toBeVisible();
  release();
  await expect(page.getByTestId('current-cue')).toContainText('A new concept remains visible.');
});
