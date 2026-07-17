import { defineConfig } from 'vite';
import { resolve, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync, existsSync } from 'node:fs';
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

/**
 * Resolve extensionless URLs to their .html file, mirroring how Cloudflare
 * Pages serves the site. Links are emitted without `.html` (to avoid a 301 on
 * every internal navigation), so dev/preview must resolve them the same way or
 * they'd 404 locally while working in production.
 */
function cleanUrlMiddleware(rootDir) {
  return (req, _res, next) => {
    const [path, query] = req.url.split('?');
    if (path === '/admin' || path === '/admin/') {
      req.url = '/admin/index.html';
      return next();
    }
    if (path !== '/' && !basename(path).includes('.')) {
      const candidate = path.replace(/\/$/, '') + '.html';
      if (existsSync(resolve(rootDir, '.' + candidate))) {
        req.url = candidate + (query ? '?' + query : '');
      }
    }
    next();
  };
}

// re-render pages when content or templates change during dev
function renderPlugin() {
  return {
    name: 'rhc-render',
    configurePreviewServer(server) {
      server.middlewares.use(cleanUrlMiddleware(resolve(__dirname, 'dist')));
    },
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
      server.middlewares.use(cleanUrlMiddleware(__dirname));

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
