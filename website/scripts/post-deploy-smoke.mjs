#!/usr/bin/env node
/**
 * Post-deploy smoke test for the `immiguide-web` Cloud Run site.
 *
 * Catches failures that DON'T show up in unit tests or a server-side `curl`:
 * most importantly, a production build that shipped WITHOUT the
 * NEXT_PUBLIC_FIREBASE_* values baked in — which crashes the browser with
 * "Application error: a client-side exception has occurred" while the SSR
 * response is still a healthy 200. (See website/Dockerfile + PR #29.)
 *
 * Usage:
 *   node scripts/post-deploy-smoke.mjs [baseUrl]
 *   SMOKE_BASE_URL=https://candidate-tag---immiguide-web-...run.app npm run smoke
 *
 * Exit code 0 = all checks passed, 1 = at least one failed (fail the deploy).
 */

const BASE = (process.argv[2] || process.env.SMOKE_BASE_URL || 'https://www.meridianjourney.ai').replace(/\/$/, '');
const TIMEOUT_MS = 20000;

let failures = 0;
function check(name, ok, detail = '') {
  const tag = ok ? '✓ PASS' : '✗ FAIL';
  console.log(`  ${tag}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function get(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal, redirect: 'follow' });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log(`Post-deploy smoke → ${BASE}\n`);

  // 1. Homepage renders (SSR) and is the right brand.
  const home = await get('/');
  check('GET / returns 200', home.status === 200, `status ${home.status}`);
  check('Home title is Meridian', /<title>[^<]*Meridian/i.test(home.body));
  check('No stale "usajourney" brand leak', !/usajourney/i.test(home.body));

  // 2. THE regression guard: the client JS bundle must contain the Firebase web
  //    config. If NEXT_PUBLIC_FIREBASE_* weren't baked at build time, the bundle
  //    has apiKey=undefined and the app throws on getAuth() in the browser.
  //    The Firebase config is inlined into the shared layout + auth-page chunks,
  //    so scan the auth routes (which reliably reference them), not just `/`
  //    (which 308-redirects to /search and exposes only a few chunks).
  const scanPages = ['/', '/search', '/login', '/post'];
  const htmls = (await Promise.all(scanPages.map((p) => get(p)))).map((r) => r.body);
  const chunkPaths = [...new Set(
    htmls.join('').match(/\/_next\/static\/[^"'\\]+?\.js/g) || []
  )].slice(0, 50);
  check('Pages reference JS chunks', chunkPaths.length > 0, `${chunkPaths.length} chunks`);

  let foundApiKey = false;
  let foundAuthDomain = false;
  let foundUndef = false;
  for (const c of chunkPaths) {
    const js = (await get(c)).body;
    if (/AIza[0-9A-Za-z_-]{20,}/.test(js)) foundApiKey = true;
    if (/[a-z0-9-]+\.firebaseapp\.com/i.test(js)) foundAuthDomain = true;
    if (/apiKey:\s*(void 0|undefined)/.test(js)) foundUndef = true;
    if (foundApiKey && foundAuthDomain) break;
  }
  check('No apiKey:undefined in bundle (build env present)', !foundUndef);
  check('Firebase apiKey baked into client bundle', foundApiKey,
        foundApiKey ? '' : 'NEXT_PUBLIC_FIREBASE_API_KEY missing from build — client will crash');
  check('Firebase authDomain baked into client bundle', foundAuthDomain);

  // 3. The landing route (root redirects here) is reachable.
  const search = await get('/search');
  check('GET /search returns 200', search.status === 200, `status ${search.status}`);

  console.log(`\n${failures === 0 ? 'SMOKE PASSED' : `SMOKE FAILED (${failures} check(s))`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nSMOKE ERROR: ${e?.message || e}`);
  process.exit(1);
});
