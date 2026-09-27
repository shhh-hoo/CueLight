import { expect, type Page, type WebSocketRoute } from '@playwright/test';

export const configuration = { preset: 'captions', language: 'cmn_en', operatingPoint: 'enhanced',
  audioEncoding: 'pcm_f32le', channels: 1, voiceVersion: '0.2.8', rtVersion: '1.1.1', sampleRate: 16000 };
export async function setup(page: Page, refinementConfig = { configured: false, model: 'refinement-test', timeoutMs: 6000, maxInputChars: 16000, defaultEnabled: false }, voiceConfig = configuration, path = '/dev') {
  const sessions: { ws: WebSocketRoute; id: string; commands: string[]; audio: number }[] = [];
  await page.route('**/api/jev/status', route => route.fulfill({ json: { configured: true, model: 'jev-test' } }));
  await page.route('**/api/voice/status', route => route.fulfill({ json: { configured: true, configuration } }));
  await page.route('**/api/openai/status', route => route.fulfill({ json: refinementConfig }));
  await page.routeWebSocket('**/api/voice/session', ws => {
    ws.onMessage(data => {
      if (typeof data !== 'string') { sessions.at(-1)!.audio++; return; }
      const event = JSON.parse(data);
      if (event.type === 'start') {
        expect(event.sampleRate).toBe(16000);
        expect(event.encoding).toBe('pcm_f32le');
        sessions.push({ ws, id: event.sessionId, commands: ['start'], audio: 0 });
        ws.send(JSON.stringify({ type: 'started', sessionId: event.sessionId, configuration: voiceConfig }));
      } else {
        const session = sessions.find(session => session.id === event.sessionId)!;
        session.commands.push(event.type);
        if (event.type === 'finish') ws.send(JSON.stringify({ type: 'stopped', sessionId: event.sessionId }));
      }
    });
  });
  await page.goto(path);
  if (path === '/dev') await page.getByLabel('Input source').selectOption('microphone');
  await expect(page.getByRole('button', { name: 'Start microphone', exact: true })).toBeEnabled();
  return sessions;
}
export function send(session: { ws: WebSocketRoute; id: string }, type: string, fields = {}) {
  session.ws.send(JSON.stringify({ type, sessionId: session.id, ...fields }));
}
export function segments(cycle: number, texts: string[]) {
  return { cycle, segments: texts.map((text, index) => ({ text, sequence: cycle * 10 + index,
    startSeconds: cycle * 3 + index, endSeconds: cycle * 3 + index + .8, speakerId: 'S1', language: 'en' })) };
}
