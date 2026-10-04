# Project handoff — Rosehill College website

_Written 2026-10-04, moving this project from Windows to Jack's always-on Mac mini._

## What this is

The Rosehill College public website (https://www.rosehillcollege.school.nz).
Static site: **Vite + Handlebars**. Page content is authored as JSON in
`content/`, rendered to static HTML by `scripts/render.mjs`, bundled by Vite,
and deployed to **Cloudflare Pages**. Staff edit via **Decap CMS** at `/admin/`
(GitHub login), which commits straight back to the repo.

## Source of truth

**GitHub: `github.com/augustineynwa/rosehill-college-website` (branch `main`).**
This repo is authoritative — everything flows from it. `git push` to `main`
auto-deploys the live site via Cloudflare Pages. Staff CMS publishes also commit
here. The local Windows working copy is disposable.

## Current state (nothing in progress)

All work is committed and live; there is **no half-finished work** to wrap up.
Most recent change: the Staff Vacancies page was flipped to pull live from the
Pātaka careers feed (2026-10-01, commit de5d358) — verified live.

The Windows local copy may sit a commit or two behind `origin/main` because
staff publish via the CMS. **Don't worry about local state — clone fresh from
GitHub on the Mac** (see below); that is always current.

## Getting it running on the Mac (clone fresh — do NOT copy the folder)

```bash
git clone https://github.com/augustineynwa/rosehill-college-website.git
cd rosehill-college-website
npm install        # Node 22 (see .node-version)
npm run dev        # render + Vite dev server
```

- **Do not copy `node_modules/`** from Windows — `sharp` (image optimisation)
  ships OS-specific native binaries; `npm install` on macOS fetches the right
  ones. It's gitignored anyway.
- **Do not copy the whole working folder.** It is ~1.2 GB, mostly `.git`
  (~517 MB of baked-image history) and `node_modules` (~75 MB). A `git clone`
  brings the real thing; `npm install` rebuilds the rest.

## Deploying

- **Normal deploy = `git push origin main`.** Cloudflare Pages rebuilds and goes
  live in 1–2 min. That's the only deploy step you need day to day.
- `npm run deploy` exists but targets a **secondary** Pages project
  (`rosehill-college`) via `wrangler` — legacy, rarely used. Ignore unless
  you specifically need it.
- Commits carry **no AI/Co-Authored-By trailer** (house rule).
- **Pull before you push** — staff are actively publishing via the CMS.

## Build pipeline (what `npm run build` does — Cloudflare runs this)

`optimize-images → gen-image-variants → gen-cms-config → render → vite build → inline-css`

- Images are "baked": optimised AVIFs + responsive variants are committed to
  git so Cloudflare's build doesn't re-process them (a `.github` Action keeps
  them baked on every push). This is what prevents the 20-min build timeout.
- `public/admin/config.yml` is **generated** by `scripts/gen-cms-config.mjs` —
  edit that generator, never the yml directly.

## Windows-only things to port: NONE

Checked: no `.cmd`/`.ps1`/`.bat` scripts, no hard-coded `C:\` paths, scripts use
`__dirname`/`path.join` throughout. Everything is portable Node. Nothing to
rewrite for macOS.

## What's needed OUTSIDE this repo

- **Node 22** installed on the Mac.
- **GitHub push access** to `augustineynwa/rosehill-college-website` (git
  credential / SSH key on the Mac).
- **Cloudflare auth** (`npx wrangler login`) — ONLY if you redeploy the CMS auth
  worker (`cms-auth/`) or use the legacy `npm run deploy`. Not needed for normal
  git-push deploys.
- **No secret files to move.** There are no local `.env`/`.dev.vars` files. The
  `cms-auth` worker's secrets (GitHub OAuth app) live in Cloudflare, not on disk.
- **Claude's project memory** (`~/.claude/projects/<this project>/memory/`) is
  separate from this repo — it's Claude's, and travels with the conversation
  move, not with the website. Not a website dependency.

## Parked / next steps (all waiting on Jack or a third party)

- **Course Info 2027 PDFs** — Lisa shared Year 9/10/11 finals (Google Drive) to
  replace the live copies in `public/assets/docs/`. Not done: pending Jack's
  choice of CMS-upload vs repo-drop (binary transfer from Drive can't be done
  reliably by the assistant).
- **FlipHTML5 PDF viewer** — decide whether to drop the subscription (renews
  Oct 2026) and self-host a flipbook, or use Loong's one-off tool. Pending Jack.
- **"Show image in full" toggle for posts** — offered, not built. Would let
  staff flag a flyer/poster feature image as "contain" (don't crop) themselves.
- **HOD Food Tech vacancy** — closing date shows 2027-10-13 (likely a typo);
  flagged to Pātaka to fix at source (the feed drives that page now).
- **Governance** — repo lives on the personal `augustineynwa` GitHub account;
  consider transferring to a Rosehill-owned GitHub org for long-term safety.

## Orientation

Read `~/.claude/.../memory/MEMORY.md` first — it indexes the non-obvious
decisions (why the site ignores reduced-motion, why the notice banner is
homepage-only, the build-timeout bake fix, the vacancies feed, etc.). Other
in-repo docs: `README.md`, `DEPLOY.md`, `STAFF-GUIDE.md`, `EDITING.md`.
