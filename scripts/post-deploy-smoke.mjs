import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.argv[2] || 'https://kar-tochki.pages.dev';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_SRC = fs.readFileSync(path.join(ROOT, 'js', 'core', 'version.js'), 'utf8');
const match = VERSION_SRC.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
const appVersion = match?.[1] || '';
const expectedInSw = `${appVersion}-bundle`;

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchHeaders(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.headers;
}

console.log(`[post-deploy] BASE_URL=${BASE_URL}`);

// 1) The root should return HTML with CSP.
const headers = await fetchHeaders(`${BASE_URL}/`);
const csp = headers.get('content-security-policy');
if (!csp) {
  throw new Error('[post-deploy] Missing CSP header: content-security-policy');
}
console.log(`[post-deploy] CSP present (${csp.slice(0, 80)}...)`);

// 2) sw.js should exist and include current version marker.
const sw = await fetchText(`${BASE_URL}/sw.js`);
if (!sw.includes(expectedInSw)) {
  throw new Error(
    `[post-deploy] sw.js does not include expected version: ${expectedInSw}`,
  );
}
console.log('[post-deploy] sw.js version marker OK');

// 3) API routes should respond (likely 404/405 but must not be network/CSP broken).
// We check that /api/yt-video responds with JSON-like error.
const apiRes = await fetch(`${BASE_URL}/api/yt-video`, { method: 'POST', body: '{}' });
if (apiRes.status === 0) throw new Error('[post-deploy] API network error');
const apiText = await apiRes.text();
if (!apiText || apiText.length < 2) {
  throw new Error('[post-deploy] /api/yt-video returned empty body');
}
console.log('[post-deploy] api response body OK');

console.log('[post-deploy] OK');
