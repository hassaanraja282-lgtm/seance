---
inclusion: always
---

# Séance — Product

## Purpose

Séance lets anyone paste a dead URL and "resurrect" it. It checks whether the
page is still alive, queries the Internet Archive's Wayback Machine for archived
snapshots, and renders a chosen snapshot as a clean, modern, mobile-friendly,
accessible "reborn" page. Output is a self-contained downloadable HTML file with
a provenance footer so the result is citeable. An optional LLM summary (Gemini)
provides a short "spirit message" and "epitaph"; a deterministic fallback keeps the
app fully functional without an API key.

The project was built for the Kiroween 2026 hackathon, category "Resurrection."

## Users

- **Curious reader** — followed a broken link from a paper, Stack Overflow answer,
  or bookmark and wants the content back.
- **Researcher / writer** — needs a clean, citeable copy of an archived page with
  provenance (original URL, snapshot timestamp, archive link).
- **Demo audience / hackathon judge** — wants a one-click experience via the
  Graveyard of famous dead pages.

## Voice & Tone

- **Playful-spooky but clear.** The theme is séances, graveyards, ghosts — but
  every piece of copy must remain immediately understandable. The metaphor never
  obscures function. A first-time visitor should know what to do without help.
- Dead pages are "corpses," archived snapshots are "remains," rendering is
  "resurrection" / "summoning." Keep these terms consistent across UI and docs.
- Status copy is atmospheric but unambiguous: "Checking for a pulse…", "Digging
  up the remains…", "Summoning…", "The page lives! 👻", "R.I.P. — cause of death:
  404".
- Error messages are honest and human: "The spirits are silent" for upstream
  failures, never a raw stack trace. Always include the underlying cause when it
  helps the user act (e.g. "DNS lookup failed", "timed out after 8s").
- Tone of docs is developer-oriented and concise, with spooky flavor in headings
  and section names only.
- Accessibility is part of voice: the theme is a costume, not a barrier. Contrast
  must meet WCAG AA and motion must respect `prefers-reduced-motion`.
