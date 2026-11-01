import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractContent, extractText } from '../src/extract.js';

// ---------------------------------------------------------------------------
// Seeded RNG for property-based tests
// ---------------------------------------------------------------------------
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

const TS = '20010504120000';
const BASE_URL = 'https://example.com/page';

// ---------------------------------------------------------------------------
// Property: No dangerous tags survive extraction
// ---------------------------------------------------------------------------
const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'frame', 'applet'];

test('no dangerous tags survive extraction', () => {
  const rng = makeRng(42);
  for (let i = 0; i < 200; i++) {
    const tag = pick(rng, DANGEROUS_TAGS);
    const content = pick(rng, ['alert(1)', 'evil()', 'malicious']);
    const html = `<${tag}>${content}</${tag}><p>safe text</p>`;
    const result = extractContent(html, TS, BASE_URL);
    const lower = result.content.toLowerCase();
    assert.ok(!lower.includes(`<${tag}`), `Tag <${tag}> should not survive: ${result.content}`);
    assert.ok(!lower.includes(content), `Content "${content}" should not survive`);
    assert.ok(lower.includes('safe text'), 'safe text should survive');
  }
});

// ---------------------------------------------------------------------------
// Property: No event handlers in output
// ---------------------------------------------------------------------------
test('no event handlers in extracted content', () => {
  const handlers = ['onclick', 'onload', 'onerror', 'onmouseover'];
  for (const handler of handlers) {
    const html = `<p ${handler}="alert(1)">text</p>`;
    const result = extractContent(html, TS, BASE_URL);
    assert.ok(!result.content.toLowerCase().includes(handler), `${handler} should not survive`);
  }
});

// ---------------------------------------------------------------------------
// Property: No style attributes in output
// ---------------------------------------------------------------------------
test('no style attributes in extracted content', () => {
  const html = '<p style="color:red">text</p>';
  const result = extractContent(html, TS, BASE_URL);
  assert.ok(!result.content.toLowerCase().includes('style='), 'style should not survive');
});

// ---------------------------------------------------------------------------
// Property: No javascript:/vbscript: URIs
// ---------------------------------------------------------------------------
test('no javascript: or vbscript: URIs in extracted content', () => {
  const html = '<a href="javascript:alert(1)">link</a><img src="vbscript:msgbox(1)">';
  const result = extractContent(html, TS, BASE_URL);
  assert.ok(!result.content.toLowerCase().includes('javascript:'), 'javascript: should not survive');
  assert.ok(!result.content.toLowerCase().includes('vbscript:'), 'vbscript: should not survive');
});

// ---------------------------------------------------------------------------
// Property: Image rewriting — every img src starts with archive URL
// ---------------------------------------------------------------------------
test('image src rewritten to archived version', () => {
  const html = '<img src="/img/photo.png" alt="photo">';
  const result = extractContent(html, TS, BASE_URL);
  assert.equal(result.images.length, 1);
  assert.ok(
    result.images[0].src.startsWith(`https://web.archive.org/web/${TS}id_/`),
    `Image src should be rewritten: ${result.images[0].src}`,
  );
  assert.ok(result.images[0].src.includes('example.com/img/photo.png'));
  assert.equal(result.images[0].alt, 'photo');
});

test('image src rewritten for absolute URL', () => {
  const html = '<img src="https://cdn.example.com/img.png" alt="img">';
  const result = extractContent(html, TS, BASE_URL);
  assert.equal(result.images.length, 1);
  assert.ok(
    result.images[0].src.startsWith(`https://web.archive.org/web/${TS}id_/`),
    `Image src should be rewritten`,
  );
  assert.ok(result.images[0].src.includes('cdn.example.com/img.png'));
});

test('image src already archive URL is kept', () => {
  const html = '<img src="https://web.archive.org/web/20010504120000id_/https://example.com/img.png" alt="x">';
  const result = extractContent(html, TS, BASE_URL);
  assert.equal(result.images.length, 1);
  assert.ok(result.images[0].src.includes('web.archive.org/web/'));
});

test('javascript: image src dropped', () => {
  const html = '<img src="javascript:alert(1)" alt="x">';
  const result = extractContent(html, TS, BASE_URL);
  assert.equal(result.images.length, 0, 'javascript: image should be dropped');
});

// ---------------------------------------------------------------------------
// Property: External link hardening — rel="noopener noreferrer"
// ---------------------------------------------------------------------------
test('external links get rel="noopener noreferrer"', () => {
  const html = '<a href="https://other.com/page">link</a>';
  const result = extractContent(html, TS, BASE_URL);
  assert.ok(result.content.includes('rel="noopener noreferrer"'), 'external link should have rel');
  assert.ok(result.content.includes('target="_blank"'), 'external link should have target');
});

test('internal anchor links do not get rel', () => {
  const html = '<a href="#section">section</a>';
  const result = extractContent(html, TS, BASE_URL);
  assert.ok(result.content.includes('#section'), 'anchor link should survive');
  assert.ok(!result.content.includes('rel="noopener'), 'anchor link should not get rel');
});

test('javascript: link href dropped', () => {
  const html = '<a href="javascript:alert(1)">click</a>';
  const result = extractContent(html, TS, BASE_URL);
  assert.ok(!result.content.toLowerCase().includes('javascript:'), 'javascript: link should be stripped');
});

// ---------------------------------------------------------------------------
// Property: Structural preservation — safe content survives
// ---------------------------------------------------------------------------
test('headings survive extraction', () => {
  const html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
  const result = extractContent(html, TS, BASE_URL);
  assert.ok(result.content.includes('Title'), 'h1 text should survive');
  assert.ok(result.content.includes('Subtitle'), 'h2 text should survive');
  assert.ok(result.content.includes('Section'), 'h3 text should survive');
});

test('paragraphs survive extraction', () => {
  const html = '<p>First paragraph.</p><p>Second paragraph.</p>';
  const result = extractContent(html, TS, BASE_URL);
  assert.ok(result.content.includes('First paragraph.'), 'first p should survive');
  assert.ok(result.content.includes('Second paragraph.'), 'second p should survive');
});

test('list items survive extraction', () => {
  const html = '<ul><li>Item A</li><li>Item B</li></ul>';
  const result = extractContent(html, TS, BASE_URL);
  assert.ok(result.content.includes('Item A'), 'li A should survive');
  assert.ok(result.content.includes('Item B'), 'li B should survive');
});

// ---------------------------------------------------------------------------
// Property: Determinism — same input → byte-identical output
// ---------------------------------------------------------------------------
test('deterministic: same input yields same output', () => {
  const rng = makeRng(7);
  const fragments = [
    '<h1>Test</h1><p>Content</p>',
    '<ul><li>A</li><li>B</li></ul>',
    '<a href="https://x.com">link</a>',
    '<img src="/img.png" alt="img">',
    '<p>Text</p><script>alert(1)</script>',
  ];
  for (let i = 0; i < 50; i++) {
    const html = pick(rng, fragments);
    const r1 = extractContent(html, TS, BASE_URL);
    const r2 = extractContent(html, TS, BASE_URL);
    assert.deepEqual(r1, r2, `Non-deterministic for: ${html}`);
  }
});

// ---------------------------------------------------------------------------
// Title extraction
// ---------------------------------------------------------------------------
test('title extracted from head', () => {
  const html = '<html><head><title>My Page</title></head><body><p>text</p></body></html>';
  const result = extractContent(html, TS, BASE_URL);
  assert.equal(result.title, 'My Page');
});

test('title empty when no title tag', () => {
  const html = '<html><body><p>text</p></body></html>';
  const result = extractContent(html, TS, BASE_URL);
  assert.equal(result.title, '');
});

// ---------------------------------------------------------------------------
// extractText
// ---------------------------------------------------------------------------
test('extractText returns plain text', () => {
  const html = '<h1>Title</h1><p>First sentence.</p><p>Second sentence.</p>';
  const text = extractText(html);
  assert.ok(text.includes('Title'), 'text should include heading');
  assert.ok(text.includes('First sentence.'), 'text should include paragraph');
  assert.ok(text.includes('Second sentence.'), 'text should include second paragraph');
});

test('extractText strips script content', () => {
  const html = '<script>alert(1)</script><p>safe</p>';
  const text = extractText(html);
  assert.ok(!text.includes('alert'), 'script content should not be in text');
  assert.ok(text.includes('safe'), 'safe text should be included');
});
