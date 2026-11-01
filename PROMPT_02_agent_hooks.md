Read the steering docs in .kiro/steering and the spec in .kiro/specs/seance.
Now set up Kiro automation for this repo (no application code yet):
1. Create a custom Kiro CLI agent at `.kiro/agents/seance-builder.json` (Kiro CLI agent config schema: name, description, prompt, tools, allowedTools, resources, hooks). Its prompt: implement tasks from .kiro/specs/seance/tasks.md one at a time, tick the checkbox when done, follow steering. resources: "file://.kiro/steering/**/*.md", "file://.kiro/specs/seance/**/*.md". allowedTools: fs_read, fs_write, execute_bash (or their current names). Hooks:
   - agentSpawn: a command that prints `git status --short` and the next unchecked task line from tasks.md (e.g. `grep -m1 -n "\- \[ \]" .kiro/specs/seance/tasks.md`), so every session starts with context.
   - postToolUse matched to the file-write tool: run `npm test --silent 2>&1 | tail -n 15 || true` so test feedback is fed back after each write.
   - stop: run a secret scan `grep -rnE "AIza[0-9A-Za-z_-]{20,}" --exclude-dir=node_modules --exclude-dir=.git . && echo "SECRET FOUND" || echo "no secrets"`.
2. Create Kiro IDE agent hooks in `.kiro/hooks/` (JSON files ending `.kiro.hook`, fields: enabled, name, description, version "1", when {type: "fileEdited", patterns:[...]} or {type:"userTriggered"}, then {type:"askAgent", prompt:"..."}):
   - `test-on-save.kiro.hook`: on edits to src/**/*.js or server.js, ask agent to run npm test and fix failures.
   - `security-review.kiro.hook`: on edits to src/**/*.js, review the change against .kiro/steering/security.md (SSRF, sanitization, key handling).
   - `spooky-copy-check.kiro.hook`: on edits to public/**/*.html or public/**/*.js, check UI copy matches product.md voice and that contrast/reduced-motion rules hold.
   - `sync-tasks.kiro.hook` (userTriggered): reconcile tasks.md checkboxes with what exists in the codebase.
3. Create `.kiro/settings/mcp.json` registering the official `fetch` MCP server (`uvx mcp-server-fetch`) with `disabled: false` and `autoApprove: ["fetch"]`, used to inspect Wayback Machine API responses while building.
Write the files directly, valid JSON only.
