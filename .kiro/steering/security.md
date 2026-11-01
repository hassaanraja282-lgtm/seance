---
inclusion: fileMatch
fileMatchPattern: "server.js|src/**/*.js"
---

# Séance — Security Rules

These rules apply to `server.js` and all `src/**/*.js`. Treat them as mandatory
when writing or reviewing server-side code.

## SSRF Protection (URL validation)

Any URL coming from a user request must be validated before it is fetched by the
server. Rules:

- **Scheme allowlist:** accept only `http` and `https`. Reject everything else
  (`file:`, `ftp:`, `data:`, `gopher:`, etc.) with a 400.
- **No localhost / private addresses:** reject hostnames and IPs that resolve to
  private ranges. At minimum block:
  - `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`,
    `169.254.0.0/16` (link-local), `::1`, `fc00::/7`, `fe80::/10`.
  - The literal hostnames `localhost`, `0.0.0.0`, and `metadata.google.internal`
    (and mirror it for cloud metadata endpoints, e.g. `169.254.169.254`).
- **DNS rebinding:** resolve the hostname and check the resolved IP(s) against the
  private-range list **before** issuing the request. Do not trust the hostname
  string alone. Use `node:dns` `lookup`/`resolve4`/`resolve6`.
- **No credentials in URL:** reject URLs containing `user:pass@` userinfo.
- **Block known metadata IPs** explicitly (e.g. `169.254.169.254`).
- On any validation failure, return `400 { error: 'Invalid or unsafe URL' }` and
  do not perform the fetch.

> The CDX API and web.archive.org targets are hardcoded safe hosts; they do not
> take a user-controlled host. Only the live "pulse" fetch uses a user URL and
> must pass full validation.

## Timeouts

Every outbound `fetch` uses an `AbortController` with a fixed timeout
(recommended 8s). On timeout, abort and return a clear error — never hang.

## API Keys

- `GEMINI_API_KEY` is optional. Read it lazily from `process.env`. Never hardcode
  it. Never write it to logs, error messages, or response bodies.
- If Gemini is unavailable or the call fails, fall back to the deterministic
  extractive summarizer so the app always works. Never crash on a missing key.
- Do not log the key, request headers that contain it (`x-goog-api-key`), or any
  portion of the key in caught errors.

## HTML Sanitization (resurrected pages)

Archived HTML is untrusted. Before extracting content and before rendering the
reborn page, sanitize with `node-html-parser`:

- **Remove entirely:** `<script>`, `<iframe>`, `<object>`, `<embed>`,
  `<frame>`, `<frameset>`, `<applet>`, `<noscript>`, `<meta http-equiv>` (refresh
  / redirects), `<base>`, `<link>` (stylesheets / preloads), and any tag whose
  presence could load remote content or run code.
- **Strip event handlers:** remove every `on*` attribute (`onclick`, `onerror`,
  `onload`, `onmouseover`, etc.) from every element.
- **Strip dangerous attributes:** remove `style` attributes (we provide our own
  CSS) and any `href`/`src` using `javascript:`, `data:` (except for images that
  are clearly safe, prefer rewriting to archive URLs), or `vbscript:`.
- **Rewrite, don't fetch:** rewrite `<img src>` to their archived
  `web.archive.org/web/{ts}id_/{original}` form so images resolve through the
  archive rather than the (possibly dead) origin.
- **Keep structural content:** `<title>`, headings (`h1`–`h6`), `<p>`, `<ul>`,
  `<ol>`, `<li>`, `<a>` (links rewritten to archive form, `rel="noopener
  noreferrer"` added for external links), and `<img>` (sanitized + rewritten).
- Sanitization happens **before** extraction so the extractor never sees script
  or style content. The same sanitized tree is used to build the downloadable
  standalone HTML.
- The downloadable standalone file is also fully self-contained and sanitized —
  it must not load any external script or stylesheet, only inline (safe) content
  plus rewritten archive image URLs.

## Logging

- Log generic events and errors only. Never log: API keys, full request
  headers, user passwords, or raw archived HTML bodies. Redact if unsure.
- Prefer `console.error` for server errors with a short message; keep logs
  safe to paste in a bug report.
