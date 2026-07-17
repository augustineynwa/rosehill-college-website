/**
 * strip-admin.mjs — remove the CMS editor from a public build.
 *
 * The trial runs Decap with `local_backend: true`, which only works against a
 * local decap-server. Shipping /admin publicly in that state would expose a
 * broken login page (harmless — it grants no write access without an auth
 * backend — but confusing to anyone who finds it).
 *
 * Once a real auth backend is configured (Gap 1), drop this from the deploy
 * script and set `local_backend: false` in scripts/gen-cms-config.mjs.
 */
import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'admin');
if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true });
  console.log('Stripped /admin from the public build (CMS is local-only for now).');
} else {
  console.log('No /admin in build output — nothing to strip.');
}
