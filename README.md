# Rosehill College — cinematic scroll website

Award-standard static build for Rosehill College (Year 9–13, Papakura, South
Auckland). Vite + GSAP ScrollTrigger + Lenis + three.js, structured for a clean
port to self-hosted WordPress. Every page composes from one design system and
one shared component library; all editable content lives in per-page JSON.

## Architecture

```
content/site.json          global data (nav, contact, footer) → ACF options
content/pages/**/*.json     per-page content (sections[]) → ACF flexible content
templates/layouts/*.hbs     front-page / page shells → WP template hierarchy
templates/partials/*.hbs    header, footer, section-* components → template parts
src/styles/tokens.css       design tokens — single source of truth
src/styles/*.css            base, components, home
src/js/*.js                 nav, shared animations, home chapters, 3D crest, search
scripts/                    build pipeline (see below)
public/assets/              img, video, docs, fonts, crest.glb
```

## Build pipeline

| Command | What it does |
| --- | --- |
| `npm run extract` | Pull real copy + image refs from the Webflow export into `extracted/*.json` (source material) |
| `npm run crest` | Extrude the official crest SVG into `public/assets/crest.glb` (run `@gltf-transform optimize --compress meshopt` after) |
| `node scripts/gen-image-variants.mjs` | Generate responsive AVIF variants for oversized images and inject srcsets |
| `npm run render` | Render `content` + `templates` → static `.html` |
| `npm run dev` | Render + Vite dev server (re-renders on content/template change) |
| `npm run build` | Render → Vite build → inline critical CSS into each page |
| `node scripts/check.mjs` | Validate every rendered page: images exist, links resolve, alts present |

## Design system

- **Colour** — from the official crest: navy `#273370`, rose red `#da3029`,
  silver `#f3f3f3`, gold `#e0cf90`; deep dark base derived from the crest navy.
- **Type** — Albertus Nova (display, subset to Latin + macrons) / Carlito (body),
  self-hosted. Fixed modular scale, no off-scale sizes.
- **Spacing** — 8px base; two desktop section paddings + one mobile; one vertical
  rhythm applied everywhere.
- **Grid** — 12 columns, max content width 1344px; full-bleed media aligns to grid.
- All tokens are CSS custom properties in `src/styles/tokens.css`.

## Motion

GSAP ScrollTrigger (scrubbed + pinned) with Lenis momentum scroll. The homepage
runs eight scroll chapters: 3D crest assembly + motto reveal, four pou values,
pinned Life gallery, Year 9→13 journey with a corner progress marker,
co-curricular montage, news, enrolment CTA, footer. Sub-pages share a lighter
entrance + parallax language. `prefers-reduced-motion` ships a calm static
version of every animated section; the 3D crest and ambient video are
desktop-only (mobile keeps the official SVG crest).

## Accessibility & performance

- WCAG 2.1 AA: keyboard nav, visible focus, semantic headings, alt text on every
  real image, AA contrast on the dark base.
- Lazy media, self-hosted subset fonts, responsive AVIF, meshopt-compressed GLB,
  inlined critical CSS, click-to-load facade for heavy third-party embeds.
- Lighthouse mobile (verified): home 100/100, term-dates 100/100,
  enrolment 96/100, our-history 98/100 (performance / accessibility).

## WordPress port

See `wordpress-map.md` for the partial → WP template mapping. Content is fully
separated from layout so each `sections[]` entry maps to an ACF flexible-content
layout, and `site.json` maps to an ACF options page + registered menus.

## Notes on the export

All copy and imagery come from the real Webflow export. Empty CMS shells in the
export (news posts, clubs, staff-vacancies listings, assessment sub-pages) had no
content to rebuild; the news hub links to real documents until posts are migrated.
No fake students, staff, or campus imagery was generated.
