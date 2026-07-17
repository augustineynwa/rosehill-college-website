# Staff editing trial — Decap CMS

A trial of non-technical editing for the Rosehill College site. Editors get a
web login with labelled fields; no code, no git knowledge, no HTML.

## Try it locally (two terminals)

```bash
cd rhc-site

# terminal 1 — the CMS file backend
npm run cms          # decap-server on :8081

# terminal 2 — the site
npm run dev          # vite on :5173
```

Then open **http://localhost:5173/admin/** and click **Login** (local trial mode
needs no password). Edits write straight to `content/**.json`; the site
hot-reloads so you see the result immediately.

## What an editor can do

- **Site settings** — phone numbers, email, addresses, nav menu, footer links,
  socials. One place, changes everywhere.
- **Pages** — all 45, grouped by section. Each page is a list of blocks
  ("Hero", "Table", "Photo + text", "Call to action band"…) shown by their
  real heading, drag to reorder.
- **Photos** — pick from the existing library or upload; every photo has an
  alt-text field with a plain-English prompt.
- **Text** — a rich-text toolbar (bold, links, lists). No HTML required.

## What editors deliberately *cannot* do

This is the guardrail: **content, not layout.** The scroll choreography, design
tokens, spacing and grid are all locked in code. Editors cannot:

- create or delete pages, or change a page's URL (`layout`/`path`/`slug` are hidden)
- change colours, fonts, spacing or the homepage animation
- break responsive behaviour or accessibility structure

## How it works (and why it's safe)

Decap rewrites the whole JSON file on save, so **any field not declared in the
schema would be silently dropped**. `scripts/gen-cms-config.mjs` generates the
schema directly from the real content shape, and machine fields (`srcset`,
`pos`, `depth`, `layout`, `path`, `slug`) are declared as `hidden` so they
round-trip untouched.

Verified by a real round-trip: editing one heading through the CMS changed only
that heading — all 9 bell-time rows, the calendar facade flag, CTA buttons and
generated srcsets survived byte-for-byte.

Rich text accepts **either** HTML (how the pages were authored) or markdown
(what the editor writes) — `render.mjs` runs both through `marked`, which passes
block HTML through unchanged.

### Regenerating the schema

Run after adding pages or section types:

```bash
npm run cms:config   # rewrites public/admin/config.yml
```

## Going live (what's still to do)

The trial uses `local_backend: true`, which is local-only. For real staff use:

1. **Host the site** — Cloudflare Pages / Netlify (static; free tier is ample).
2. **Pick an auth backend** — swap `backend:` in the generated config:
   - GitHub/GitLab backend + OAuth (staff need an account on that provider), or
   - Netlify Identity / a small OAuth proxy (staff log in with email — friendlier).
3. **Remove `local_backend: true`.**
4. **Un-ignore uploaded media.** `public/assets/img/` is currently gitignored
   (the bulk export was kept out of the repo). For CMS uploads to commit and
   deploy, that needs revisiting — either track the folder or point
   `media_folder` at a tracked directory / external media store.
5. Optional: **editorial workflow** (`publish_mode: editorial_workflow`) adds a
   draft → review → publish flow via pull requests.

## Known gaps to weigh before committing

- **Uploaded photos skip the responsive pipeline.** `gen-image-variants.mjs`
  generates the resized AVIFs; a CMS upload won't have them (it'll just use the
  original). Fix: run the script in the build, or accept larger images.
- **Table rows** are edited as a list of cells — workable, but the least
  elegant part of the UI.
- **No visual preview** of the styled page inside the CMS (the preview pane is
  plain). Fixable with a custom preview template if it matters.
