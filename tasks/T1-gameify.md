# Task T1 — Game-ify (v1)

You are given a small vanilla-JS canvas project: a self-driving-car neural-network
demo (2D top-down road, sensor rays, generational learning). Your job is to turn it
into a **complete, polished, playable arcade game** — something a person would
genuinely enjoy playing for ten minutes.

## Requirements

- **Player-controlled car** (keyboard). The game, not the simulation, is the product.
- **Score system** — meaningful scoring the player understands at a glance.
- **Progression** — levels, waves, or escalating difficulty; the game must ramp up.
- **Full game loop** — start screen, playing state, game over, restart. No dead ends.
- **Polish** — visual and game-feel polish is explicitly part of the task: motion,
  feedback, HUD, sound if you can do it without external assets.

## The neural network

The existing neural network is **yours to decide about**: remove it entirely if it
serves no purpose, or repurpose it (AI opponents, adaptive traffic, a rival racer…).
Justify your choice in RESULT.md. Dead code left behind counts against you.

## Constraints

- **Zero build step.** The game must run by serving this directory statically and
  opening `index.html`. No bundlers, no npm install, no frameworks.
- No external assets or CDNs. Everything self-contained (generated/inline assets are fine).
- The game will also be embedded in a **sandboxed iframe** where `localStorage` /
  `sessionStorage` / cookies **throw**. Treat storage as best-effort: wrap access in
  try/catch and degrade gracefully (e.g. high score just doesn't persist). The game
  must never crash because storage is unavailable.
- This is a **single attempt**. There is no follow-up prompt and no human to ask.
  Make decisions and commit to them. If you have browser tooling available, use it
  to verify the game actually runs before you finish.

## Deliverable

Besides the working game, write **`RESULT.md`** in the project root:

1. **What I built** — one-paragraph pitch of the game.
2. **Features** — bullet list of everything added/changed.
3. **How to play** — controls and goal.
4. **The neural network** — what you did with it and why.
5. **Design decisions** — the interesting trade-offs you made.
6. **Next** — what you would build with one more attempt.
