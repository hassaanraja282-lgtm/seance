import { parse, HTMLElement } from 'node-html-parser';

/**
 * Tags to remove entirely (including content) during sanitization.
 * @type {Set<string>}
 */
const TAGS_TO_REMOVE = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'frame',
  'frameset',
  'applet',
  'noscript',
  'base',
  'link',
  'meta',
  'style',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'svg',
  'canvas',
  'template',
]);

/**
 * Remove <meta> tags that have http-equiv attributes (redirects, refresh).
 * @param {HTMLElement} el
 */
function shouldRemoveMeta(el) {
  if (el.tagName === 'META') {
    const httpEquiv = el.getAttribute('http-equiv');
    if (httpEquiv) {
      return true;
    }
  }
  return false;
}

/**
 * Check whether an attribute name is an event handler (on*).
 * @param {string} name
 * @returns {boolean}
 */
function isEventHandler(name) {
  return name.toLowerCase().startsWith('on');
}

/**
 * Check whether a URI value is dangerous (javascript:, vbscript:, data: for non-image).
 * @param {string} value
 * @returns {boolean}
 */
function isDangerousUri(value) {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  return (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('data:text/html') ||
    trimmed.startsWith('data:application/') ||
    trimmed.startsWith('data:image/svg')
  );
}

/**
 * Sanitize an HTML string, removing dangerous tags, attributes, and URIs.
 *
 * @param {string} html - raw HTML from the archive
 * @returns {string} - sanitized HTML string
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const root = parse(html, {
    blockTextElements: {
      script: false,
      noscript: false,
      style: false,
      pre: true,
    },
    comment: false,
  });

  sanitizeNode(root);
  return root.toString();
}

/**
 * Recursively sanitize a node and its children.
 * @param {HTMLElement} node
 */
function sanitizeNode(node) {
  // Process children first (bottom-up would miss removed parents; top-down is fine
  // since we remove dangerous tags wholesale).
  const children = [...node.childNodes];
  for (const child of children) {
    if (child.nodeType !== 1) continue; // only element nodes

    const tag = child.tagName.toLowerCase();

    // Remove dangerous tags entirely
    if (TAGS_TO_REMOVE.has(tag) || shouldRemoveMeta(child)) {
      child.remove();
      continue;
    }

    // Sanitize attributes
    const attrs = child.rawAttributes;
    for (const attrName of Object.keys(attrs)) {
      const attrValue = attrs[attrName];

      // Remove event handlers
      if (isEventHandler(attrName)) {
        child.removeAttribute(attrName);
        continue;
      }

      // Remove style attributes
      if (attrName.toLowerCase() === 'style') {
        child.removeAttribute(attrName);
        continue;
      }

      // Check href and src for dangerous URIs
      const lower = attrName.toLowerCase();
      if (lower === 'href' || lower === 'src' || lower === 'action' || lower === 'formaction' || lower === 'xlink:href') {
        if (isDangerousUri(attrValue)) {
          child.removeAttribute(attrName);
          continue;
        }
      }
    }

    // Recurse into children
    sanitizeNode(child);
  }
}

/**
 * Parse and sanitize in one step — returns the root HTMLElement for further
 * extraction. Used by extract.js.
 *
 * @param {string} html
 * @returns {HTMLElement}
 */
export function sanitizeToTree(html) {
  if (!html || typeof html !== 'string') {
    return parse('');
  }

  const root = parse(html, {
    blockTextElements: {
      script: false,
      noscript: false,
      style: false,
      pre: true,
    },
    comment: false,
  });

  sanitizeNode(root);
  return root;
}
