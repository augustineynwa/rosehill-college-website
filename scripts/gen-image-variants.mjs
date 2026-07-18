/**
 * gen-image-variants.mjs — responsive images for performance.
 *
 * Walks every content/pages JSON, finds image objects ({src, srcset, alt}),
 * and for any source WIDER than MIN_WIDTH that lacks a responsive srcset,
 * generates resized variants and writes a real srcset back into the content.
 * Idempotent: variants already present are reused, and images that already
 * carry a srcset are left untouched.
 *
 * Gating is on PIXEL WIDTH, not file size. A well-compressed 2650px AVIF can be
 * under 100KB yet still costs a multi-megabyte decode and a large memory buffer
 * on a budget phone — decode, not transfer, is the binding constraint there.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PAGES = join(ROOT, 'content', 'pages');
const IMG_DIR = join(ROOT, 'public', 'assets', 'img');

const MIN_WIDTH = 1200;   // narrower than this already fits any layout slot
// tops out at 3000 so a 1500px CSS box on a 2x display still has an exact-ish
// candidate; without the upper rungs the browser falls back to the original,
// which for some sources is 6000px / 1.2MB to fill a 460px box
const WIDTHS = [500, 800, 1080, 1600, 2200, 3000];
// don't offer the untouched original as a candidate once it's far larger than
// our biggest variant — that's the fall-through that caused the 6000px picks
const ORIGINAL_MAX_RATIO = 1.3;
// Variants are written in the SAME format as the source. CMS uploads arrive as
// jpg/png/webp; emitting avif candidates alongside a jpg `src` would break any
// browser without avif support, since srcset does no format negotiation.
const FORMATS = {
  '.avif': (p) => p.avif({ quality: 55, effort: 4 }),
  '.jpg': (p) => p.jpeg({ quality: 78, mozjpeg: true }),
  '.jpeg': (p) => p.jpeg({ quality: 78, mozjpeg: true }),
  '.png': (p) => p.png({ compressionLevel: 9 }),
  '.webp': (p) => p.webp({ quality: 78 }),
};

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
  // src like "assets/img/Foo.avif" (leading slash tolerated — CMS may add one)
  const rel = src.replace(/^\/?assets\/img\//, '');
  const abs = join(IMG_DIR, rel);
  if (!existsSync(abs)) { generated.set(src, ''); return ''; }

  const ext = extname(abs).toLowerCase();
  const encode = FORMATS[ext];
  if (!encode) { generated.set(src, ''); return ''; }   // svg, gif etc. — leave alone

  const meta = await sharp(abs, { limitInputPixels: false }).metadata();
  if (!meta.width || meta.width <= MIN_WIDTH) { generated.set(src, ''); return ''; }

  const baseName = basename(rel, extname(rel));
  const parts = [];
  let largest = 0;
  for (const w of WIDTHS) {
    if (w >= meta.width) continue;
    const outRel = `${baseName}-rp-${w}${ext}`;
    const outAbs = join(IMG_DIR, outRel);
    if (!existsSync(outAbs)) {
      await encode(sharp(abs, { limitInputPixels: false }).resize({ width: w })).toFile(outAbs);
    }
    parts.push(`/assets/img/${outRel} ${w}w`);
    largest = w;
  }
  // keep the original only when it's a sensible top rung, not a 4x outlier
  if (largest === 0 || meta.width <= largest * ORIGINAL_MAX_RATIO) {
    parts.push(`/assets/img/${rel} ${meta.width}w`);
  }
  const srcset = parts.join(', ');
  generated.set(src, srcset);
  return srcset;
}

/**
 * Intrinsic aspect ratio, as a CSS `w / h` string. Only needed by `fit:natural`
 * images: those drop the frame's fixed ratio, so without a ratio of their own
 * the box has no height until the image loads. That isn't merely a layout
 * shift — a zero-height box never intersects the viewport, so a lazy-loaded
 * image inside one never loads at all. Deriving it here keeps it correct
 * automatically; it is not something an editor should have to type.
 */
const ratios = new Map();
async function intrinsicRatio(src) {
  if (ratios.has(src)) return ratios.get(src);
  const abs = join(IMG_DIR, src.replace(/^\/?assets\/img\//, ''));
  let ar = '';
  if (existsSync(abs)) {
    try {
      const m = await sharp(abs, { limitInputPixels: false }).metadata();
      if (m.width && m.height) ar = `${m.width} / ${m.height}`;
    } catch { /* unreadable — fall back to the CSS default */ }
  }
  ratios.set(src, ar);
  return ar;
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
      if (node.fit === 'natural') {
        const ar = await intrinsicRatio(node.src);
        if (ar && node.ar !== ar) node.ar = ar;
      } else if ('ar' in node) {
        delete node.ar;   // no longer natural — don't leave a stale ratio behind
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
