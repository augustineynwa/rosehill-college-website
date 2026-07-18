/**
 * gen-og-image.mjs — build the social share card at public/assets/img/og-default.jpg
 *
 * Facebook, Messenger, WhatsApp and LinkedIn will not unfurl AVIF (which is what
 * the rest of the photo library is) and will not accept an SVG, so the share card
 * has to be a real 1200x630 JPG. Without one, every shared link — including an
 * urgent notice — renders as a bare grey box.
 *
 * Run: npm run og
 */
import sharp from 'sharp';
import { statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200, H = 630;

const photo = join(ROOT, 'public/assets/video/Website-sizzle-reel_poster.0000000.jpg');
const crest = join(ROOT, 'public/assets/img/RHC-Official-Crest.svg');
const out = join(ROOT, 'public/assets/img/og-default.jpg');

// darken the campus drone still so crest and wordmark stay legible at the
// thumbnail sizes these cards are actually viewed at
const scrim = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0.35">
      <stop offset="0%" stop-color="#070a14" stop-opacity="0.94"/>
      <stop offset="55%" stop-color="#0d1430" stop-opacity="0.86"/>
      <stop offset="100%" stop-color="#131c44" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="#da3029"/>
</svg>`);

const text = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="470" y="286" font-family="Georgia, 'Times New Roman', serif" font-size="76"
        font-weight="700" fill="#ffffff">Rosehill College</text>
  <text x="473" y="344" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="30"
        fill="#c9cede">Papakura, South Auckland</text>
  <text x="473" y="404" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="26"
        fill="#c2a45e">Years 9&#8211;13 &#183; State co-educational</text>
</svg>`);

const crestPng = await sharp(crest, { density: 300 }).resize({ height: 330 }).png().toBuffer();

await sharp(photo)
  .resize(W, H, { fit: 'cover', position: 'centre' })
  .composite([
    { input: scrim, top: 0, left: 0 },
    { input: crestPng, top: 150, left: 110 },
    { input: text, top: 0, left: 0 },
  ])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(out);

const meta = await sharp(out).metadata();
console.log(`Wrote og-default.jpg — ${meta.width}x${meta.height}, ${Math.round(statSync(out).size / 1024)} KB`);
