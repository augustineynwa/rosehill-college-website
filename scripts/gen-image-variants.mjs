/**
 * gen-image-variants.mjs — responsive images for performance.
 *
 * Walks every content/pages JSON, finds image objects ({src, srcset, alt}),
 * and for any source file larger than THRESHOLD that lacks a responsive
 * srcset, generates resized AVIF variants and writes a real srcset back into
 * the content. Idempotent: variants already present are reused, and images
 * that already carry a srcset are left untouched.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PAGES = join(ROOT, 'content', 'pages');
const IMG_DIR = join(ROOT, 'public', 'assets', 'img');

const THRESHOLD = 120 * 1024;         // only touch images bigger than this
const WIDTHS = [500, 800, 1080, 1600];

function walkFiles(dir, ext) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full, ext));
    else if (e.endsWith(ext)) out.push(full);
  }
  return out;
}

const generated = new Map(); // src → srcset string (cache across pages)

async function ensureVariants(src) {
  if (generated.has(src)) return generated.get(src);
  // src like "assets/img/Foo.avif"
  const rel = src.replace(/^\/?assets\/img\//, '');
  const abs = join(IMG_DIR, rel);
  if (!existsSync(abs)) return '';
  if (statSync(abs).size < THRESHOLD) { generated.set(src, ''); return ''; }
  if (extname(abs).toLowerCase() !== '.avif') { generated.set(src, ''); return ''; }

  const meta = await sharp(abs, { limitInputPixels: false }).metadata();
  const baseName = basename(rel, '.avif');
  const parts = [];
  for (const w of WIDTHS) {
    if (meta.width && w >= meta.width) continue;
    const outRel = `${baseName}-rp-${w}.avif`;
    const outAbs = join(IMG_DIR, outRel);
    if (!existsSync(outAbs)) {
      await sharp(abs, { limitInputPixels: false })
        .resize({ width: w })
        .avif({ quality: 55, effort: 4 })
        .toFile(outAbs);
    }
    parts.push(`/assets/img/${outRel} ${w}w`);
  }
  if (meta.width) parts.push(`/assets/img/${rel} ${meta.width}w`);
  const srcset = parts.join(', ');
  generated.set(src, srcset);
  return srcset;
}

async function processNode(node) {
  if (Array.isArray(node)) {
    for (const n of node) await processNode(n);
    return;
  }
  if (node && typeof node === 'object') {
    // an image object: has a string src pointing at assets/img and a srcset field
    if (typeof node.src === 'string' && node.src.includes('assets/img/') && 'srcset' in node) {
      if (!node.srcset) {
        const ss = await ensureVariants(node.src);
        if (ss) node.srcset = ss;
      }
    }
    for (const key of Object.keys(node)) await processNode(node[key]);
  }
}

let changed = 0;
let madeVariants = 0;
const before = generated.size;
for (const f of walkFiles(PAGES, '.json')) {
  const data = JSON.parse(readFileSync(f, 'utf8'));
  const snapshot = JSON.stringify(data);
  await processNode(data);
  const after = JSON.stringify(data);
  if (after !== snapshot) {
    writeFileSync(f, JSON.stringify(data, null, 2) + '\n', 'utf8');
    changed++;
  }
}
for (const ss of generated.values()) if (ss) madeVariants++;
console.log(`Image variants: updated ${changed} page files, ${madeVariants} images now have responsive srcsets.`);
