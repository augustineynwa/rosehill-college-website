/**
 * optimize-images.mjs — keep CMS photo uploads lean, automatically.
 *
 * Staff upload photos through the CMS straight off a phone or camera. Those
 * arrive un-optimised: a 4MB JPEG, a 2MB PNG, or an over-quality AVIF. This
 * runs at the START of the build (before gen-image-variants) and rewrites any
 * content-referenced upload to a compact AVIF master, so editors never have to
 * think about file size.
 *
 * What it touches — only genuine uploads, never the designed assets:
 *   - Any jpg / jpeg / png / webp referenced in content → re-encoded to AVIF
 *     (the whole curated site is already AVIF, so a non-AVIF file is always an
 *     upload). The original is removed and every src reference is repointed.
 *   - An AVIF over the size budget that has NO responsive -rp- variants yet
 *     (i.e. a fresh upload, not a processed curated image) → re-encoded leaner
 *     in place.
 * In both cases the srcset is cleared so gen-image-variants rebuilds it from the
 * new master.
 *
 * Idempotent: once a file is a lean AVIF it falls under the budget and is
 * skipped, so re-running (every build) does no work and never re-degrades.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PAGES = join(ROOT, 'content', 'pages');
const SITE = join(ROOT, 'content', 'site.json');
const IMG_DIR = join(ROOT, 'public', 'assets', 'img');

const MAX_WIDTH = 2560;                 // plenty for a full-bleed retina master
const AVIF = { quality: 55, effort: 4 };
const AVIF_BUDGET = 500 * 1024;         // an upload AVIF above this is re-encoded
const CONVERT_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function walkFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else if (e.endsWith('.json')) out.push(full);
  }
  return out;
}

const rel = (src) => src.replace(/^\/?assets\/img\//, '');
const hasVariants = (base, ext) =>
  existsSync(join(IMG_DIR, `${base}-rp-500${ext}`)) ||
  existsSync(join(IMG_DIR, `${base}-rp-800${ext}`));

// decision + work is done once per source path and cached
const handled = new Map(); // normalisedSrc → newSrc (may equal old for in-place)
let reencoded = 0;

async function optimise(src) {
  const key = src.replace(/^\//, '');
  if (handled.has(key)) return handled.get(key);
  const relPath = rel(key);
  const abs = join(IMG_DIR, relPath);
  const ext = extname(relPath).toLowerCase();
  if (!existsSync(abs)) { handled.set(key, null); return null; }

  const base = basename(relPath, extname(relPath));

  // 1) non-AVIF upload → convert to AVIF, drop the original, repoint src
  if (CONVERT_EXT.has(ext)) {
    const outAbs = join(IMG_DIR, `${base}.avif`);
    try {
      await sharp(abs, { limitInputPixels: false })
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .avif(AVIF).toFile(outAbs);
      if (abs !== outAbs) { try { rmSync(abs); } catch {} }
      reencoded++;
      const newSrc = `assets/img/${base}.avif`;
      handled.set(key, newSrc);
      return newSrc;
    } catch (e) {
      console.warn(`  ! could not convert ${relPath}: ${e.message}`);
      handled.set(key, null); return null;
    }
  }

  // 2) oversized AVIF upload (no variants yet) → re-encode leaner under a NEW
  //    name. A new filename is essential: re-encoding in place keeps the URL, so
  //    Cloudflare's 7-day image cache would keep serving the old, heavy bytes.
  //    The "-lean" suffix also marks it done, so it's never re-processed.
  if (ext === '.avif' && !base.endsWith('-lean') && !hasVariants(base, ext)) {
    let size = 0; try { size = statSync(abs).size; } catch {}
    if (size > AVIF_BUDGET) {
      try {
        const buf = await sharp(abs, { limitInputPixels: false })
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .avif(AVIF).toBuffer();
        if (buf.length < size) {
          const outAbs = join(IMG_DIR, `${base}-lean.avif`);
          writeFileSync(outAbs, buf);
          if (abs !== outAbs) { try { rmSync(abs); } catch {} }
          reencoded++;
          const newSrc = `assets/img/${base}-lean.avif`;
          handled.set(key, newSrc);
          return newSrc;
        }
      } catch (e) {
        console.warn(`  ! could not re-encode ${relPath}: ${e.message}`);
      }
    }
  }

  handled.set(key, null); // nothing to do
  return null;
}

async function processNode(node) {
  if (Array.isArray(node)) { for (const n of node) await processNode(n); return; }
  if (node && typeof node === 'object') {
    if (typeof node.src === 'string' && node.src.includes('assets/img/')) {
      const ext = extname(node.src).toLowerCase();
      const isUpload = CONVERT_EXT.has(ext) || ext === '.avif';
      if (isUpload) {
        const newSrc = await optimise(node.src);
        if (newSrc) {
          if (newSrc !== node.src.replace(/^\//, '')) node.src = newSrc;
          node.srcset = ''; // let gen-image-variants rebuild from the new master
        }
      }
    }
    for (const k of Object.keys(node)) await processNode(node[k]);
  }
}

let changed = 0;
const POSTS = join(ROOT, 'content', 'posts');
const files = [PAGES, POSTS].filter(existsSync).flatMap(walkFiles);
if (existsSync(SITE)) files.push(SITE);
for (const f of files) {
  const data = JSON.parse(readFileSync(f, 'utf8'));
  const before = JSON.stringify(data);
  await processNode(data);
  if (JSON.stringify(data) !== before) {
    writeFileSync(f, JSON.stringify(data, null, 2) + '\n', 'utf8');
    changed++;
  }
}
console.log(`Optimised uploads: re-encoded ${reencoded} image(s), updated ${changed} content file(s).`);
