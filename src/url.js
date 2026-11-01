import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Validate a user-provided URL for safe outbound fetching.
 *
 * Rules (see .kiro/steering/security.md):
 *  - scheme must be http or https
 *  - no userinfo (user:pass@)
 *  - no localhost / private / loopback / link-local / metadata IPs
 *  - DNS resolution check: resolve hostname, reject if any resolved IP is blocked
 *
 * @param {string} raw - the raw URL string from the user
 * @returns {Promise<{ ok: true, url: URL } | { ok: false, reason: string }>}
 */
export async function validateUrl(raw) {
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

  const hostname = parsed.hostname;
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
  } else {
    // DNS resolution check — reject if any resolved IP is blocked
    let addresses;
    try {
      addresses = await lookup(hostname, { all: true });
    } catch {
      // DNS failure is a rejection for safety
      return { ok: false, reason: 'Invalid or unsafe URL' };
    }
    if (addresses.length === 0) {
      return { ok: false, reason: 'Invalid or unsafe URL' };
    }
    for (const addr of addresses) {
      const family = addr.family === 6 ? 6 : 4;
      if (isBlockedIP(addr.address, family)) {
        return { ok: false, reason: 'Invalid or unsafe URL' };
      }
    }
  }

  return { ok: true, url: parsed };
}

/**
 * Check whether an IP address falls into a blocked range.
 * @param {string} ip - the IP address string
 * @param {4|6} [family] - address family (4 or 6), auto-detected if omitted
 * @returns {boolean}
 */
export function isBlockedIP(ip, family) {
  if (!family) {
    family = isIP(ip);
  }

  if (family === 4) {
    return isBlockedIPv4(ip);
  }
  if (family === 6) {
    return isBlockedIPv6(ip);
  }
  // Unknown family — block to be safe
  return true;
}

/**
 * @param {string} ip
 * @returns {boolean}
 */
function isBlockedIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed → block
  }
  const [a, b] = parts;

  // 127.0.0.0/8
  if (a === 127) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0
  if (a === 0 && parts[1] === 0 && parts[2] === 0 && parts[3] === 0) return true;
  // 100.64.0.0/10 (carrier-grade NAT) — block to be safe
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

/**
 * @param {string} ip
 * @returns {boolean}
 */
function isBlockedIPv6(ip) {
  const addr = ip.toLowerCase();

  // ::1 loopback
  if (addr === '::1') return true;
  // :: (unspecified)
  if (addr === '::') return true;

  // fc00::/7 (unique local)
  // fe80::/10 (link-local)
  // Normalize to check prefixes
  const expanded = expandIPv6(addr);
  if (!expanded) return true; // malformed → block

  const firstGroup = parseInt(expanded.split(':')[0], 16);
  const firstByte = (firstGroup >> 8) & 0xff;  // top 8 bits of first group
  const secondByte = firstGroup & 0xff;         // lower 8 bits of first group

  // fc00::/7 — first 7 bits are 1111 110x (first byte 0xfc or 0xfd)
  if ((firstByte & 0xfe) === 0xfc) return true;
  // fe80::/10 — first 10 bits: first byte 0xfe, top 2 bits of second byte are 10
  if (firstByte === 0xfe && (secondByte & 0xc0) === 0x80) return true;

  // IPv4-mapped (::ffff:x.x.x.x)
  const v4match = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
  if (v4match) {
    return isBlockedIPv4(v4match[1]);
  }

  return false;
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
