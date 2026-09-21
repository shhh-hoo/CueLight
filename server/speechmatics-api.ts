import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

type Options = { apiKey?: string; transport?: typeof fetch };
const TOKEN_ENDPOINT = 'https://mp.speechmatics.com/v1/api_keys?type=rt';

function reply(response: ServerResponse, status: number, body: unknown) {
  if (response.writableEnded || response.destroyed) return;
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

export function createSpeechmaticsMiddleware(options: Options) {
  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const path = request.url?.split('?')[0];
    if (path !== '/api/speechmatics/status' && path !== '/api/speechmatics/token') { next(); return; }
    const host = request.headers.host ?? '';
    const origin = request.headers.origin;
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) ||
        (origin !== undefined && origin !== `http://${host}`) ||
        (request.headers['sec-fetch-site'] !== undefined && request.headers['sec-fetch-site'] !== 'same-origin')) {
      reply(response, 403, { error: 'Only same-origin local requests are accepted.' }); return;
    }
    if (path === '/api/speechmatics/status' && request.method === 'GET') {
      reply(response, 200, { configured: !!options.apiKey?.trim() }); return;
    }
    if (path !== '/api/speechmatics/token' || request.method !== 'POST') {
      reply(response, 405, { error: 'Method not allowed.' }); return;
    }
    // Unlike the read-only status endpoint, minting requires an explicit Origin.
    if (origin !== `http://${host}`) { reply(response, 403, { error: 'A matching local Origin is required.' }); return; }
    if (request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') {
      reply(response, 415, { error: 'Expected application/json.' }); return;
    }
    if (!options.apiKey?.trim()) {
      reply(response, 503, { error: 'Speechmatics is not configured on the local server.' }); return;
    }
    const controller = new AbortController();
    const cancel = () => controller.abort();
    response.once('close', cancel);
    const timer = setTimeout(() => {
      if (!response.writableEnded) reply(response, 504, { error: 'Speechmatics authentication timed out.' });
      controller.abort();
    }, 5_000);
    void (async () => {
      try {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          if (controller.signal.aborted) return;
          size += chunk.length;
          if (size > 1024) { reply(response, 413, { error: 'Request body is too large.' }); return; }
          chunks.push(Buffer.from(chunk));
        }
        if (controller.signal.aborted) return;
        let body: unknown;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { reply(response, 400, { error: 'Expected an empty JSON object.' }); return; }
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) {
          reply(response, 400, { error: 'Expected an empty JSON object.' }); return;
        }
        if (controller.signal.aborted) return;
        const upstream = await (options.transport ?? fetch)(TOKEN_ENDPOINT, {
          method: 'POST', signal: controller.signal,
          headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ttl: 60 }),
        });
        if (!upstream.ok) throw new Error('Upstream rejected credentials');
        const data: unknown = await upstream.json();
        if (!data || typeof data !== 'object' || !('key_value' in data) || typeof data.key_value !== 'string' || !data.key_value) {
          throw new Error('Invalid token response');
        }
        if (!controller.signal.aborted) reply(response, 200, { jwt: data.key_value });
      } catch {
        if (!controller.signal.aborted && !response.writableEnded) reply(response, 502, { error: 'Speechmatics authentication failed.' });
      } finally { clearTimeout(timer); response.removeListener('close', cancel); }
    })();
  };
}

export function speechmaticsApiPlugin(options: Options): Plugin {
  const middleware = createSpeechmaticsMiddleware(options);
  return {
    name: 'cuelight-local-speechmatics',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
