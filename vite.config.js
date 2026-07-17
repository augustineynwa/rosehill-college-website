import { defineConfig } from 'vite';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// every rendered .html page is a rollup input
function htmlInputs(dir, base = dir) {
  const inputs = {};
  const skip = new Set(['node_modules', 'templates', 'content', 'scripts', 'extracted', 'public', 'src', 'dist', '.git']);
  for (const e of readdirSync(dir)) {
    const full = resolve(dir, e);
    if (statSync(full).isDirectory()) {
      if (!skip.has(e)) Object.assign(inputs, htmlInputs(full, base));
    } else if (e.endsWith('.html')) {
      const rel = relative(base, full).replaceAll('\\', '/');
      inputs[rel.replace(/\.html$/, '').replaceAll('/', '__')] = full;
    }
  }
  return inputs;
}

// re-render pages when content or templates change during dev
function renderPlugin() {
  return {
    name: 'rhc-render',
    configureServer(server) {
      const rerender = (file) => {
        if (file.includes('templates') || file.includes('content')) {
          try {
            execSync('node scripts/render.mjs', { cwd: __dirname, stdio: 'inherit' });
            server.ws.send({ type: 'full-reload' });
          } catch (e) {
            console.error(e.message);
          }
        }
      };
      // /admin → /admin/index.html (production hosts do this directory-index
      // resolution themselves; Vite's public dir does not)
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/admin' || req.url === '/admin/') req.url = '/admin/index.html';
        next();
      });

      server.watcher.add([resolve(__dirname, 'templates'), resolve(__dirname, 'content')]);
      server.watcher.on('change', rerender);
      server.watcher.on('add', rerender);
    },
  };
}

export default defineConfig({
  root: __dirname,
  publicDir: 'public',
  appType: 'mpa',
  plugins: [renderPlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: { input: htmlInputs(__dirname) },
    assetsInlineLimit: 2048,
  },
});
