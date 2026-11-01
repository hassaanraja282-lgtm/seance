import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPulse } from '../src/pulse.js';

// ---------------------------------------------------------------------------
// Mock fetch helper: returns a function that simulates various fetch outcomes
// ---------------------------------------------------------------------------
function mockFetch(responses) {
  // responses is an array of { status, body, statusText, ok, error, timeout }
  let idx = 0;
  return async (url, opts) => {
    const resp = responses[idx++] || responses[responses.length - 1];
    if (resp.error) {
      throw resp.error;
    }
    if (resp.timeout) {
      // Simulate timeout via AbortController abort
      if (opts?.signal) {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }
    }
    const status = resp.status ?? 200;
    const text = () => Promise.resolve(resp.body ?? '');
    return {
      status,
      ok: status >= 200 && status < 300,
      statusText: resp.statusText ?? '',
      text,
      headers: new Map(),
    };
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test('invalid URL → ok:false', async () => {
  const result = await checkPulse('not-a-url');
  assert.ok(!result.ok);
  assert.equal(result.reason, 'Invalid or unsafe URL');
});

test('unsafe URL (localhost) → ok:false', async () => {
  const result = await checkPulse('http://localhost/');
  assert.ok(!result.ok);
  assert.equal(result.reason, 'Invalid or unsafe URL');
});

test('missing url → ok:false', async () => {
  const result = await checkPulse('');
  assert.ok(!result.ok);
});

test('2xx → ALIVE', async () => {
  const fetch = mockFetch([{ status: 200, body: 'OK' }]);
  const result = await checkPulse('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.status, 'ALIVE');
  assert.equal(result.result.httpStatus, 200);
});

test('3xx (redirect followed) → ALIVE', async () => {
  const fetch = mockFetch([{ status: 301, body: '' }]);
  // After following redirect, we'd get 200 — but mock returns 301; in real fetch
  // redirect:'follow' resolves with final. For this test we simulate 301 as final.
  const result = await checkPulse('https://example.com/', { fetch });
  // 301 is a 3xx → ALIVE
  assert.ok(result.ok);
  assert.equal(result.result.status, 'ALIVE');
  assert.equal(result.result.httpStatus, 301);
});

test('404 → DEAD with cause 404', async () => {
  const fetch = mockFetch([{ status: 404, body: 'Not Found' }]);
  const result = await checkPulse('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.status, 'DEAD');
  assert.equal(result.result.cause, '404');
  assert.equal(result.result.httpStatus, 404);
});

test('500 → DEAD with cause 5xx', async () => {
  const fetch = mockFetch([{ status: 500, body: 'Internal Server Error' }]);
  const result = await checkPulse('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.status, 'DEAD');
  assert.equal(result.result.cause, '5xx');
  assert.equal(result.result.httpStatus, 500);
});

test('403 → DEAD with cause 403', async () => {
  const fetch = mockFetch([{ status: 403, body: 'Forbidden' }]);
  const result = await checkPulse('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.status, 'DEAD');
  assert.equal(result.result.cause, '403');
});

test('DNS failure → DEAD with cause dns_failure', async () => {
  const err = new Error('getaddrinfo ENOTFOUND example.invalid');
  const fetch = mockFetch([{ error: err }]);
  const result = await checkPulse('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.status, 'DEAD');
  assert.equal(result.result.cause, 'dns_failure');
  assert.equal(result.result.httpStatus, null);
});

test('connection refused → DEAD with cause connection_refused', async () => {
  const err = new Error('connect ECONNREFUSED 127.0.0.1:443');
  const fetch = mockFetch([{ error: err }]);
  // Note: validateUrl for example.com won't resolve to localhost, but
  // the mock fetch throws ECONNREFUSED regardless.
  const result = await checkPulse('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.status, 'DEAD');
  assert.equal(result.result.cause, 'connection_refused');
});

test('timeout → DEAD with cause timeout', async () => {
  const fetch = mockFetch([{ timeout: true }]);
  const result = await checkPulse('https://example.com/', { fetch, timeout: 100 });
  assert.ok(result.ok);
  assert.equal(result.result.status, 'DEAD');
  assert.equal(result.result.cause, 'timeout');
  assert.equal(result.result.httpStatus, null);
});

test('network error → DEAD with cause network_error', async () => {
  const err = new Error('fetch failed');
  const fetch = mockFetch([{ error: err }]);
  const result = await checkPulse('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.status, 'DEAD');
  assert.equal(result.result.cause, 'network_error');
});

test('result includes the URL', async () => {
  const fetch = mockFetch([{ status: 200, body: 'OK' }]);
  const result = await checkPulse('https://example.com/page?q=1', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.url, 'https://example.com/page?q=1');
});

test('redirect to different host → DEAD with cause possessed', async () => {
  const fetch = async (url, opts) => ({
    status: 200,
    ok: true,
    url: 'https://different-host.com/page',  // different host → possessed
    text: async () => '',
    headers: new Map(),
  });
  const result = await checkPulse('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.status, 'DEAD');
  assert.equal(result.result.cause, 'possessed');
  assert.equal(result.result.httpStatus, 200);
  assert.ok(result.result.detail.includes('different-host.com'));
});

test('redirect to same host stays ALIVE', async () => {
  const fetch = async (url, opts) => ({
    status: 200,
    ok: true,
    url: 'https://example.com/different-path',  // same host → alive
    text: async () => '',
    headers: new Map(),
  });
  const result = await checkPulse('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.status, 'ALIVE');
  assert.equal(result.result.httpStatus, 200);
});
