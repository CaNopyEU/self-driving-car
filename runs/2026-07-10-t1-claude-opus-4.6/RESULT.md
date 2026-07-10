# RESULT.md

## What I built

**Neural Racer** — a top-down arcade racing game where you weave through traffic at increasing speeds while AI rivals powered by neural networks compete alongside you. Dodge cars, rack up points for overtakes, and survive as long as possible across escalating levels.

## Features

- Player-controlled car with keyboard (arrow keys or WASD)
- Score system: distance + overtake bonuses multiplied by level
- Level progression every 3000 points with increasing traffic density, speed, and AI rival count
- Full game loop: start screen → playing → game over → restart
- 3 lives with explosion effects on crash
- AI rival racers using the neural network (1–3 depending on level)
- Procedurally generated infinite traffic
- Particle effects (explosions, overtake sparkles)
- Screen shake on collision
- Speed lines at high velocity
- Synthesized sound effects (overtake ding, level-up jingle, crash, game over)
- HUD with score, level, speed, lives
- High score persistence (gracefully degrades if storage unavailable)
- Level-up announcement animation
- Neon visual style

## How to play

- **Arrow keys** or **WASD** to steer, accelerate, brake
- Dodge traffic cars and AI rivals
- Pass traffic cars to earn bonus points (50 × level)
- Distance traveled earns base score
- Every 3000 points advances a level (faster traffic, more AI rivals)
- 3 lives — crashing costs one life
- Game over when all lives lost

## The neural network

Repurposed as **AI rival racers**. Each level spawns 1–3 neural-network-driven cars that use sensors to detect obstacles and compete with the player. Their brains are randomly mutated each level, creating varied and unpredictable opponents. This gives the NN a meaningful gameplay role (rivals to dodge and race against) rather than being dead simulation code.

## Design decisions

- **Removed the simulation UI entirely** (settings panel, network visualizer, generation controls) — none of it served arcade gameplay
- **Canvas-drawn cars instead of car.png** — eliminates external asset dependency and allows colored/styled cars
- **Web Audio API for sound** — no external assets needed, wrapped in try/catch for sandboxed environments
- **3 lives instead of instant death** — keeps runs feeling meaningful, adds tension as lives drain
- **Level = floor(score/3000)+1** — simple, predictable progression the player can plan around
- **AI rivals see the player as an obstacle** — creates emergent behavior where they swerve around you

## Next

With one more attempt I would add:
- A minimap/radar showing upcoming traffic
- Power-ups (shield, speed boost, score multiplier)
- A combo system for consecutive close overtakes
- Mobile touch controls
- Visual variety (road curves, weather effects)
- Leaderboard overlay showing run history
