---
inclusion: always
---

# Séance — File Layout

```
seance/
├── .kiro/
│   ├── steering/
│   │   ├── product.md
│   │   ├── tech.md
│   │   ├── structure.md
│   │   └── security.md
│   └── specs/
│       └── seance/
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
├── server.js                 # Express entrypoint: static + API routes, wiring
├── src/
│   ├── url.js                # URL validation + SSRF-safe resolution helpers
│   ├── cache.js              # Tiny in-memory LRU cache
│   ├── pulse.js              # GET /api/pulse logic (live check)
│   ├── snapshots.js          # GET /api/snapshots logic (CDX API)
│   ├── resurrect.js          # GET /api/resurrect orchestration
│   ├── extract.js            # HTML extraction + image rewriting
│   ├── sanitize.js          # HTML sanitization (strip scripts/events/style)
│   ├── render.js             # Build the "reborn" HTML (server-side string templating)
│   ├── gemini.js             # Optional LLM summary + fallback
│   └── graveyard.js          # The 6 famous-dead-page demo entries
├── public/
│   ├── index.html            # App shell, graveyard, paste box
│   ├── app.js                # Client: calls API, renders results, download/cite
│   └── styles.css            # Dark graveyard theme, fog, candle, Ouija planchette
├── test/
│   ├── url.test.js           # Property-based URL validation tests
│   ├── extract.test.js       # Property-based HTML extractor tests
│   └── (other *.test.js)
├── package.json              # type: module, deps: express, node-html-parser; scripts: start, test
├── render.yaml               # Render free web service config
└── LICENSE                   # MIT
```

## Notes

- `server.js` is the single entrypoint; it wires Express and delegates logic to
  `src/` modules. Keep route handlers thin — real logic lives in `src/`.
- `public/` is served as static. No build step touches it.
- `test/` mirrors `src/` concerns. Tests never hit the live network.
- Keep new modules under `src/` and add a matching `test/*.test.js` when the
  module has non-trivial logic.
