import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateUrl, isBlockedIP, isValidTimestamp } from '../src/url.js';

// ---------------------------------------------------------------------------
// Seeded RNG for deterministic property-based tests
// ---------------------------------------------------------------------------
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ---------------------------------------------------------------------------
// Helper: pick a random element
// ---------------------------------------------------------------------------
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Property 1: Scheme allowlist — accepted URLs have scheme http or https
// ---------------------------------------------------------------------------
const schemes = [
  'http', 'https', 'ftp', 'file', 'data', 'gopher', 'ws', 'wss', 'javascript',
  '', 'ht tp', 'HTTP', 'HTTPS',
];

test('scheme allowlist: only http/https accepted', async () => {
  const rng = makeRng(42);
  for (let i = 0; i < 500; i++) {
    const scheme = pick(rng, schemes);
    const host = pick(rng, ['example.com', 'geocities.com', 'wiki.org']);
    const path = pick(rng, ['', '/', '/page', '/a/b/c']);
    const raw = `${scheme}://${host}${path}`;
    const result = await validateUrl(raw);
    if (result.ok) {
      assert.ok(
        result.url.protocol === 'http:' || result.url.protocol === 'https:',
        `Accepted scheme "${scheme}" → protocol ${result.url.protocol}`,
      );
    } else {
      assert.equal(result.reason, 'Invalid or unsafe URL');
    }
  }
  // Explicit checks for rejected schemes
  for (const badScheme of ['ftp', 'file', 'data', 'gopher', 'javascript', 'ws', 'wss']) {
    const result = await validateUrl(`${badScheme}://example.com/`);
    assert.ok(!result.ok, `Scheme "${badScheme}" should be rejected`);
  }
  // Explicit checks for accepted schemes
  for (const goodScheme of ['http', 'https']) {
    const result = await validateUrl(`${goodScheme}://example.com/`);
    assert.ok(result.ok, `Scheme "${goodScheme}" should be accepted`);
  }
});

// ---------------------------------------------------------------------------
// Property 2: No userinfo — accepted URLs have no user:pass@
// ---------------------------------------------------------------------------
test('userinfo rejection: accepted URLs have no userinfo', async () => {
  const rng = makeRng(99);
  for (let i = 0; i < 200; i++) {
    const hasUser = rng() < 0.5;
    const user = hasUser ? `user${Math.floor(rng() * 1000)}` : '';
    const pass = hasUser && rng() < 0.5 ? `pass${Math.floor(rng() * 1000)}` : '';
    const creds = hasUser ? `${user}${pass ? ':' + pass : ''}@` : '';
    const raw = `https://${creds}example.com/`;
    const result = await validateUrl(raw);
    if (result.ok) {
      assert.equal(result.url.username, '');
      assert.equal(result.url.password, '');
    } else {
      assert.equal(result.reason, 'Invalid or unsafe URL');
    }
  }
  // Explicit checks
  assert.ok(!(await validateUrl('https://user:pass@example.com/')).ok);
  assert.ok(!(await validateUrl('https://user@example.com/')).ok);
  assert.ok((await validateUrl('https://example.com/')).ok);
});

// ---------------------------------------------------------------------------
// Property 3: Private-range rejection
// ---------------------------------------------------------------------------
const blockedIPv4s = [
  '127.0.0.1', '127.1.2.3', '127.255.255.255',    // loopback
  '10.0.0.1', '10.255.255.255',                    // 10/8
  '172.16.0.1', '172.31.255.255',                  // 172.16/12
  '192.168.1.1', '192.168.0.0',                    // 192.168/16
  '169.254.169.254', '169.254.1.1',                // link-local / metadata
  '0.0.0.0',                                        // unspecified
  '100.64.0.1',                                     // carrier-grade NAT
];
const blockedHostnames = ['localhost', '0.0.0.0', 'metadata.google.internal'];
const blockedIPv6s = ['::1', '::', 'fc00::1', 'fd00::1', 'fe80::1'];

test('private-range rejection: blocked IPs and hostnames', async () => {
  for (const ip of blockedIPv4s) {
    assert.ok(!(await validateUrl(`https://${ip}/`)).ok, `IP ${ip} should be blocked`);
  }
  for (const ip of blockedIPv6s) {
    assert.ok(!(await validateUrl(`https://[${ip}]/`)).ok, `IPv6 ${ip} should be blocked`);
  }
  for (const hn of blockedHostnames) {
    assert.ok(!(await validateUrl(`https://${hn}/`)).ok, `Hostname ${hn} should be blocked`);
  }
});

test('isBlockedIP covers all private ranges', () => {
  for (const ip of blockedIPv4s) {
    assert.ok(isBlockedIP(ip, 4), `${ip} should be blocked`);
  }
  for (const ip of blockedIPv6s) {
    assert.ok(isBlockedIP(ip, 6), `${ip} should be blocked`);
  }
  // Public IPs should not be blocked
  assert.ok(!isBlockedIP('8.8.8.8', 4));
  assert.ok(!isBlockedIP('1.1.1.1', 4));
  assert.ok(!isBlockedIP('93.184.216.34', 4));
  assert.ok(!isBlockedIP('2606:4700:4700::1111', 6));
});

// ---------------------------------------------------------------------------
// Property 4: Idempotency — same input → same verdict within a run
// ---------------------------------------------------------------------------
test('idempotency: same input yields same verdict', async () => {
  const urls = [
    'https://example.com/',
    'http://localhost/',
    'https://user:pass@evil.com/',
    'ftp://example.com/',
    'https://8.8.8.8/',
    'https://127.0.0.1/',
    'not-a-url',
    'https://example.com/page?q=1&r=2',
  ];
  for (const url of urls) {
    const r1 = await validateUrl(url);
    const r2 = await validateUrl(url);
    assert.equal(r1.ok, r2.ok, `Inconsistent verdict for "${url}"`);
    if (r1.ok) {
      assert.equal(r1.url.href, r2.url.href);
    } else {
      assert.equal(r1.reason, r2.reason);
    }
  }
});

// ---------------------------------------------------------------------------
// Property 5: Round-trip of safe URLs
// ---------------------------------------------------------------------------
test('round-trip: accepted URLs parse cleanly and reconstruct', async () => {
  const rng = makeRng(7);
  const safeHosts = [
    'example.com', 'geocities.com', 'archive.org', 'wikipedia.org',
    '8.8.8.8', '1.1.1.1', '93.184.216.34',
  ];
  for (let i = 0; i < 200; i++) {
    const scheme = pick(rng, ['http', 'https']);
    const host = pick(rng, safeHosts);
    const port = rng() < 0.3 ? `:${1000 + Math.floor(rng() * 1000)}` : '';
    const path = pick(rng, ['', '/', '/page', '/a/b']);
    const query = rng() < 0.3 ? `?q=${Math.floor(rng() * 100)}` : '';
    const raw = `${scheme}://${host}${port}${path}${query}`;
    const result = await validateUrl(raw);
    if (result.ok) {
      // Should reconstruct to an equivalent string
      const reconstructed = new URL(result.url.href);
      assert.equal(reconstructed.hostname, host);
    }
  }
  // Explicit round-trip
  const r = await validateUrl('https://example.com/path?q=1');
  assert.ok(r.ok);
  assert.equal(r.url.hostname, 'example.com');
  assert.equal(r.url.pathname, '/path');
  assert.equal(r.url.searchParams.get('q'), '1');
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
test('edge cases', async () => {
  // Empty string
  assert.ok(!(await validateUrl('')).ok);
  // Non-string
  assert.ok(!(await validateUrl(null)).ok);
  assert.ok(!(await validateUrl(undefined)).ok);
  assert.ok(!(await validateUrl(123)).ok);
  // Malformed URL
  assert.ok(!(await validateUrl('not a url')).ok);
  assert.ok(!(await validateUrl('://no-scheme')).ok);
  // IPv4-mapped IPv6
  assert.ok(!(await validateUrl('https://[::ffff:127.0.0.1]/')).ok);
  // Port-only changes don't bypass IP checks
  assert.ok(!(await validateUrl('http://127.0.0.1:8080/')).ok);
  // Legitimate public IP
  assert.ok((await validateUrl('https://8.8.8.8/')).ok);
  // Unicode hostname (IDN) — should not crash
  // (Node URL parser doesn't resolve IDNs without punycode; validate will attempt DNS)
  // Non-standard port on public host
  assert.ok((await validateUrl('https://example.com:8443/')).ok);
});

// ---------------------------------------------------------------------------
// Timestamp validation
// ---------------------------------------------------------------------------
test('isValidTimestamp', () => {
  assert.ok(isValidTimestamp('20010504120000'));
  assert.ok(isValidTimestamp('20230310153000'));
  assert.ok(isValidTimestamp('19900101000000'));
  assert.ok(isValidTimestamp('20991231235959'));
  assert.ok(!isValidTimestamp(''));
  assert.ok(!isValidTimestamp('2001050412000'));   // 13 digits
  assert.ok(!isValidTimestamp('200105041200000'));  // 15 digits
  assert.ok(!isValidTimestamp('2001050412000a'));   // non-digit
  assert.ok(!isValidTimestamp('20010504126000'));   // invalid minute
  assert.ok(!isValidTimestamp('21000101000000'));   // year > 2099
  assert.ok(!isValidTimestamp('19890101000000'));   // year < 1990
  assert.ok(!isValidTimestamp('20011301000000'));   // month 13
});
