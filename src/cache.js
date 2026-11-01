/**
 * Tiny in-memory LRU cache backed by a Map.
 *
 * Map preserves insertion order, so LRU eviction is implemented by
 * deleting and re-inserting on access (get/set) to move a key to the end
 * (most-recently-used). When the cache exceeds `maxSize`, the oldest
 * entry (first key in iteration order) is deleted.
 *
 * @template K, V
 */
export class LRUCache {
  /**
   * @param {number} maxSize - maximum number of entries
   */
  constructor(maxSize = 100) {
    if (typeof maxSize !== 'number' || maxSize <= 0) {
      throw new Error('maxSize must be a positive number');
    }
    this.maxSize = maxSize;
    /** @type {Map<K, V>} */
    this.store = new Map();
  }

  /**
   * Get a value by key, marking it most-recently-used.
   * @param {K} key
   * @returns {V | undefined}
   */
  get(key) {
    if (!this.store.has(key)) {
      return undefined;
    }
    const value = this.store.get(key);
    // Delete and re-insert to move to end (most recent)
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  /**
   * Set a key-value pair, evicting the least-recently-used entry if needed.
   * @param {K} key
   * @param {V} value
   */
  set(key, value) {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      // Evict oldest (first key in iteration order)
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }
    this.store.set(key, value);
  }

  /**
   * Check whether a key exists without updating LRU order.
   * @param {K} key
   * @returns {boolean}
   */
  has(key) {
    return this.store.has(key);
  }

  /**
   * Delete a key.
   * @param {K} key
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * Current number of entries.
   * @returns {number}
   */
  get size() {
    return this.store.size;
  }

  /**
   * Clear all entries.
   */
  clear() {
    this.store.clear();
  }
}
