# NEON RUSH — 3D Highway Arcade

## What I built

**Neon Rush** is a synthwave endless-highway dodger built on three.js (single CDN
importmap, zero build step). You pilot a neon car down a five-lane highway at
night, weaving through traffic that is driven by evolving neural networks. Score
comes from distance and from *near misses* — shaving past a car builds a combo
multiplier, so the optimal play is deliberately dangerous. Shields absorb three
hits, pickups restore shields and boost, and every 500 m the level rises: the road
gets faster, denser, and the traffic's brains get meaner.

## Features

- Full 3D scene: perspective chase cam over a scrolling highway, synthwave sun,
  star field, neon city blocks, fog, emissive lane markers and pylons — all
  procedural, no external assets (even the sun is a canvas texture).
- Player car with smooth analog-feel steering, boost meter (drain/regen), brake,
  body roll/yaw animation, and blinking invulnerability frames after a hit.
- Three cameras (`C`): chase, cockpit, and a drifting cinematic side cam. FOV
  widens with speed for a sense of velocity.
- Score system: distance × combo, +100 × combo per near miss, +50 × combo per
  pickup; combo (up to x10) decays after 5 s without a near miss.
- Progression: level per 500 m — base speed, traffic density and spawn rate all
  ramp; fog colour shifts each level as a visual milestone.
- NN-driven adaptive traffic (see below) that lane-changes, brakes and surges.
- Pickups: shield (octahedron) and boost (icosahedron), floating and spinning.
- Feedback & juice: voxel explosions with gravity and floor bounce, camera shake,
  combo pop, HUD toasts ("NEAR MISS +400", "LEVEL 3 — TRAFFIC ADAPTS").
- Procedural WebAudio: engine hum pitched to speed, near-miss noise whoosh,
  crash noise burst, pickup blips, level-up fanfare. `M` mutes.
- Full game loop: attract-mode orbiting menu camera → playing → pause (`P`) →
  wrecked screen with stats and restart. No dead ends.
- Best score persisted via localStorage, fully wrapped in try/catch — in a
  sandboxed iframe it silently degrades to session-only.

## How to play

- **←/→ or A/D** steer • **↑/W** boost • **↓/S** brake
- **C** camera • **M** mute • **P** pause • **Enter/Space** start/restart
- Survive. Graze cars for combo. Grab ◆ shields and ⬢ boost. Don't get wrecked.

## Camera & 3D approach

Default is a **chase camera**: it reads best for a lane-dodging game because you
can judge lateral gaps several car-lengths ahead, and it shows off your own car.
It lerps toward the target with speed-scaled FOV and shake on impact, so motion
feels physical. Cockpit and cinematic cams are one keypress away for spectacle.
The world is genuinely 3D: the player advances along +Z through recycled road
segments and buildings (a treadmill of real geometry), with real perspective,
fog, and lighting — not a tilted 2D scene.

## The neural network

**Kept and repurposed.** `network.js` (the original feed-forward net with
binary-threshold neurons and the `mutate` operator) now drives every traffic car.
Each car thinks 5×/sec on inputs `[player lateral offset, gap to player, left
lane blocked, right lane blocked, own relative speed]` and outputs
`[drift left, drift right, brake, surge]`. Cars accumulate *fitness* for time
spent squarely in the player's path close ahead — i.e. for being a threat. When
a car scrolls off behind you, a threatening brain enters an elite pool (cap 8),
and 75 % of new spawns are mutated clones of elites. So the generational-learning
idea of the original demo survives, but the selection pressure is now *you*: the
traffic literally evolves to block the player within a single run. Everything
else from the demo (2D car, sensor raycasting, visualizer, settings panel) was
deleted — no dead code.

## Design decisions

- **Near-miss combo as the core loop.** Pure survival games plateau emotionally;
  rewarding grazes creates a risk dial the player controls, which is what makes
  runs feel authored rather than random.
- **Lateral steering is free-form, traffic is lane-quantized.** Gives the player
  more expressiveness than the AI, which reads as skill.
- **Elite pool resets each run** so a new game is a fair start, and mutation rate
  (0.15) keeps traffic varied instead of converging on one degenerate blocker.
- **Threshold neurons kept as-is** (outputs are 0/1): decisions are re-evaluated
  on a 0.2 s tick and positions lerped, so binary outputs still produce smooth,
  readable motion — no need to rewrite the net with sigmoids.
- **Everything procedural** (geometry, textures, audio) to honour the no-assets,
  no-build constraint while still delivering spectacle.

## Next

- Curved road sections and hills (spline-based treadmill) for camera drama.
- Boss waves: a single heavily-evolved "rival" car that mirrors your lane.
- Post-processing bloom via three.js examples CDN for true neon glow.
- Persist the elite brain pool (best-effort storage) so traffic remembers you
  across sessions — a nemesis system.
- Gamepad and touch controls.
