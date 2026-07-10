# Neon Overdrive

## What I Built
Neon Overdrive is a polished top-down arcade lane dodger built from the original canvas demo: you drive a neon car through escalating cyber-city traffic, collect energy cells, chain overtakes for score, and survive periodic rival drones that try to cut into your line.

## Features
- Replaced the simulator/training interface with a complete static game: title screen, active play, crash/game-over screen, and instant restart.
- Added keyboard and touch controls for steering and boosting.
- Added score, best score, level, overtakes, streak bonuses, energy pickups, and boost management.
- Added progression through rising road speed, denser traffic, faster obstacles, and recurring rival drones.
- Added procedural visuals: neon road edges, lane markers, particle bursts, screen shake, crash flash, boost flames, animated coins, HUD panels, and responsive full-screen rendering.
- Added lightweight WebAudio sound effects generated at runtime with no external assets.
- Wrapped high-score storage in try/catch so sandboxed iframes without storage degrade safely.
- Removed the old trainer UI, neural-network visualizer, settings panel, sprite asset, and unused simulation modules.

## How To Play
- Press `Space` or `Enter` to start.
- Steer with `Arrow Left`/`Arrow Right` or `A`/`D`.
- Hold `Arrow Up`, `W`, or `Space` to boost while energy is available.
- On touch devices, use the on-screen `LEFT`, `BOOST`, and `RIGHT` buttons.
- Dodge cars, collect yellow energy cells, pass traffic to build streak bonuses, and survive as levels get faster.
- Press `R`, `Space`, or `Enter` after crashing to restart.

## The Neural Network
I removed the original trainable neural-network system because the product is now a player-first arcade game, not a passive learning simulation. Keeping the old population training, sensors, storage, and visualizer would have created dead code and confusing UI. The concept is repurposed only as gameplay flavor: pink rival drones use a small adaptive lane-selection heuristic that reads nearby traffic and the player's lane to choose an aggressive path.

## Design Decisions
- I chose an immediate lane-dodger format because it makes the old road/car premise playable within ten seconds while preserving the top-down driving identity.
- I kept the game zero-build and self-contained by drawing all cars, coins, particles, and UI procedurally on canvas.
- I made boost a score risk/reward tool instead of just a speed button: it raises scoring but spends energy, so coins matter.
- I avoided persistent progression because storage may be unavailable in the target sandbox; only best score is attempted and failure is harmless.
- I removed rather than preserved the neural-network files because unused training code would conflict with the requirement that dead code counts against the submission.

## Next
With one more attempt I would add multiple road biomes, named challenge missions, more enemy behaviors, and a short audio music loop generated from the same WebAudio system.
