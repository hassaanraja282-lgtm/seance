import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSnapshots, parseCdxResponse } from '../src/snapshots.js';

// ---------------------------------------------------------------------------
// Mock CDX response helpers
// ---------------------------------------------------------------------------
function makeCdxResponse(snapshots) {
  // snapshots: array of { timestamp, status, digest }
  const header = ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'];
  const rows = snapshots.map((s) => [
    `com,example)/${s.timestamp}`,
    s.timestamp,
    'https://example.com/',
    'text/html',
    s.status,
    s.digest,
    '1234',
  ]);
  return [header, ...rows];
}

function mockFetch(data) {
  return async (url, opts) => ({
    ok: true,
    status: 200,
    async json() { return data; },
    text() { return Promise.resolve(JSON.stringify(data)); },
    headers: new Map(),
  });
}

function mockFetchError(status) {
  return async (url, opts) => ({
    ok: false,
    status,
    async json() { return []; },
    text() { return Promise.resolve(''); },
    headers: new Map(),
  });
}

function mockFetchTimeout() {
  return async (url, opts) => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test('invalid URL → 400', async () => {
  const result = await getSnapshots('not-a-url', { fetch: mockFetch([]) });
  assert.ok(!result.ok);
  assert.equal(result.code, 400);
});

test('unsafe URL → 400', async () => {
  const result = await getSnapshots('http://localhost/', { fetch: mockFetch([]) });
  assert.ok(!result.ok);
  assert.equal(result.code, 400);
});

test('no snapshots → empty result', async () => {
  const fetch = mockFetch([]);
  const result = await getSnapshots('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.total, 0);
  assert.equal(result.result.firstSeen, null);
  assert.equal(result.result.lastSeen, null);
  assert.deepEqual(result.result.snapshots, []);
  assert.deepEqual(result.result.timeline, []);
});

test('with snapshots → correct data', async () => {
  const data = makeCdxResponse([
    { timestamp: '20010504120000', status: '200', digest: 'abc123' },
    { timestamp: '20020615120000', status: '200', digest: 'def456' },
    { timestamp: '20010310153000', status: '200', digest: 'ghi789' },
  ]);
  const fetch = mockFetch(data);
  const result = await getSnapshots('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.total, 3);
  assert.equal(result.result.firstSeen, '20010310153000');
  assert.equal(result.result.lastSeen, '20020615120000');
  assert.equal(result.result.snapshots.length, 3);
  assert.equal(result.result.snapshots[0].timestamp, '20010310153000');
});

test('timeline grouped by year', async () => {
  const data = makeCdxResponse([
    { timestamp: '20010101000000', status: '200', digest: 'a' },
    { timestamp: '20010601000000', status: '200', digest: 'b' },
    { timestamp: '20020101000000', status: '200', digest: 'c' },
    { timestamp: '20030101000000', status: '200', digest: 'd' },
    { timestamp: '20030101000000', status: '200', digest: 'e' }, // collapsed would dedupe but CDX returns
  ]);
  const fetch = mockFetch(data);
  const result = await getSnapshots('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.timeline.length, 3);
  assert.deepEqual(result.result.timeline[0], { year: 2001, count: 2 });
  assert.deepEqual(result.result.timeline[1], { year: 2002, count: 1 });
  assert.deepEqual(result.result.timeline[2], { year: 2003, count: 2 });
});

test('timeline sorted by year ascending', async () => {
  const data = makeCdxResponse([
    { timestamp: '20030101000000', status: '200', digest: 'd' },
    { timestamp: '20010101000000', status: '200', digest: 'a' },
    { timestamp: '20020101000000', status: '200', digest: 'c' },
  ]);
  const fetch = mockFetch(data);
  const result = await getSnapshots('https://example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.timeline[0].year, 2001);
  assert.equal(result.result.timeline[1].year, 2002);
  assert.equal(result.result.timeline[2].year, 2003);
});

test('CDX fetch error → 502', async () => {
  const fetch = mockFetchError(500);
  const result = await getSnapshots('https://example.com/', { fetch });
  assert.ok(!result.ok);
  assert.equal(result.code, 502);
  assert.equal(result.reason, 'Archive unreachable');
});

test('CDX timeout → 502', async () => {
  const fetch = mockFetchTimeout();
  const result = await getSnapshots('https://example.com/', { fetch, timeout: 100 });
  assert.ok(!result.ok);
  assert.equal(result.code, 502);
  assert.equal(result.reason, 'Archive unreachable');
});

test('result URL matches input', async () => {
  const fetch = mockFetch(makeCdxResponse([
    { timestamp: '20010101000000', status: '200', digest: 'a' },
  ]));
  const result = await getSnapshots('https://example.com/page', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.url, 'https://example.com/page');
});

test('parseCdxResponse with empty array', () => {
  const result = parseCdxResponse('https://example.com/', []);
  assert.equal(result.total, 0);
  assert.equal(result.firstSeen, null);
  assert.deepEqual(result.snapshots, []);
  assert.deepEqual(result.timeline, []);
});

test('parseCdxResponse with header only (no data rows)', () => {
  const header = ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'];
  const result = parseCdxResponse('https://example.com/', [header]);
  assert.equal(result.total, 0);
});

test('parseCdxResponse ignores rows without timestamp', () => {
  const header = ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'];
  const result = parseCdxResponse('https://example.com/', [
    header,
    ['key', '', 'url', 'text', '200', 'abc', '123'],
    ['key', '20010101000000', 'url', 'text', '200', 'abc', '123'],
  ]);
  assert.equal(result.total, 1);
});

test('www. variant tried when no exact matches', async () => {
  let calls = [];
  const fetch = async (url, opts) => {
    calls.push(url);
    // Return empty for www.example.com, snapshots for example.com
    if (url.includes('url=www.example.com')) {
      return { ok: true, status: 200, json: async () => [], text: async () => '' };
    }
    return {
      ok: true, status: 200,
      json: async () => makeCdxResponse([
        { timestamp: '20010101000000', status: '200', digest: 'a' },
      ]),
      text: async () => '',
    };
  };
  const result = await getSnapshots('https://www.example.com/', { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.total, 1);
  // First call should be for www.example.com (original), second for example.com
  assert.ok(calls.length >= 1);
});
