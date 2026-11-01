// Séance — Frontend app

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let selectedTimestamp = null;
let snapshotsData = null;
let currentGraveyardUrl = null;
let graveyardBestTs = null;

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, html = '') => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  if (html) e.innerHTML = html;
  return e;
};

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------
async function api(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// ---------------------------------------------------------------------------
// Loading status rotation
// ---------------------------------------------------------------------------
let statusRotationId = null;

function startStatusRotation(element, phrases) {
  let idx = 0;
  element.textContent = phrases[0];
  statusRotationId = setInterval(() => {
    idx = (idx + 1) % phrases.length;
    element.style.opacity = '0';
    setTimeout(() => {
      element.textContent = phrases[idx];
      element.style.opacity = '1';
    }, 200);
  }, 2000);
}

function stopStatusRotation() {
  if (statusRotationId) {
    clearInterval(statusRotationId);
    statusRotationId = null;
  }
}

// ---------------------------------------------------------------------------
// Smooth scroll helper
// ---------------------------------------------------------------------------
function scrollToElement(selector) {
  const target = $(selector);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ---------------------------------------------------------------------------
// Cause-of-death text
// ---------------------------------------------------------------------------
function causeOfDeathText(data) {
  const { cause, httpStatus, detail } = data;
  if (cause === 'possessed') {
    // detail is "Redirected to hostname" — extract hostname, avoid duplication
    const hostname = detail ? detail.replace(/^Redirected to\s+/i, '') : null;
    const target = hostname || 'another host';
    return `Cause of death: body-snatched → ${target}`;
  }
  if (cause === '404') return 'Cause of death: 404 Not Found';
  if (cause === '5xx') return `Cause of death: ${httpStatus || '5xx'} Server Error`;
  if (cause === 'dns_failure') return 'Cause of death: DNS — domain vanished';
  if (cause === 'connection_refused') return 'Cause of death: connection refused';
  if (cause === 'timeout') return 'Cause of death: timeout';
  if (cause === 'network_error') return 'Cause of death: network error';
  if (httpStatus) return `Cause of death: ${httpStatus}`;
  return `Cause of death: ${cause || 'unknown'}`;
}

// ---------------------------------------------------------------------------
// Heartbeat SVG for alive pages
// ---------------------------------------------------------------------------
function heartbeatSvg() {
  return `<svg class="heartbeat-line" viewBox="0 0 60 28" aria-hidden="true">
    <polyline points="0,14 12,14 16,4 22,24 28,14 38,14 42,8 48,20 52,14 60,14"
      fill="none" stroke="#80d080" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
      <animate attributeName="stroke-dashoffset" from="0" to="120" dur="1.5s" repeatCount="indefinite" />
    </polyline>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Step 1: Pulse check
// ---------------------------------------------------------------------------
async function checkPulse(url) {
  const resultDiv = $('#pulse-result');
  stopStatusRotation();
  resultDiv.innerHTML = `<div class="loading"><div class="ouija-loading">
    <div class="planchette-svg"></div>
    <div class="ouija-strip">A B C D E F G H I J K L M N O P Q R S T U V W X Y Z &nbsp; YES NO</div>
  </div><p class="loading-status">Summoning the spirits…</p></div>`;

  const statusEl = resultDiv.querySelector('.loading-status');
  startStatusRotation(statusEl, [
    'Summoning the spirits…',
    'Reading the pulse…',
    'Listening for a heartbeat…',
  ]);

  try {
    const data = await api(`/api/pulse?url=${encodeURIComponent(url)}`);
    stopStatusRotation();
    renderPulseResult(data);
    if (data.status === 'DEAD' || data.status === 'ALIVE') {
      $('#step-snapshots').classList.remove('hidden');
      setTimeout(() => scrollToElement('#step-snapshots'), 100);
      fetchSnapshots(url);
    }
  } catch (err) {
    stopStatusRotation();
    resultDiv.innerHTML = `<div class="pulse-card alive"><p class="pulse-status dead">⚠️ ${err.message}</p></div>`;
  }
}

function renderPulseResult(data) {
  const resultDiv = $('#pulse-result');
  if (data.status === 'ALIVE') {
    resultDiv.innerHTML = `<div class="pulse-card alive">
      ${heartbeatSvg()}
      <div>
        <p class="pulse-status alive">👻 The page lives!</p>
        <p class="pulse-detail">HTTP ${data.httpStatus} — still breathing.</p>
      </div>
    </div>`;
  } else {
    const causeLine = causeOfDeathText(data);
    resultDiv.innerHTML = `<div class="tombstone-card">
      <div class="tombstone-shape">
        <p class="tombstone-rip">R.I.P.</p>
        <p class="tombstone-url">${escapeHtml(data.url)}</p>
        <p class="tombstone-cause">${causeLine}</p>
      </div>
      <div class="tombstone-grass"></div>
    </div>`;
  }
}

// ---------------------------------------------------------------------------
// Escape HTML utility
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Step 2: Snapshots
// ---------------------------------------------------------------------------
async function fetchSnapshots(url) {
  const loading = $('#snapshots-loading');
  const result = $('#snapshots-result');
  const picker = $('#snapshot-picker');
  const resurrectBtn = $('#resurrect-btn');

  loading.classList.remove('hidden');
  result.innerHTML = '';
  picker.classList.add('hidden');
  resurrectBtn.classList.add('hidden');

  stopStatusRotation();
  const statusEl = loading.querySelector('.loading-status');
  startStatusRotation(statusEl, [
    'Asking the Wayback Machine…',
    'The table is shaking…',
    'Consulting the archive spirits…',
  ]);

  try {
    const data = await api(`/api/snapshots?url=${encodeURIComponent(url)}`);
    stopStatusRotation();
    loading.classList.add('hidden');
    snapshotsData = data;

    if (data.total === 0) {
      result.innerHTML = '<p class="pulse-detail">No remains found in the archive. The spirits are silent.</p>';
      return;
    }

    // Render summary
    const firstDate = formatDate(data.firstSeen);
    const lastDate = formatDate(data.lastSeen);
    result.innerHTML = `<p class="timeline-info">
      Found <strong>${data.total}</strong> snapshots
      (${firstDate} → ${lastDate})
    </p>`;

    // Render timeline
    renderTimeline(data.timeline);

    // Render snapshot picker
    renderSnapshotPicker(data.snapshots);

    // Auto-select golden era snapshot
    autoSelectSnapshot(url, data);

    picker.classList.remove('hidden');
    resurrectBtn.classList.remove('hidden');
  } catch (err) {
    stopStatusRotation();
    loading.classList.add('hidden');
    result.innerHTML = `<p class="pulse-detail">⚠️ ${err.message}</p>`;
  }
}

function formatDate(ts) {
  if (!ts || ts.length < 8) return 'unknown';
  const y = ts.slice(0, 4);
  const m = parseInt(ts.slice(4, 6), 10);
  const d = ts.slice(6, 8);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1] || '?'} ${d}, ${y}`;
}

function renderTimeline(timeline) {
  const resultDiv = $('#snapshots-result');
  if (!timeline || timeline.length === 0) return;

  const maxCount = Math.max(...timeline.map((t) => t.count));
  const timelineDiv = el('div', { class: 'timeline' });

  for (const entry of timeline) {
    // Fixed pixel heights: min 6px, max 90px, proportional to count
    const minPx = 6;
    const maxPx = 90;
    const heightPx = maxCount > 0
      ? Math.round(minPx + (entry.count / maxCount) * (maxPx - minPx))
      : minPx;
    const bar = el('div', {
      class: 'timeline-bar',
      'data-year': entry.year,
      style: `height: ${heightPx}px`,
      title: `${entry.year}: ${entry.count} snapshots`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${entry.year}: ${entry.count} snapshots`,
    });
    bar.innerHTML = `
      <span class="timeline-bar-count">${entry.count}</span>
      <span class="timeline-bar-label">${entry.year}</span>
    `;
    bar.addEventListener('click', () => {
      const firstSnap = snapshotsData.snapshots.find((s) => s.timestamp.startsWith(String(entry.year)));
      if (firstSnap) {
        selectSnapshot(firstSnap.timestamp);
      }
    });
    bar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        bar.click();
      }
    });
    timelineDiv.appendChild(bar);
  }

  resultDiv.appendChild(timelineDiv);
}

function renderSnapshotPicker(snapshots) {
  const picker = $('#snapshot-picker');
  picker.innerHTML = '';

  const list = el('div', { class: 'snapshot-list' });
  const sorted = [...snapshots].reverse();

  for (const snap of sorted) {
    const item = el('div', {
      class: 'snapshot-item',
      'data-ts': snap.timestamp,
      tabindex: '0',
      role: 'button',
      'aria-label': `Snapshot from ${formatDate(snap.timestamp)}, HTTP ${snap.status}`,
    });
    item.innerHTML = `
      <span class="snapshot-date">${formatDate(snap.timestamp)}</span>
      <span class="snapshot-status">HTTP ${snap.status}</span>
    `;
    item.addEventListener('click', () => selectSnapshot(snap.timestamp));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectSnapshot(snap.timestamp);
      }
    });
    list.appendChild(item);
  }

  picker.appendChild(list);
}

// ---------------------------------------------------------------------------
// Auto-select golden era snapshot
// ---------------------------------------------------------------------------
function autoSelectSnapshot(url, data) {
  // Check if this URL matches a graveyard entry
  if (graveyardBestTs && url === currentGraveyardUrl) {
    // Find the snapshot closest to bestTs
    const target = graveyardBestTs;
    const closest = findClosestSnapshot(data.snapshots, target);
    if (closest) {
      selectSnapshot(closest.timestamp);
      return;
    }
  }

  // For other URLs, pick snapshot closest to midpoint between first and last
  if (data.firstSeen && data.lastSeen && data.snapshots.length > 0) {
    const midpoint = midpointTimestamp(data.firstSeen, data.lastSeen);
    const closest = findClosestSnapshot(data.snapshots, midpoint);
    if (closest) {
      selectSnapshot(closest.timestamp);
      return;
    }
  }

  // Fallback: select the latest
  if (data.snapshots.length > 0) {
    selectSnapshot(data.snapshots[data.snapshots.length - 1].timestamp);
  }
}

function midpointTimestamp(first, last) {
  // Treat as numbers, take midpoint
  const f = parseInt(first, 10);
  const l = parseInt(last, 10);
  const mid = Math.floor((f + l) / 2);
  return String(mid).padStart(14, '0');
}

function findClosestSnapshot(snapshots, target) {
  if (!snapshots || snapshots.length === 0) return null;
  const targetNum = parseInt(target, 10);
  let closest = snapshots[0];
  let minDiff = Math.abs(parseInt(closest.timestamp, 10) - targetNum);
  for (const snap of snapshots) {
    const diff = Math.abs(parseInt(snap.timestamp, 10) - targetNum);
    if (diff < minDiff) {
      minDiff = diff;
      closest = snap;
    }
  }
  return closest;
}

function selectSnapshot(ts) {
  selectedTimestamp = ts;
  // Highlight in picker
  document.querySelectorAll('.snapshot-item').forEach((item) => {
    item.classList.toggle('selected', item.getAttribute('data-ts') === ts);
  });
  // Scroll the selected item into view in the picker
  const selectedItem = document.querySelector('.snapshot-item.selected');
  if (selectedItem) {
    selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  // Highlight in timeline
  const year = ts.slice(0, 4);
  document.querySelectorAll('.timeline-bar').forEach((bar) => {
    bar.classList.toggle('selected', bar.getAttribute('data-year') === year);
  });
}

// ---------------------------------------------------------------------------
// Step 3: Resurrect
// ---------------------------------------------------------------------------
async function doResurrect() {
  const url = $('#url-input').value.trim();
  if (!url) return;

  const step = $('#step-resurrect');
  const loading = $('#resurrect-loading');
  const result = $('#resurrect-result');

  step.classList.remove('hidden');
  loading.classList.remove('hidden');
  result.innerHTML = '';

  stopStatusRotation();
  const statusEl = loading.querySelector('.loading-status');
  startStatusRotation(statusEl, [
    'Summoning the spirits…',
    'The table is shaking…',
    'Asking the Wayback Machine…',
  ]);

  try {
    const params = new URLSearchParams({ url });
    if (selectedTimestamp) params.set('ts', selectedTimestamp);
    const data = await api(`/api/resurrect?${params}`);
    stopStatusRotation();
    loading.classList.add('hidden');
    renderResurrectResult(data);
    setTimeout(() => scrollToElement('#step-resurrect'), 100);
  } catch (err) {
    stopStatusRotation();
    loading.classList.add('hidden');
    result.innerHTML = `<p class="pulse-detail">⚠️ ${err.message}</p>`;
  }
}

function renderResurrectResult(data) {
  const resultDiv = $('#resurrect-result');
  resultDiv.innerHTML = '';

  const p = data.provenance || {};
  const risenDate = p.snapshotDate || formatDate(data.ts);

  // Title
  resultDiv.innerHTML = `<h3 class="reborn-title">Risen from ${escapeHtml(risenDate)}</h3>`;

  // Spirit message (ghostly speech bubble)
  const spirit = el('div', { class: 'spirit-message' });
  spirit.innerHTML = `
    <p class="label">🔮 Spirit Message</p>
    <p class="spirit-text">${escapeHtml(data.spiritMessage)}</p>
  `;
  resultDiv.appendChild(spirit);

  // Epitaph
  const epitaph = el('div', { class: 'epitaph' });
  epitaph.innerHTML = `
    <p class="label">R.I.P.</p>
    <p>${escapeHtml(data.epitaph)}</p>
  `;
  resultDiv.appendChild(epitaph);

  // Search queries (Where did it go?)
  const queries = el('div', { class: 'search-queries' });
  const links = (data.searchQueries || []).map((q) =>
    `<a href="https://duckduckgo.com/?q=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer">${escapeHtml(q)}</a>`,
  ).join('');
  queries.innerHTML = `
    <span class="label">🔍 Where did it go?</span>
    <div class="search-query-links">${links}</div>
  `;
  resultDiv.appendChild(queries);

  // Action buttons
  const actions = el('div', { class: 'reborn-actions' });

  // Download button
  const dlBtn = el('button', { type: 'button' }, '⬇ Download as standalone HTML');
  dlBtn.addEventListener('click', () => {
    const blob = new Blob([data.downloadHtml], { type: 'text/html' });
    const dlUrl = URL.createObjectURL(blob);
    const a = el('a', { href: dlUrl, download: `${(data.title || 'reborn-page').replace(/[^a-z0-9]+/gi, '-')}.html` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(dlUrl);
  });
  actions.appendChild(dlBtn);

  // Copy citation button
  const citeBtn = el('button', { type: 'button', class: 'secondary' }, '📋 Copy citation');
  citeBtn.addEventListener('click', () => {
    const citation = formatCitation(data);
    navigator.clipboard.writeText(citation).then(() => {
      citeBtn.textContent = '✓ Copied!';
      setTimeout(() => { citeBtn.textContent = '📋 Copy citation'; }, 2000);
    }).catch(() => {
      citeBtn.textContent = '⚠️ Copy failed';
      setTimeout(() => { citeBtn.textContent = '📋 Copy citation'; }, 2000);
    });
  });
  actions.appendChild(citeBtn);

  // Open in Wayback button
  if (p.archiveLink) {
    const waybackLink = el('a', {
      href: p.archiveLink,
      target: '_blank',
      rel: 'noopener noreferrer',
      class: 'button secondary',
      style: 'text-decoration: none; display: inline-flex; align-items: center;',
    }, '🔗 Open in Wayback');
    actions.appendChild(waybackLink);
  }

  resultDiv.appendChild(actions);

  // Reborn page in sandboxed iframe
  const container = el('div', { class: 'reborn-container' });
  const iframe = el('iframe', {
    class: 'reborn-iframe',
    sandbox: 'allow-same-origin',
    title: 'Reborn page',
  });
  container.appendChild(iframe);
  resultDiv.appendChild(container);

  iframe.srcdoc = data.content;
}

function formatCitation(data) {
  const p = data.provenance || {};
  return `Archived page: "${data.title}". ` +
    `Original URL: ${p.originalUrl || data.url}. ` +
    `Snapshot date: ${p.snapshotDate || ''}. ` +
    `Archive link: ${p.archiveLink || ''}.`;
}

// ---------------------------------------------------------------------------
// Graveyard
// ---------------------------------------------------------------------------
async function loadGraveyard() {
  const grid = $('#graveyard-grid');
  try {
    const data = await api('/api/graveyard');
    for (const grave of data.graves) {
      const stone = el('button', {
        class: 'grave-tombstone',
        type: 'button',
        'aria-label': `${grave.name} — ${grave.description}`,
      });
      stone.innerHTML = `
        <div class="grave-tombstone-stone">
          <h3>${escapeHtml(grave.name)}</h3>
          <p class="grave-tombstone-years">${grave.born}–${grave.died}</p>
          <p class="grave-tombstone-epitaph">${escapeHtml(grave.description)}</p>
        </div>
        <div class="grave-tombstone-grass"></div>
      `;
      stone.addEventListener('click', () => {
        $('#url-input').value = grave.url;
        $('#step-snapshots').classList.add('hidden');
        $('#step-resurrect').classList.add('hidden');
        // Track which graveyard entry was clicked for golden-era selection
        currentGraveyardUrl = grave.url;
        graveyardBestTs = grave.bestTs || null;
        checkPulse(grave.url);
      });
      grid.appendChild(stone);
    }
  } catch {
    // If API fails, try inline graveyard
    const fallback = [
      { name: 'GeoCities', url: 'http://www.geocities.com/', description: 'A sprawling necropolis of personal homepages.', born: 1995, died: 2009, bestTs: '20090801000000' },
      { name: 'Google Reader', url: 'http://www.google.com/reader/', description: 'The beloved RSS reader, laid to rest in 2013.', born: 2005, died: 2013, bestTs: '20120601000000' },
      { name: 'Yahoo Answers', url: 'https://answers.yahoo.com/', description: 'A chaotic oracle of dubious wisdom.', born: 2005, died: 2021, bestTs: '20200601000000' },
      { name: 'Google+', url: 'https://plus.google.com/', description: 'The ghost of social networks past.', born: 2011, died: 2019, bestTs: '20150601000000' },
      { name: 'AltaVista', url: 'http://www.altavista.com/', description: 'Once the king of search, now a spectral memory.', born: 1995, died: 2013, bestTs: '19990508000000' },
      { name: 'Orkut', url: 'http://www.orkut.com/', description: "Google's first social experiment, haunting the web.", born: 2004, died: 2014, bestTs: '20130601000000' },
    ];
    for (const grave of fallback) {
      const stone = el('button', {
        class: 'grave-tombstone',
        type: 'button',
        'aria-label': `${grave.name} — ${grave.description}`,
      });
      stone.innerHTML = `
        <div class="grave-tombstone-stone">
          <h3>${escapeHtml(grave.name)}</h3>
          <p class="grave-tombstone-years">${grave.born}–${grave.died}</p>
          <p class="grave-tombstone-epitaph">${escapeHtml(grave.description)}</p>
        </div>
        <div class="grave-tombstone-grass"></div>
      `;
      stone.addEventListener('click', () => {
        $('#url-input').value = grave.url;
        $('#step-snapshots').classList.add('hidden');
        $('#step-resurrect').classList.add('hidden');
        currentGraveyardUrl = grave.url;
        graveyardBestTs = grave.bestTs || null;
        checkPulse(grave.url);
      });
      grid.appendChild(stone);
    }
  }
}

// ---------------------------------------------------------------------------
// Stars generation
// ---------------------------------------------------------------------------
function generateStars() {
  const layer = $('#stars-layer');
  if (!layer) return;
  const numStars = 60;
  for (let i = 0; i < numStars; i++) {
    const star = el('div', { class: 'star' });
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 60}%`;
    star.style.animationDelay = `${Math.random() * 3}s`;
    star.style.animationDuration = `${2 + Math.random() * 3}s`;
    layer.appendChild(star);
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
function init() {
  $('#pulse-btn').addEventListener('click', () => {
    const url = $('#url-input').value.trim();
    if (!url) return;
    $('#step-snapshots').classList.add('hidden');
    $('#step-resurrect').classList.add('hidden');
    currentGraveyardUrl = null;
    graveyardBestTs = null;
    checkPulse(url);
  });

  $('#resurrect-btn').addEventListener('click', () => {
    doResurrect();
  });

  $('#url-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      $('#pulse-btn').click();
    }
  });

  // Deep-link: auto-run pulse if ?url= is present
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('url');
  if (urlParam) {
    $('#url-input').value = urlParam;
    checkPulse(urlParam);
  }

  generateStars();
  loadGraveyard();
}

document.addEventListener('DOMContentLoaded', init);
