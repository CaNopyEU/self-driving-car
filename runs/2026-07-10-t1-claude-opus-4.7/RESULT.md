# NEURAL RUSH

## 1. What I built

**Neural Rush** is a top-down arcade highway racer. You drive an ever-faster car
down an endless 4-lane road, weaving through traffic, snatching diamond fuel/coin
pickups, and (from level 3 onward) being chased by red **neural hunter** cars that
actively try to run you off the road. Score comes from distance, coins, and
near-miss weaving that stacks a combo multiplier. Levels ramp density, traffic
speed, and hunter count. Three lives, then game over with a persistent local
best score.

## 2. Features

- Player-controlled car with acceleration, friction, and a **boost** on Shift that
  drains a fuel/boost bar (refilled by pickups).
- Endless procedural traffic with lane-aware, non-overlapping spawns and
  cull-behind cleanup.
- **Neural hunter opponents** with sensor-based AI that steer toward the player and
  around obstacles (see §4).
- **Coin/fuel pickups** — diamond shapes worth points × combo, also refill boost.
- **Combo system** built from near-misses and pickups; decays if you play safe.
- **Escalating difficulty**: `spawn density`, `traffic speed`, `hunter count`,
  and `hunter top speed` all scale with level; level-up every 1500 pts.
- **Full game loop**: title screen → play → crash → respawn (3 lives) → game over
  → Play Again. Also **pause** (P), **mute** (M), quick-restart (R).
- **HUD**: live Score, Best, Level, Speed, Lives, Combo, plus a fuel-gauge bar.
- **Polish**:
  - camera follow with lerp, screen shake on crash
  - particle effects (crash sparks, coin burst, boost exhaust, near-miss shimmer)
  - level-up banner, invulnerability flash after respawn
  - parallax star/light background
  - self-drawn car sprites (rounded body, windshield, head/tail-lights) — no
    external images
  - Web Audio SFX synthesized inline (coin, crash, near-miss, level-up, game
    over, boost)
- **Storage-safe**: all `localStorage` reads/writes go through a `try/catch`
  wrapper (`SafeStorage`). Verified running inside a `sandbox="allow-scripts"`
  iframe (null origin, `localStorage` throws) — the game boots, plays, and shows
  the game-over screen without errors; the high score simply doesn't persist.

## 3. How to play

- `↑` / `W` — accelerate
- `↓` / `S` — brake / reverse
- `←` `→` / `A` `D` — steer
- `Shift` — boost (drains fuel)
- `P` — pause, `M` — mute, `R` — restart from game-over

Goal: survive as long as possible, rack up the highest score. Grab yellow
diamonds for points and boost fuel. Weave close to cars for near-miss combo
bonuses. Avoid the **red hunter cars** — they will actively chase you.

## 4. The neural network

**Repurposed, not deleted.** The original codebase used the NN as the driving
brain for a genetic-algorithm swarm; that entire training loop is gone. The
`NeuralNetwork` / `Level` / `Sensor` classes now power the **hunter enemy AI**:

- Each hunter has a 5-ray sensor (180° spread) that reads obstacle proximities
  (walls + traffic + player).
- Those 5 readings, plus two extra inputs (relative x/y to the player), feed a
  **7 → 6 → 4** feed-forward network with `tanh` hidden and `sigmoid` output.
- Outputs are thresholded to become the four control bits (forward/left/right/reverse).
- Instead of random weights + evolution, the network's weights are **hand-tuned in
  code** (`NeuralNetwork.hunterBrain()`) to encode a readable behavior:
  hidden neurons represent "obstacle on left / right / ahead" and "player is on
  left / right", and output weights combine them into "always accelerate, steer
  toward the player, but veer away from imminent obstacles, never reverse."

**Why keep the NN at all?** Because it's still doing meaningful work — the same
sensor-and-network pipeline the original demo trained blindly is now the readable
brain of a hostile opponent. It also means the enemy behavior is trivially
tunable by editing weights, and the sensor infrastructure has a real gameplay
purpose. I considered ripping it out entirely (a scripted "chase" AI would fit
in 10 lines), but a fully alive `NeuralNetwork` class that a player can *feel*
in the enemy behavior is more interesting than dead code either way.

**Dead code removed**: `visualizer.js`, `settings.js`, `car.png`, plus every
reference to generational training, the settings panel, help overlay, and the
right-hand network canvas. `config.js` is kept only because the class code still
imports a couple of defaults from it during sensor construction fallback — it
loads via storage-safe wrappers.

## 5. Design decisions

- **Vertical scroller, not free-drive.** Committed to a Crazy-Taxi-meets-Frogger
  vibe rather than an open track: it makes distance-as-score legible and lets
  difficulty scale cleanly by cranking spawn density / traffic speed.
- **Combo built from *near-misses*, not just kills.** Encourages risky driving,
  which is what makes the game feel good moment-to-moment. Coins refresh the
  combo so pickup routing matters.
- **Hunters as ‘remixed NN’ instead of hidden AI.** A dumber scripted chaser
  would have worked, but exposing the neural brain (documented weights, sensor
  rays) preserves the didactic heart of the original demo inside a real game.
- **Hand-tuned weights over runtime training.** Real-time evolutionary training
  in an arcade game is a bad match — the player would see hunters flailing
  randomly for the first N generations. Baking a working brain in code is
  honest and instant.
- **Everything self-contained.** SFX synthesized via WebAudio, car sprites drawn
  with `roundRect`, colors are HSL — no fetches, no assets, no CDN.
- **Storage as best-effort.** Every read/write is wrapped; iframe-verified.
  High-score persistence is a nice-to-have, never a crash risk.
- **Zero build step, no framework.** Pure `<script>` tags in dependency order.

## 6. Next

- Power-ups: shield, slow-mo, magnet for coins.
- Multiple hunter behaviors driven by different baked NN weight sets
  (rammer / blocker / sniper).
- Cosmetic car unlocks tied to score milestones.
- Tilt-blur / motion streaks at high speed for extra game-feel.
- Mobile touch controls (drag-to-steer).
- Music: a simple procedural WebAudio loop that intensifies with level.
