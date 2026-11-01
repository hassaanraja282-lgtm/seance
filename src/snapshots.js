import { validateUrl } from './url.js';

/**
 * Default timeout for CDX API calls (ms).
 * @type {number}
 */
export const SNAPSHOTS_TIMEOUT = 15000;

/**
 * User-Agent for Wayback Machine requests.
 * @type {string}
 */
const USER_AGENT = 'Seance/1.0 (+https://github.com/hassaanraja282-lgtm/seance)';

/**
 * Query the Wayback Machine CDX API for archived snapshots of a URL.
 *
 * @param {string} rawUrl - user-provided URL
 * @param {{ fetch?: typeof globalThis.fetch, timeout?: number }} [opts]
 * @returns {Promise<{ ok: true, result: SnapshotsResult } | { ok: false, reason: string, code?: number }>}
 */
export async function getSnapshots(rawUrl, opts = {}) {
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const timeout = opts.timeout ?? SNAPSHOTS_TIMEOUT;

  const validation = await validateUrl(rawUrl);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason, code: 400 };
  }

  const url = validation.url.href;

  // Try multiple variants: original, without "www.", with trailing slash
  const variants = generateVariants(url);

  let lastError = null;
  for (const variant of variants) {
    try {
      const result = await queryCdx(fetchFn, variant, timeout);
      // Return immediately if we got snapshots; otherwise try next variant
      if (result.total > 0) {
        return { ok: true, result };
      }
    } catch (err) {
      // Network error — remember it
      lastError = err;
    }
  }

  // If we got a network error on all variants, return 502
  if (lastError) {
    return { ok: false, reason: 'Archive unreachable', code: 502 };
  }

  // No snapshots found on any variant — return empty result
  return {
    ok: true,
    result: {
      url,
      total: 0,
      firstSeen: null,
      lastSeen: null,
      snapshots: [],
      timeline: [],
    },
  };
}

/**
 * Generate URL variants to try when CDX returns no exact matches.
 * @param {string} url
 * @returns {string[]}
 */
function generateVariants(url) {
  const variants = [url];
  try {
    const parsed = new URL(url);
    // Without "www."
    if (parsed.hostname.startsWith('www.')) {
      const noWww = new URL(parsed.href);
      noWww.hostname = parsed.hostname.slice(4);
      variants.push(noWww.href);
    }
    // With trailing slash if path is empty
    if (parsed.pathname === '/' || parsed.pathname === '') {
      const withSlash = new URL(parsed.href);
      if (!withSlash.pathname.endsWith('/')) {
        withSlash.pathname = withSlash.pathname + '/';
        variants.push(withSlash.href);
      }
    }
  } catch {
    // ignore
  }
  // Deduplicate
  return [...new Set(variants)];
}

/**
 * Query the CDX API for a single URL variant.
 * @param {typeof fetch} fetchFn
 * @param {string} url
 * @param {number} timeout
 * @returns {Promise<SnapshotsResult>}
 */
async function queryCdx(fetchFn, url, timeout) {
  const cdxUrl = new URL('https://web.archive.org/cdx/search/cdx');
  cdxUrl.searchParams.set('url', url);
  cdxUrl.searchParams.set('output', 'json');
  cdxUrl.searchParams.set('collapse', 'timestamp:6'); // one per month
  cdxUrl.searchParams.set('filter', 'statuscode:200');
  cdxUrl.searchParams.set('limit', '500');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetchFn(cdxUrl.href, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new Error(`CDX API returned ${response.status}`);
  }

  const data = await response.json();
  return parseCdxResponse(url, data);
}

/**
 * Parse the CDX API JSON response into a SnapshotsResult.
 * @param {string} url
 * @param {any[][]} data - CDX JSON rows (first row is header)
 * @returns {SnapshotsResult}
 */
function parseCdxResponse(url, data) {
  // CDX JSON: first row is column headers, subsequent rows are data
  if (!Array.isArray(data) || data.length === 0) {
    return {
      url,
      total: 0,
      firstSeen: null,
      lastSeen: null,
      snapshots: [],
      timeline: [],
    };
  }

  const headers = data[0];
  const tsIdx = headers.indexOf('timestamp');
  const statusIdx = headers.indexOf('statuscode');
  const digestIdx = headers.indexOf('digest');

  if (tsIdx === -1) {
    return {
      url,
      total: 0,
      firstSeen: null,
      lastSeen: null,
      snapshots: [],
      timeline: [],
    };
  }

  const rows = data.slice(1);
  const snapshots = [];
  const yearCounts = new Map();

  for (const row of rows) {
    const ts = row[tsIdx];
    if (!ts || typeof ts !== 'string' || ts.length < 8) continue;

    const status = statusIdx !== -1 ? String(row[statusIdx] || '') : '';
    const digest = digestIdx !== -1 ? String(row[digestIdx] || '') : '';

    snapshots.push({ timestamp: ts, status, digest });

    const year = parseInt(ts.slice(0, 4), 10);
    if (year) {
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    }
  }

  if (snapshots.length === 0) {
    return {
      url,
      total: 0,
      firstSeen: null,
      lastSeen: null,
      snapshots: [],
      timeline: [],
    };
  }

  // Sort by timestamp
  snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const firstSeen = snapshots[0].timestamp;
  const lastSeen = snapshots[snapshots.length - 1].timestamp;

  // Build timeline sorted by year
  const timeline = [...yearCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, count]) => ({ year, count }));

  return {
    url,
    total: snapshots.length,
    firstSeen,
    lastSeen,
    snapshots,
    timeline,
  };
}

/**
 * @typedef {Object} SnapshotEntry
 * @property {string} timestamp - 14-digit yyyyMMddHHmmss
 * @property {string} status - HTTP status code string
 * @property {string} digest - content digest
 */

/**
 * @typedef {Object} TimelineEntry
 * @property {number} year
 * @property {number} count
 */

/**
 * @typedef {Object} SnapshotsResult
 * @property {string} url
 * @property {number} total
 * @property {string|null} firstSeen
 * @property {string|null} lastSeen
 * @property {SnapshotEntry[]} snapshots
 * @property {TimelineEntry[]} timeline
 */
