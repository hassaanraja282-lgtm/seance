import { validateUrlForFetch } from './url.js';
import { STATUS_CODES } from 'node:http';

/**
 * Default timeout for live fetch (ms).
 * @type {number}
 */
export const PULSE_TIMEOUT = 8000;

/**
 * Check whether a URL is alive or dead, classifying the cause of death.
 *
 * @param {string} rawUrl - user-provided URL
 * @param {{ fetch?: typeof globalThis.fetch, timeout?: number }} [opts]
 * @returns {Promise<{ ok: true, result: PulseResult } | { ok: false, reason: string }>}
 */
export async function checkPulse(rawUrl, opts = {}) {
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const timeout = opts.timeout ?? PULSE_TIMEOUT;

  const validation = await validateUrlForFetch(rawUrl, opts.dnsLookup ? { dnsLookup: opts.dnsLookup } : {});
  if (!validation.ok) {
    if (validation.reason === 'dns_failure') {
      // A vanished domain is a death, not a bad request (T16).
      return {
        ok: true,
        result: { url: String(rawUrl).trim(), status: 'DEAD', cause: 'dns_failure', httpStatus: null, detail: 'Domain no longer resolves' },
      };
    }
    return { ok: false, reason: validation.reason };
  }

  const url = validation.url;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let response;
    try {
      response = await fetchFn(url.href, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Seance/1.0 (+https://github.com/hassaanraja282-lgtm/seance)' },
      });
    } catch (err) {
      clearTimeout(timer);
      return classifyFetchError(err, url.href);
    }
    clearTimeout(timer);

    const status = response.status;

    // Check for "possessed" — redirect to a different host (body-snatched)
    if (response.url) {
      try {
        const finalUrl = new URL(response.url);
        const bare = (h) => h.toLowerCase().replace(/^www\./, '');
        if (bare(finalUrl.hostname) !== bare(url.hostname)) {
          return {
            ok: true,
            result: {
              url: url.href,
              status: 'DEAD',
              cause: 'possessed',
              httpStatus: status,
              detail: `Redirected to ${finalUrl.hostname}`,
            },
          };
        }
      } catch {
        // If we can't parse the final URL, ignore and continue
      }
    }

    if (status >= 200 && status < 400) {
      return {
        ok: true,
        result: {
          url: url.href,
          status: 'ALIVE',
          httpStatus: status,
        },
      };
    }

    // Dead — HTTP error
    let cause;
    if (status === 404) {
      cause = '404';
    } else if (status >= 500) {
      cause = '5xx';
    } else {
      // Other 4xx / unexpected
      cause = String(status);
    }

    // Short human string only; never echo the response body (T16).
    const detail = `${status} ${STATUS_CODES[status] || response.statusText || ''}`.trim();
    try { await response.body?.cancel(); } catch { /* ignore */ }

    return {
      ok: true,
      result: {
        url: url.href,
        status: 'DEAD',
        cause,
        httpStatus: status,
        detail,
      },
    };
  } catch (err) {
    return classifyFetchError(err, url.href);
  }
}

/**
 * @param {Error} err
 * @param {string} href
 * @returns {{ ok: true, result: PulseResult }}
 */
function classifyFetchError(err, href) {
  // AbortController timeout
  if (err.name === 'AbortError' || err.name === 'TimeoutError') {
    return {
      ok: true,
      result: {
        url: href,
        status: 'DEAD',
        cause: 'timeout',
        httpStatus: null,
        detail: `Timed out after ${PULSE_TIMEOUT}ms`,
      },
    };
  }

  // DNS failure
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('enotfound') || msg.includes('dns') || msg.includes('getaddrinfo') || msg.includes('resolve')) {
    return {
      ok: true,
      result: {
        url: href,
        status: 'DEAD',
        cause: 'dns_failure',
        httpStatus: null,
        detail: 'DNS lookup failed',
      },
    };
  }

  // Connection refused / ECONNREFUSED
  if (msg.includes('econnrefused') || msg.includes('connection refused')) {
    return {
      ok: true,
      result: {
        url: href,
        status: 'DEAD',
        cause: 'connection_refused',
        httpStatus: null,
        detail: 'Connection refused',
      },
    };
  }

  // Timeout via fetch TimeoutError
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return {
      ok: true,
      result: {
        url: href,
        status: 'DEAD',
        cause: 'timeout',
        httpStatus: null,
        detail: 'Timed out',
      },
    };
  }

  // Other network errors
  return {
    ok: true,
    result: {
      url: href,
      status: 'DEAD',
      cause: 'network_error',
      httpStatus: null,
      detail: msg || 'Network error',
    },
  };
}

/**
 * @typedef {Object} PulseResult
 * @property {string} url
 * @property {'ALIVE'|'DEAD'} status
 * @property {string} [cause] - '404' | '5xx' | 'dns_failure' | 'connection_refused' | 'timeout' | 'network_error' | 'possessed'
 * @property {number|null} [httpStatus]
 * @property {string} [detail]
 */
