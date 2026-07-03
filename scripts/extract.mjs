/**
 * extract.mjs — pull real page content out of the Webflow export.
 *
 * For every HTML page in the export, capture (in document order) the main
 * content: headings, paragraphs, lists, tables, images (src + srcset + alt),
 * links, video embeds and PDF references — skipping nav, footer and utility
 * chrome. Output: extracted/<section>__<page>.json
 *
 * This is raw material. Curated per-page content lives in content/pages/.
 */
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORT_ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(__dirname, '..', 'extracted');
mkdirSync(OUT_DIR, { recursive: true });

const SKIP = new Set([
  'detail_category.html', 'detail_contact-us-form.html', 'detail_site-notice-colour.html',
  'detail_site-notice.html', 'detail_test-post.html', 'styleguide.html',
  'school-app-upgrade-in-progress.html', 'rhc-sit-page.html',
]);
const SKIP_DIRS = new Set(['rhctest', 'rhc-site', 'node_modules']);

function findPages(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry) && !entry.startsWith('.')) out.push(...findPages(full));
    } else if (entry.endsWith('.html')) {
      const rel = relative(EXPORT_ROOT, full).replaceAll('\\', '/');
      if (!SKIP.has(rel) && !rel.includes('/')) out.push(rel);
      else if (!SKIP.has(entry) && rel.includes('/')) out.push(rel);
    }
  }
  return out;
}

function cleanText(t) {
  return t.replace(/\s+/g, ' ').replace(/ /g, ' ').trim();
}

function extractPage(relPath) {
  const html = readFileSync(join(EXPORT_ROOT, relPath), 'utf8');
  const $ = cheerio.load(html);

  const title = cleanText($('title').text());
  const metaDescription = $('meta[name="description"]').attr('content') || '';

  // Remove chrome that repeats on every page.
  $('.nav, .w-nav, footer, .footer, .back-to-top, .report-absence-button, .notice-modal-wrapper, script, style, noscript, .nav-search, .enrol_ads_card').remove();

  const blocks = [];
  const seenText = new Set();

  $('body').find('h1, h2, h3, h4, h5, p, li, blockquote, td, th, img, a, iframe, video, source, div').each((_, el) => {
    const $el = $(el);
    const tag = el.tagName.toLowerCase();

    if (tag === 'img') {
      const src = $el.attr('src') || '';
      if (!src || src.startsWith('http') || src.includes('placeholder')) return;
      blocks.push({ type: 'img', src: src.replace(/^(\.\.\/)+/, ''), srcset: $el.attr('srcset') || '', alt: $el.attr('alt') || '', class: $el.attr('class') || '' });
      return;
    }
    if (tag === 'iframe') {
      const src = $el.attr('src') || '';
      if (src) blocks.push({ type: 'embed', src, title: $el.attr('title') || '' });
      return;
    }
    if (tag === 'video' || tag === 'source') {
      const src = $el.attr('src') || $el.parent().attr('data-video-urls') || '';
      if (src) blocks.push({ type: 'video', src });
      return;
    }
    if (tag === 'a') {
      const href = $el.attr('href') || '';
      const text = cleanText($el.text());
      // Only capture document links and buttons — inline links are captured by parent text.
      if (href.match(/\.pdf$/i) || ($el.attr('class') || '').match(/button|btn|cta/i)) {
        blocks.push({ type: 'link', href, text });
      }
      return;
    }

    // Text elements: only leaf-ish content (avoid duplicating nested text).
    const text = cleanText($el.text());
    if (!text || text.length < 2) return;
    if (tag === 'div') {
      // leaf divs carrying real copy (Webflow text blocks, slider text, rich text)
      const cls = $el.attr('class') || '';
      if ($el.children('div,h1,h2,h3,h4,p,ul,ol,a,img').length > 0) return;
      if (text.length < 25 || cls.match(/chevron|icon|button|dropdown|tooltip|empty|pagination|overlay/i)) return;
      if (seenText.has('div|' + text)) return;
      seenText.add('div|' + text);
      blocks.push({ type: 'div', text, class: cls });
      return;
    }
    // skip if identical text already captured (Webflow duplicates desktop/mobile)
    if (seenText.has(tag + '|' + text)) return;
    // skip if this element contains block children that will be captured separately
    if ($el.find('h1,h2,h3,h4,p,li').length > 0 && tag !== 'li') return;
    seenText.add(tag + '|' + text);
    blocks.push({ type: tag, text, class: $el.attr('class') || '' });
  });

  return { source: relPath, title, metaDescription, blocks };
}

const pages = findPages(EXPORT_ROOT);
let count = 0;
for (const p of pages) {
  const data = extractPage(p);
  const outName = p.replace(/\.html$/, '').replaceAll('/', '__') + '.json';
  writeFileSync(join(OUT_DIR, outName), JSON.stringify(data, null, 2), 'utf8');
  count++;
  console.log(`${outName}  (${data.blocks.length} blocks)`);
}
console.log(`\nExtracted ${count} pages -> ${OUT_DIR}`);
