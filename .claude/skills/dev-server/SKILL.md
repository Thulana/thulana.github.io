---
name: dev-server
description: Run this Jekyll blog locally and verify a change in a real browser — start or reuse the dev server, then drive the rendered page, emulate themes and reduced motion, and take screenshots. Use when asked to start, serve, run, preview or screenshot the site, or to confirm a change works on the page rather than only in source.
---

# Running and verifying the blog

## Read this first

**[docs/running-locally.md](../../../docs/running-locally.md)** is the source
of truth for everything about getting a server up: Ruby requirements, gem
setup, the dev config, expected build noise, and the traps that make a running
server lie to you (`127.0.0.1` vs `localhost`, port 4000 already in use, the
server following whatever branch is checked out). Read it rather than
rediscovering any of it, and fix it there if it turns out to be wrong.

The short version:

```bash
lsof -nP -iTCP:4000 -sTCP:LISTEN     # reuse a running server if there is one
bundle exec jekyll serve --config _config.yml,_config.dev.yml
```

Then open **http://localhost:4000** — not `127.0.0.1`, for the reason the
guide gives.

## Driving it in a browser

This is the part no document covers, because it exists for agents rather than
for people reading the site.

Prefer the `chrome-devtools` MCP tools when they are available. They often
fail with *"The browser is already running for .../chrome-profile"* because
another session holds the automation profile. **Do not kill the user's
browser** — use the driver next to this file, which launches its own isolated
headless Chrome and speaks the DevTools Protocol directly.

```bash
CHROME="$(command -v google-chrome || command -v google-chrome-stable \
  || command -v chromium || command -v chromium-browser \
  || echo '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')"

"$CHROME" --headless=new --disable-gpu --no-first-run \
  --remote-debugging-port=9333 --user-data-dir="$(mktemp -d)" about:blank &

node .claude/skills/dev-server/verify.mjs \
  --url http://localhost:4000/ --scheme dark --screenshot /tmp/home.png
```

| Flag | Effect |
| --- | --- |
| `--url` | Page to load (default `http://localhost:4000/`) |
| `--scheme light\|dark` | Emulates `prefers-color-scheme` |
| `--reduce` | Emulates `prefers-reduced-motion: reduce` |
| `--screenshot PATH` | Writes a PNG |
| `--port` | Debugging port, default 9333 |

It reports computed animation and transition durations, images that failed to
decode, whether the giscus comment iframe mounted, and console errors. Needs
Node 22+ for global `fetch` and `WebSocket`; no dependencies.

**Look at the screenshot.** A blank or half-painted frame is a failure even
when the probe output reads fine.

Console entries survive navigation within a tab, so errors from a previous
page replay and look current. If a console result surprises you, restart
Chrome and re-run against the single URL in question.

## What to check after a change

- **Both themes.** There is a manual toggle *and* OS following, so run
  `--scheme light` and `--scheme dark`.
- **Reduced motion.** Anything animated must collapse under `--reduce`.
- **A post page, not just the homepage.** Posts carry the TOC, comments,
  sidebar and share links; the homepage uses `splash` and has none of them.
