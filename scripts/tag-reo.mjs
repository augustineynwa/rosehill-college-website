/**
 * tag-reo.mjs — mark te reo Māori inside English prose with lang="mi".
 *
 * WCAG 2.1 AA 3.1.2 (Language of Parts): without this a screen reader voices
 * te reo with English phonemes, which mangles it. The templates already tag
 * eyebrows, quotes, the motto and the pou; this covers the rich-text bodies.
 *
 * Two things make a naive find-and-replace wrong here:
 *  - The fields are HTML. Replacing blindly would corrupt attributes (an alt
 *    text or a URL containing a matched word). So the string is split on tags
 *    and only the text between them is touched.
 *  - JavaScript's \b is ASCII-only, so it treats the macron in "whānau" as a
 *    word boundary. Unicode property escapes are used instead.
 *
 * Idempotent: text already inside a lang="mi" span is skipped, so re-running
 * doesn't nest spans.
 *
 * Run: node scripts/tag-reo.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');

/**
 * Deliberately conservative. Only unambiguous te reo, and no bare particles
 * ("te", "ngā", "o") which would match constantly inside English text.
 * Multi-word phrases are matched first so they're tagged as one unit.
 */
const TERMS = [
  'te reo Māori', 'te ao Māori', 'Ngāti Tamaoho', 'kapa haka', 'Kapa Haka',
  'mātauranga Māori', 'Aotearoa', 'Māori',
  'whānau', 'whanaungatanga', 'Whanaungatanga',
  'manaakitanga', 'Manaakitanga', 'rangatiratanga', 'Rangatiratanga',
  'hihiritanga', 'Hihiritanga', 'kaitiakitanga', 'Kaitiakitanga',
  'ākonga', 'kaiako', 'kaiārahi', 'kaitiaki', 'Kaitiaki', 'kaimanaaki', 'Kaimanaaki',
  'tamariki', 'rangatahi', 'kaupapa', 'Kaupapa', 'tikanga', 'pōwhiri', 'hapū',
  'iwi', 'marae', 'karakia', 'waiata', 'haka', 'koha', 'aroha', 'mana',
  'kura', 'tuakana', 'teina', 'mahi', 'whaea', 'Whaea', 'matua', 'kia ora',
];

// longest first so "te reo Māori" wins over "Māori"
const sorted = [...TERMS].sort((a, b) => b.length - a.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Unicode-aware boundaries: a letter or combining mark on either side means
// we're inside a longer word, so don't match.
const RE = new RegExp(
  `(?<![\\p{L}\\p{M}])(${sorted.map(esc).join('|')})(?![\\p{L}\\p{M}])`,
  'gu',
);

function tagHtml(html) {
  // odd indices are tags, even indices are text — only text gets touched
  const parts = html.split(/(<[^>]*>)/);
  let changed = 0;
  let insideReo = false;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i % 2 === 1) {                       // a tag
      if (/^<span[^>]*lang="mi"/i.test(p)) insideReo = true;
      else if (insideReo && /^<\/span>/i.test(p)) insideReo = false;
      continue;
    }
    if (insideReo || !p) continue;           // already tagged — leave alone
    parts[i] = p.replace(RE, (m) => { changed++; return `<span lang="mi">${m}</span>`; });
  }
  return { html: parts.join(''), changed };
}

function walk(d) {
  return readdirSync(d).flatMap((e) => {
    const f = join(d, e);
    return statSync(f).isDirectory() ? walk(f) : (e.endsWith('.json') ? [f] : []);
  });
}

let files = 0, total = 0;
const perTerm = new Map();

function visit(node) {
  if (Array.isArray(node)) return node.reduce((sum, n) => sum + visit(n), 0);
  if (!node || typeof node !== 'object') return 0;
  let n = 0;
  for (const [key, value] of Object.entries(node)) {
    // only rich-text fields hold HTML; `aside` is a string on contact-form
    if ((key === 'html' || key === 'aside') && typeof value === 'string') {
      const { html, changed } = tagHtml(value);
      if (changed) {
        for (const m of value.match(RE) || []) perTerm.set(m, (perTerm.get(m) || 0) + 1);
        node[key] = html;
        n += changed;
      }
    } else n += visit(value);   // must accumulate: rich text is nested in sections
  }
  return n;
}

for (const f of walk(CONTENT)) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  const before = JSON.stringify(j);
  const n = visit(j);
  if (JSON.stringify(j) !== before) {
    writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
    files++; total += n;
  }
}

console.log(`Tagged ${total} te reo terms across ${files} files.`);
const top = [...perTerm.entries()].sort((a, b) => b[1] - a[1]);
for (const [t, n] of top) console.log(`  ${String(n).padStart(3)}x  ${t}`);
