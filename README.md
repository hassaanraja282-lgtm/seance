# Séance 🔮🕯️

**Live:** https://seance-a6ag.onrender.com · **Demo video:** https://youtu.be/CcU-MdIMzPc · **Kiroween 2026 — Resurrection category** · MIT

Resurrect dead URLs via the Internet Archive's Wayback Machine.

Paste a broken link, check if it's still alive, dig up archived snapshots, and
summon a clean, modern "reborn" page from the remains. Optionally get a
Gemini-powered "spirit message" summary, epitaph, and search queries — or
rely on the deterministic fallback that always works.

Built for the **Kiroween 2026 hackathon**, category "Resurrection."

## Features

- **Pulse check** — HTTP request to the live URL; classifies ALIVE, DEAD (404, 5xx,
  DNS failure, connection refused, timeout), or POSSESSED (redirected to a
  different host — body-snatched).
- **Snapshot discovery** — queries the Wayback Machine CDX API, showing first-seen,
  last-seen, total count, and a year-by-year "haunting timeline."
- **Resurrection** — fetches the raw archived HTML, sanitizes it (strips scripts,
  iframes, event handlers, dangerous attributes), extracts content (headings,
  paragraphs, lists, links, images), and renders a mobile-friendly reborn page.
- **Spirit message & epitaph** — Gemini-powered summary when `GEMINI_API_KEY` is
  set; deterministic extractive fallback otherwise. Both paths return the same
  response shape so the client can't tell which produced it.
- **Downloadable HTML** — self-contained standalone document with inline CSS and a
  provenance footer (original URL, snapshot date, archive link).
- **Copy citation** — copies a citation string to the clipboard.
- **Graveyard demos** — 6 famous dead/changed pages (GeoCities, Google Wave,
  Yahoo Answers, Google+, AltaVista, NCSA Mosaic) as one-click demos.
- **SSRF protection** — URL validation rejects private IPs, loopback, link-local,
  metadata endpoints, and non-http(s) schemes.
- **Deep-linkable** — `/?url=...` auto-runs the pulse check.

## Quick Start

```bash
npm install
npm start          # serves on port 3000
npm test           # runs all unit + property tests (no network)
```

Set `GEMINI_API_KEY` (optional) for Gemini-powered summaries:

```bash
GEMINI_API_KEY=your-key npm start
```

## Deployment (Render)

The included `render.yaml` defines a free-tier web service. Push to a repo
connected to Render, or use the Render dashboard with:

- **Build:** `npm install`
- **Start:** `node server.js`
- **Env vars:** `GEMINI_API_KEY` (optional), `GEMINI_MODELS` (optional)

## How Kiro Was Used

This project was built using **Kiro** — an AI agent that writes code alongside
developers. The workflow used:

1. **Steering docs** (`.kiro/steering/`) — product, tech stack, file structure, and
   security rules that Kiro follows on every task.
2. **Spec** (`.kiro/specs/seance/`) — requirements (EARS-format acceptance criteria),
   design (architecture, data flow, API contracts, correctness properties), and a
   task checklist.
3. **Agent hooks** — programmatic hooks that gather context (git status, next
   unchecked task) and inject it into each turn.
4. **Custom agent** — a builder agent that reads the next unchecked task from
   `tasks.md`, implements it, runs tests, and ticks the checkbox.

The agent worked through tasks T1–T15 sequentially, writing code and tests, running
`npm test` after each task, and fixing failures before moving on.

### After launch: spec-first bug fixes (T16, T17)
- **T16** — production showed dead domains being rejected as "unsafe" (the SSRF guard treated a DNS failure as an attack). The fix started in the spec (new AC-1.5, a design addendum splitting `validateUrlSyntax` from `validateUrlForFetch`), then code and tests. Kiro drafted the new validators; the free-tier service throttled the remaining runs, so the wiring and tests were finished by hand and recorded in `tasks.md`.
- **T17** — the T16 diagnostic log line revealed Render's resolver returns IPv6 addresses ending in `::`, which the IPv6 expander mis-parsed. Fixed with regression tests.

135 tests (unit + property-based) pass with `npm test`.

## Architecture

```
Browser (public/index.html, app.js, styles.css)
        │  JSON over HTTP
        ▼
server.js ─── Express
        │     static(public/)
        │     GET /api/pulse
        │     GET /api/snapshots
        │     GET /api/resurrect
        │     GET /api/health
        │     GET /api/graveyard
        ▼
src/ modules ──► outbound fetch (live URL | CDX API | web.archive.org)
```

All real logic lives in `src/`. `server.js` wires Express, delegates to modules,
and returns JSON. `public/app.js` calls the API and renders results in the DOM.

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | Returns `{ status: "ok" }` |
| `GET /api/pulse?url=` | Checks if a URL is alive or dead |
| `GET /api/snapshots?url=` | Lists archived snapshots + timeline |
| `GET /api/resurrect?url=&ts=` | Resurrects an archived page |
| `GET /api/graveyard` | Returns 6 famous dead page demos |

## License

MIT
