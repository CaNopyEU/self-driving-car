# Neon Overdrive 3D

## What I built

Neon Overdrive 3D is a zero-build arcade road game built on Three.js: the player pilots a glowing sports car through a night-city highway, threading adaptive traffic, hitting score gates, building close-pass combos, and trying to survive escalating speed and density for a high score.

## Features

- Replaced the 2D training simulator UI with a complete playable 3D game loop.
- Added a real perspective Three.js scene with 3D road segments, vehicles, buildings, shadows, fog, lighting, emissive neon lane markers, and particle bursts.
- Added player-controlled driving with acceleration, braking, steering, handbrake drift, road-edge slowdown, impacts, and camera-responsive game feel.
- Added start screen, playing state, game-over screen, restart flow, HUD, toast feedback, high score display, and safe best-score persistence.
- Added scoring from speed, distance, level, near overtakes, and green boost gates, with a combo multiplier that the player can understand immediately.
- Added progression through distance-based levels that increase top speed, rival pace, and traffic pressure while restoring a little integrity at each level.
- Added three camera modes: chase, cockpit, and cinematic, switchable with `C`.
- Added generated Web Audio engine hum and event tones without external assets.
- Wrapped storage access in `try/catch`, so sandboxed iframe storage failures degrade to non-persistent high scores instead of crashing.

## How To Play

- `W` or `Up`: accelerate.
- `S` or `Down`: brake.
- `A/D` or `Left/Right`: steer.
- `Space`: handbrake for sharper drift corrections.
- `C`: switch camera.
- `M`: mute or unmute sound.
- `Enter`: start or restart.
- Goal: survive traffic, pass close for combo, hit green gates for boosts, and push the score as high as possible before integrity reaches zero.

## Camera & 3D Approach

I chose a polished chase camera as the default because it makes the game readable at speed while still showing the 3D car, road depth, traffic, city scale, lighting, and particle feedback. Cockpit mode gives a faster and more dangerous perspective, while cinematic mode is included for spectacle. The game is truly 3D: all cars are modeled from 3D meshes, the road is a perspective world with recycled 3D segments, and buildings, shadows, fog, point lights, and camera movement all operate in world space.

## The Neural Network

I removed the neural-network simulation entirely instead of leaving it as dead code. The original network was built for autonomous training, but this brief asks for the game to be the product and for keyboard play to be central. Adaptive traffic and the rival are now deterministic gameplay systems tuned for readability and pressure; they serve the arcade game better than an opaque training loop would. The shipped runtime has no neural-network dependency.

## Design Decisions

- I used Three.js from a CDN import map to satisfy the zero-build constraint while still delivering real 3D rendering.
- I kept assets procedural and mesh-based so the game works from a static directory with no install step and no external art pipeline.
- I favored an endless-score arcade format over laps because it gives immediate progression, fast restarts, and clear ten-minute replay value.
- I made scoring visible and layered: basic speed/distance points, obvious gate bonuses, and risky close-pass combo rewards.
- I implemented best-effort persistence only for the high score; gameplay never depends on storage availability.
- I deleted the old simulator files after replacing the game so there is no unused neural-network code in the deliverable.

## Next

With one more attempt I would add mobile touch controls, a minimap-style rival indicator, richer procedural road bends/elevation, a boss-like rival phase every fifth level, and a small in-game garage with unlockable paint schemes tied to score milestones.
