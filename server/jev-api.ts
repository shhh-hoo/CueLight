import { parseRuntimeConfig } from './runtime-config.ts';
import type { JevConfiguration } from '../src/runtime-config.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { JevDecisionProvider } from '../src/decision/jev-decision-provider.ts';
import { validateInput } from './validate-input.ts';
import type { JevChoiceDiagnostics } from '../src/decision/jev-choice.ts';

export const MAX_REQUEST_BYTES = 2_000_000;
type Options = { apiKey?: string; model?: string; config?: JevConfiguration; transport?: typeof fetch };

function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

// Local, same-origin endpoint. No separate server process, sessions, or storage.
export function createJevMiddleware(options: Options) {
  const config = options.config ?? parseRuntimeConfig({ JEV_MODEL: options.model }).jev;
  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const path = request.url?.split('?')[0];
    if (path !== '/api/jev/status' && path !== '/api/jev/decide') { next(); return; }
    const host = request.headers.host ?? '';
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) ||
        (request.headers.origin && request.headers.origin !== `http://${host}`)) {
      reply(response, 403, { error: 'Only same-origin local requests are accepted.' });
      return;
    }
    if (path === '/api/jev/status' && request.method === 'GET') {
      reply(response, 200, { configured: !!options.apiKey?.trim(), ...config });
      return;
    }
    if (path !== '/api/jev/decide' || request.method !== 'POST') {
      reply(response, 405, { error: 'Method not allowed.' });
      return;
    }
    if (!options.apiKey?.trim()) {
      reply(response, 503, { error: 'Jev is not configured. Set TYPESAFE_API_KEY on the local server.' });
      return;
    }
    if (request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') {
      reply(response, 415, { error: 'Expected application/json.' });
      return;
    }

    const controller = new AbortController();
    const cancel = () => { if (!response.writableEnded) controller.abort(); };
    response.once('close', cancel);
    void (async () => {
      try {
        const chunks: Buffer[] = [];
        let bytes = 0;
        // Do not read an unbounded body or forward unvalidated content to a paid API.
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes > MAX_REQUEST_BYTES) {
            reply(response, 413, { error: 'Decision input is too large.' });
            return;
          }
          chunks.push(Buffer.from(chunk));
        }
        let input;
        try { input = validateInput(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reply(response, 400, { error: 'Invalid decision input or ungrounded candidates.' }); return; }
        if (controller.signal.aborted) return;
        let failure: string | null = null;
        let diagnostics: JevChoiceDiagnostics | null = null;
        const provider = new JevDecisionProvider({
          apiKey: options.apiKey!, model: config.model, timeoutMs: config.timeoutMs, transport: options.transport, signal: controller.signal,
          onChoice(value) { diagnostics = value; },
          onError(message) {
            // Do not reflect arbitrary transport exceptions or upstream payloads.
            failure = /^Jev HTTP \d{3}\.$/.test(message) || message === 'Jev request timed out.'
              ? message : 'Jev returned no usable decision.';
          },
        });
        const decision = await provider.decide(input);
        if (!controller.signal.aborted) reply(response, failure ? 502 : 200, failure ? { error: failure, configuration: config } : { decision, diagnostics, configuration: config });
      } catch {
        if (!response.headersSent && !controller.signal.aborted) reply(response, 400, { error: 'Unable to read decision input.' });
      } finally {
        response.removeListener('close', cancel);
      }
    })();
  };
}

export function jevApiPlugin(options: Options): Plugin {
  const middleware = createJevMiddleware(options);
  return {
    name: 'cuelight-local-jev',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
