# Editing the site — developer guide

Pure code. No CMS, no AI tools required. You edit files, push to `main`, and
Cloudflare rebuilds and publishes automatically in about a minute.

If you'd rather edit content through a web UI, there's a CMS too — see
`STAFF-GUIDE.md`. This guide is for working directly in the code.

## Prerequisites

- **Node.js 24** (the version is pinned in `.node-version`; if you use `nvm`,
  run `nvm use`).
- **Git**, plus write access to the repo:
  `github.com/augustineynwa/rosehill-college-website`.
- An editor — VS Code recommended.

## First-time setup

```bash
git clone https://github.com/augustineynwa/rosehill-college-website.git
cd rosehill-college-website
npm install
npm run dev
```

`npm run dev` renders the pages and starts a local server at
**http://localhost:5173**. Leave it running — it watches `content/` and
`templates/` and re-renders automatically when you save.

## The everyday loop

1. Edit a file (see **Where things live** below).
2. Save — the dev server re-renders and the browser updates.
3. When it looks right, ship it:
   ```bash
   git add -A
   git commit -m "Short description of what changed"
   git push
   ```
4. Cloudflare auto-builds and publishes to
   **https://rosehill-college-website.pages.dev** within ~1 minute.

That's the whole deployment story. No wrangler command, no manual build — a push
to `main` is the deploy.

## Where things live

| You want to change… | Edit… |
| --- | --- |
| Wording or images on a page | `content/pages/**/*.json` (the matching page) |
| The nav menu, contact details, footer | `content/site.json` |
| A page-section's layout/markup | `templates/partials/section-*.hbs` |
| Header / footer | `templates/partials/header.hbs`, `footer.hbs` |
| Colours, spacing, fonts | `src/styles/tokens.css` |
| Other styling | `src/styles/components.css`, `home.css` |
| Behaviour / animations | `src/js/*.js` |
| Images, video, PDFs, fonts | `public/assets/` |

Deeper reference: **`README.md`** (architecture + build pipeline) and
**`PAGE_SPEC.md`** (the content/section JSON schema — what fields each section
type accepts).

## Common edits

- **Change text on a page** — open that page's file in `content/pages/…` and edit
  the section's `heading` / `html` / `text`.
- **Add or reorder a menu item** — `content/site.json`, the `nav` array. The mega
  menus use `groups[]` (and `subgroups[]`, `cards[]`); existing entries are the
  best template to copy.
- **Change a colour or spacing** — `src/styles/tokens.css` (single source of truth;
  everything references these variables).
- **Add a new page** — create `content/pages/<folder>/<slug>.json` (copy an
  existing page as a starting point) and add a link to it in `content/site.json`.
  The build turns it into `<folder>/<slug>.html` automatically.

## Before you push

```bash
node scripts/check.mjs
```

Validates every rendered page: images exist, internal links resolve, alt text is
present. Fix anything it flags before pushing.

## Gotchas

- **Content is JSON.** A stray trailing comma or an unescaped quote will break the
  build. The dev server surfaces the error immediately — keep it running.
- **Don't hand-edit the generated files.** The top-level `*.html` files and
  everything in `dist/` are output from `npm run render` / `npm run build`. Edit
  `content/` and `templates/` instead; the HTML regenerates.
- **Big images are handled for you.** Drop originals in `public/assets/img`; the
  build auto-generates responsive AVIF variants for anything over ~120 KB.
- **Keep commit messages plain** — short and descriptive, no tooling credit lines.
- **`main` is production.** A push to `main` goes live. For anything risky, work on
  a branch and open a PR first (branch pushes get their own preview URL).
