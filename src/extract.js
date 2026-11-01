import { sanitizeToTree } from './sanitize.js';

/**
 * Content tags we extract, in order.
 * @type {string[]}
 */
const CONTENT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'tr', 'td', 'th'];

/**
 * Rewrite an image src to point to the archived version.
 * @param {string} src - original src
 * @param {string} ts - 14-digit CDX timestamp
 * @param {string} baseUrl - the original page URL (for relative resolution)
 * @returns {string|null} rewritten URL or null if src is empty/dangerous
 */
function rewriteImageSrc(src, ts, baseUrl) {
  if (!src || typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!trimmed) return null;

  // Already an archive URL
  if (trimmed.startsWith('https://web.archive.org/web/')) {
    return trimmed;
  }

  // Skip dangerous protocols
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
    return null;
  }

  // Skip data: URIs for non-image types
  if (lower.startsWith('data:image/')) {
    return trimmed;
  }
  if (lower.startsWith('data:')) {
    return null;
  }

  // Resolve relative URLs
  let absoluteUrl;
  try {
    absoluteUrl = new URL(trimmed, baseUrl).href;
  } catch {
    return null;
  }

  return `https://web.archive.org/web/${ts}id_/${absoluteUrl}`;
}

/**
 * Rewrite an external link href, adding rel="noopener noreferrer".
 * If the link is relative or points to the same domain, keep it as-is.
 * @param {string} href
 * @param {string} baseUrl
 * @param {string} ts
 * @returns {{ href: string, external: boolean } | null}
 */
function rewriteLink(href, baseUrl, ts) {
  if (!href || typeof href !== 'string') return null;
  const trimmed = href.trim();
  if (!trimmed) return null;

  // Skip dangerous protocols
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
    return null;
  }

  // Anchor links — keep as-is
  if (trimmed.startsWith('#')) {
    return { href: trimmed, external: false };
  }

  // Mailto, tel, etc — keep
  if (lower.startsWith('mailto:') || lower.startsWith('tel:')) {
    return { href: trimmed, external: false };
  }

  // Already an archive URL
  if (trimmed.startsWith('https://web.archive.org/web/')) {
    return { href: trimmed, external: true };
  }

  // Resolve relative URLs
  let absoluteUrl;
  try {
    absoluteUrl = new URL(trimmed, baseUrl);
  } catch {
    return null;
  }

  // Rewrite to archived version for external links
  const archived = `https://web.archive.org/web/${ts}/${absoluteUrl.href}`;
  return { href: archived, external: true };
}

/**
 * Extract structured content from sanitized HTML.
 *
 * @param {string} html - raw archived HTML
 * @param {string} ts - 14-digit CDX timestamp
 * @param {string} originalUrl - the original page URL
 * @returns {{ title: string, content: string, images: Array<{src: string, alt: string}> }}
 */
export function extractContent(html, ts, originalUrl) {
  const root = sanitizeToTree(html);

  // Extract title
  const titleEl = root.querySelector('title');
  const title = titleEl ? titleEl.text.trim() : '';

  // Collect content elements
  const contentParts = [];
  const images = [];

  // Find body or use root
  const body = root.querySelector('body') || root;

  function processElement(el) {
    const tag = el.tagName.toLowerCase();

    if (tag === 'img') {
      const src = el.getAttribute('src');
      const alt = el.getAttribute('alt') || '';
      const rewritten = rewriteImageSrc(src, ts, originalUrl);
      if (rewritten) {
        el.setAttribute('src', rewritten);
        el.removeAttribute('srcset');
        el.removeAttribute('data-src');
        el.setAttribute('loading', 'lazy');
        images.push({ src: rewritten, alt });
        contentParts.push(el.toString());
      }
      return;
    }

    if (tag === 'a') {
      const href = el.getAttribute('href');
      const result = rewriteLink(href, originalUrl, ts);
      if (result) {
        el.setAttribute('href', result.href);
        if (result.external) {
          el.setAttribute('rel', 'noopener noreferrer');
          el.setAttribute('target', '_blank');
        }
        contentParts.push(el.toString());
      }
      return;
    }

    if (CONTENT_TAGS.includes(tag)) {
      // Process any nested images and links first
      const nestedImgs = el.querySelectorAll('img');
      for (const img of nestedImgs) {
        const src = img.getAttribute('src');
        const alt = img.getAttribute('alt') || '';
        const rewritten = rewriteImageSrc(src, ts, originalUrl);
        if (rewritten) {
          img.setAttribute('src', rewritten);
          img.removeAttribute('srcset');
          img.removeAttribute('data-src');
          img.setAttribute('loading', 'lazy');
          images.push({ src: rewritten, alt });
        } else {
          img.remove();
        }
      }

      const nestedLinks = el.querySelectorAll('a');
      for (const a of nestedLinks) {
        const href = a.getAttribute('href');
        const result = rewriteLink(href, originalUrl, ts);
        if (result) {
          a.setAttribute('href', result.href);
          if (result.external) {
            a.setAttribute('rel', 'noopener noreferrer');
            a.setAttribute('target', '_blank');
          }
        } else {
          a.removeAttribute('href');
        }
      }

      contentParts.push(el.toString());
      return;
    }

    // Recurse into children for other tags
    for (const child of [...el.childNodes]) {
      if (child.nodeType === 1) {
        processElement(child);
      }
    }
  }

  for (const child of [...body.childNodes]) {
    if (child.nodeType === 1) {
      processElement(child);
    }
  }

  return {
    title,
    content: contentParts.join('\n'),
    images,
  };
}

/**
 * Extract plain text from sanitized HTML, for use by the summarizer.
 * @param {string} html
 * @returns {string}
 */
export function extractText(html) {
  const root = sanitizeToTree(html);
  const body = root.querySelector('body') || root;

  // Collect text from meaningful elements
  const textParts = [];
  const collectTags = ['title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'pre', 'td', 'th'];

  for (const tag of collectTags) {
    const els = body.querySelectorAll(tag);
    for (const el of els) {
      const text = el.text.trim();
      if (text) {
        textParts.push(text);
      }
    }
  }

  return textParts.join(' ');
}
