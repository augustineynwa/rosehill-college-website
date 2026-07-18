# Go-live checklist — pointing rosehillcollege.school.nz at this site

Everything code-side is prepared. On cutover day, work top to bottom. Most steps
are one line. Items marked **IT/DNS** are done at your registrar/Cloudflare, not
in this repo.

## Before the switch (safe to do any time)

- [ ] **Contact form key.** Get a free Web3Forms access key: go to
      https://web3forms.com, enter `inquiries@rosehillcollege.school.nz`, and
      copy the key they email you. Paste it into `content/site.json` →
      `"web3formsKey": "<key>"`, commit. Test a real submission arrives.
- [ ] **CMS auth worker** already lists the real domain in
      `cms-auth/wrangler.toml` (`ALLOWED_ORIGINS`). Redeploy it once so that's
      live: `npx wrangler deploy --config cms-auth/wrangler.toml`.
      (No GitHub OAuth-app change needed — the callback is the worker itself.)

## DNS + domain  **(IT/DNS)**

- [ ] **Back up the current DNS zone first.** Export/screenshot every existing
      record from wherever the domain's DNS lives today.
- [ ] Add the domain to Cloudflare (or, if already there, skip). Let it scan and
      import existing records.
- [ ] **Verify these survived the import before touching nameservers** — getting
      this wrong takes down staff email:
  - [ ] `MX` records (email delivery)
  - [ ] `SPF` (`TXT` starting `v=spf1`), `DKIM`, `DMARC`
  - [ ] Any Google/Microsoft/other verification `TXT` records
  - [ ] Subdomain records (app, adult learning, etc.)
- [ ] Point nameservers to Cloudflare at the NZ registrar (or add the CNAME if
      keeping DNS elsewhere). Allow up to 24–48h propagation — pick a quiet window.
- [ ] In **Cloudflare Pages → this project → Custom domains**, add both
      `rosehillcollege.school.nz` and `www.rosehillcollege.school.nz`. Let SSL
      provision. Set one to redirect to the other (pick the canonical form).

## Flip the site to the real domain (this repo)

- [ ] `content/site.json` → `"baseUrl": "https://rosehillcollege.school.nz"`
      (use whichever of apex/www you chose as canonical). This one edit updates
      canonical tags, og:url, sitemap.xml, robots.txt **and** the CMS "View Live"
      links — they all read from `baseUrl`.
- [ ] Delete the noindex block in `public/_headers` (the two lines under
      "Preview build: keep it out of search results" — `/*` + `X-Robots-Tag:
      noindex`). **Until this is removed, Google will not index the site.**
- [ ] Update the admin URL in the staff guides (`STAFF-GUIDE.md` and
      `public/staff-guide.html`) from `rosehill-college-website.pages.dev/admin/`
      to `rosehillcollege.school.nz/admin/`.
- [ ] Commit + push. Cloudflare rebuilds (~1–2 min).

## After the switch

- [ ] Load `https://rosehillcollege.school.nz` — check it serves this site over HTTPS.
- [ ] Spot-check a few old Webflow URLs 301 to the new pages (see `public/_redirects`),
      e.g. `/our-school/introduction/principals-message` →
      `/our-school/principals-message`.
- [ ] Log into `/admin/` on the real domain and publish a trivial edit to confirm
      CMS auth works there.
- [ ] Submit the contact form for real — confirm the email arrives.
- [ ] In Google Search Console: add the domain, submit
      `https://rosehillcollege.school.nz/sitemap.xml`.
- [ ] Confirm staff email still sends and receives.

## Notes
- The `_redirects` file maps every known old Webflow URL to its new home,
  including the `/posts/*`, `/vacancies/*` and `/community-sponsors/*` collections
  (which consolidated into single pages). If any specific old URL matters, verify
  it individually.
