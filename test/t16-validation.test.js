import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateUrlSyntax, validateUrlForFetch } from '../src/url.js';
import { checkPulse } from '../src/pulse.js';

// Tiny seeded RNG (no deps) for property-style tests.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const pick = (r, a) => a[Math.floor(r() * a.length)];

test('T16 property: validateUrlSyntax is synchronous and never touches DNS', () => {
  const r = rng(16);
  const tlds = ['com', 'net', 'org', 'io', 'invalid', 'zzzz-not-a-tld'];
  for (let i = 0; i < 300; i++) {
    const label = Math.floor(r() * 1e9).toString(36);
    const url = `${pick(r, ['http', 'https'])}://${label}.${pick(r, tlds)}/${label}`;
    const res = validateUrlSyntax(url);
    assert.ok(!(res instanceof Promise), 'must not be async');
    assert.equal(res.ok, true, url);
  }
});

test('T16: validateUrlSyntax still blocks localhost and literal private IPs', () => {
  for (const u of ['http://localhost/', 'http://127.0.0.1/', 'http://10.1.2.3/', 'http://169.254.169.254/latest', 'http://[::1]/', 'file:///etc/passwd']) {
    assert.equal(validateUrlSyntax(u).ok, false, u);
  }
});

test('T16: DNS failure is reported as dns_failure, not unsafe', async () => {
  const dnsLookup = async () => { const e = new Error('nope'); e.code = 'ENOTFOUND'; throw e; };
  const v = await validateUrlForFetch('http://long-gone.example/', { dnsLookup });
  assert.deepEqual(v, { ok: false, reason: 'dns_failure' });
  const p = await checkPulse('http://long-gone.example/', { dnsLookup, fetch: async () => { throw new Error('should not fetch'); } });
  assert.equal(p.ok, true);
  assert.equal(p.result.status, 'DEAD');
  assert.equal(p.result.cause, 'dns_failure');
});

test('T16: resolution into a blocked range is still rejected', async () => {
  const dnsLookup = async () => [{ address: '10.0.0.5', family: 4 }];
  const orig = console.error; console.error = () => {};
  try {
    const v = await validateUrlForFetch('http://sneaky.example/', { dnsLookup });
    assert.equal(v.ok, false);
    assert.notEqual(v.reason, 'dns_failure');
  } finally { console.error = orig; }
});

test('T16: pulse detail is a short status string, never the body', async () => {
  const dnsLookup = async () => [{ address: '93.184.216.34', family: 4 }];
  const fetch = async () => new Response('<!doctype html><html>huge error page</html>', { status: 404 });
  const p = await checkPulse('https://example.com/gone', { dnsLookup, fetch });
  assert.equal(p.result.detail, '404 Not Found');
});
