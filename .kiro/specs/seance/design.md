# Séance — Design

## Architecture

```
Browser (public/index.html, app.js, styles.css)
        │  JSON over HTTP
        ▼
server.js  ─── Express
        │        static(public/)
        │        GET /api/pulse
        │        GET /api/snapshots
        │        GET /api/resurrect
        │        GET /api/health
        ▼
src/ modules ──► outbound fetch (live URL | CDX API | web.archive.org)
                     ▲
src/url.js (SSRF-safe validation + DNS check)
src/cache.js (in-memory LRU)
src/sanitize.js ─► src/extract.js ─► src/render.js
src/gemini.js (optional) or deterministic fallback
```

All real logic lives in `src/`. `server.js` wires Express, delegates to modules,
and returns JSON. `public/app.js` calls the API and renders results in the DOM;
no server-side templating of the SPA shell — only the "reborn" page content is
built server-side as a self-contained HTML string.

## Data Flow (Resurrection)

1. Client calls `GET /api/pulse?url=...` → `src/pulse.js` validates via
   `src/url.js`, fetches the live URL (timeout-guarded), returns status + cause.
2. Client calls `GET /api/snapshots?url=...` → `src/snapshots.js` queries the
   CDX API (`https://web.archive.org/cdx/search/cdx?url={url}&output=json...`),
   parses timestamps, computes first/last/count and a per-year timeline.
3. Client calls `GET /api/resurrect?url=...&ts=...` → `src/resurrect.js`:
   - validates URL + timestamp;
   - checks LRU cache (`src/cache.js`), returns cached if present;
   - fetches raw HTML from `https://web.archive.org/web/{ts}id_/{url}`;
   - `src/sanitize.js` strips dangerous elements/attributes;
   - `src/extract.js` pulls title/headings/paragraphs/lists/links/images,
     rewriting image `src` to `web.archive.org/web/{ts}id_/{original}`;
   - `src/gemini.js` builds summary/epitaph/queries (Gemini if key present &
     healthy, else deterministic fallback);
   - `src/render.js` assembles the reborn HTML + provenance footer;
   - result cached by `{url, ts}` and returned as JSON.

## API Contracts

All responses are `application/json; charset=utf-8` unless noted. Error bodies
are `{ "error": "<message>" }`. Every outbound fetch has an 8s timeout.

### GET /api/health

- 200 `{ "status": "ok" }`

### GET /api/pulse?url=<url>

Query param `url` is required.

- 400 `{ "error": "Invalid or unsafe URL" }` — bad scheme / userinfo / private IP.
- 200
```json
{
  "url": "https://example.com/old",
  "status": "ALIVE",
  "httpStatus": 200
}
```
- 200 (dead)
```json
{
  "url": "https://example.com/old",
  "status": "DEAD",
  "cause": "404" | "dns_failure" | "connection_refused" | "timeout" | "network_error",
  "httpStatus": 404 | null,
  "detail": "Not Found"
}
```

`cause` values: `404`/`5xx` use the numeric status; non-HTTP failures use
`dns_failure`, `connection_refused`, `timeout`, `network_error`.

### GET /api/snapshots?url=<url>

- 400 `{ "error": "Invalid or unsafe URL" }`
- 502 `{ "error": "Archive unreachable" }`
- 200
```json
{
  "url": "https://example.com/old",
  "total": 42,
  "firstSeen": "20010504120000",
  "lastSeen": "20230310153000",
  "snapshots": [
    { "timestamp": "20010504120000", "status": "200", "digest": "abc123" }
  ],
  "timeline": [
    { "year": 2001, "count": 3 },
    { "year": 2002, "count": 7 }
  ]
}
```
When no snapshots exist: `total: 0`, `snapshots: []`, `timeline: []`,
`firstSeen: null`, `lastSeen: null`.

### GET /api/resurrect?url=<url>&ts=<timestamp>

`ts` is a 14-digit `yyyyMMddHHmmss` CDX timestamp.

- 400 `{ "error": "Invalid or unsafe URL" }` / `{ "error": "Invalid timestamp" }`
- 502 `{ "error": "Could not retrieve remains" }`
- 200
```json
{
  "url": "https://example.com/old",
  "ts": "20010504120000",
  "title": "My Old Page",
  "content": "<h1>...</h1><p>...</p>...",
  "images": [
    { "src": "https://web.archive.org/web/20010504120000id_/https://example.com/img.png",
      "alt": "photo" }
  ],
  "spiritMessage": "Two-sentence summary.",
  "epitaph": "One-line description.",
  "searchQueries": ["query 1", "query 2", "query 3"],
  "provenance": {
    "originalUrl": "https://example.com/old",
    "timestamp": "20010504120000",
    "snapshotDate": "May 4, 2001",
    "archiveLink": "https://web.archive.org/web/20010504120000/https://example.com/old"
  },
  "downloadHtml": "<!doctype html>...self-contained..."
}
```

`content` is sanitized HTML safe to insert into the reborn page.
`downloadHtml` is a complete standalone document (also sanitized) including the
provenance footer.

## Error Handling

- Input validation errors → 400 with a clear message; no outbound work.
- Upstream archive failures (CDX / raw snapshot fetch) → 502 with a generic
  message; underlying cause is logged server-side only, never sent to client.
- Live pulse failures are not errors at the protocol level — they return 200
  with `status: DEAD` and a cause (so the client can render a tombstone).
- Gemini failures are swallowed: the response falls back to the deterministic
  summarizer and is otherwise identical in shape.
- All 4xx/5xx bodies include `error`; only 2xx responses omit it.

## Correctness Properties (Property-Based Testing)

### URL validation (`src/url.js`)

For any generated candidate URL string:

1. **Scheme allowlist:** if accepted, the parsed scheme is exactly `http` or
   `https`.
2. **No userinfo:** if accepted, the URL has no `user:pass@` component.
3. **Private-range rejection:** if the hostname resolves to a blocked IP, the
   URL is rejected (the generator produces hostnames that resolve to
   `127.0.0.1`, `10.x`, `192.168.x`, `169.254.x`, `::1`, etc., and the validator
   must reject them).
4. **Idempotency:** `validate(url)` returns the same verdict for the same input
   within a run.
5. **Round-trip of safe URLs:** accepted URLs parse cleanly with `new URL()` and
   reconstruct to an equivalent string.

### HTML extractor (`src/extract.js`)

For any generated HTML fragment (random tags from a small vocabulary, some safe
and some dangerous):

1. **No dangerous tags survive extraction:** the output `content` contains no
   `<script>`, `<iframe>`, `<object>`, `<embed>`, `<frame>`, `<applet>`, `<meta
   http-equiv>`, `<base>`, or `<link>`.
2. **No event handlers:** no element in the output has any `on*` attribute.
3. **No `style` attributes** and no `javascript:`/`vbscript:` URIs in any `href`
   or `src`.
4. **Image rewriting:** every `<img>` in the output has a `src` that starts with
   `https://web.archive.org/web/{ts}id_/`.
5. **External link hardening:** every `<a>` with an external `href` has
   `rel="noopener noreferrer"`.
6. **Structural preservation:** safe headings/paragraphs/list items present in
   the input survive into the output (their text content is preserved).
7. **Deterministic:** running extraction twice on the same input yields
   byte-identical output.

### Deterministic summarizer (fallback)

For any extracted content with non-empty text:

1. `spiritMessage` has at most 2 sentences and is non-empty.
2. `epitaph` is a single line (no newlines) and is non-empty.
3. `searchQueries` is an array of exactly 3 non-empty strings.
4. Output depends only on the input text (same input ⇒ same output).
