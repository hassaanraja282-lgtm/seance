// Séance — Frontend app

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let selectedTimestamp = null;
let snapshotsData = null;

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
// Step 1: Pulse check
// ---------------------------------------------------------------------------
async function checkPulse(url) {
  const resultDiv = $('#pulse-result');
  resultDiv.innerHTML = '<div class="loading"><div class="planchette"></div><p>Checking for a pulse…</p></div>';

  try {
    const data = await api(`/api/pulse?url=${encodeURIComponent(url)}`);
    renderPulseResult(data);
    if (data.status === 'DEAD' || data.status === 'ALIVE') {
      $('#step-snapshots').classList.remove('hidden');
      fetchSnapshots(url);
    }
  } catch (err) {
    resultDiv.innerHTML = `<div class="pulse-card dead"><p class="pulse-status dead">⚠️ ${err.message}</p></div>`;
  }
}

function renderPulseResult(data) {
  const resultDiv = $('#pulse-result');
  if (data.status === 'ALIVE') {
    resultDiv.innerHTML = `<div class="pulse-card alive">
      <p class="pulse-status alive">👻 The page lives!</p>
      <p class="pulse-detail">HTTP ${data.httpStatus} — still breathing.</p>
    </div>`;
  } else {
    const causeText = data.cause === 'possessed'
      ? `Body-snatched! Redirected to ${data.detail || 'another host'}`
      : `Cause of death: ${data.cause}`;
    resultDiv.innerHTML = `<div class="pulse-card dead">
      <p class="pulse-status dead">🪦 R.I.P.</p>
      <p class="pulse-detail">${causeText}${data.httpStatus ? ` (HTTP ${data.httpStatus})` : ''}</p>
    </div>`;
  }
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

  try {
    const data = await api(`/api/snapshots?url=${encodeURIComponent(url)}`);
    snapshotsData = data;
    loading.classList.add('hidden');

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
    picker.classList.remove('hidden');
    resurrectBtn.classList.remove('hidden');
  } catch (err) {
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
    const heightPct = (entry.count / maxCount) * 100;
    const bar = el('div', {
      class: 'timeline-bar',
      'data-year': entry.year,
      style: `height: ${Math.max(heightPct, 5)}%`,
      title: `${entry.year}: ${entry.count} snapshots`,
    });
    bar.innerHTML = `
      <span class="timeline-bar-count">${entry.count}</span>
      <span class="timeline-bar-label">${entry.year}</span>
    `;
    bar.addEventListener('click', () => {
      // Jump to the first snapshot of this year in the picker
      const firstSnap = snapshotsData.snapshots.find((s) => s.timestamp.startsWith(String(entry.year)));
      if (firstSnap) {
        selectSnapshot(firstSnap.timestamp);
      }
    });
    timelineDiv.appendChild(bar);
  }

  resultDiv.appendChild(timelineDiv);
}

function renderSnapshotPicker(snapshots) {
  const picker = $('#snapshot-picker');
  picker.innerHTML = '';

  // Show a scrollable list, latest first
  const list = el('div', { class: 'snapshot-list' });
  const sorted = [...snapshots].reverse(); // latest first

  for (const snap of sorted) {
    const item = el('div', {
      class: 'snapshot-item',
      'data-ts': snap.timestamp,
    });
    item.innerHTML = `
      <span class="snapshot-date">${formatDate(snap.timestamp)}</span>
      <span class="snapshot-status">HTTP ${snap.status}</span>
    `;
    item.addEventListener('click', () => selectSnapshot(snap.timestamp));
    list.appendChild(item);
  }

  picker.appendChild(list);
}

function selectSnapshot(ts) {
  selectedTimestamp = ts;
  // Highlight in picker
  document.querySelectorAll('.snapshot-item').forEach((item) => {
    item.classList.toggle('selected', item.getAttribute('data-ts') === ts);
  });
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

  try {
    const params = new URLSearchParams({ url });
    if (selectedTimestamp) params.set('ts', selectedTimestamp);
    const data = await api(`/api/resurrect?${params}`);
    loading.classList.add('hidden');
    renderResurrectResult(data);
  } catch (err) {
    loading.classList.add('hidden');
    result.innerHTML = `<p class="pulse-detail">⚠️ ${err.message}</p>`;
  }
}

function renderResurrectResult(data) {
  const resultDiv = $('#resurrect-result');
  resultDiv.innerHTML = '';

  // Spirit message
  const spirit = el('div', { class: 'spirit-message' });
  spirit.innerHTML = `
    <p class="label">🔮 Spirit Message</p>
    <p>${data.spiritMessage}</p>
  `;
  resultDiv.appendChild(spirit);

  // Epitaph
  const epitaph = el('div', { class: 'epitaph' });
  epitaph.innerHTML = `
    <p class="label">R.I.P.</p>
    <p>${data.epitaph}</p>
  `;
  resultDiv.appendChild(epitaph);

  // Search queries (Where did it go?)
  const queries = el('div', { class: 'search-queries' });
  const links = (data.searchQueries || []).map((q) =>
    `<a href="https://duckduckgo.com/?q=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer">${q}</a>`,
  ).join('');
  queries.innerHTML = `
    <p class="label">🔍 Where did it go?</p>
    <div class="search-query-links">${links}</div>
  `;
  resultDiv.appendChild(queries);

  // Actions
  const actions = el('div', { class: 'reborn-actions' });

  // Download button
  const dlBtn = el('button', { type: 'button' }, '⬇ Download as standalone HTML');
  dlBtn.addEventListener('click', () => {
    const blob = new Blob([data.downloadHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `${data.title || 'reborn-page'}.html` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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

  // Set iframe content via srcdoc
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
      const stone = el('div', { class: 'tombstone' });
      stone.innerHTML = `<h3>${grave.name}</h3><p>${grave.description}</p>`;
      stone.addEventListener('click', () => {
        $('#url-input').value = grave.url;
        $('#step-snapshots').classList.add('hidden');
        $('#step-resurrect').classList.add('hidden');
        checkPulse(grave.url);
      });
      grid.appendChild(stone);
    }
  } catch {
    // If API fails, try inline graveyard
    const fallback = [
      { name: 'GeoCities', url: 'http://www.geocities.com/', description: 'A sprawling necropolis of personal homepages.' },
      { name: 'Google Reader', url: 'http://www.google.com/reader/', description: 'The beloved RSS reader, laid to rest in 2013.' },
      { name: 'Yahoo Answers', url: 'https://answers.yahoo.com/', description: 'A chaotic oracle of dubious wisdom.' },
      { name: 'Google+', url: 'https://plus.google.com/', description: 'The ghost of social networks past.' },
      { name: 'AltaVista', url: 'http://www.altavista.com/', description: 'Once the king of search, now a spectral memory.' },
      { name: 'Orkut', url: 'http://www.orkut.com/', description: "Google's first social experiment, haunting the web." },
    ];
    for (const grave of fallback) {
      const stone = el('div', { class: 'tombstone' });
      stone.innerHTML = `<h3>${grave.name}</h3><p>${grave.description}</p>`;
      stone.addEventListener('click', () => {
        $('#url-input').value = grave.url;
        $('#step-snapshots').classList.add('hidden');
        $('#step-resurrect').classList.add('hidden');
        checkPulse(grave.url);
      });
      grid.appendChild(stone);
    }
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
function init() {
  $('#pulse-btn').addEventListener('click', () => {
    const url = $('#url-input').value.trim();
    if (!url) return;
    // Reset downstream steps
    $('#step-snapshots').classList.add('hidden');
    $('#step-resurrect').classList.add('hidden');
    checkPulse(url);
  });

  $('#resurrect-btn').addEventListener('click', () => {
    doResurrect();
  });

  // Enter key in URL input
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

  loadGraveyard();
}

document.addEventListener('DOMContentLoaded', init);
