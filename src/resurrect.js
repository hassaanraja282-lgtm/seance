import { validateUrl, isValidTimestamp } from './url.js';
import { LRUCache } from './cache.js';
import { extractContent, extractText } from './extract.js';
import { sanitizeHtml } from './sanitize.js';
import { summarize } from './gemini.js';
import { renderRebornContent, renderStandaloneHtml, buildProvenance } from './render.js';
import { getSnapshots } from './snapshots.js';

/**
 * Timeout for fetching archived HTML (ms).
 * @type {number}
 */
export const RESURRECT_TIMEOUT = 15000;

/**
 * User-Agent for Wayback Machine requests.
 * @type {string}
 */
const USER_AGENT = 'Seance/1.0 (+https://github.com/hassaanraja282-lgtm/seance)';

/**
 * Shared LRU cache for resurrection results.
 * @type {LRUCache<string, object>}
 */
const resurrectCache = new LRUCache(50);

/**
 * Build a cache key from url + ts.
 * @param {string} url
 * @param {string} ts
 * @returns {string}
 */
function cacheKey(url, ts) {
  return `${url}|${ts}`;
}

/**
 * Format a CDX timestamp for the archive fetch URL.
 * @param {string} ts
 * @returns {string}
 */
function formatTs(ts) {
  return ts.replace(/[^0-9]/g, '');
}

/**
 * Resurrect an archived page from the Wayback Machine.
 *
 * @param {string} rawUrl - user-provided URL
 * @param {string} [ts] - 14-digit CDX timestamp (optional; uses latest 200 if omitted)
 * @param {{ fetch?: typeof globalThis.fetch, timeout?: number }} [opts]
 * @returns {Promise<{ ok: true, result: ResurrectResult } | { ok: false, reason: string, code?: number }>}
 */
export async function resurrect(rawUrl, ts, opts = {}) {
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const timeout = opts.timeout ?? RESURRECT_TIMEOUT;

  // Validate URL
  const validation = await validateUrl(rawUrl);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason, code: 400 };
  }

  const url = validation.url.href;

  // Validate or resolve timestamp
  let resolvedTs = ts;
  if (!resolvedTs) {
    // Use latest 200 snapshot
    const snapResult = await getSnapshots(url, { fetch: fetchFn });
    if (!snapResult.ok) {
      return { ok: false, reason: 'Could not retrieve remains', code: snapResult.code ?? 502 };
    }
    if (snapResult.result.total === 0 || !snapResult.result.snapshots.length) {
      return { ok: false, reason: 'No snapshots found for this URL', code: 404 };
    }
    // Snapshots are sorted ascending; take the last one
    resolvedTs = snapResult.result.snapshots[snapResult.result.snapshots.length - 1].timestamp;
  } else {
    if (!isValidTimestamp(resolvedTs)) {
      return { ok: false, reason: 'Invalid timestamp', code: 400 };
    }
    resolvedTs = formatTs(resolvedTs);
  }

  // Check cache
  const key = cacheKey(url, resolvedTs);
  const cached = resurrectCache.get(key);
  if (cached) {
    return { ok: true, result: cached };
  }

  // Fetch archived HTML
  const archiveUrl = `https://web.archive.org/web/${resolvedTs}id_/${url}`;
  let rawHtml;
  try {
    rawHtml = await fetchArchivedHtml(fetchFn, archiveUrl, timeout);
  } catch (err) {
    // Log generic error, never log full response or key
    console.error('Archived HTML fetch failed');
    return { ok: false, reason: 'Could not retrieve remains', code: 502 };
  }

  // Sanitize (extractContent sanitizes internally via sanitizeToTree)
  const { title, content, images } = extractContent(rawHtml, resolvedTs, url);

  // Extract text for summarizer
  const text = extractText(rawHtml);

  // Summarize (Gemini or fallback)
  const summary = await summarize(text, title, opts);

  // Build provenance
  const provenance = buildProvenance(url, resolvedTs);

  // Render content and standalone HTML
  const renderedContent = renderRebornContent({ title, content, provenance });
  const downloadHtml = renderStandaloneHtml({ title, content, provenance });

  // Build the result
  const result = {
    url,
    ts: resolvedTs,
    title: title || 'Untitled',
    content: renderedContent,
    images,
    spiritMessage: summary.spiritMessage,
    epitaph: summary.epitaph,
    searchQueries: summary.searchQueries,
    source: summary.source,
    provenance,
    downloadHtml,
  };

  // Cache it
  resurrectCache.set(key, result);

  return { ok: true, result };
}

/**
 * Fetch raw archived HTML from the Wayback Machine.
 * @param {typeof fetch} fetchFn
 * @param {string} archiveUrl
 * @param {number} timeout
 * @returns {Promise<string>}
 */
async function fetchArchivedHtml(fetchFn, archiveUrl, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetchFn(archiveUrl, {
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
    throw new Error(`Archive returned ${response.status}`);
  }

  const html = await response.text();
  return html;
}

/**
 * Clear the resurrection cache (for testing).
 */
export function clearResurrectCache() {
  resurrectCache.clear();
}
