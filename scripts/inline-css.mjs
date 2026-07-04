/**
 * inline-css.mjs — post-build: inline the extracted CSS into every page head
 * and drop the render-blocking <link>. On throttled mobile this removes a
 * full round-trip before first paint. The bundle is small (~7KB gzipped) and
 * the HTML itself is gzipped by the server, so the transfer cost is minor.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

function walk(dir, ext) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walk(full, ext));
    else if (e.endsWith(ext)) out.push(full);
  }
  return out;
}

let inlined = 0;
for (const page of walk(DIST, '.html')) {
  let html = readFileSync(page, 'utf8');
  // find the stylesheet link Vite injected
  const linkMatch = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"[^>]*>/);
  if (!linkMatch) continue;
  const cssHref = linkMatch[1].replace(/^\//, '');
  const cssPath = join(DIST, cssHref);
  try {
    const css = readFileSync(cssPath, 'utf8');
    html = html.replace(linkMatch[0], `<style>${css}</style>`);
    writeFileSync(page, html, 'utf8');
    inlined++;
  } catch {
    // leave the link if the file can't be read
  }
}
console.log(`Inlined CSS into ${inlined} pages.`);
