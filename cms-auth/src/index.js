/**
 * Decap CMS ↔ GitHub OAuth proxy.
 *
 * Decap's GitHub backend needs an authorization-code exchange, which requires
 * the OAuth client secret. That can't live in the browser, so this Worker does
 * the exchange server-side and hands the token back to the CMS window.
 *
 * Flow:
 *   /auth      → redirect to GitHub's consent screen (with CSRF state)
 *   /callback  → exchange ?code for a token, postMessage it to the opener
 *
 * Secrets/vars (set via wrangler, never committed):
 *   GITHUB_CLIENT_ID      (var)    — public
 *   GITHUB_CLIENT_SECRET  (secret) — `wrangler secret put GITHUB_CLIENT_SECRET`
 *   ALLOWED_ORIGIN        (var)    — the site allowed to receive the token
 */

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN = 'https://github.com/login/oauth/access_token';

const html = (body) =>
  new Response(`<!doctype html><meta charset="utf-8">${body}`, {
    headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'no-store' },
  });

/** the page Decap expects: hand the token to the opener window, then close */
function completionPage(status, payload, allowedOrigin) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  return html(`<title>Signing in…</title>
<p style="font:16px system-ui;padding:2rem">Completing sign-in…</p>
<script>
(function () {
  var msg = ${JSON.stringify(message)};
  var target = ${JSON.stringify(allowedOrigin)};
  function send() { window.opener && window.opener.postMessage(msg, target); }
  // Decap handshake: it replies to "authorizing:github", then we send the result
  window.addEventListener('message', function handler() {
    send();
    window.removeEventListener('message', handler);
    setTimeout(function () { window.close(); }, 400);
  }, { once: true });
  window.opener && window.opener.postMessage('authorizing:github', target);
})();
</script>`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = env.ALLOWED_ORIGIN;

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return html('<h1>Not configured</h1><p>GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET are not set on this Worker.</p>');
    }

    // ---- step 1: send the editor to GitHub -------------------------------
    if (url.pathname === '/auth') {
      const state = crypto.randomUUID();
      const target = new URL(GITHUB_AUTHORIZE);
      target.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      target.searchParams.set('redirect_uri', `${url.origin}/callback`);
      // `repo` is required to commit to a PRIVATE repository
      target.searchParams.set('scope', 'repo,user');
      target.searchParams.set('state', state);
      return new Response(null, {
        status: 302,
        headers: {
          location: target.toString(),
          // round-trip the state so /callback can verify it
          'set-cookie': `csrf=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
        },
      });
    }

    // ---- step 2: exchange the code for a token ---------------------------
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const cookie = request.headers.get('cookie') || '';
      const expected = /(?:^|;\s*)csrf=([^;]+)/.exec(cookie)?.[1];

      if (!code) return completionPage('error', { message: 'No code returned from GitHub' }, origin);
      if (!state || !expected || state !== expected) {
        return completionPage('error', { message: 'State mismatch — possible CSRF, sign-in aborted' }, origin);
      }

      const res = await fetch(GITHUB_TOKEN, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${url.origin}/callback`,
        }),
      });
      const data = await res.json();
      if (!data.access_token) {
        return completionPage('error', { message: data.error_description || 'Token exchange failed' }, origin);
      }
      return completionPage('success', { token: data.access_token, provider: 'github' }, origin);
    }

    return html('<h1>Rosehill College CMS auth</h1><p>This service only handles editor sign-in.</p>');
  },
};
