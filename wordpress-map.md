# WordPress port map

The static build is structured so each piece maps 1:1 onto a self-hosted
WordPress theme. Content lives in per-page JSON (`content/pages/**`) that maps
to ACF fields; templates are Handlebars partials that map to PHP template
parts.

## Template hierarchy

| Static artefact | WordPress template | Notes |
| --- | --- | --- |
| `templates/layouts/front-page.hbs` + `content/pages/index.json` | `front-page.php` | Homepage scroll experience |
| `templates/layouts/page.hbs` + `content/pages/**/*.json` | `page.php` | Generic page shell; sections render as ACF flexible content |
| `content/pages/our-school/our-latest-news.json` | `archive.php` (post archive) | News hub; cards become the post loop |
| *(news item — CMS-empty in export, see notes)* | `single.php` | Post template; use `section-hero` + `section-prose` partials |
| `content/pages/404.json` | `404.php` | |
| `content/pages/search.json` + `src/js/search.js` | `search.php` | Replace client-side index with WP search loop |
| `templates/partials/header.hbs` | `header.php` | Nav from `content/site.json` → WP menus (`wp_nav_menu`) |
| `templates/partials/footer.hbs` | `footer.php` | Footer data from `site.json` → ACF options page |

## Section partials → ACF flexible-content layouts

Every `sections[]` entry in a page JSON is one ACF flexible-content layout.
`templates/partials/section-<type>.hbs` becomes
`template-parts/sections/<type>.php` with identical fields:

| Partial | ACF layout | Fields |
| --- | --- | --- |
| `section-hero` | `hero` | eyebrow, reo (bool), heading, lede, image, actions (repeater) |
| `section-prose` | `prose` | eyebrow, heading, html (wysiwyg), aside (group) |
| `section-media-text` | `media_text` | eyebrow, heading, html, image, flip, portrait, actions |
| `section-gallery` | `gallery` | images (gallery field + captions) |
| `section-cards` | `cards` | heading, lede, cards (repeater: title, text, link, image) |
| `section-table` | `table` | heading, caption, columns, rows (repeater) |
| `section-list` | `def_list` | items (repeater: term, text) |
| `section-quote` | `quote` | reo, text, attribution |
| `section-stats` | `stats` | stats (repeater: value, label, count) |
| `section-cta` | `cta` | eyebrow, heading, text, image, actions |
| `section-accordion` | `accordion` | items (repeater: title, html, open) |
| `section-timeline` | `timeline` | entries (repeater: year, title, html, image) |
| `section-people` | `people` | groups (repeater of repeaters: name, role, email, image) |
| `section-docs` | `docs` | docs (repeater: file, label, meta) |
| `section-embed` | `embed` | src OR embeds (repeater), tall, note |
| `section-contact-form` | `contact_form` | swap for WPForms/Gravity Forms shortcode |
| `home-*` partials | `front-page.php` sections | homepage-only ACF layouts (same fields as JSON) |

## Global data

`content/site.json` → ACF options page ("Site settings"): contact details,
addresses, socials, footer links, motto/vision. Nav arrays → two registered
menus (primary, footer).

## Assets

- `src/styles/tokens.css` is the design token source of truth — enqueue
  unchanged. All components inherit from its custom properties.
- `public/assets/crest.glb` + `src/js/crest.js` — enqueue as a module;
  the crest is one model reused at any scale.
- Fonts self-hosted in the theme (`assets/fonts`), same `@font-face` rules.
- JS entry `src/main.js` builds with Vite to a `dist/` bundle; enqueue the
  hashed output (or use `vite-for-wp`).

## Content types

- **Pages** — everything under `content/pages/**` except news.
- **Posts** — news items (the Webflow CMS collection exported empty; the news
  hub links to real documents until posts are migrated).
- **Documents** — `public/assets/docs/*.pdf` → WP media library; `section-docs`
  fields point at attachments.

## Not rebuilt (empty CMS shells in the export)

- `cocurricular/clubs.html`, `curriculum/student-assessment-and-reporting/*`
  (placeholder "Heading" pages, hidden from the live nav)
- `detail_posts.html`, `detail_vacancies.html`, `detail_community-sponsors.html`
  (Webflow CMS detail templates with no exported content — map to
  `single.php` / custom post types at migration time)
- `401.html` (Webflow password page — WP handles auth natively)
- `styleguide.html`, `rhctest/*` (Webflow internal test pages)
