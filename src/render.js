/**
 * Render the "reborn" page — both the in-app content and the downloadable
 * standalone HTML document.
 *
 * The same core content renderer is used for both; the standalone version
 * wraps it in a full HTML document with inline CSS and a provenance footer.
 */

/**
 * Format a 14-digit CDX timestamp as a human-readable date.
 * @param {string} ts - yyyyMMddHHmmss
 * @returns {string}
 */
export function formatSnapshotDate(ts) {
  if (!ts || ts.length < 8) return '';
  const year = parseInt(ts.slice(0, 4), 10);
  const month = parseInt(ts.slice(4, 6), 10);
  const day = parseInt(ts.slice(6, 8), 10);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthName = months[month - 1] || '';
  return `${monthName} ${day}, ${year}`;
}

/**
 * Escape HTML text content.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Build the provenance footer HTML.
 * @param {{ originalUrl: string, timestamp: string, snapshotDate: string, archiveLink: string }} provenance
 * @returns {string}
 */
function buildProvenanceFooter(provenance) {
  return `
  <footer class="provenance">
    <p><strong>Provenance</strong></p>
    <p>Original URL: <a href="${escapeHtml(provenance.originalUrl)}">${escapeHtml(provenance.originalUrl)}</a></p>
    <p>Snapshot date: ${escapeHtml(provenance.snapshotDate)}</p>
    <p>Archive link: <a href="${escapeHtml(provenance.archiveLink)}">${escapeHtml(provenance.archiveLink)}</a></p>
  </footer>`;
}

/**
 * CSS for the reborn page (shared between in-app and standalone).
 * @returns {string}
 */
function pageCss() {
  return `
    :root {
      --bg: #1a1a2e;
      --card-bg: #16213e;
      --text: #e0e0e0;
      --text-muted: #a0a0a0;
      --accent: #b8a9c9;
      --accent-bright: #d4c5e8;
      --border: #2a2a4a;
      --link: #b8c9ff;
      --link-hover: #d4dcff;
      --parchment: #f0e8d8;
      --parchment-text: #3a3a2a;
      --parchment-link: #8b2020;
      --parchment-link-hover: #a52828;
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: Georgia, 'Times New Roman', serif;
      background: var(--parchment);
      color: var(--parchment-text);
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 1.5rem;
    }
    h1, h2, h3, h4, h5, h6 {
      color: var(--parchment-text);
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      line-height: 1.3;
    }
    h1 { font-size: 1.8rem; }
    h2 { font-size: 1.5rem; }
    h3 { font-size: 1.25rem; }
    p { margin: 0.5em 0 1em; }
    a { color: var(--parchment-link); text-decoration: underline; }
    a:hover { color: var(--parchment-link-hover); }
    ul, ol { padding-left: 1.5em; }
    li { margin: 0.25em 0; font-size: 1rem; }
    blockquote {
      border-left: 3px solid var(--parchment-link);
      padding-left: 1em;
      margin: 1em 0;
      color: #6a6a4a;
      font-style: italic;
    }
    pre {
      background: #e8e0d0;
      padding: 1em;
      border-radius: 4px;
      overflow-x: auto;
      color: var(--parchment-text);
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 0.5em 0;
    }
    img:empty {
      display: none;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    td, th {
      border: 1px solid #c8c0b0;
      padding: 0.5em;
    }
    th {
      background: #e8e0d0;
      font-weight: bold;
    }
    .provenance {
      margin-top: 2em;
      padding: 1em;
      border-top: 2px solid #c8c0b0;
      font-size: 0.9rem;
      color: #6a6a4a;
    }
    .provenance a { word-break: break-all; }
  `;
}

/**
 * Render the in-app content HTML (for insertion into the SPA).
 * This is the extracted content with provenance footer.
 *
 * @param {{ title: string, content: string, provenance: object }} params
 * @returns {string}
 */
export function renderRebornContent({ title, content, provenance }) {
  const footer = buildProvenanceFooter(provenance);
  return `<article class="reborn-page">
    <h1>${escapeHtml(title || 'Untitled')}</h1>
    ${content || '<p>No content was extracted from the remains.</p>'}
    ${footer}
  </article>`;
}

/**
 * Build the complete standalone HTML document for download.
 * Includes inline CSS (no external resources) and provenance footer.
 *
 * @param {{ title: string, content: string, provenance: object }} params
 * @returns {string}
 */
export function renderStandaloneHtml({ title, content, provenance }) {
  const footer = buildProvenanceFooter(provenance);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title || 'Untitled')}</title>
  <style>${pageCss()}</style>
</head>
<body>
  <article class="reborn-page">
    <h1>${escapeHtml(title || 'Untitled')}</h1>
    ${content || '<p>No content was extracted from the remains.</p>'}
    ${footer}
  </article>
</body>
</html>`;
}

/**
 * Build the provenance object for a resurrection.
 * @param {string} originalUrl
 * @param {string} ts
 * @returns {{ originalUrl: string, timestamp: string, snapshotDate: string, archiveLink: string }}
 */
export function buildProvenance(originalUrl, ts) {
  return {
    originalUrl,
    timestamp: ts,
    snapshotDate: formatSnapshotDate(ts),
    archiveLink: `https://web.archive.org/web/${ts}/${originalUrl}`,
  };
}
