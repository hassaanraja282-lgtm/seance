# Séance — Requirements

## User Stories

### US1: Check for a Pulse
As a curious reader, I want to paste a dead URL and instantly see whether the
page is alive or dead and the cause of death, so I know whether I need the
archive.

### US2: Dig Up the Remains
As a reader, I want to see all archived snapshots of a URL with first-seen,
last-seen, count, and a year-by-year "haunting timeline," so I can pick the best
snapshot to resurrect.

### US3: Hold the Séance
As a reader, I want to resurrect a chosen snapshot as a clean, modern,
mobile-friendly, accessible reborn page so I can actually read the lost content.

### US4: Spirit Message & Epitaph
As a reader, I want a short summary ("spirit message"), a one-line description
("epitaph"), and suggested search queries, so I can understand and find where
the content moved. If Gemini is unavailable, a deterministic fallback summary
must still be provided.

### US5: Downloadable Standalone HTML
As a researcher, I want to download the reborn page as a self-contained HTML
file with a provenance footer (original URL, snapshot timestamp, archive link)
and a copy-citation button, so I can cite and archive it myself.

### US6: Graveyard Demos
As a judge or first-time visitor, I want 6 famous dead pages as one-click demos
so I can try Séance instantly without finding my own URL.

### US7: Safe & Always-On
As an operator, I want the app to refuse unsafe URLs (SSRF), never expose API
keys, and always work with or without `GEMINI_API_KEY`, so it is safe to host.

---

## EARS-format Acceptance Criteria

**AC-1.1 (US1)** The system shall make a live HTTP request to the user-provided
URL and report status: `ALIVE` when a 2xx/3xx response is received, and `DEAD`
with a cause of death (status code ≥ 400, DNS failure, connection refused, or
timeout), and `DEAD` with cause `timeout` when no response arrives within the
configured timeout (default 8 seconds).

**AC-1.2 (US1)** When the provided URL does not use the `http` or `https`
scheme, the system shall reject the request with HTTP 400 and a message that
the URL is invalid, and it shall not perform any outbound fetch.

**AC-1.3 (US1)** When the provided URL resolves to a private/loopback/link-local
IP or a blocked metadata endpoint, the system shall reject the request with
HTTP 400 and a message that the URL is unsafe, and it shall not perform any
outbound fetch.

**AC-1.4 (US1)** When the live fetch fails due to network error or timeout, the
system shall respond with HTTP 200 and a JSON body marking the page `DEAD` with
a human-readable cause, rather than an HTTP 5xx.

**AC-2.1 (US2)** The system shall query the Wayback Machine CDX API for the
user-provided URL and return an array of snapshots, each with a timestamp
(`yyyyMMddHHmmss`), HTTP status code, and digest, plus a summary of
first-seen, last-seen, and total count.

**AC-2.2 (US2)** The system shall derive and return a year-by-year "haunting
timeline" grouping snapshot counts by the year portion of the timestamp, in
ascending year order.

**AC-2.3 (US2)** When the CDX API returns no snapshots for the URL, the system
shall respond with HTTP 200 and an empty snapshot array and a `total` of 0,
without erroring.

**AC-2.4 (US2)** When the CDX API request fails or times out, the system shall
respond with HTTP 502 and a message that the archive could not be reached.

**AC-3.1 (US3)** When the user selects a snapshot, the system shall fetch the
raw archived HTML from `web.archive.org/web/{ts}id_/{url}`, sanitize it (strip
scripts, iframes, event-handler attributes, style attributes, dangerous tags),
rewrite image `src` to their archived versions, and extract title, headings,
paragraphs, lists, links, and images.

**AC-3.2 (US3)** The system shall render the extracted content into a reborn
page that is mobile-friendly, uses semantic HTML, meets WCAG AA color contrast,
and respects `prefers-reduced-motion` (no animation when the user requests
reduced motion).

**AC-3.3 (US3)** When the archived fetch fails or times out, the system shall
respond with HTTP 502 and a message that the remains could not be retrieved.

**AC-3.4 (US3)** The system shall cache resurrect results in an in-memory LRU
cache keyed by `{url, ts}` and serve repeated requests for the same key from
cache without re-fetching, up to the configured cache size.

**AC-4.1 (US4)** When `GEMINI_API_KEY` is set and the Gemini API call succeeds,
the system shall return a 2-sentence "spirit message" summary, a one-line
"epitaph," and 3 suggested search queries as part of the resurrection response.

**AC-4.2 (US4)** When `GEMINI_API_KEY` is not set, or the Gemini call fails, the
system shall fall back to a deterministic extractive summary, epitaph, and
suggested queries, and the response shall be identical in shape to the Gemini
path so the client cannot tell which produced it.

**AC-5.1 (US5)** The system shall offer a "Download as standalone HTML" action
that returns a single self-contained HTML document with all content inlined
(no external scripts or stylesheets), including a provenance footer with the
original URL, snapshot timestamp, and a link to the archive capture.

**AC-5.2 (US5)** The downloadable HTML shall be fully sanitized, containing no
`<script>`, `<iframe>`, `on*` attributes, or `javascript:` URIs.

**AC-5.3 (US5)** The system shall provide a "copy citation" control that copies
a citation string containing the original URL, snapshot date (human-readable),
and archive link to the clipboard.

**AC-6.1 (US6)** The system shall present a "Graveyard" of exactly 6 one-click
demo pages, each verified to be dead or substantially changed, each with a name
and a short spooky description, and clicking one shall prefill the URL and
trigger the pulse check.

**AC-7.1 (US7)** The system shall not expose `GEMINI_API_KEY` in any response
body, error message, or log line.

**AC-7.2 (US7)** The system shall remain fully functional (pulse, snapshots,
resurrect with fallback summary) when `GEMINI_API_KEY` is unset.

**AC-7.3 (US7)** The system shall apply all SSRF validation rules (AC-1.2,
AC-1.3) to every user-provided URL before any outbound fetch.

**AC-7.4 (US7)** The `GET /api/health` endpoint shall return HTTP 200 and a JSON
body `{ status: 'ok' }` without requiring any API key.
