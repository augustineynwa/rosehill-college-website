# Governance migration — moving the website off personal accounts

_Plan written 2026-11-05. Nothing in this document has been done. No file other
than this one was changed, nothing was committed, nothing was pushed._

The website currently depends on one person's personal accounts in three
separate places. This plan moves all three to school-owned control without
breaking Loong's ability to publish for more than a short, scheduled window.

## 1. Three ownership problems, not one

| # | Problem | Owned today by | Moves how |
| --- | --- | --- | --- |
| A | GitHub repository | personal user `augustineynwa` | repo transfer into a new school org |
| B | Cloudflare account holding the Pages project and the `rhc-cms-auth` Worker | very likely personal (`fusion-588.workers.dev` subdomain) | new school account, Worker redeployed, Pages project recreated |
| C | GitHub OAuth app behind `GITHUB_CLIENT_ID = Ov23lilGm7jL4pXVGl1G` | personal user account | transferred to the org, or recreated there |

These are independent. A GitHub repo transfer does not touch B or C. Treating
them as one move is how this goes wrong.

### Established starting facts

- `augustineynwa` belongs to no GitHub organisation. A school org does not exist
  yet and has to be created.
- Repo collaborators: `augustineynwa` (admin), `mchau-rhc`, `jherst1963`
  (neither admin). Loong (`mchau-rhc`) is the main editor, 33 CMS commits. He
  signs his email M C Loong and uses he/him.
- The school estate is Microsoft-centric: on-premises Active Directory
  (`internal.rosehill-college.co.nz`, two domain controllers), Windows servers,
  IIS, school mail on `rosehillcollege.school.nz`. This plan assumes Microsoft
  365 / Entra ID.

## 2. Every coupling a move would break

Found by searching the repository, with file and line.

### Breaks on a GitHub ownership change

| What | Where | Effect |
| --- | --- | --- |
| CMS backend repo slug | `scripts/gen-cms-config.mjs:413` — `repo: 'augustineynwa/rosehill-college-website'` | Decap commits to the old path. Code change required. |
| Generated, committed CMS config | `public/admin/config.yml:3` | Tracked in git, not ignored. The deployed `/admin` reads this file, so it serves the old slug until the next build regenerates it. |
| Target branch | `scripts/gen-cms-config.mjs:414` — `branch: 'main'` | Unaffected unless the branch is renamed. Do not rename it during this work. |
| Actions workflow trigger | `.github/workflows/optimise-images.yml:19` — `branches: [main]` | Unaffected by transfer. Org default workflow permissions are the risk, see below. |
| Actions write permission | `.github/workflows/optimise-images.yml:25-26` — `permissions: contents: write` | The bot pushes to `main` using the built-in `GITHUB_TOKEN` (comment at line 12). No repository secret exists, so there is nothing to re-create, but a new org that defaults Actions tokens to read-only silently breaks image baking. |
| Docs naming the personal path | `HANDOFF.md:15`, `HANDOFF.md:33`, `HANDOFF.md:75`, `HANDOFF.md:98`, `EDITING.md:14`, `EDITING.md:20` | Wrong after transfer. |
| Local git remotes | `origin = https://github.com/augustineynwa/rosehill-college-website` on each of Jack's machines | GitHub keeps a redirect, so pushes keep working, but update them. |

### Breaks on a Cloudflare ownership change

| What | Where | Effect |
| --- | --- | --- |
| CMS auth endpoint | `scripts/gen-cms-config.mjs:417` — `base_url: 'https://rhc-cms-auth.fusion-588.workers.dev'` | The `fusion-588` part is the account's workers.dev subdomain. A new account gives a new subdomain, so this string changes. |
| Same value, committed | `public/admin/config.yml:5` | Served to the browser until the next build. |
| Worker name and workers.dev flag | `cms-auth/wrangler.toml:1`, `cms-auth/wrangler.toml:4` | Name carries over on redeploy. The subdomain does not. |
| `GITHUB_CLIENT_SECRET` | Not in the repo. Documented at `cms-auth/wrangler.toml:13-14` | A Cloudflare secret, scoped to the account. Does not travel. Must be re-put on the new account. |
| Legacy second Pages project | `package.json:16` — `wrangler pages deploy dist --project-name rosehill-college` | Deploys to whichever account `wrangler` is logged into. A drift hazard today and during the move. |

### Not affected by either move

Worth stating, so time is not spent on them.

- `public/_redirects` — path to path only, no hostnames. Ships inside `dist`, so
  Cloudflare Pages picks it up wherever the project lives.
- `public/_headers` — no hostnames.
- `content/site.json:309` — `baseUrl: "https://www.rosehillcollege.school.nz"`.
  Tied to the public domain, not to account ownership. Drives canonical tags,
  `og:url`, the sitemap, `robots.txt` and the CMS "View Live" link via
  `scripts/gen-cms-config.mjs:26`. Only changes if the canonical host changes.
- `public/robots.txt` and `public/sitemap.xml` — both generated from `baseUrl`
  by `scripts/render.mjs:345-357` and both tracked in git. No manual edit needed.
  Note the committed copies are already stale: `public/robots.txt:4` and
  `public/sitemap.xml` say apex `rosehillcollege.school.nz` while
  `content/site.json:309` says `www.`. The next build corrects both.
- `cms-auth/wrangler.toml:11` — `ALLOWED_ORIGINS` already lists the apex, `www.`
  and the `rosehill-college-website.pages.dev` preview. No change needed if the
  public domain stays the same. Add an entry only if a new preview URL has to
  serve `/admin`.
- Staff-facing admin URL — `STAFF-GUIDE.md:29`,
  `public/staff-guide.html:181`, `public/staff-guide.html:207`. Already on the
  live domain.
- The four Web3Forms keys (`content/site.json:283`, `:297`, `:308`, `:328`).
  Client-side form keys tied to a Web3Forms account, not to GitHub or
  Cloudflare. Separate from this migration, but the same ownership question
  applies and should be raised later.

## 3. What a GitHub repo transfer does and does not carry

This determines the whole order of operations.

**Carried by the transfer**

- Full git history, all branches and tags
- Issues, pull requests, releases, stars, watchers
- Workflow files, because they are ordinary files in the repository
- A redirect from the old `augustineynwa/rosehill-college-website` path for both
  git and the web, so existing clones keep fetching and pushing

**Not carried**

- **Collaborators.** Outside collaborators are dropped when a repo moves into an
  organisation. `mchau-rhc` and `jherst1963` lose access the moment the transfer
  completes. This is the single biggest staff-impact risk in the plan.
- **Actions secrets and variables.** None exist here, so nothing is lost. The
  built-in `GITHUB_TOKEN` is reissued automatically.
- **Actions default permissions.** Governed by org and repo settings, not by the
  workflow file. A new org set to read-only tokens breaks the bot push at
  `.github/workflows/optimise-images.yml:25`.
- **The Cloudflare Pages GitHub App installation.** Pages connects through the
  Cloudflare GitHub App installed on the `augustineynwa` account. That
  installation does not follow the repo into an org. The build connection
  breaks and must be re-authorised against the org.
- **The OAuth app.** A separate object owned by the user account. Transferring
  the repo does nothing to it.
- Branch protection rules transfer, but org-level rulesets can override them.

Cloudflare, separately, **cannot transfer a Pages project between accounts**. A
new project has to be created in the school account and pointed at the org repo.

## 4. The OAuth app

`GITHUB_CLIENT_ID = "Ov23lilGm7jL4pXVGl1G"` at `cms-auth/wrangler.toml:7`.

**Preferred path: transfer it.** GitHub OAuth apps can be transferred to an
organisation from the app's own settings page (Settings, Developer settings,
OAuth Apps, the app, Transfer ownership). A transfer preserves both the client ID
and the client secret, so no file in this repository changes and the Worker keeps
working. Try this first.

**Fallback: recreate it in the org.** This changes the client ID, and the
following has to happen in this order:

1. Create the OAuth app in the org. Homepage URL is the live site. The
   authorization callback URL must be `https://<worker-host>/callback`, because
   the Worker builds `redirect_uri` from its own origin
   (`cms-auth/src/index.js`, `redirect_uri` set to `${url.origin}/callback`).
2. Update `cms-auth/wrangler.toml:7` with the new client ID.
3. Put the new secret against the new Cloudflare account:
   `npx wrangler secret put GITHUB_CLIENT_SECRET --config cms-auth/wrangler.toml`
4. Redeploy the Worker.
5. If the Worker host changed, update `scripts/gen-cms-config.mjs:417` and
   rebuild, so `public/admin/config.yml:5` regenerates.
6. Staff sign out and sign in again at `/admin`. Tokens issued by the old app
   stop working.

**The ordering trap.** The callback URL depends on the Worker's final hostname,
and the hostname depends on which Cloudflare account hosts the Worker. So
Cloudflare must be settled before the OAuth app is finalised, or the callback has
to be edited twice. This is why Phase 1 below is Cloudflare, not GitHub.

## 5. Identity: what is realistic on a school budget

The school has a Microsoft-centric tenant. That shapes the mailboxes, not the
GitHub plan, because of one hard constraint:

> **GitHub does not federate with Entra ID on the Free or Team plans.** SAML
> single sign-on and SCIM provisioning require **GitHub Enterprise Cloud**, a
> per-user paid product. This plan is deliberately **not** built around SSO.

Nothing the website does today needs Enterprise Cloud. The repository is public,
so **GitHub Free for organisations covers it**: unlimited public repositories,
free Actions minutes on public repositories, and org-level 2FA enforcement.
Recommend Free, and revisit only if the school later wants managed identities.

The realistic shape, where **control follows the mailbox**:

- GitHub accounts registered against school-controlled
  `@rosehillcollege.school.nz` mailboxes. The school owns the mailbox in its
  tenant, so the school can recover the account. A personal mailbox means the
  school cannot.
- An organisation with **at least two owners**, so this does not become a
  single-person dependency again.
- **2FA required at org level**, enabled only after members have 2FA on, see the
  warning in Phase 2.
- `mchau-rhc` and `jherst1963` re-added at the least privilege that still lets
  them publish. Decap commits to `main` through the GitHub API **as the
  signed-in user**, so the minimum workable role is **Write** on the repository.
  Read and Triage are not enough. Put them in a team (for example
  `website-editors`) holding Write on this repository only, rather than widening
  org-wide member defaults.

Same reasoning for Cloudflare: account membership is email-based, so the account
holding Pages and the Worker should sit on a school mailbox with **more than one
Super Administrator**. Cloudflare's SSO is also a paid tier, so the same
mailbox-based approach applies.

**Where the identity choice changes a step:** if the school turns out to be on
Google Workspace rather than Microsoft 365, nothing in this plan changes except
which admin console issues the mailboxes. If the school later buys Enterprise
Cloud, accounts created on school mailboxes can be linked to Entra identities
through SCIM. Accounts created on personal mailboxes close that door.

## 6. Order of operations

### Phase 0 — build the destination (no user-visible change)

1. Jack answers the open questions in section 9.
2. Create the school mailboxes in Microsoft 365, including a shared mailbox for
   the org-owner account so it does not belong to one individual.
3. Create the GitHub user accounts on those mailboxes. Enable 2FA on each
   immediately.
4. Create the GitHub organisation. Name it for the school, not a person. Add the
   second owner. **Do not** enable 2FA enforcement yet.
5. Create the school-owned Cloudflare account on a school mailbox. Add the second
   Super Administrator.

Nothing has moved. The live site and the CMS are untouched throughout.

### Phase 1 — Cloudflare first, deliberately

Cloudflare goes first because the Worker hostname feeds the OAuth callback and
the CMS config. GitHub first would force a second edit of both.

1. On the new Cloudflare account, deploy the Worker from `cms-auth/`. Record the
   new hostname.
2. **Better than a workers.dev subdomain:** give the Worker a stable custom route
   under the school domain, for example `cms-auth.rosehillcollege.school.nz`.
   That removes an account-specific hostname from the codebase permanently, so a
   future account move costs no code change. Needs the DNS zone in that account.
3. Put `GITHUB_CLIENT_SECRET` on the new Worker, still using the **old** client
   ID, so sign-in keeps working against the existing OAuth app.
4. Settle the DNS zone. If `rosehillcollege.school.nz` sits in the personal
   Cloudflare account, it has to move. Cloudflare supports moving a zone between
   accounts, but SSL re-provisions and the zone is re-verified. **Export and
   verify every record first** — MX, SPF, DKIM, DMARC and all verification TXT
   records. Staff email lives on this zone. This discipline is the one genuinely
   useful part of the existing `GOLIVE.md`.
5. Do not point the live domain at a new Pages project yet.

Rollback: the existing Worker and Pages project are still serving. Delete the new
Worker.

### Phase 2 — the GitHub transfer, the short staff-impact window

Do steps 2 through 10 in **one sitting, outside school hours**.

1. Tell Loong and `jherst1963` not to publish during the agreed window.
2. Check the Actions tab and wait for any in-flight `Auto-optimise uploaded
   images` run to finish. That workflow pushes to `main`, and a transfer
   mid-run loses the push.
3. Transfer the repository from `augustineynwa` into the org.
4. **Immediately** re-invite `mchau-rhc` and `jherst1963` with Write, through the
   editors team. The transfer dropped them.
5. In org settings, allow write for Actions workflow tokens on this repository,
   or the image-baking bot fails on its push.
6. Install the Cloudflare GitHub App on the org and create a **new** Pages
   project in the school Cloudflare account pointing at the org repository.
   Build command `npm run build:deploy`, output directory `dist`, Node 22.
   (Worth aligning while here: `.node-version` says 22, `DEPLOY.md` says 20 or
   later, and `.github/workflows/optimise-images.yml:41` pins 20.)
7. Verify a build succeeds and the new preview URL serves the site correctly
   **before** touching the live domain.
8. Move the custom domains `rosehillcollege.school.nz` and
   `www.rosehillcollege.school.nz` onto the new Pages project. This is the only
   moment the public site is at risk. Keep it brief.
9. Transfer the OAuth app to the org, or recreate it per section 4.
10. Have Loong sign in at `/admin` and publish one trivial edit. That single
    test exercises the whole chain: OAuth app, Worker, GitHub write access,
    Actions bot, Pages build.
11. **Only now** enable org-level 2FA enforcement, after confirming both editors
    have 2FA on their accounts.

### Phase 3 — code and docs, once the chain is proven

1. `scripts/gen-cms-config.mjs:413` — new org slug.
2. `scripts/gen-cms-config.mjs:417` — new Worker hostname, if it changed.
3. `cms-auth/wrangler.toml:7` and `:11` — new client ID and any new origin.
4. Retire the legacy second Pages project: drop or repoint the `deploy` script at
   `package.json:16`, then delete the `rosehill-college` project in Cloudflare so
   the two cannot drift. Check nothing links to `rosehill-college.pages.dev`
   first.
5. Update `HANDOFF.md:15`, `:33`, `:75` and `EDITING.md:14`, `:20` to the org
   slug. Delete the governance bullet at `HANDOFF.md:98`, now resolved.
6. Update the git remote on each of Jack's machines.
7. One commit to `main`, which rebuilds and regenerates
   `public/admin/config.yml` with the new values.

**Important window:** between Phase 2 step 3 and Phase 3 step 7, the deployed
`/admin` is still serving the committed `public/admin/config.yml:3`, naming the
old repository path. GitHub's post-transfer redirect usually carries the API call
through, but do not rely on it. Treat that whole span as CMS-closed and finish it
in one session.

## 7. Staff impact: what Loong actually sees

| Moment | What he sees |
| --- | --- |
| Before Phase 2 step 3 | Normal. |
| Between steps 3 and 4 | `/admin` loads and he signs in, but every save fails on permissions. He has no way to distinguish this from the site being broken. This is why step 4 is immediate, not next morning. |
| Between step 3 and Phase 3 step 7 | The deployed CMS config still names the old repository. Saves may pass through the redirect or may fail. Do not leave this open. |
| If the OAuth app is recreated | His browser token is invalid. He is returned to the login screen, and sign-in fails until the Worker holds the matching client ID and secret. Warn him in advance that he will click "Login with GitHub" and re-authorise once. |
| At step 8 | Short public outage risk on the website. Not a CMS issue. |
| At step 11 | If he has not enabled 2FA, enforcement removes him from the org and publishing stops **silently**. Confirm his 2FA before enabling. |

**Keeping the window short:** Phase 0 and Phase 1 are invisible to staff and can
be done days ahead at leisure. Only Phase 2 steps 2 to 10 touch him. With the
destination already built, that is realistically one to two hours. Book it
outside school hours, tell him beforehand, and use the step 10 test publish as
the all-clear message back to him.

## 8. Rollback for each irreversible step

| Step | Reversible | How to roll back |
| --- | --- | --- |
| Org creation (0.4) | Yes | Delete the org while it owns nothing. |
| Repo transfer (2.3) | Yes, with care | The org owner transfers it back to `augustineynwa`. History, issues and PRs survive. Collaborators drop again on the return trip, so re-add them. **Do not create a new repository at the old name during the window** — that permanently breaks the redirect. |
| Collaborators dropped (side effect of 2.3) | Yes | Re-invite. The invite goes to the account's email, so confirm both editors' GitHub account addresses **before** the window. |
| Cloudflare GitHub App re-install (2.6) | Yes | Re-install on the personal account and reconnect the old project. |
| New Pages project (2.6) | Yes | Delete it. The old project is untouched and still building. |
| Custom domain move (2.8) | Yes | Remove the domain from the new project, re-add it to the old one. SSL re-provisions on each flip, so expect a few minutes of certificate errors each way. Do it once, deliberately, rather than testing back and forth. |
| DNS zone move between accounts (1.4) | Risky, partly irreversible in practice | The zone moves back, but records do not travel with it and SSL re-provisions. A missed MX or SPF record takes down staff email. Mitigation: full zone export beforehand, record-by-record verification after, and **do not** change registrar nameservers in the same sitting. |
| OAuth app transfer (2.9) | Yes | Transfer it back. Client ID and secret are preserved, so no code changes either way. |
| OAuth app recreation (2.9 fallback) | Yes, while the old app survives | Restore the old client ID at `cms-auth/wrangler.toml:7`, re-put the old secret, redeploy. **Keep the old app until the new one is proven**, then delete it. |
| Org 2FA enforcement (2.11) | Yes, but not silent-safe | Turn it off, then re-invite anyone it removed. Confirm 2FA on both editor accounts first. |
| Deleting the legacy `rosehill-college` Pages project (3.4) | Effectively irreversible | It serves no traffic and holds only build output. Confirm nothing links to `rosehill-college.pages.dev`, then delete. |

## 9. Open questions only Jack can answer

1. Does the Microsoft 365 tenant allow shared or resource mailboxes for service
   identities, and does IT policy permit GitHub accounts registered against them?
   Control follows the mailbox, so this is the foundation of the whole plan.
2. **Who is the second GitHub org owner, and the second Cloudflare Super
   Administrator?** Naming two people is the entire point of this work. Suggest
   Jack plus a senior leader or deputy with IT oversight, rather than another
   technical single point of failure.
3. Microsoft 365 / Entra ID as assumed? If Google Workspace instead, only the
   mailbox-issuing console changes.
4. Does the school want GitHub Enterprise Cloud for Entra SSO and SCIM? It is a
   per-user paid product and nothing the site does today needs it.
   **Recommendation: no for now.** Creating accounts on school mailboxes keeps
   the option open.
5. Who owns the Cloudflare account holding the Pages project and the Worker, and
   is the `rosehillcollege.school.nz` DNS zone in that same account or elsewhere?
   This decides whether Phase 1 step 4 is a zone move or a no-op.
6. Give the Worker a stable custom route under the school domain instead of a
   `workers.dev` subdomain? **Recommended.** One DNS record now removes an
   account-specific hostname from `scripts/gen-cms-config.mjs:417` for good.
7. Canonical host: apex or `www.`? `content/site.json:309` says `www.`, while the
   committed `public/robots.txt:4` and `public/sitemap.xml` still say apex. One
   is stale. Worth settling during this work.
8. Do `mchau-rhc` (Loong) and `jherst1963` have 2FA enabled on GitHub today?
   Needed
   before Phase 2 step 11.
9. Is the repository meant to stay public? Public keeps GitHub Free sufficient
   and keeps Actions minutes free.
10. Full school name or an abbreviation for the org slug? It lands in
    `scripts/gen-cms-config.mjs:413` and in the staff-facing docs.
11. Separate but related: who owns the Web3Forms account behind the four keys at
    `content/site.json:283`, `:297`, `:308`, `:328`? Same personal-dependency
    question, out of scope here. The FlipHTML5 subscription is the same shape of
    problem and is now live: it auto-renewed on 29 October 2026 and a partial
    refund is on the table. It carries two embeds, not one, and the yearbooks
    exist nowhere else. See the note at the end of this file.

## 10. What this plan supersedes in the existing docs

`DEPLOY.md`, `GOLIVE.md` and `HANDOFF.md` already disagree with reality, before
this migration adds anything.

- **`HANDOFF.md:98`** — the governance bullet ("consider transferring to a
  Rosehill-owned GitHub org") is replaced by this document.
- **`HANDOFF.md:15`, `:33`, `:75` and `EDITING.md:14`, `:20`** — the personal
  repository path becomes wrong at Phase 2 step 3.
- **`DEPLOY.md`** — substantially stale now. It describes a preview-only site
  with `/admin` removed by `strip-admin.mjs` and a `noindex` header to delete.
  None of that holds: `strip-admin.mjs` appears in no npm script,
  `public/_headers` contains no `noindex` block, and `public/robots.txt` allows
  all crawlers. Its whole "Still to do before this is the real site" section is
  obsolete. Its two-Pages-project warning **is** still accurate and is carried
  into Phase 3 step 4.
- **`GOLIVE.md`** — a cutover checklist for a cutover already completed. Its
  first item asks for a Web3Forms key already set at `content/site.json:283`.
  Its instruction to delete a `noindex` block refers to lines that do not exist.
  Its `baseUrl` step is done. Its staff-guide URL step is done
  (`STAFF-GUIDE.md:29`). The only part still worth keeping is the DNS backup
  discipline, carried into Phase 1 step 4.
- **`CMS-TRIAL.md:70` and `:74-80`** — describes staff login as deferred and
  `/admin` as local-only. The CMS is live on GitHub OAuth. Stale.
- **Node version disagreement** — `.node-version` says 22, `DEPLOY.md` says 20 or
  later, `.github/workflows/optimise-images.yml:41` pins 20. Align during
  Phase 2 step 6.

**Recommendation after the migration:** fold `DEPLOY.md`, `GOLIVE.md` and
`CMS-TRIAL.md` into one current "how this is built and deployed" document, and
keep `HANDOFF.md` as the machine-setup note it is.

## 11. Note: the FlipHTML5 subscription, as of 2026-11-09

Not part of the governance migration, recorded here because it is the same
single-supplier dependency and a decision is pending.

The site has **two** FlipHTML5 embeds, both loading the third-party iframe
directly with no click-to-load facade:

- `content/pages/join-us/prospectus.json:18` — one book,
  `online.fliphtml5.com/snsln/Prospectus-2026/`
- `content/pages/our-school/yearbook.json:23` — a **bookcase**,
  `fliphtml5.com/bookcase/sexgj/`, holding multiple yearbooks

**The exposure:** no yearbook PDF exists anywhere in this repository. The
bookcase is the only copy the website points at. The prospectus is safer, its
source PDF is committed at `public/assets/docs/Rosehill-College-Prospectus-2026.pdf`
(5.4 MB), currently unreferenced because the embed replaced the direct link.

**Before any downgrade or cancellation:** export every book out of FlipHTML5,
the full yearbook back-catalogue included. A free tier can impose book and page
limits, and the bookcase view is itself a paid feature, so a downgrade risks
losing more than it adds ads to.

**On the ads:** both embeds load automatically, so free-tier ads would render on
the prospectus page, which links straight to "Enrol now", and on the yearbook
page that students and families use. Ad content would not be under the school's
control.

**Replacement shape, if wanted:** the repository already has a `docs` section
type and `templates/partials/doc-list.hbs` for linking PDFs, which needs no
third-party service and no new dependency. A self-hosted flipbook library would
cut against this site's performance posture. Note that committing large yearbook
PDFs would worsen the repository weight problem, so consider hosting them in
Cloudflare R2 rather than in git.

`HANDOFF.md:92-93` records this as parked and mentions a one-off tool Loong
has built. Worth asking him what it does before building anything.
