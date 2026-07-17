/**
 * check.mjs — validate every rendered page:
 *  - every <img src> and srcset candidate exists in public/
 *  - every internal <a href> resolves to a rendered page or public asset
 *  - every image has an alt attribute
 * Exit 1 with a report if anything is broken.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');

function walk(dir, ext, skip = new Set(['node_modules', 'templates', 'content', 'scripts', 'extracted', 'public', 'src', 'dist', '.git', '.claude'])) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) {
      if (!skip.has(e)) out.push(...walk(full, ext, skip));
    } else if (e.endsWith(ext)) out.push(full);
  }
  return out;
}

const pages = walk(ROOT, '.html');
const pagePaths = new Set(pages.map((p) => '/' + p.slice(ROOT.length + 1).replaceAll('\\', '/')));
const problems = [];

for (const page of pages) {
  const rel = '/' + page.slice(ROOT.length + 1).replaceAll('\\', '/');
  const html = readFileSync(page, 'utf8');

  // images
  for (const m of html.matchAll(/<img([^>]*)>/g)) {
    const attrs = m[1];
    const src = attrs.match(/\ssrc="([^"]+)"/)?.[1];
    if (src && src.startsWith('/') && !src.startsWith('/src/') && !existsSync(join(PUBLIC, decodeURIComponent(src)))) {
      problems.push(`${rel}: missing image ${src}`);
    }
    if (!/\salt=/.test(attrs)) problems.push(`${rel}: img without alt (${src})`);
    const srcset = attrs.match(/\ssrcset="([^"]+)"/)?.[1];
    if (srcset) {
      for (const cand of srcset.split(',')) {
        const url = cand.trim().split(/\s+/)[0];
        if (url.startsWith('/') && !existsSync(join(PUBLIC, decodeURIComponent(url)))) {
          problems.push(`${rel}: missing srcset candidate ${url}`);
        }
      }
    }
  }

  // internal links
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    const href = m[1];
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const clean = decodeURIComponent(href.split('#')[0].split('?')[0]);
    if (!clean) continue;
    if (clean.startsWith('/assets/')) {
      if (!existsSync(join(PUBLIC, clean))) problems.push(`${rel}: broken asset link ${href}`);
    } else if (clean === '/') {
      // homepage — served from index.html
      if (!pagePaths.has('/index.html')) problems.push(`${rel}: no index.html for /`);
    } else {
      // links are emitted extensionless (see cleanUrls in render.mjs); the
      // host serves them from the matching .html file
      const target = clean.endsWith('.html') ? clean : clean + '.html';
      if (!pagePaths.has(target)) problems.push(`${rel}: broken page link ${href} (expects ${target})`);
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problem(s) across ${pages.length} pages.`);
  process.exit(1);
}
console.log(`All good: ${pages.length} pages checked, images + links resolve.`);
