// Reuse Vite's TypeScript loader; no second engine or runtime dependency.
import { createServer } from 'vite';
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { main } = await server.ssrLoadModule('/scripts/replay.ts');
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith('Replay requires --input ')
    ? error.message
    : 'Replay failed. Check arguments/configuration and the partial trace; no credentials or upstream bodies are logged.');
  process.exitCode = 1;
} finally {
  await server.close();
}
