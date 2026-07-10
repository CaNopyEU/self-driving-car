# RESULT — Highway Dodger

## 1. What I built

**Highway Dodger** — a fast, neon-tinted arcade lane-weaver. You drive an endless
four-lane highway, overtaking slower traffic for points and shaving past cars for
near-miss bonuses that chain into combos. Difficulty escalates by level: traffic
gets faster and denser, and from level 3 the road fills with **elite drivers** —
red cars powered by the original project's neural network that sense you coming
and actively swerve, brake, and dodge. One crash and it's over; beat your best.

## 2. Features

- Player-controlled car (arrows or WASD) with auto-straightening steering for arcade feel
- Score system: distance (meters) + 50/overtake (elites worth double) + 25/near-miss
- Combo chain with on-screen combo meter and decay bar
- Level progression every ~275 m: faster/denser traffic, higher player top speed, elite drivers from level 3 (with a warning banner)
- Full game loop: start menu → playing → crash/explosion → game-over stats screen → restart (buttons or Enter/Space)
- High score, persisted best-effort (try/catch-wrapped storage; safe in sandboxed iframes)
- Game feel: screen shake on near-misses and crashes, particle explosion on death, speed lines at high velocity, floating score popups, level banners
- HUD: score, level, distance, best score, speedometer with speed bar
- Sound, all generated via WebAudio (no assets): engine hum pitched to speed, near-miss/overtake blips, level-up arpeggio, noise-burst crash
- Removed the whole simulation apparatus: settings panel, presets, network visualizer, generation training UI (`settings.js`, `visualizer.js`, `config.js`, `main.js` deleted)

## 3. How to play

- **↑ / W** accelerate, **↓ / S** brake/reverse, **← → / A D** steer
- **Enter / Space** start or restart
- Goal: survive as long as possible and maximize score. Overtake for +50,
  graze cars at speed for +25 near-misses, chain bonuses within 2.5 s to build combos.
  Elite (red) drivers dodge back — outsmart them for double points.

## 4. The neural network

**Repurposed, not removed.** `network.js` and `sensor.js` power the *elite drivers*:
each red car has 5 sensor rays and a `NeuralNetwork` whose weights I hand-crafted
(left rays blocked → steer right, center blocked → brake, etc.), then perturbed with
`NeuralNetwork.mutate(brain, 0.08)` so every elite has a slightly different
"personality" — some dodge early, some brake-check you. This keeps the project's
identity (sensing, feed-forward inference, mutation) while serving the game as an
escalating enemy type. Generational *training* (population, fitness, save/discard,
visualizer) was deleted — it served spectating, not playing, and would have been
dead weight.

## 5. Design decisions

- **Hand-crafted weights instead of pre-trained brains**: training in-repo would need
  a stored brain blob and offers no gameplay benefit; designed weights are readable,
  deterministic-ish, and mutation still gives variety cheaply.
- **One-hit death** rather than lives/health: rounds are short, restart is instant
  (Enter), which suits the "one more run" loop better than dragging out a bad run.
- **Near-miss + combo system** is the core risk/reward: the safest play (empty lane)
  scores worst, so the mechanics push you toward the traffic, not away from it.
- **Difficulty ramps on distance, not time**, so braking to play safe delays your
  score *and* your progression — no camping.
- **Storage is decorative**: high score is the only persisted value, wrapped in
  try/catch so the sandboxed-iframe case simply shows session-only bests.
- Elite sensor rays are drawn faintly (red) so the player can *read* the AI's
  awareness — telegraphing beats fake difficulty.

## 6. Next

- Pickups (score gems, shield, slow-mo) spawned in risky lanes
- A rival racer: an NN car chasing the same scoring rules, with your best run's
  "ghost" to race against
- Curved/narrowing road sections and weather (rain = lower friction)
- Touch controls for mobile, pause state, and a proper chiptune loop via WebAudio scheduling
