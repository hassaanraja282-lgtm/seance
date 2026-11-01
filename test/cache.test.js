import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LRUCache } from '../src/cache.js';

test('basic set/get', () => {
  const cache = new LRUCache(3);
  assert.equal(cache.get('a'), undefined);
  cache.set('a', 1);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.size, 1);
});

test('eviction removes least-recently-used', () => {
  const cache = new LRUCache(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  assert.equal(cache.size, 3);
  // Insert 'd' — 'a' (least recently used) should be evicted
  cache.set('d', 4);
  assert.equal(cache.size, 3);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('b'), 2);
  assert.equal(cache.get('c'), 3);
  assert.equal(cache.get('d'), 4);
});

test('get updates LRU order', () => {
  const cache = new LRUCache(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  // Access 'a' to move it to most-recently-used
  assert.equal(cache.get('a'), 1);
  // Insert 'd' — 'b' should now be evicted (it was least recently used)
  cache.set('d', 4);
  assert.equal(cache.get('a'), 1);   // still present
  assert.equal(cache.get('b'), undefined); // evicted
  assert.equal(cache.get('c'), 3);
  assert.equal(cache.get('d'), 4);
});

test('set on existing key updates value and recency', () => {
  const cache = new LRUCache(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  // Update 'a' — moves it to most-recently-used
  cache.set('a', 10);
  // Insert 'd' — 'b' should be evicted
  cache.set('d', 4);
  assert.equal(cache.get('a'), 10);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('c'), 3);
  assert.equal(cache.get('d'), 4);
});

test('has does not update LRU order', () => {
  const cache = new LRUCache(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  // has should not change recency
  assert.ok(cache.has('a'));
  // Insert 'd' — 'a' should still be evicted
  cache.set('d', 4);
  assert.equal(cache.get('a'), undefined);
});

test('delete removes entry', () => {
  const cache = new LRUCache(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.delete('a');
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.size, 1);
  assert.ok(!cache.has('a'));
  // Deleting non-existent key is a no-op
  cache.delete('a');
  assert.equal(cache.size, 1);
});

test('clear empties cache', () => {
  const cache = new LRUCache(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.clear();
  assert.equal(cache.size, 0);
  assert.equal(cache.get('a'), undefined);
});

test('size never exceeds maxSize', () => {
  const cache = new LRUCache(2);
  for (let i = 0; i < 100; i++) {
    cache.set(`key${i}`, i);
    assert.ok(cache.size <= 2, `size ${cache.size} exceeded maxSize 2`);
  }
  // Only the last two should remain
  assert.equal(cache.get('key98'), 98);
  assert.equal(cache.get('key99'), 99);
  assert.equal(cache.get('key97'), undefined);
});

test('maxSize 1 keeps only the latest', () => {
  const cache = new LRUCache(1);
  cache.set('a', 1);
  assert.equal(cache.get('a'), 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('b'), 2);
});

test('constructor throws for invalid maxSize', () => {
  assert.throws(() => new LRUCache(0));
  assert.throws(() => new LRUCache(-1));
  assert.throws(() => new LRUCache('x'));
});
