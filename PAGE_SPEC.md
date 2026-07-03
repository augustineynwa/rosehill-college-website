# Rosehill College — page content authoring spec

You are converting a page from the old Webflow export into a curated content
JSON file for the new design system. The rendered page must feel as polished
as the homepage: varied section rhythm, real copy, real photography.

## Inputs
- `extracted/<section>__<page>.json` — the real copy and image references
  pulled from the export, in document order. This is your source of truth.
- If a block reads oddly (Webflow duplicated text, truncated), you may open
  the original HTML page in the export root (`../<section>/<page>.html`) to
  check context.
- Images live in `public/assets/img/` (same filenames as `images/` in the
  extract, without the `images/` prefix).

## Output
`content/pages/<section>/<page>.json`:

```json
{
  "layout": "page",
  "path": "<section>/<page>.html",
  "slug": "<page>",
  "title": "<Title from extract>",
  "metaDescription": "<from extract>",
  "sections": [ ... ]
}
```

## Section vocabulary (the ONLY allowed types)

- `hero` — every page starts with one. `{ type, eyebrow?, reo?, heading, lede?, image?, actions? }`.
  `image` gives a full-bleed parallax band under the heading — use the page's
  banner image when the extract has one.
- `prose` — `{ heading?, eyebrow?, reo?, html, aside? }`. `html` is rich text
  (`<p>`, `<ul>`, `<ol>`, `<strong>`, `<a>`); aside: `{ image?, html? }` renders
  in a right column. Keep one topic per prose section.
- `media-text` — `{ eyebrow?, heading, html, image, flip?, portrait?, actions? }`.
  Alternate `flip` between consecutive media-text sections.
- `gallery` — `{ heading?, images: [{src, srcset, alt, caption?}] }` (3–8 images).
- `cards` — `{ heading?, lede?, cards: [{title, text?, href?, image?, cta?, external?}] }`.
  Use for link hubs only, never as filler. 2–6 cards.
- `table` — `{ heading?, lede?, caption, columns, rows }`. Rows are arrays;
  first cell becomes a row header. `<br>` allowed inside cells.
- `list` — `{ heading?, items: [{term, text}] }` — definition rows (dates,
  contacts, fees).
- `quote` — `{ reo?, text, attribution? }` — pull quote band.
- `stats` — `{ stats: [{value, label}] }` — ONLY real figures from the extract.
- `cta` — `{ eyebrow?, heading, text?, image?, actions: [{href, label, primary?}] }`.
  Most pages end with one pointing somewhere genuinely useful.
- `accordion` — `{ heading?, items: [{title, html, open?}] }` — long FAQ/policy
  material.
- `timeline` — `{ entries: [{year, title?, html?, image?}] }` — history.
- `people` — `{ groups: [{title?, people: [{name, role?, email?, image?}]}], compact? }`.
- `docs` — `{ heading?, lede?, docs: [{href, label, meta?}], columns? }` — PDF
  downloads. PDFs live at `assets/docs/<file>.pdf`.
- `embed` — `{ heading?, src, iframeTitle, tall?, note? }` or `{ embeds: [...] }`
  for a grid. YouTube must use `https://www.youtube-nocookie.com/embed/<id>?rel=0`.
- `contact-form` — contact page only.

## Image rules (strict)
- `src`: `assets/img/<filename>` (no leading slash). Only files that exist.
- `srcset`: ONLY entries like `/assets/img/<name>-p-500.avif 500w` where that
  exact `-p-NNN` file exists in `public/assets/img/`. If the image has no
  `-p-` variants, use `"srcset": ""`. NEVER reference the duplicated
  `<name>_1<Name with spaces>.avif` files.
- Every image needs meaningful `alt` text describing what is really shown
  (or `""` only if purely decorative). Never invent people's names.
- Use each page's own images (they are named after the page). Do not reuse
  the same hero image on multiple pages.
- Optional `pos` field (e.g. `"50% 15%"`) sets the crop focal point for
  portraits.

## Copy rules (strict)
- Use the real copy from the extract, essentially verbatim. You may fix
  obvious typos/spelling ("reslient" → "resilient"), normalise NZ English
  spelling, and add correct macrons to te reo Māori words (whānau, Māori,
  kaupapa, mātau). Do not invent facts, names, dates, or numbers.
- Skip Webflow boilerplate blocks: "This is some text inside of a div block",
  lorem ipsum, "No items found", "Thank you! Your submission…", pagination,
  "Items in view", empty-state text, search icons.
- The big `"class": "main"` div at the top of each extract is a concatenated
  duplicate of everything — use it only to understand order, never as copy.
- `eyebrow`: a short te reo phrase with `"reo": true` when it carries
  meaning (e.g. "Ngā hākinakina" for sports). Only use well-established
  phrases you are certain are correct, otherwise use a short English eyebrow
  without `reo`.
- Headings sentence case ("Our vision and values"), never all-caps.

## Layout judgement (what makes the page pass review)
- Vary the rhythm: hero → media-text (flip alternating) → prose/table/docs →
  quote or gallery → cta. Do NOT default to rows of three equal cards.
- Tabular data (dates, fees, times, uniform lists) belongs in `table`, long
  bullet-lists of requirements in `prose` or `accordion`, PDF collections in
  `docs`.
- Practical info must come early — never bury dates/fees/contacts below
  decorative sections.
- 4–8 sections per page is typical. A page with one paragraph of source copy
  gets: hero, one substantive section, cta. Do not pad.

## Existing examples to study before writing
- `content/pages/our-school/principals-message.json`
- `content/pages/our-school/about-us.json`
- `content/pages/our-school/term-dates.json`
- `content/pages/index.json` (homepage — do not copy its bespoke types)

## Validation
After writing the JSON, run `node scripts/render.mjs` from `rhc-site/` and
confirm it exits 0. If it errors on your page, fix the JSON.
