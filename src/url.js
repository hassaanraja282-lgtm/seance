import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// ---------------------------------------------------------------------------
// Syntax validation — no DNS, safe to call on any URL
// ---------------------------------------------------------------------------

/**
 * Validate URL syntax without performing any DNS lookups.
 *
 * Rules:
 *  - scheme must be http or https
 *  - no userinfo (user:pass@)
 *  - no localhost / literal private / loopback / link-local / metadata IPs
 *  - no blocked literal hostnames (localhost, 0.0.0.0, metadata.google.internal)
 *
 * @param {string} raw - the raw URL string from the user
 * @returns {{ ok: true, url: URL } | { ok: false, reason: string }}
 */
export function validateUrlSyntax(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, reason: 'Invalid or unsafe URL' };
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'Invalid or unsafe URL' };
  }

  // Scheme allowlist
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Invalid or unsafe URL' };
  }

  // No userinfo
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Invalid or unsafe URL' };
  }

  // WHATWG URL keeps IPv6 literals bracketed ("[::1]"); strip them so isIP() sees the address.
  const hostname = parsed.hostname.replace(/^\[(.*)\]$/, '$1');
  if (!hostname) {
    return { ok: false, reason: 'Invalid or unsafe URL' };
  }

  // Block literal hostnames
  const blockedHostnames = new Set([
    'localhost',
    '0.0.0.0',
    'metadata.google.internal',
  ]);
  if (blockedHostnames.has(hostname.toLowerCase())) {
    return { ok: false, reason: 'Invalid or unsafe URL' };
  }

  // Check if hostname is a literal IP
  const ipType = isIP(hostname);
  if (ipType) {
    if (isBlockedIP(hostname, ipType)) {
      return { ok: false, reason: 'Invalid or unsafe URL' };
    }
  }

  return { ok: true, url: parsed };
}

// ---------------------------------------------------------------------------
// Fetch validation — syntax + DNS resolution (used by pulse only)
// ---------------------------------------------------------------------------

/**
 * Validate a URL for safe outbound fetching, including DNS resolution.
 *
 * Extends validateUrlSyntax with a DNS check: resolves the hostname and
 * rejects if any resolved IP is in a blocked range. A DNS failure
 * (ENOTFOUND/EAI_AGAIN) is NOT treated as unsafe — it returns
 * { ok: false, reason: 'dns_failure' } so the caller (pulse) can report
 * 200 DEAD instead of 400.
 *
 * @param {string} raw - the raw URL string from the user
 * @param {{ dnsLookup?: function }} [opts] - optional DNS lookup override (for testing)
 * @returns {Promise<{ ok: true, url: URL } | { ok: false, reason: string }>}
 */
export async function validateUrlForFetch(raw, opts = {}) {
  const lookupFn = opts.dnsLookup ?? lookup;

  const syntax = validateUrlSyntax(raw);
  if (!syntax.ok) {
    return syntax;
  }

  const hostname = syntax.url.hostname.replace(/^\[(.*)\]$/, '$1');

  // Literal IPs are already checked in syntax validation — no DNS needed
  const ipType = isIP(hostname);
  if (ipType) {
    return syntax;
  }

  // DNS resolution check
  let addresses;
  try {
    addresses = await lookupFn(hostname, { all: true });
  } catch {
    // DNS failure — not a safety issue, the domain is just dead
    return { ok: false, reason: 'dns_failure' };
  }

  if (!addresses || addresses.length === 0) {
    return { ok: false, reason: 'dns_failure' };
  }

  for (const addr of addresses) {
    const family = addr.family === 6 ? 6 : 4;
    const category = blockedCategory(addr.address, family);
    if (category) {
      // Log the blocked resolution for diagnostics (no secrets)
      console.error(`[SSRF] Blocked resolution: ${hostname} -> ${addr.address} (${category})`);
      return { ok: false, reason: 'Invalid or unsafe URL' };
    }
  }

  return { ok: true, url: syntax.url };
}

/**
 * Backward-compatible alias for validateUrlForFetch.
 * @deprecated Use validateUrlForFetch or validateUrlSyntax directly.
 */
export async function validateUrl(raw, opts = {}) {
  return validateUrlForFetch(raw, opts);
}

// ---------------------------------------------------------------------------
// IP blocking
// ---------------------------------------------------------------------------

/**
 * Determine the category of a blocked IP address.
 * @param {string} ip - the IP address string
 * @param {4|6} [family] - address family (4 or 6), auto-detected if omitted
 * @returns {string|null} - category string if blocked, null if safe
 */
export function blockedCategory(ip, family) {
  if (!family) {
    family = isIP(ip);
  }

  if (family === 4) {
    return blockedIPv4Category(ip);
  }
  if (family === 6) {
    return blockedIPv6Category(ip);
  }
  // Unknown family — block to be safe
  return 'unknown';
}

/**
 * Check whether an IP address falls into a blocked range.
 * @param {string} ip - the IP address string
 * @param {4|6} [family] - address family (4 or 6), auto-detected if omitted
 * @returns {boolean}
 */
export function isBlockedIP(ip, family) {
  return blockedCategory(ip, family) !== null;
}

/**
 * @param {string} ip
 * @returns {string|null}
 */
function blockedIPv4Category(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return 'malformed'; // malformed → block
  }
  const [a, b] = parts;

  // 127.0.0.0/8
  if (a === 127) return 'loopback';
  // 10.0.0.0/8
  if (a === 10) return 'private (10/8)';
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return 'private (172.16/12)';
  // 192.168.0.0/16
  if (a === 192 && b === 168) return 'private (192.168/16)';
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return 'link-local';
  // 0.0.0.0
  if (a === 0 && parts[1] === 0 && parts[2] === 0 && parts[3] === 0) return 'unspecified';
  // 100.64.0.0/10 (carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return 'carrier-grade NAT';

  return null;
}

/**
 * @param {string} ip
 * @returns {string|null}
 */
function blockedIPv6Category(ip) {
  const addr = ip.toLowerCase();

  // ::1 loopback
  if (addr === '::1') return 'loopback';
  // :: (unspecified)
  if (addr === '::') return 'unspecified';

  // fc00::/7 (unique local)
  // fe80::/10 (link-local)
  const expanded = expandIPv6(addr);
  if (!expanded) return 'malformed'; // malformed → block

  const firstGroup = parseInt(expanded.split(':')[0], 16);
  const firstByte = (firstGroup >> 8) & 0xff;  // top 8 bits of first group
  const secondByte = firstGroup & 0xff;         // lower 8 bits of first group

  // fc00::/7 — first 7 bits are 1111 110x (first byte 0xfc or 0xfd)
  if ((firstByte & 0xfe) === 0xfc) return 'unique local (fc00::/7)';
  // fe80::/10 — first 10 bits: first byte 0xfe, top 2 bits of second byte are 10
  if (firstByte === 0xfe && (secondByte & 0xc0) === 0x80) return 'link-local (fe80::/10)';

  // IPv4-mapped (::ffff:x.x.x.x)
  const v4match = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
  if (v4match) {
    return blockedIPv4Category(v4match[1]);
  }

  return null;
}

/**
 * Expand an IPv6 address to full 8-group form (without leading-zero compression).
 * Returns null if the address is malformed.
 * @param {string} addr
 * @returns {string|null}
 */
function expandIPv6(addr) {
  // Handle IPv4-mapped separately
  if (addr.includes('.')) {
    return addr; // good enough for prefix checks above
  }

  // Handle :: compression
  const parts = addr.split(':');
  if (parts.length > 8) return null;

  // Find the empty span from ::
  const emptyIdx = parts.indexOf('');
  if (emptyIdx !== -1) {
    // Count how many full groups we have
    const fullGroups = parts.filter((p) => p !== '').length;
    const missing = 8 - fullGroups;
    // Replace the empty group(s) with the right number of zero groups
    parts.splice(emptyIdx, 1, ...Array(missing).fill('0'));
    // If there were two consecutive empties (::), remove the second empty
    if (parts[emptyIdx + 1] === '') {
      parts.splice(emptyIdx + 1, 1);
    }
  }

  if (parts.length !== 8) return null;

  // Pad each group to 4 hex digits
  return parts.map((p) => p.padStart(4, '0')).join(':');
}

// ---------------------------------------------------------------------------
// Timestamp validation
// ---------------------------------------------------------------------------

/**
 * Validate a 14-digit CDX timestamp (yyyyMMddHHmmss).
 * @param {string} ts
 * @returns {boolean}
 */
export function isValidTimestamp(ts) {
  if (typeof ts !== 'string' || ts.length !== 14 || !/^\d{14}$/.test(ts)) {
    return false;
  }
  const year = parseInt(ts.slice(0, 4), 10);
  const month = parseInt(ts.slice(4, 6), 10);
  const day = parseInt(ts.slice(6, 8), 10);
  const hour = parseInt(ts.slice(8, 10), 10);
  const minute = parseInt(ts.slice(10, 12), 10);
  const second = parseInt(ts.slice(12, 14), 10);

  return (
    year >= 1990 && year <= 2099 &&
    month >= 1 && month <= 12 &&
    day >= 1 && day <= 31 &&
    hour >= 0 && hour <= 23 &&
    minute >= 0 && minute <= 59 &&
    second >= 0 && second <= 59
  );
}
