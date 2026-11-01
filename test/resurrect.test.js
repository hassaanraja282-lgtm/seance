import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resurrect, clearResurrectCache } from '../src/resurrect.js';

// ---------------------------------------------------------------------------
// Mock fetch for archived HTML
// ---------------------------------------------------------------------------
function mockArchivedHtml(html) {
  return async (url, opts) => {
    // CDX API calls also use this fetch — return empty snapshots for simplicity
    if (url.includes('/cdx/search/cdx')) {
      return {
        ok: true,
        status: 200,
        async json() { return []; },
        text: async () => '',
        headers: new Map(),
      };
    }
    // Archived HTML
    return {
      ok: true,
      status: 200,
      url: url,
      async text() { return html; },
      headers: new Map(),
    };
  };
}

function mockCdxWithSnapshots(snapshots) {
  const header = ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'];
  const rows = snapshots.map((s) => [
    'com,example)/', s.timestamp, 'https://example.com/', 'text/html', s.status, s.digest, '1234',
  ]);
  const data = [header, ...rows];
  return async (url, opts) => {
    if (url.includes('/cdx/search/cdx')) {
      return {
        ok: true,
        status: 200,
        async json() { return data; },
        text: async () => '',
        headers: new Map(),
      };
    }
    // Archived HTML
    return {
      ok: true,
      status: 200,
      url,
      async text() { return '<html><head><title>Test Page</title></head><body><h1>Hello</h1><p>World</p></body></html>'; },
      headers: new Map(),
    };
  };
}

function mockFetchError() {
  return async () => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('invalid URL → 400', async () => {
  const result = await resurrect('not-a-url', '20010504120000', { fetch: mockArchivedHtml('') });
  assert.ok(!result.ok);
  assert.equal(result.code, 400);
});

test('unsafe URL → 400', async () => {
  const result = await resurrect('http://localhost/', '20010504120000', { fetch: mockArchivedHtml('') });
  assert.ok(!result.ok);
  assert.equal(result.code, 400);
});

test('invalid timestamp → 400', async () => {
  const result = await resurrect('https://example.com/', 'bad-ts', { fetch: mockArchivedHtml('') });
  assert.ok(!result.ok);
  assert.equal(result.code, 400);
  assert.equal(result.reason, 'Invalid timestamp');
});

test('archive fetch failure → 502', async () => {
  const result = await resurrect('https://example.com/', '20010504120000', { fetch: mockFetchError() });
  assert.ok(!result.ok);
  assert.equal(result.code, 502);
  assert.equal(result.reason, 'Could not retrieve remains');
});

test('successful resurrection returns full result', async () => {
  clearResurrectCache();
  const html = '<html><head><title>My Old Page</title></head><body><h1>Welcome</h1><p>This is the content.</p></body></html>';
  const result = await resurrect('https://example.com/', '20010504120000', { fetch: mockArchivedHtml(html) });
  assert.ok(result.ok);
  assert.equal(result.result.url, 'https://example.com/');
  assert.equal(result.result.ts, '20010504120000');
  assert.equal(result.result.title, 'My Old Page');
  assert.ok(result.result.content.includes('Welcome'), 'content should include h1');
  assert.ok(result.result.content.includes('content'), 'content should include p');
  assert.ok(result.result.spiritMessage.length > 0, 'should have spirit message');
  assert.ok(result.result.epitaph.length > 0, 'should have epitaph');
  assert.equal(result.result.searchQueries.length, 3, 'should have 3 search queries');
  assert.ok(result.result.provenance, 'should have provenance');
  assert.equal(result.result.provenance.originalUrl, 'https://example.com/');
  assert.equal(result.result.provenance.timestamp, '20010504120000');
  assert.equal(result.result.provenance.snapshotDate, 'May 4, 2001');
  assert.ok(result.result.downloadHtml.includes('<!doctype html>'), 'should have downloadable HTML');
  assert.ok(result.result.downloadHtml.includes('Welcome'), 'download HTML should contain content');
});

test('result cached by url+ts', async () => {
  clearResurrectCache();
  let fetchCount = 0;
  const fetch = async (url, opts) => {
    fetchCount++;
    if (url.includes('/cdx/')) {
      return { ok: true, status: 200, async json() { return []; }, text: async () => '', headers: new Map() };
    }
    return {
      ok: true,
      status: 200,
      url,
      async text() { return '<html><body><p>Cached test</p></body></html>'; },
      headers: new Map(),
    };
  };

  const r1 = await resurrect('https://example.com/', '20010504120000', { fetch });
  const r2 = await resurrect('https://example.com/', '20010504120000', { fetch });
  assert.ok(r1.ok);
  assert.ok(r2.ok);
  assert.equal(fetchCount, 1, 'second call should come from cache, not re-fetch');
});

test('without ts uses latest snapshot', async () => {
  clearResurrectCache();
  const fetch = mockCdxWithSnapshots([
    { timestamp: '20010101000000', status: '200', digest: 'a' },
    { timestamp: '20020101000000', status: '200', digest: 'b' },
    { timestamp: '20030101000000', status: '200', digest: 'c' },
  ]);
  const result = await resurrect('https://example.com/', null, { fetch });
  assert.ok(result.ok);
  assert.equal(result.result.ts, '20030101000000', 'should use latest snapshot');
});

test('without ts and no snapshots → 404', async () => {
  clearResurrectCache();
  const fetch = mockCdxWithSnapshots([]);
  const result = await resurrect('https://example.com/', null, { fetch });
  assert.ok(!result.ok);
  assert.equal(result.code, 404);
});

test('source is fallback when no API key', async () => {
  clearResurrectCache();
  const oldKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const html = '<html><head><title>Test</title></head><body><p>Content here.</p></body></html>';
    const result = await resurrect('https://example.com/', '20010504120000', { fetch: mockArchivedHtml(html) });
    assert.ok(result.ok);
    assert.equal(result.result.source, 'fallback');
  } finally {
    if (oldKey) process.env.GEMINI_API_KEY = oldKey;
  }
});

test('images extracted and rewritten', async () => {
  clearResurrectCache();
  const html = '<html><body><img src="/img/photo.png" alt="photo"><p>text</p></body></html>';
  const result = await resurrect('https://example.com/', '20010504120000', { fetch: mockArchivedHtml(html) });
  assert.ok(result.ok);
  assert.equal(result.result.images.length, 1);
  assert.ok(result.result.images[0].src.startsWith('https://web.archive.org/web/20010504120000id_/'));
  assert.ok(result.result.images[0].src.includes('example.com/img/photo.png'));
});

test('downloadHtml is self-contained', async () => {
  clearResurrectCache();
  const html = '<html><head><title>Test</title></head><body><h1>Hi</h1><p>There</p></body></html>';
  const result = await resurrect('https://example.com/', '20010504120000', { fetch: mockArchivedHtml(html) });
  assert.ok(result.ok);
  const dl = result.result.downloadHtml;
  assert.ok(dl.includes('<!doctype html>'));
  assert.ok(dl.includes('<style>'), 'should have inline CSS');
  assert.ok(!dl.includes('<script'), 'should not have scripts');
  assert.ok(!dl.includes('<link'), 'should not have external links');
  assert.ok(dl.includes('Provenance'), 'should have provenance footer');
});
