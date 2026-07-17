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

## Status of the three gaps

| Gap | Status |
| --- | --- |
| **1. Auth / staff login** | **Deferred by choice.** `/admin` is stripped from the public build (`strip-admin.mjs`), so the CMS is local-only. See DEPLOY.md for how to enable it. |
| **2. Uploads skipped the image pipeline** | **Closed.** `gen-image-variants.mjs` now handles jpg/png/webp/avif and runs as the first step of `npm run build`. Verified: a 619KB / 3000px upload produced 500/800/1080/1600 variants + srcset automatically. Variants are written in the *same format* as the source — emitting avif next to a jpg `src` would break browsers without avif support, since srcset does no format negotiation. |
| **3. Media was gitignored** | **Closed.** `public/assets/**` is now tracked (~100MB / ~690 files, well inside Cloudflare Pages' 20,000-file / 25MiB-per-file limits). 30MB of unreferenced video from the Webflow export was pruned. |

## Enabling staff login later

1. Pick an auth backend and set `backend:` + `local_backend: false` in
   `scripts/gen-cms-config.mjs`:
   - GitHub/GitLab OAuth (staff need an account on that provider), or
   - an identity service for plain email logins (friendlier for non-technical staff).
2. Remove `strip-admin.mjs` from the `build:deploy` script.
3. Connect continuous deploys so a published edit rebuilds the site.
4. Optional: `publish_mode: editorial_workflow` adds draft → review → publish.

## Remaining rough edges

- **Table rows** are edited as a list of cells — workable, but the least
  elegant part of the UI.
- **No visual preview** of the styled page inside the CMS (the preview pane is
  plain). Fixable with a custom preview template if it matters.
