// Small local loader for the existing extensionless production imports. No network,
// environment-file loading, Promptfoo initialization or model clients.
import { registerHooks } from 'node:module';
import { transformSync } from 'esbuild';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const url = new URL(specifier, context.parentURL);
      if (!/\.[cm]?[jt]sx?$/.test(url.pathname) && existsSync(fileURLToPath(url) + '.ts')) return next(url.href + '.ts', context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('file:') && url.endsWith('.ts') && !url.includes('/node_modules/')) {
      return { format: 'module', shortCircuit: true, source: transformSync(readFileSync(new URL(url), 'utf8'), { loader: 'ts', target: 'es2023', format: 'esm' }).code };
    }
    return next(url, context);
  },
});
