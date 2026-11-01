import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHtml, sanitizeToTree } from '../src/sanitize.js';

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

// ---------------------------------------------------------------------------
// Dangerous tags that must not survive
// ---------------------------------------------------------------------------
const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'frame', 'applet', 'noscript'];
const DANGEROUS_META = '<meta http-equiv="refresh" content="0;url=http://evil.com/">';
const DANGEROUS_BASE = '<base href="http://evil.com/">';
const DANGEROUS_LINK = '<link rel="stylesheet" href="http://evil.com/style.css">';

// Tags that are void/self-closing — content check doesn't apply
const VOID_TAGS = new Set(['embed', 'frame', 'base', 'link', 'meta']);

test('dangerous tags are removed entirely', () => {
  for (const tag of DANGEROUS_TAGS) {
    const html = `<${tag}>content here</${tag}>`;
    const result = sanitizeHtml(html).toLowerCase();
    assert.ok(!result.includes(`<${tag}`), `Tag <${tag}> should be removed, got: ${result}`);
    if (!VOID_TAGS.has(tag)) {
      assert.ok(!result.includes('content here'), `Content inside <${tag}> should be removed`);
    }
  }
});

test('meta http-equiv is removed', () => {
  const result = sanitizeHtml(DANGEROUS_META).toLowerCase();
  assert.ok(!result.includes('http-equiv'), 'meta http-equiv should be removed');
  assert.ok(!result.includes('evil.com'), 'redirect target should be removed');
});

test('base tag is removed', () => {
  const result = sanitizeHtml(DANGEROUS_BASE).toLowerCase();
  assert.ok(!result.includes('<base'), 'base tag should be removed');
});

test('link tag is removed', () => {
  const result = sanitizeHtml(DANGEROUS_LINK).toLowerCase();
  assert.ok(!result.includes('<link'), 'link tag should be removed');
});

// ---------------------------------------------------------------------------
// Property: No event handlers survive
// ---------------------------------------------------------------------------
const EVENT_HANDLERS = [
  'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onfocus',
  'onblur', 'onsubmit', 'onchange', 'onkeydown', 'onkeyup', 'oninput',
  'ondrag', 'ondrop', 'onmouseenter', 'onmouseleave',
];

test('event handler attributes are stripped', () => {
  const rng = makeRng(42);
  for (let i = 0; i < 200; i++) {
    const handler = pick(rng, EVENT_HANDLERS);
    const tag = pick(rng, ['div', 'p', 'span', 'a', 'img', 'h1', 'ul', 'li']);
    const value = pick(rng, ['alert(1)', 'evil()', "document.location='x'", 'void(0)']);
    const html = `<${tag} ${handler}="${value}">text</${tag}>`;
    const result = sanitizeHtml(html).toLowerCase();
    assert.ok(!result.includes(handler), `Handler ${handler} should be stripped: ${result}`);
  }
});

// ---------------------------------------------------------------------------
// Property: No style attributes survive
// ---------------------------------------------------------------------------
test('style attributes are stripped', () => {
  const rng = makeRng(99);
  const styleValues = [
    'color:red', 'display:none', 'position:absolute;top:0;left:0',
    'background:url(javascript:alert(1))', 'width:100%;height:100%',
  ];
  for (let i = 0; i < 100; i++) {
    const tag = pick(rng, ['div', 'p', 'span', 'a', 'h1', 'ul']);
    const style = pick(rng, styleValues);
    const html = `<${tag} style="${style}">text</${tag}>`;
    const result = sanitizeHtml(html).toLowerCase();
    assert.ok(!result.includes('style='), `style attribute should be stripped: ${result}`);
  }
});

// ---------------------------------------------------------------------------
// Property: No javascript:/vbscript: URIs survive
// ---------------------------------------------------------------------------
test('javascript: and vbscript: URIs are stripped from href', () => {
  const uris = [
    'javascript:alert(1)', 'javascript:void(0)', 'vbscript:msgbox(1)',
    'javascript:document.cookie', 'JaVaScRiPt:alert(1)',
  ];
  for (const uri of uris) {
    const html = `<a href="${uri}">click</a>`;
    const result = sanitizeHtml(html).toLowerCase();
    assert.ok(!result.includes('javascript:'), `javascript: URI should be stripped: ${result}`);
    assert.ok(!result.includes('vbscript:'), `vbscript: URI should be stripped: ${result}`);
  }
});

test('javascript: URIs stripped from src', () => {
  const html = '<img src="javascript:alert(1)" alt="x">';
  const result = sanitizeHtml(html).toLowerCase();
  assert.ok(!result.includes('javascript:'), `javascript: src should be stripped: ${result}`);
});

// ---------------------------------------------------------------------------
// Property: Safe content is preserved
// ---------------------------------------------------------------------------
test('safe headings and paragraphs survive', () => {
  const html = '<h1>Title</h1><p>Paragraph text</p><h2>Subtitle</h2><p>More text</p>';
  const result = sanitizeHtml(html);
  assert.ok(result.includes('Title'), 'h1 text should survive');
  assert.ok(result.includes('Paragraph text'), 'p text should survive');
  assert.ok(result.includes('Subtitle'), 'h2 text should survive');
  assert.ok(result.includes('More text'), 'second p text should survive');
});

test('safe lists survive', () => {
  const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
  const result = sanitizeHtml(html);
  assert.ok(result.includes('Item 1'), 'li text should survive');
  assert.ok(result.includes('Item 2'), 'li text should survive');
});

test('safe links survive (href preserved)', () => {
  const html = '<a href="https://example.com/page">link text</a>';
  const result = sanitizeHtml(html);
  assert.ok(result.includes('link text'), 'link text should survive');
  assert.ok(result.includes('https://example.com/page'), 'safe href should survive');
});

test('safe images survive (src preserved)', () => {
  const html = '<img src="https://example.com/img.png" alt="photo">';
  const result = sanitizeHtml(html);
  assert.ok(result.includes('example.com/img.png'), 'safe img src should survive');
  assert.ok(result.includes('photo'), 'alt text should survive');
});

// ---------------------------------------------------------------------------
// Determinism: same input → byte-identical output
// ---------------------------------------------------------------------------
test('deterministic: same input yields same output', () => {
  const rng = makeRng(7);
  const tags = ['div', 'p', 'span', 'h1', 'h2', 'ul', 'li', 'a', 'img', 'script', 'iframe'];
  for (let i = 0; i < 50; i++) {
    const tag = pick(rng, tags);
    const content = pick(rng, ['hello', 'world', 'test', 'foo', 'bar']);
    const html = `<${tag}>${content}</${tag}>`;
    const r1 = sanitizeHtml(html);
    const r2 = sanitizeHtml(html);
    assert.equal(r1, r2, `Non-deterministic for: ${html}`);
  }
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
test('empty or null input', () => {
  assert.equal(sanitizeHtml(''), '');
  assert.equal(sanitizeHtml(null), '');
  assert.equal(sanitizeHtml(undefined), '');
});

test('nested dangerous tags removed', () => {
  const html = '<div><script>alert(1)</script><p>safe</p></div>';
  const result = sanitizeHtml(html);
  assert.ok(!result.includes('script'), 'nested script should be removed');
  assert.ok(!result.includes('alert(1)'), 'script content should be removed');
  assert.ok(result.includes('safe'), 'safe content should survive');
});

test('frameset removed', () => {
  const html = '<frameset><frame src="evil.html"></frameset>';
  const result = sanitizeHtml(html).toLowerCase();
  assert.ok(!result.includes('frameset'), 'frameset should be removed');
  assert.ok(!result.includes('frame'), 'frame should be removed');
});

test('style tag removed', () => {
  const html = '<style>body { color: red; }</style><p>text</p>';
  const result = sanitizeHtml(html).toLowerCase();
  assert.ok(!result.includes('<style'), 'style tag should be removed');
  assert.ok(!result.includes('color: red'), 'style content should be removed');
});

test('form elements removed', () => {
  const html = '<form action="javascript:alert(1)"><input type="text"></form>';
  const result = sanitizeHtml(html).toLowerCase();
  assert.ok(!result.includes('<form'), 'form should be removed');
  assert.ok(!result.includes('<input'), 'input should be removed');
});

test('svg and canvas removed', () => {
  const html = '<svg onload="alert(1)"><rect/></svg><canvas id="c"></canvas>';
  const result = sanitizeHtml(html).toLowerCase();
  assert.ok(!result.includes('<svg'), 'svg should be removed');
  assert.ok(!result.includes('<canvas'), 'canvas should be removed');
});

test('sanitizeToTree returns usable root', () => {
  const tree = sanitizeToTree('<div><p>text</p></div>');
  assert.ok(tree.querySelector, 'sanitizeToTree should return a parseable root');
  const p = tree.querySelector('p');
  assert.ok(p, 'p element should exist in sanitized tree');
  assert.equal(p.text, 'text');
});
