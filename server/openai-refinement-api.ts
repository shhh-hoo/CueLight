import { parseRuntimeConfig } from './runtime-config.ts';
import type { RefinementConfiguration } from '../src/runtime-config.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { type RefinementInput } from '../src/refinement/types.ts';
import { IncompleteSource, validatePresentationInput, buildPresentationRequest, parsePresentationResponse } from '../prompts/presentation-v1/request.ts';

const MAX_BODY_BYTES = 256_000;

function reply(response: ServerResponse, status: number, body: unknown) {
  if (response.writableEnded || response.destroyed || response.headersSent) return;
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

export function openaiRefinementApiPlugin(options: { apiKey?: string; config?: RefinementConfiguration }): Plugin {
  const config = options.config ?? parseRuntimeConfig({}).refinement;
  const send = (response: ServerResponse, status: number, body: object) => reply(response, status, { ...body, configuration: config });
  const middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const path = request.url?.split('?')[0];
    if (path !== '/api/openai/status' && path !== '/api/openai/refine') { next(); return; }
    const host = request.headers.host ?? '';
    const origin = `http://${host}`;
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) ||
        (request.headers.origin && request.headers.origin !== origin) ||
        (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin')) {
      send(response, 403, { error: 'unavailable' }); return;
    }
    if (path === '/api/openai/status' && request.method === 'GET') {
      reply(response, 200, { configured: !!options.apiKey?.trim(), ...config }); return;
    }
    if (path !== '/api/openai/refine' || request.method !== 'POST') { send(response, 405, { error: 'invalid' }); return; }
    if (request.headers.origin !== origin) { send(response, 403, { error: 'unavailable' }); return; }
    if (request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') {
      send(response, 415, { error: 'invalid' }); return;
    }
    if (!options.apiKey?.trim()) { send(response, 503, { error: 'unavailable' }); return; }
    const controller = new AbortController();
    const cancel = () => { if (!response.writableEnded) controller.abort(); };
    response.once('close', cancel);
    const timer = setTimeout(() => {
      controller.abort();
      send(response, 504, { error: 'timeout' });
    }, config.timeoutMs);
    void (async () => {
      try {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          if (controller.signal.aborted) return;
          size += chunk.length;
          if (size > MAX_BODY_BYTES) { send(response, 413, { error: 'invalid' }); return; }
          chunks.push(Buffer.from(chunk));
        }
        if (controller.signal.aborted) return;
        let input: RefinementInput;
        try { input = validatePresentationInput(JSON.parse(Buffer.concat(chunks).toString('utf8')), config.maxInputChars); }
        catch (error) { send(response, 400, { error: error instanceof IncompleteSource ? 'incomplete-source' : 'invalid' }); return; }
        const upstream = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST', headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(buildPresentationRequest(input, config)),
        });
        if (!upstream.ok) { await upstream.body?.cancel(); send(response, 502, { error: 'unavailable' }); return; }
        const result = parsePresentationResponse(await upstream.json());
        if (!controller.signal.aborted) send(response, 'error' in result ? 502 : 200, result);
      } catch {
        if (!controller.signal.aborted) send(response, 502, { error: 'unavailable' });
      } finally {
        clearTimeout(timer);
        response.removeListener('close', cancel);
      }
    })();
  };
  return { name: 'cuelight-openai-refinement',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); } };
}
