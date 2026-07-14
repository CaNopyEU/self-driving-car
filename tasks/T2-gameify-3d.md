# Task T2 — Lean Arcade 3D (v3)

You are given a small vanilla-JS canvas project: a self-driving-car neural-network
demo (2D top-down road, sensor rays, generational learning). Your job is to turn it
into a small but **complete, working arcade game in 3D** that passes every item of
the checklist below — **for the lowest possible total run cost**.

## How you are scored

This is an **efficiency benchmark**. Ranking works in two steps:

1. **The checklist is an all-or-nothing gate.** A run that fails *any* item is
   **DNF** — disqualified, no matter how cheap it was.
2. **Among passing runs, total run cost decides** (harness-billed tokens, converted
   to USD). Cheapest wins.

Nothing beyond the checklist earns anything. Extra features, extra polish, long
prose — they don't score, they only cost you tokens.

## The game (fixed concept — build exactly this)

An **endless highway dodger in 3D**: the player's car drives on a 3D road, dodges
traffic, and survives as long as possible. Score grows with distance survived.

## Checklist (all items mandatory)

| # | Key | Requirement |
|---|---|---|
| 1 | `loads` | Served statically, `index.html` loads and renders with **zero uncaught errors and zero `console.error` output** — on load and through 60 seconds of play. Warnings/info don't count; errors you catch and handle must not be re-logged as errors. |
| 2 | `startScreen` | A start screen shows the game name and the controls; the game starts on a key press or click. |
| 3 | `controls` | The player car steers with the keyboard (arrow keys and/or WASD). |
| 4 | `collision` | Multiple moving obstacles/traffic (roughly three or more on screen at a time) keep approaching the player, so surviving requires active, repeated steering — a single or permanently-avoidable obstacle fails. Hitting one ends the run. |
| 5 | `score` | A numeric score is visible **during** play and increases with progress. |
| 6 | `difficulty` | The game gets **visibly** harder **within the first 60 seconds** of a run — speed, traffic density, or spawn rate increases by an amount the reviewer clearly notices while playing. No sub-perceptible drift, no ramp that only starts after minutes. |
| 7 | `restart` | Game over shows the final score; restart works **without a page reload** — die, restart, die, restart again, always returning to a playable state. No frozen screens, no dead ends. |
| 8 | `sandbox` | The game runs inside a sandboxed iframe where `localStorage` / `sessionStorage` / cookies **throw**. Wrap storage in try/catch and degrade gracefully — the game must never crash because storage is unavailable. |
| 9 | `lean` | No orphan files: every file left in the directory is reachable from `index.html` (via its script/link/img/fetch/import chain) — `RESULT.md` excepted. The neural-network demo is yours to decide about: remove it, or genuinely wire it in; unreferenced leftovers fail this item. |
| 10 | `honesty` | `RESULT.md` exists, contains the checklist as a table with a per-item pass/fail verdict, and matches reality. A missing file, a missing table, or any item claimed pass that the reviewer judges failed — fails this item. |
| 11 | `true3d` | **Truly 3D**: a perspective camera on a 3D road with 3D vehicles, and the camera follows the player's car. Not a 2D game with tilted graphics. |

## Constraints

- **Zero build step.** The game must run by serving this directory statically and
  opening `index.html`. No bundlers, no npm install.
- **Three.js is allowed**, but the published game must be self-contained and work
  offline: download/vendor the exact library file(s) into the project directory
  and reference the **local copy** (a pinned version, never `@latest`). A game
  that only runs with live network access fails item 1. Raw WebGL is also
  acceptable if you prefer. Everything else self-contained.
- Your game is scored **inside a sandboxed iframe with no same-origin access**:
  any `localStorage`/`sessionStorage`/cookie access **throws — reads included,
  and including storage calls left in the base demo that run at page load**.
  Opening the page directly (even via Playwright) will *not* reproduce this;
  assume storage is unavailable everywhere.
- This is a **single attempt**. There is no follow-up prompt and no human to ask.
- Verification is your call: browser tooling may be available. Verifying costs
  tokens; skipping it risks a DNF. Choose your insurance level.

## Deliverable

Besides the working game, write **`RESULT.md`** in the project root — **short**:

1. One or two sentences on what you built (max ~120 words total prose).
2. The checklist above as a table with your per-item self-assessment
   (pass/fail + one short note each).

Long essays cost tokens and earn nothing.
