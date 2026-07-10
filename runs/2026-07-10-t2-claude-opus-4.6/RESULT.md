# RESULT.md

## What I built

**Neon Rush 3D** — a synthwave-styled 3D endless racer where you weave through AI-controlled traffic at increasing speeds. The game features a chase camera, procedural neon cityscape, combo scoring for near-misses, escalating difficulty through levels, and a full arcade game loop with lives, score, and a persistent high score.

## Features

- Full 3D perspective rendering using Three.js (via CDN importmap)
- Chase camera with dynamic height based on speed and steering tilt
- 4-lane neon highway with procedural city buildings and glowing edge strips
- Player-controlled car with physics-based steering (momentum, damping)
- AI traffic cars that use neural networks to decide lane changes
- Near-miss combo system rewarding risky driving
- 3 lives with invincibility frames and screen shake on hit
- Level progression every 15 seconds (faster traffic, denser spawns, higher top speed)
- Procedural audio: pass sounds, combo tones, crash noise
- Pulsing neon edge lights and fog for atmosphere
- HUD showing score, speed, level, combo, lives
- Full game loop: start screen → playing → game over → restart
- High score persistence with safe localStorage (try/catch)
- Responsive canvas, works at any window size

## How to play

- **Arrow Keys** or **WASD** to steer and accelerate/brake
- Dodge traffic cars, pass them to earn points
- Pass cars closely for **near-miss combo** bonus (x1, x2, x3... multiplier)
- Survive as long as possible — speed and traffic increase every level
- 3 lives; collisions cost one life with brief invincibility
- Press **Enter** or **Space** to start/restart

## Camera & 3D approach

Chase camera positioned behind and above the player car, with smooth interpolation (lerp) on all axes. Camera height increases slightly with speed for a sense of velocity. Steering input tilts the car model and offsets the camera laterally. Screen shake on collision adds impact. The fog and neon lighting create depth cues that make the 3D space readable at high speed.

## The neural network

The neural network is **repurposed as AI traffic behavior**. Each traffic car has a small neural network (3 inputs → 4 hidden → 2 outputs) that decides lane-change behavior based on: available lanes left/right and player proximity. Each car's brain is mutated randomly at spawn, creating varied and unpredictable traffic patterns — some cars stay put, others weave aggressively. This makes gameplay feel dynamic rather than pattern-based. The original generational learning code was removed as it served a simulation purpose incompatible with an arcade game.

## Design decisions

- **Endless runner format** over track racing — better fits the original forward-scrolling design and delivers immediate fun without requiring complex track geometry
- **Combo near-miss system** — rewards skilled play and risk-taking, adds depth beyond simple dodging
- **Lives instead of one-hit death** — more forgiving for new players while still creating tension
- **Procedural audio** — satisfies "sound" requirement without external assets; simple tones give feedback
- **Level escalation via multiple parameters** — traffic speed, spawn density, and player top speed all increase, creating compounding challenge
- **No build step** — single ES module with importmap for Three.js, zero tooling required
- **Smooth steering with velocity** — feels more like driving than instant lane-snapping

## Next

With one more attempt I would add:
- Curved road segments for visual variety
- Power-ups (shields, speed boost, score multiplier)
- More detailed car models with proper geometry
- Particle effects (sparks on near-miss, explosion on crash)
- Persistent leaderboard overlay
- Mobile touch controls
- Engine sound via continuous oscillator modulated by speed
- Rear-view mirror minimap
