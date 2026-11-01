We are starting a brand-new project for the Kiroween 2026 hackathon (category: Resurrection — "bring your favorite dead technology back to life").

Project: **Séance** — "Summon dead web pages back from the grave."
Problem: link rot. Old blogs, GeoCities homepages, docs and tutorials die every day; links in papers, Stack Overflow answers and bookmarks lead to 404s. The Internet Archive's Wayback Machine has the corpses, but archived pages are slow, broken, unreadable on mobile, and hard to cite.
Séance lets anyone paste a dead URL and:
1. "Check for a pulse": the server requests the URL live and reports Alive / Dead (status code, DNS failure, timeout) shown as a tombstone with the cause of death.
2. "Dig up the remains": query the Wayback Machine CDX API to list archived snapshots (first seen, last seen, count, a year-by-year "haunting timeline").
3. "Hold the séance": fetch a chosen snapshot's raw HTML (web.archive.org/web/{ts}id_/{url}), extract title, headings, paragraphs, lists, links and images (rewrite image URLs to their archived versions), and resurrect it as a clean, modern, mobile-friendly, accessible "reborn" page. If GEMINI_API_KEY is set, Gemini writes a 2-sentence "spirit message" summary and an "epitaph" (one-line description) and suggests 3 search queries to find where the content moved; if not set or it fails, a deterministic extractive fallback is used so the app always works.
4. Output: rendered reborn page in the app, plus "Download as standalone HTML" (self-contained, citeable, with a provenance footer: original URL, snapshot timestamp, archive link), and a copy-citation button.
5. A "Graveyard" of 6 famous dead pages as one-click demos (e.g. geocities.com, the Space Jam 1996 site is alive so skip it; use examples verified to be dead or changed).
UI: Costume-quality spooky design — dark graveyard theme, candle flicker, drifting fog, a Ouija-board planchette loading animation, tombstone cards, "summoning…" status copy. Must remain readable (WCAG AA contrast) and respect prefers-reduced-motion.

Tech constraints (sandbox: Linux aarch64, Node 20+, no Docker):
- Node.js >= 18, plain ES modules, Express is allowed as the only runtime dependency (plus a tiny HTML parser: use `node-html-parser`). No frontend framework or build step: static `public/index.html`, `public/app.js`, `public/styles.css`.
- Server: `server.js` with routes GET /api/pulse?url=, GET /api/snapshots?url=, GET /api/resurrect?url=&ts=, GET /api/health. Validate URLs (http/https only, block localhost/private IP ranges to prevent SSRF), timeouts on every outbound fetch, small in-memory LRU cache.
- Tests with the built-in `node:test` runner (`npm test`), including property-based style tests for URL validation and the HTML extractor (hand-rolled random generators, no extra deps).
- Deploy target: Render free web service (`render.yaml`), env GEMINI_API_KEY optional. MIT license.

YOUR TASK NOW (do not write application code yet):
A. Create Kiro steering docs in `.kiro/steering/`: `product.md` (purpose, users, voice/tone: playful-spooky but clear), `tech.md` (stack + constraints above, coding conventions), `structure.md` (file layout), and `security.md` (SSRF rules, never log or expose API keys, sanitize resurrected HTML: strip scripts/iframes/event handlers/style attributes before rendering). Use front matter `inclusion: always` for product/tech/structure and `inclusion: fileMatch` with `fileMatchPattern: "server.js|src/**/*.js"` for security.md.
B. Create a Kiro spec in `.kiro/specs/seance/`: `requirements.md` (user stories with EARS-format acceptance criteria, numbered), `design.md` (architecture, data flow, API contracts with JSON shapes, error handling, correctness properties for property-based testing), and `tasks.md` (an ordered implementation checklist of ~10-14 tasks using `- [ ]` checkboxes, each referencing requirement numbers).
Write the files directly. Keep each file focused and concrete.
