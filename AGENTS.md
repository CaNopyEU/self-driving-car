# Agent Guide — Self-Driving Car Bench

This repo is a **benchmark, not an app**. It measures what AI coding models ship
from a fixed starting point. Read `README.md` for the idea, `bench/README.md` for
the protocol.

## Hard rules

- **Never edit `base/`.** It is the frozen benchmark input (tag `base-v1`). Any
  change invalidates comparability; if a change is truly needed, it's a new tag
  (`base-v2`) and a new task version — ask the user first.
- **Never edit `tasks/*.md` wording.** Frozen prompts. Changes require bumping the
  `(vN)` in the H1 and are a user decision.
- **Never edit anything inside `runs/<id>/`.** Run folders are verbatim model
  output — fixing them corrupts the benchmark. Broken runs get `firstTry: false`
  and notes in the ledger instead.
- `runs/index.json` is append/annotate only: the runner appends entries, the user
  fills `smoke`/`review`. Don't rewrite history in it.

## What agents *do* work on here

The infrastructure: `bench/run.ts` (runner), `index.html` (dashboard), docs. The
dashboard must stay a single self-contained static file (GitHub Pages, zero deps)
and must keep rendering the `runs/index.json` schema documented in
`runs/README.md` — schema changes need a migration of existing entries.

## Stack

Vanilla JS/HTML/CSS (dashboard, base game) + Bun/TypeScript (runner). No build
step anywhere. Serve locally with `bun bench/serve.ts` from the repo root —
not `python3 -m http.server`: the dashboard fetches `runs/index.json` (so
`file://` won't work) and its sandboxed iframe needs CORS headers for
ES-module games, which python's server doesn't send.
