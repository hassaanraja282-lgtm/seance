---
inclusion: always
---

# Séance — Tech Stack & Conventions

## Runtime / Sandbox

- Linux aarch64, Node.js >= 18 (target 20+). Plain ES modules (`"type": "module"`).
- No Docker. No native build steps.

## Dependencies (intentionally minimal)

- **express** — the only runtime web framework. Use it to serve `public/` and
  expose the JSON API in `server.js`.
- **node-html-parser** — the only HTML parser. Use it for both extracting content
  and for sanitizing archived HTML before it is rendered (see security.md).
- Dev/test: none required — tests use the built-in `node:test` runner.

> Do not add any other runtime dependencies. If a feature seems to need one,
  raise it before pulling it in. The minimalism is a hard constraint of the
  project.

## No Frontend Framework / No Build Step

- Static files only: `public/index.html`, `public/app.js`, `public/styles.css`.
- Vanilla JS (ES modules), served as-is by Express static middleware. No bundler,
  no transpiler, no TypeScript build. Browser-targeted JS uses standard DOM APIs.
- `public/app.js` talks to the server only via the JSON API routes.

## Coding Conventions

- **Modules:** ES `import`/`export` everywhere. Node entrypoint is `server.js`.
- **Style:** 2-space indent, single quotes, trailing commas in multiline
  literals, semicolons. `async`/`await` over raw `.then()` chains.
- **Errors:** `throw new Error('message')` with a meaningful message; server
  routes catch and respond with `{ error: 'message', detail?: '...' }` and an
  appropriate status. Never leak stack traces to the client.
- **Validation first:** every API route validates input before doing work (see
  security.md for URL rules). Return 400 for bad input with a clear message.
- **Timeouts:** every outbound `fetch` (to the live URL, the CDX API, and
  web.archive.org) must have an `AbortController`-based timeout. No unbounded
  network waits.
- **Caching:** a small in-memory LRU cache keyed by request URL + params.
  Implement by hand (a `Map` with a max size and delete-on-set eviction is fine);
  do not add an LRU library.
- **Env:** read `process.env.GEMINI_API_KEY` lazily; absence is normal and must
  not break the app. Only `GEMINI_API_KEY` is expected.
- **Naming:** kebab-case filenames for non-entrypoint modules under `src/`;
  camelCase for functions/variables; PascalCase for classes. Route handler
  filenames mirror their resource (e.g. `src/pulse.js`, `src/snapshots.js`,
  `src/resurrect.js`).
- **No secrets in code or logs.** See security.md.

## Testing

- Built-in `node:test` runner; assertions via `node:assert/strict`. `npm test`
  runs `node --test`.
- Property-based style tests for URL validation and the HTML extractor: hand-rolled
  random generators (a small `for` loop with a seeded `Math.random`-based RNG or
  `node:crypto` random) feed many inputs and assert invariants. No extra deps.
- Keep tests fast and hermetic — mock or stub outbound `fetch` so tests don't hit
  the network. Reset module state between tests where needed.
