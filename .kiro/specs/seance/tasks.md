# Séance — Implementation Tasks

Ordered checklist. Each task references the requirement(s) it satisfies. Do not
write application code beyond what a task asks for; keep changes scoped.

- [x] **T1 — Project scaffold & deps**
  Initialize `package.json` (`"type": "module"`, `type: module`, deps
  `express` + `node-html-parser`, scripts `start: node server.js`,
  `test: node --test`), `render.yaml`, `LICENSE` (MIT), and an empty `public/`
  + `src/` + `test/`. Verify `node --test` runs with zero tests.
  _Refs: AC-7.2, AC-7.4_

- [x] **T2 — URL validation with SSRF protection (`src/url.js` + tests)**
  Implement scheme allowlist, userinfo rejection, private/loopback/link-local/
  metadata IP blocking, and DNS resolution check before fetch. Add
  `test/url.test.js` with property-based tests (hand-rolled RNG, blocked-range
  generators, safe public-URL generators).
  _Refs: AC-1.2, AC-1.3, AC-7.3_

- [x] **T3 — In-memory LRU cache (`src/cache.js` + tests)**
  Small `Map`-based LRU with a max size and delete-on-set eviction; `get`/`set`
  with LRU reordering. Test eviction and cache hits.
  _Refs: AC-3.4_

- [x] **T4 — Express skeleton + health + static (`server.js`)**
  Wire Express: `express.static('public')`, `GET /api/health`, route stubs for
  pulse/snapshots/resurrect, central error handler returning
  `{ error }` JSON. Start server on `process.env.PORT || 3000`.
  _Refs: AC-7.4_

- [x] **T5 — Pulse endpoint (`src/pulse.js` + `server.js` route)**
  Validate URL, fetch with `AbortController` timeout, classify ALIVE/DEAD + cause
  (status, dns_failure, connection_refused, timeout, network_error). Return
  200 for both alive and dead; 400 for invalid/unsafe.
  _Refs: AC-1.1, AC-1.2, AC-1.3, AC-1.4_

- [ ] **T6 — Snapshots endpoint (`src/snapshots.js` + `server.js` route)**
  Query CDX API (`web.archive.org/cdx/search/cdx?url=...&output=json`), parse
  timestamps/status/digest, compute first/last/total and per-year timeline.
  Return 200 with empty array when none; 502 when archive unreachable.
  _Refs: AC-2.1, AC-2.2, AC-2.3, AC-2.4_

- [ ] **T7 — HTML sanitization (`src/sanitize.js` + tests)**
  Using `node-html-parser`: remove script/iframe/object/embed/frame/applet/meta
  http-equiv/base/link/noscript; strip `on*` and `style` attributes; drop
  `javascript:`/`vbscript:` URIs. Property-based tests per design.md properties.
  _Refs: AC-3.1, AC-5.2_

- [ ] **T8 — Content extraction + image rewriting (`src/extract.js` + tests)**
  From the sanitized tree, extract title, headings, paragraphs, lists, links
  (rewrite external links with `rel="noopener noreferrer"`), and images
  (rewrite `src` to `web.archive.org/web/{ts}id_/{original}`). Property-based
  tests verify the extractor invariants.
  _Refs: AC-3.1_

- [ ] **T9 — Deterministic fallback summarizer (`src/gemini.js` fallback path)**
  Build a 2-sentence extractive `spiritMessage`, a single-line `epitaph`, and
  exactly 3 `searchQueries` from extracted text, deterministically. Tests
  assert the summarizer correctness properties.
  _Refs: AC-4.2_

- [ ] **T10 — Gemini integration (`src/gemini.js` Gemini path)**
  When `GEMINI_API_KEY` set, call the Gemini generate-content API for summary,
  epitaph, and 3 queries. On any failure (missing key, HTTP error, bad JSON),
  fall back to the deterministic path. Never log or expose the key. Tests stub
  `fetch` to simulate success and failure.
  _Refs: AC-4.1, AC-4.2, AC-7.1_

- [ ] **T11 — Render reborn page + standalone HTML (`src/render.js`)**
  Assemble semantic, mobile-friendly HTML from extracted content + provenance
  footer. Produce `downloadHtml` as a self-contained, sanitized document
  including the provenance footer. Same renderer used for in-app and download.
  _Refs: AC-3.2, AC-5.1, AC-5.2_

- [ ] **T12 — Resurrect endpoint wiring (`src/resurrect.js` + `server.js` route)**
  Orchestrate validate → cache lookup → fetch archived HTML → sanitize → extract
  → summarize (Gemini or fallback) → render. Cache by `{url, ts}`. Return 400 for
  invalid URL/timestamp, 502 when archived fetch fails. Response shape per
  design.md.
  _Refs: AC-3.1, AC-3.3, AC-3.4, AC-4.1, AC-4.2, AC-5.1_

- [ ] **T13 — Graveyard demos (`src/graveyard.js` + `public/`)**
  Define exactly 6 famous dead/changed pages with name + spooky description and a
  verifiable dead-or-changed status. Expose via an endpoint or inline in the
  page; clicking prefills the URL and triggers a pulse check.
  _Refs: AC-6.1_

- [ ] **T14 — Frontend app + spooky UI (`public/index.html`, `app.js`, `styles.css`)**
  Build the paste box, pulse/snapshots/resurrect flows, tombstone cards,
  haunting timeline, reborn page view, "Download as standalone HTML" link, and
  copy-citation button. Dark graveyard theme, candle/fog/planchette animation
  with `prefers-reduced-motion` fallback. WCAG AA contrast.
  _Refs: AC-3.2, AC-5.3, AC-6.1_

- [ ] **T15 — Full test pass + render.yaml + README polish**
  Run `npm test` green (unit + property tests, no network). Confirm
  `render.yaml` free-tier web service config and optional `GEMINI_API_KEY` env
  var. Add a short README with run/deploy instructions.
  _Refs: AC-7.2, AC-7.4_
