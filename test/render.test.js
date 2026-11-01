import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSnapshotDate, renderRebornContent, renderStandaloneHtml, buildProvenance } from '../src/render.js';

test('formatSnapshotDate formats correctly', () => {
  assert.equal(formatSnapshotDate('20010504120000'), 'May 4, 2001');
  assert.equal(formatSnapshotDate('20230310153000'), 'March 10, 2023');
  assert.equal(formatSnapshotDate('19990101000000'), 'January 1, 1999');
  assert.equal(formatSnapshotDate('20011231235959'), 'December 31, 2001');
});

test('formatSnapshotDate handles edge cases', () => {
  assert.equal(formatSnapshotDate(''), '');
  assert.equal(formatSnapshotDate(null), '');
  assert.equal(formatSnapshotDate('2001'), '');
  assert.equal(formatSnapshotDate(undefined), '');
});

test('buildProvenance creates correct object', () => {
  const p = buildProvenance('https://example.com/old', '20010504120000');
  assert.equal(p.originalUrl, 'https://example.com/old');
  assert.equal(p.timestamp, '20010504120000');
  assert.equal(p.snapshotDate, 'May 4, 2001');
  assert.equal(p.archiveLink, 'https://web.archive.org/web/20010504120000/https://example.com/old');
});

test('renderRebornContent produces article HTML', () => {
  const html = renderRebornContent({
    title: 'My Page',
    content: '<p>Hello world</p>',
    provenance: buildProvenance('https://example.com/old', '20010504120000'),
  });
  assert.ok(html.includes('<article'), 'should contain article tag');
  assert.ok(html.includes('My Page'), 'should contain title');
  assert.ok(html.includes('Hello world'), 'should contain content');
  assert.ok(html.includes('Provenance'), 'should contain provenance footer');
  assert.ok(html.includes('example.com/old'), 'should contain original URL');
});

test('renderRebornContent handles empty title', () => {
  const html = renderRebornContent({
    title: '',
    content: '<p>text</p>',
    provenance: buildProvenance('https://example.com/', '20010504120000'),
  });
  assert.ok(html.includes('Untitled'), 'should show Untitled for empty title');
});

test('renderRebornContent handles empty content', () => {
  const html = renderRebornContent({
    title: 'Page',
    content: '',
    provenance: buildProvenance('https://example.com/', '20010504120000'),
  });
  assert.ok(html.includes('No content was extracted'), 'should show fallback message');
});

test('renderStandaloneHtml produces full HTML document', () => {
  const html = renderStandaloneHtml({
    title: 'My Page',
    content: '<p>Hello</p>',
    provenance: buildProvenance('https://example.com/old', '20010504120000'),
  });
  assert.ok(html.includes('<!doctype html>'), 'should start with doctype');
  assert.ok(html.includes('<html'), 'should contain html tag');
  assert.ok(html.includes('</html>'), 'should close html tag');
  assert.ok(html.includes('<style>'), 'should contain inline CSS');
  assert.ok(html.includes('<title>My Page</title>'), 'should contain title');
  assert.ok(html.includes('Hello'), 'should contain content');
  assert.ok(html.includes('Provenance'), 'should contain provenance footer');
});

test('renderStandaloneHtml has no external scripts or stylesheets', () => {
  const html = renderStandaloneHtml({
    title: 'Test',
    content: '<p>text</p>',
    provenance: buildProvenance('https://example.com/', '20010504120000'),
  });
  assert.ok(!html.includes('<script'), 'should not contain script tags');
  assert.ok(!html.includes('<link'), 'should not contain link tags');
  assert.ok(!html.includes('src='), 'should not contain external src');
});

test('renderStandaloneHtml escapes HTML in title', () => {
  const html = renderStandaloneHtml({
    title: '<script>alert(1)</script>',
    content: '<p>text</p>',
    provenance: buildProvenance('https://example.com/', '20010504120000'),
  });
  assert.ok(!html.includes('<script>alert(1)</script>'), 'should escape title');
  assert.ok(html.includes('&lt;script&gt;'), 'should contain escaped script tag');
});

test('renderRebornContent escapes title', () => {
  const html = renderRebornContent({
    title: '<img src=x onerror=alert(1)>',
    content: '<p>text</p>',
    provenance: buildProvenance('https://example.com/', '20010504120000'),
  });
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'), 'should escape dangerous title');
  assert.ok(html.includes('&lt;img'), 'should contain escaped img');
});

test('provenance footer contains archive link', () => {
  const provenance = buildProvenance('https://example.com/old', '20010504120000');
  const html = renderRebornContent({
    title: 'Test',
    content: '<p>text</p>',
    provenance,
  });
  assert.ok(html.includes('web.archive.org/web/20010504120000/'), 'footer should contain archive link');
});
