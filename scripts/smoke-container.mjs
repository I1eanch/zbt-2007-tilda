const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8080';

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-frame-options': 'DENY',
};

function assertHeader(path, response, name, expected) {
  const actual = response.headers.get(name);
  if (actual !== expected) {
    throw new Error(`${path}: header ${name} expected "${expected}", received "${actual}"`);
  }
}

function assertSecurityHeaders(path, response) {
  for (const [name, expected] of Object.entries(securityHeaders)) {
    assertHeader(path, response, name, expected);
  }
}

async function fetchOk(path) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}

// Status + body contract.
const home = await fetchOk('/');
const homeBody = await home.text();
if (!homeBody.includes('Здоровье без таблеток')) throw new Error('/: missing Здоровье без таблеток');

const health = await fetchOk('/healthz');
if (!(await health.text()).includes('ok')) throw new Error('/healthz: missing ok');

// Security headers must reach the document, index, hashed assets and health.
assertSecurityHeaders('/', home);
assertSecurityHeaders('/healthz', health);

// Cache policy: index is no-cache.
assertHeader('/', home, 'cache-control', 'no-cache');

const index = await fetchOk('/index.html');
assertSecurityHeaders('/index.html', index);
assertHeader('/index.html', index, 'cache-control', 'no-cache');

// Hashed asset discovered from the homepage: immutable cache + security headers.
const assetMatch = homeBody.match(/\/_astro\/[^"']+/);
if (!assetMatch) throw new Error('no /_astro/ asset referenced in homepage');
const assetPath = assetMatch[0];
const asset = await fetchOk(assetPath);
assertSecurityHeaders(assetPath, asset);
assertHeader(assetPath, asset, 'cache-control', 'public, max-age=31536000, immutable');

// The Tilda embed endpoint is the only frameable document: it keeps the three
// non-framing security headers, drops X-Frame-Options, and advertises a
// Content-Security-Policy frame-ancestors allowlist (default includes Tilda).
const embed = await fetchOk('/embed/');
const embedBody = await embed.text();
if (!embedBody.includes('Здоровье без таблеток')) throw new Error('/embed/: missing Здоровье без таблеток');
for (const [name, expected] of Object.entries(securityHeaders)) {
  if (name === 'x-frame-options') continue;
  assertHeader('/embed/', embed, name, expected);
}
if (embed.headers.get('x-frame-options') !== null) {
  throw new Error(`/embed/: X-Frame-Options must be absent, received "${embed.headers.get('x-frame-options')}"`);
}
const csp = embed.headers.get('content-security-policy');
if (!csp || !csp.includes('frame-ancestors')) {
  throw new Error(`/embed/: expected Content-Security-Policy with frame-ancestors, received "${csp}"`);
}
// Prove the FRAME_ANCESTORS template was expanded by envsubst at container start
// (the literal placeholder would otherwise satisfy the frame-ancestors check).
if (/\$\{?FRAME_ANCESTORS/i.test(csp) || csp.includes('${')) {
  throw new Error(`/embed/: FRAME_ANCESTORS was not substituted, received "${csp}"`);
}
const expectedAncestors = process.env.SMOKE_FRAME_ANCESTORS;
if (expectedAncestors) {
  if (!csp.includes(expectedAncestors)) {
    throw new Error(`/embed/: frame-ancestors expected to include "${expectedAncestors}", received "${csp}"`);
  }
} else if (!/tilda/i.test(csp)) {
  throw new Error(`/embed/: default frame-ancestors should include a Tilda origin, received "${csp}"`);
}
assertHeader('/embed/', embed, 'cache-control', 'no-cache');

// The standalone landing must stay clickjacking-protected.
assertHeader('/', home, 'x-frame-options', 'DENY');

console.log('container smoke passed');
