/**
 * audit-crops.mjs — find images that are badly cropped by their component.
 *
 * Every media frame has a fixed aspect ratio and uses object-fit: cover, so a
 * source whose aspect differs a lot from its frame loses a big slice of itself.
 * If the subject isn't dead centre, that slice contains the subject.
 *
 * Prints each image slot with how much of the source is cropped away, worst
 * first, so the bad ones can be fixed with object-position (`pos`) or a
 * different image.
 */
import sharp from 'sharp';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG = join(ROOT, 'public', 'assets', 'img');

// container aspect (w/h) each image slot renders into — mirrors the CSS
const CARD = 4 / 3, PORTRAIT = 3 / 4, WIDE = 21 / 9, HERO = 2.55, SIXTEEN9 = 16 / 9;

function slotsFor(sec) {
  const out = [];
  const add = (img, ratio, where) => { if (img?.src) out.push({ img, ratio, where }); };
  switch (sec.type) {
    case 'hero': add(sec.image, HERO, 'hero banner'); break;
    case 'media-text': add(sec.image, sec.portrait ? PORTRAIT : CARD, `media-text${sec.portrait ? ' (portrait)' : ''}`); break;
    case 'prose': add(sec.aside?.image, PORTRAIT, 'prose aside'); break;
    case 'cards': (sec.cards || []).forEach(c => add(c.image, CARD, 'card')); break;
    case 'gallery': (sec.images || []).forEach((i, n) => add(i, n % 6 === 0 || n % 6 === 4 ? WIDE : CARD, 'gallery')); break;
    case 'timeline': (sec.entries || []).forEach(e => add(e.image, CARD, 'timeline')); break;
    case 'people': (sec.groups || []).forEach(g => (g.people || []).forEach(p => add(p.image, PORTRAIT, 'person'))); break;
    case 'cta': add(sec.image, HERO, 'cta band'); break;
    case 'news-list':
      add(sec.feature?.image, SIXTEEN9, 'news feature');
      (sec.items || []).forEach(i => add(i.image, CARD, 'news card'));
      break;
    case 'home-values': (sec.values || []).forEach(v => add(v.image, CARD, 'pou')); break;
    case 'home-life': (sec.images || []).forEach((i, n) => add(i, n % 2 ? CARD : SIXTEEN9, 'life panel')); break;
    case 'home-journey': (sec.steps || []).forEach(s => add(s.image, PORTRAIT, 'journey')); break;
    case 'home-cocurricular': (sec.rows || []).forEach(r => (r.images || []).forEach(i => add(i, CARD, 'montage'))); break;
  }
  return out;
}

const walk = (d) => readdirSync(d).flatMap((e) => {
  const f = join(d, e);
  return statSync(f).isDirectory() ? walk(f) : (e.endsWith('.json') ? [f] : []);
});

const rows = [];
for (const f of walk(join(ROOT, 'content', 'pages'))) {
  const page = JSON.parse(readFileSync(f, 'utf8'));
  for (const sec of page.sections || []) {
    for (const { img, ratio, where } of slotsFor(sec)) {
      const abs = join(IMG, img.src.replace(/^\/?assets\/img\//, ''));
      if (!existsSync(abs)) continue;
      let meta;
      try { meta = await sharp(abs, { limitInputPixels: false }).metadata(); } catch { continue; }
      const src = meta.width / meta.height;
      // fraction of the source's long axis discarded by object-fit: cover
      const lost = 1 - Math.min(src, ratio) / Math.max(src, ratio);
      rows.push({
        lost, page: page.path, where,
        axis: src > ratio ? 'sides' : 'top/bottom',
        file: img.src.replace('assets/img/', ''),
        srcAspect: src.toFixed(2), frame: ratio.toFixed(2),
        pos: img.pos || '—',
      });
    }
  }
}

rows.sort((a, b) => b.lost - a.lost);
const pct = (n) => (n * 100).toFixed(0) + '%';
console.log(`${rows.length} image slots audited\n`);
console.log('LOST  CUT        PAGE                                 SLOT             POS        FILE');
for (const r of rows) {
  if (r.lost < 0.25) continue;
  console.log(
    `${pct(r.lost).padStart(4)}  ${r.axis.padEnd(10)} ${r.page.padEnd(36)} ${r.where.padEnd(16)} ${String(r.pos).padEnd(10)} ${r.file}`
  );
}
const bad = rows.filter(r => r.lost >= 0.4).length;
const warn = rows.filter(r => r.lost >= 0.25 && r.lost < 0.4).length;
console.log(`\n${bad} severe (>=40% cut), ${warn} moderate (25-40%), ${rows.length - bad - warn} fine`);
