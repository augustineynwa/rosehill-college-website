# Deploying — Cloudflare Pages

**Live preview:** https://rosehill-college-website.pages.dev

## The deploy is a git push

The primary way to deploy is simply:

```bash
git add -A && git commit -m "…" && git push
```

The `rosehill-college-website` Pages project is connected to this repo and
**auto-builds and publishes every push to `main`** (live in ~1 minute). No
wrangler command needed. See `EDITING.md` for the day-to-day workflow.

Target for now: **a preview URL only** (`*.pages.dev`). Nothing points at the
live `rosehillcollege.school.nz`, and the preview is `noindex` so it can't turn
up in search results while it's being reviewed.

> **Heads-up — two Pages projects exist.** `rosehill-college-website` (git
> auto-deploy, the canonical one above) and `rosehill-college` (direct upload via
> `npm run deploy`). They drift apart because only one updates at a time. Pick one
> and retire the other before go-live; the git-connected project is the keeper.
> Until then, prefer the git push — `npm run deploy` publishes to a *different*
> URL (`rosehill-college.pages.dev`).

## One-time: authorise Cloudflare

Deploying needs your Cloudflare account. Run this yourself (it opens a browser
and asks you to click **Allow**):

```bash
cd rhc-site
npx wrangler login
```

Then confirm:

```bash
npx wrangler whoami
```

## Manual deploy (fallback)

You normally never need this — a `git push` deploys. But to publish straight from
your machine without a commit:

```bash
npm run deploy
```

That runs `build:deploy` (build + strip `/admin`) and pushes `dist/` to a
Cloudflare Pages project called **rosehill-college** — note this is the *second*
project, at `https://rosehill-college.pages.dev`, not the canonical
`rosehill-college-website.pages.dev`. Requires `npx wrangler login` first (see
below).

## What the build does

| Step | Why |
| --- | --- |
| `gen-image-variants.mjs` | Generates resized variants + srcsets for any image over 120KB, including new CMS uploads (jpg/png/webp/avif). |
| `gen-cms-config.mjs` | Regenerates the CMS schema from the current content so it can't drift. |
| `render.mjs` | Renders `content/` + `templates/` → 45 static pages. |
| `vite build` | Bundles JS/CSS, fingerprints assets. |
| `inline-css.mjs` | Inlines critical CSS (removes a render-blocking round-trip). |
| `strip-admin.mjs` | Removes `/admin` from the public build — the CMS is local-only until an auth backend is chosen. |

Output: ~103 MB, 741 files, largest file 6.8 MB — all well inside Cloudflare
Pages' limits (20,000 files, 25 MiB/file).

## Continuous deploys — already set up

The `rosehill-college-website` project is already wired to this repo with:

- **Build command:** `npm run build:deploy`
- **Output directory:** `dist`
- **Node version:** 20 or later

So every push to `main` deploys automatically. This is also the prerequisite for
staff CMS edits publishing themselves once the CMS auth backend is enabled.

## Still to do before this is the real site

1. **CMS login (Gap 1)** — deliberately deferred. `/admin` is stripped from the
   public build, so staff editing is local-only right now. To enable it:
   - pick an auth backend (GitHub OAuth, or an identity service for email logins),
   - set `backend:` and `local_backend: false` in `scripts/gen-cms-config.mjs`,
   - remove `strip-admin.mjs` from the `build:deploy` script,
   - connect continuous deploys so published edits rebuild the site.
2. **Custom domain** — only when you're ready. Adding
   `new.rosehillcollege.school.nz` needs a DNS record; replacing the live site
   is a separate, deliberate decision.
3. **Remove the `noindex`** header block in `public/_headers` when it goes live —
   otherwise Google will ignore the site.
