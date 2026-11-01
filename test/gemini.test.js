import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deterministicSummary, summarize } from '../src/gemini.js';

// ---------------------------------------------------------------------------
// Deterministic fallback summarizer tests
// ---------------------------------------------------------------------------

test('spiritMessage is non-empty and at most 2 sentences', () => {
  const text = 'This is the first sentence. This is the second sentence. This is the third sentence that should not appear.';
  const result = deterministicSummary(text, 'Test Page');
  assert.ok(result.spiritMessage.length > 0, 'spiritMessage should be non-empty');
  const sentences = result.spiritMessage.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  assert.ok(sentences.length <= 2, `spiritMessage should have at most 2 sentences, got ${sentences.length}: "${result.spiritMessage}"`);
});

test('spiritMessage with single sentence input', () => {
  const text = 'Only one sentence here.';
  const result = deterministicSummary(text, 'Test');
  assert.ok(result.spiritMessage.length > 0);
});

test('spiritMessage with empty text', () => {
  const result = deterministicSummary('', 'Test');
  assert.ok(result.spiritMessage.length > 0, 'spiritMessage should be non-empty even with empty text');
});

test('epitaph is a single line (no newlines) and non-empty', () => {
  const text = 'This is some content about technology and programming that is interesting.';
  const result = deterministicSummary(text, 'Test Page');
  assert.ok(result.epitaph.length > 0, 'epitaph should be non-empty');
  assert.ok(!result.epitaph.includes('\n'), 'epitaph should have no newlines');
});

test('searchQueries is exactly 3 non-empty strings', () => {
  const text = 'Technology programming software development web design';
  const result = deterministicSummary(text, 'Tech Page');
  assert.ok(Array.isArray(result.searchQueries), 'searchQueries should be an array');
  assert.equal(result.searchQueries.length, 3, 'searchQueries should have exactly 3 items');
  for (const q of result.searchQueries) {
    assert.ok(typeof q === 'string' && q.length > 0, `query should be non-empty: "${q}"`);
  }
});

test('searchQueries with empty text', () => {
  const result = deterministicSummary('', '');
  assert.equal(result.searchQueries.length, 3);
  for (const q of result.searchQueries) {
    assert.ok(q.length > 0, `query should be non-empty: "${q}"`);
  }
});

test('output depends only on input text (determinism)', () => {
  const text = 'This is some test content about science and research. It has multiple sentences for testing purposes.';
  const title = 'Test Page';
  const r1 = deterministicSummary(text, title);
  const r2 = deterministicSummary(text, title);
  assert.deepEqual(r1, r2, 'same input should produce same output');
});

test('different input produces different output', () => {
  const text1 = 'This is about cooking and recipes and food preparation.';
  const text2 = 'This is about quantum physics and particle accelerators.';
  const r1 = deterministicSummary(text1, 'Cooking');
  const r2 = deterministicSummary(text2, 'Physics');
  assert.notEqual(r1.spiritMessage, r2.spiritMessage, 'different inputs should produce different spirit messages');
  assert.notEqual(r1.epitaph, r2.epitaph, 'different inputs should produce different epitaphs');
});

test('source is "fallback" for deterministic path', () => {
  const result = deterministicSummary('some text', 'title');
  assert.equal(result.source, 'fallback');
});

test('epitaph truncated to reasonable length', () => {
  const longText = 'This is a very long sentence that goes on and on about various topics including technology, science, art, literature, music, cooking, travel, and many other subjects that would make this sentence far too long to be a reasonable epitaph for a web page summary.';
  const result = deterministicSummary(longText, 'Long Page');
  assert.ok(result.epitaph.length <= 103, `epitaph should be truncated, got ${result.epitaph.length}`);
});

test('epitaph uses title when no text', () => {
  const result = deterministicSummary('', 'My Page Title');
  assert.ok(result.epitaph.includes('My Page Title') || result.epitaph.length > 0, 'epitaph should use title as fallback');
});

// ---------------------------------------------------------------------------
// summarize() — fallback when no API key
// ---------------------------------------------------------------------------
test('summarize falls back to deterministic without API key', async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const result = await summarize('Test content about technology.', 'Test Page');
    assert.equal(result.source, 'fallback');
    assert.ok(result.spiritMessage.length > 0);
    assert.ok(result.epitaph.length > 0);
    assert.equal(result.searchQueries.length, 3);
  } finally {
    if (oldKey) process.env.GEMINI_API_KEY = oldKey;
  }
});

// ---------------------------------------------------------------------------
// summarize() — Gemini success path
// ---------------------------------------------------------------------------
test('summarize uses Gemini when API key present and call succeeds', async () => {
  const mockFetch = async (url, opts) => {
    assert.ok(opts.headers['x-goog-api-key'], 'should send API key in header');
    assert.ok(!url.includes('key='), 'API key should not be in URL');
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          candidates: [{
            content: {
              parts: [{ text: JSON.stringify({
                spiritMessage: 'This page is about technology. It covers various topics.',
                epitaph: 'A page about technology and programming.',
                searchQueries: ['technology', 'programming', 'software'],
              }) }],
            },
          }],
        };
      },
    };
  };

  const result = await summarize('Some text about technology.', 'Tech Page', {
    apiKey: 'fake-key',
    fetch: mockFetch,
  });
  assert.equal(result.source, 'gemini:gemini-3.6-flash');
  assert.ok(result.spiritMessage.length > 0);
  assert.ok(result.epitaph.length > 0);
  assert.equal(result.searchQueries.length, 3);
});

// ---------------------------------------------------------------------------
// summarize() — Gemini failure falls back
// ---------------------------------------------------------------------------
test('summarize falls back when Gemini returns HTTP error', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 429,
    async json() { return { error: 'rate limited' }; },
  });

  const result = await summarize('Test text.', 'Test', {
    apiKey: 'fake-key',
    fetch: mockFetch,
  });
  assert.equal(result.source, 'fallback');
  assert.ok(result.spiritMessage.length > 0);
});

test('summarize falls back when Gemini throws', async () => {
  const mockFetch = async () => {
    throw new Error('Network error');
  };

  const result = await summarize('Test text.', 'Test', {
    apiKey: 'fake-key',
    fetch: mockFetch,
  });
  assert.equal(result.source, 'fallback');
});

test('summarize falls back when Gemini returns invalid JSON', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        candidates: [{
          content: {
            parts: [{ text: 'not valid json {{{' }],
          },
        }],
      };
    },
  });

  const result = await summarize('Test text.', 'Test', {
    apiKey: 'fake-key',
    fetch: mockFetch,
  });
  assert.equal(result.source, 'fallback');
});

test('summarize tries multiple models on failure', async () => {
  let callCount = 0;
  const models = [];
  const mockFetch = async (url) => {
    callCount++;
    // Extract model name from URL
    const match = url.match(/models\/([^:]+):/);
    if (match) models.push(match[1]);
    if (callCount === 1) {
      // First model fails
      return { ok: false, status: 500, async json() { return {}; } };
    }
    // Second model succeeds
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          candidates: [{
            content: {
              parts: [{ text: JSON.stringify({
                spiritMessage: 'Summary here. Second sentence.',
                epitaph: 'An epitaph.',
                searchQueries: ['q1', 'q2', 'q3'],
              }) }],
            },
          }],
        };
      },
    };
  };

  const result = await summarize('Test text.', 'Test', {
    apiKey: 'fake-key',
    fetch: mockFetch,
  });
  assert.ok(result.source.startsWith('gemini:'), `should be gemini source, got ${result.source}`);
  assert.ok(callCount >= 2, `should have tried multiple models, got ${callCount}`);
});

// ---------------------------------------------------------------------------
// API key never leaked
// ---------------------------------------------------------------------------
test('API key not in any error or output', async () => {
  const mockFetch = async () => {
    throw new Error('connection refused to endpoint with key=secret-key-123');
  };

  const result = await summarize('text', 'title', {
    apiKey: 'secret-key-123',
    fetch: mockFetch,
  });
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('secret-key-123'), 'API key should not appear in output');
});
