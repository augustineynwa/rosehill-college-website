/**
 * render.mjs — static page generator.
 *
 * content/pages/**\/*.json  (editable content ≈ ACF fields)
 *   + templates/layouts/*.hbs  (≈ WP template hierarchy: front-page, page, single, archive)
 *   + templates/partials/*.hbs (≈ WP template parts / ACF flexible-content blocks)
 *   → <root>/**\/*.html  (Vite multi-page inputs)
 *
 * Each page JSON: { layout, path, title, metaDescription, depth-independent
 * URLs are written with {{root}} so nested pages resolve assets correctly. }
 */
import Handlebars from 'handlebars';
import { marked } from 'marked';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TPL = join(ROOT, 'templates');
const CONTENT = join(ROOT, 'content');

// ---------- helpers ----------
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('ne', (a, b) => a !== b);
Handlebars.registerHelper('or', (a, b) => a || b);
Handlebars.registerHelper('and', (a, b) => a && b);
Handlebars.registerHelper('add', (a, b) => Number(a) + Number(b));
Handlebars.registerHelper('inc', (a) => Number(a) + 1);
Handlebars.registerHelper('raw', (s) => new Handlebars.SafeString(s ?? ''));
Handlebars.registerHelper('json', (o) => new Handlebars.SafeString(JSON.stringify(o)));
Handlebars.registerHelper('pad2', (n) => String(n).padStart(2, '0'));
Handlebars.registerHelper('mod', (a, b) => Number(a) % Number(b));
// short stable id for a notice, so "dismiss" is per-message: changing the
// wording changes the id, which re-shows the banner to everyone
Handlebars.registerHelper('noticeId', (notice) => {
  const s = `${notice?.level || ''}|${notice?.message || ''}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return 'n' + h.toString(36);
});
// site-relative hrefs get a leading slash; external/mailto/tel pass through
Handlebars.registerHelper('url', (h) => /^(https?:|mailto:|tel:|\/|#)/.test(h) ? h : '/' + h);
// section dispatcher: renders partial "section-<type>" with the section as context
Handlebars.registerHelper('section', function (sec, options) {
  const partial = Handlebars.partials['section-' + sec.type] || Handlebars.partials[sec.type];
  if (!partial) throw new Error(`Unknown section type: ${sec.type}`);
  const fn = typeof partial === 'string' ? Handlebars.compile(partial) : partial;
  return new Handlebars.SafeString(fn({ ...sec, root: options.data.root.root, page: options.data.root }, { data: options.data }));
});

// ---------- load partials ----------
function walk(dir, ext) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walk(full, ext));
    else if (e.endsWith(ext)) out.push(full);
  }
  return out;
}

for (const f of walk(join(TPL, 'partials'), '.hbs')) {
  const name = relative(join(TPL, 'partials'), f).replaceAll('\\', '/').replace(/\.hbs$/, '');
  Handlebars.registerPartial(name, readFileSync(f, 'utf8'));
}

const layouts = {};
for (const f of walk(join(TPL, 'layouts'), '.hbs')) {
  const name = relative(join(TPL, 'layouts'), f).replaceAll('\\', '/').replace(/\.hbs$/, '');
  layouts[name] = Handlebars.compile(readFileSync(f, 'utf8'), { preventIndent: true });
}

// ---------- global site data ----------
const site = JSON.parse(readFileSync(join(CONTENT, 'site.json'), 'utf8'));

/**
 * Rich-text fields may be authored either as raw HTML (how the pages were
 * originally built) or as markdown (what the CMS rich-text editor writes).
 * marked passes block-level HTML through byte-identically, so running every
 * rich-text field through it makes both authoring styles render correctly.
 */
marked.setOptions({ mangle: false, headerIds: false });
function renderRichText(node) {
  if (Array.isArray(node)) { node.forEach(renderRichText); return; }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    // `aside` is a string on contact-form but an object elsewhere — only the string form is rich text
    if ((key === 'html' || key === 'aside') && typeof value === 'string') {
      node[key] = marked.parse(value).trim();
    } else {
      renderRichText(value);
    }
  }
}

/**
 * Cloudflare Pages (and most static hosts) serve `foo.html` at `/foo` and
 * 301-redirect the `.html` form. Emitting `.html` links therefore costs a
 * redirect hop on every internal navigation. Content and templates keep the
 * honest `.html` target (it's the real file, and the WordPress port maps from
 * it); we strip the extension here, on the way out.
 *
 * Only touches root-relative hrefs, so external links are never rewritten.
 */
function cleanUrls(html) {
  return html.replace(/href="(\/[^"?#]*?)\.html([^"]*)"/g, (_m, path, rest) =>
    `href="${path === '/index' ? '/' : path}${rest}"`);
}
const cleanHref = (p) => {
  const u = '/' + p.replace(/\.html$/, '');
  return u === '/index' ? '/' : u;
};

// ---------- render pages + search index ----------
const searchIndex = [];
const sitemapPaths = [];
function sectionText(sec) {
  const parts = [];
  const collect = (v) => {
    if (typeof v === 'string') parts.push(v.replace(/<[^>]+>/g, ' '));
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => {
      if (!['src', 'srcset', 'href', 'image', 'pos', 'type', 'id', 'video'].includes(k)) collect(x);
    });
  };
  collect(sec);
  return parts.join(' ');
}

let count = 0;
for (const f of walk(join(CONTENT, 'pages'), '.json')) {
  const page = JSON.parse(readFileSync(f, 'utf8'));
  renderRichText(page.sections);
  const outPath = join(ROOT, page.path);
  const depth = page.path.split('/').length - 1;
  const root = depth === 0 ? './' : '../'.repeat(depth);
  const layout = layouts[page.layout || 'page'];
  if (!layout) throw new Error(`Unknown layout "${page.layout}" for ${page.path}`);
  const canonicalPath = cleanHref(page.path);
  const html = cleanUrls(layout({ ...page, site, root, canonicalPath }));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');
  const indexable = !['404.html', 'search.html', '401.html', 'my-rhc.html'].includes(page.path)
    && !page.noindex;
  if (indexable) {
    searchIndex.push({
      title: page.title,
      href: canonicalPath,
      description: page.metaDescription || '',
      text: (page.sections || []).map(sectionText).join(' ').replace(/\s+/g, ' ').slice(0, 4000),
    });
    sitemapPaths.push(canonicalPath);
  }
  count++;
}

// ---------- sitemap.xml + robots.txt (use site.baseUrl; regenerated every build) ----------
const base = (site.baseUrl || '').replace(/\/$/, '');
if (base) {
  const urls = sitemapPaths
    .sort()
    .map((p) => `  <url><loc>${base}${p === '/' ? '/' : p}</loc></url>`)
    .join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  writeFileSync(join(ROOT, 'public', 'sitemap.xml'), sitemap, 'utf8');
  writeFileSync(join(ROOT, 'public', 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`, 'utf8');
  console.log(`Wrote sitemap.xml (${sitemapPaths.length} urls) + robots.txt for ${base}`);
}
mkdirSync(join(ROOT, 'public'), { recursive: true });
writeFileSync(join(ROOT, 'public', 'search-index.json'), JSON.stringify(searchIndex), 'utf8');
console.log(`Rendered ${count} pages (+ search index of ${searchIndex.length}).`);
