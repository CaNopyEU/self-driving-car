# NEON RUSH

## 1. What I built
**NEON RUSH** is a neon-soaked, top-down highway dodge racer. You pilot a
cyan hover-car up an endless four-lane freeway at speed, threading through
slower traffic while three synthwave-lit AI rivals weave alongside you. The
faster and more aggressively you drive — skimming past cars for near-miss
combos, snatching boost cells, and overtaking traffic — the higher your score
climbs. The road gets denser and faster in waves until you clip something and
get **WRECKED**. It's a pick-up-and-play arcade loop built for "one more run"
sessions, entirely in vanilla JS on a single canvas with zero dependencies.

## 2. Features
- **Player-controlled car** with tuned arcade physics (accel, friction,
  speed-scaled steering, reverse/brake) and a **boost** system with a fuel bar.
- **Scoring the player reads at a glance**: continuous distance score,
  **+overtakes**, and **near-miss combo multiplier (up to x9)** that decays if
  you play it safe — rewarding risk.
- **Escalating waves**: every ~1400m bumps the wave, increasing traffic speed
  and packing lanes tighter, with an on-screen "WAVE N" callout.
- **AI rival racers** driven by the repurposed neural network (see below).
- **Boost fuel cells** — spinning pickups that refill boost and grant points.
- **Full game loop**: animated START screen → PLAYING → GAME OVER (with score,
  wave, best, "NEW BEST" flag) → instant RETRY. No dead ends; Enter/Space also
  start/restart.
- **Polish / game-feel**: neon glow rendering, procedural cars (no image
  assets), particle bursts on crashes/pickups/level-ups, floating score text,
  screen shake, boost flame trail, pulsing combo HUD.
- **Self-contained WebAudio**: engine drone that pitches with speed, plus SFX
  for overtakes, near-misses, boost, pickups, level-ups and crashes. Mute toggle.
- **Sandbox-safe storage**: all `localStorage` access is wrapped; high score
  just doesn't persist if storage throws. The game never crashes.

## 3. How to play
- **Steer**: `←/→` or `A/D`
- **Accelerate**: `↑` or `W` &nbsp;·&nbsp; **Brake/Reverse**: `↓` or `S`
- **Boost**: hold `SHIFT` (drains the boost bar; refill with green fuel cells)
- **Start / Restart**: click the button or press `Enter` / `Space`
- **Goal**: survive as long as possible. Rack up score by covering distance,
  overtaking traffic, and threading **near-misses** to build your combo
  multiplier. Beat your high score before you crash.

## 4. The neural network
I **repurposed** it rather than deleting it. In the original project the network
powered offline generational self-driving *training* — which has no place in a
real-time arcade game. Here it drives the **AI rival racers**: at startup the
game runs a tiny **headless evolutionary sim** (`RivalAI.evolve()` in
`network.js`) — a few generations of small populations racing a simulated lane
strip — and selects the fittest "dodger" brain. Each rival then gets a clone of
that brain, reads the road through sensor rays (`sensor.js`), and feeds those
readings through the net every frame to steer around traffic. This keeps the
network *meaningful and load-bearing* (rivals genuinely react to the road
instead of following scripted paths) while fitting the game's real-time loop.
The original generational-training UI, visualizer and settings panel were
removed as dead code.

## 5. Design decisions
- **Rewrote, didn't bolt on.** The old sim was structurally a training tool
  (population fitness, save/mutate brains, network visualizer). I kept the
  genuinely reusable primitives (`Car` physics, `Sensor`, geometry utils, the
  `NeuralNetwork`) and deleted the training-only files (`main.js`,
  `settings.js`, `visualizer.js`, `config.js`) to avoid dead code.
- **Evolve rivals once, at boot, headless.** Full per-frame training would tank
  the framerate and isn't fun to watch. A short offline evolution gives
  competent-feeling rivals for near-zero runtime cost, and it degrades
  gracefully (random brain) if it ever fails.
- **No external assets.** Cars are drawn procedurally with rounded rects +
  glow, audio is synthesized with WebAudio. This satisfies the
  "self-contained / sandboxed iframe" constraint completely.
- **Combo-on-risk scoring.** Near-misses (close but not touching) drive the
  multiplier, pushing players to weave aggressively rather than crawl in an
  empty lane — the single biggest lever on "is this fun."
- **Storage is best-effort everywhere** via a tiny `Storage` wrapper, so the
  sandboxed-iframe requirement is handled at the source, not scattered.

## 6. Next
- **Distinct car classes / upgrades** between runs (grip, top speed, fuel).
- **Rival personalities** — evolve several brains with different fitness
  weightings (aggressive blocker vs. clean racer) so rivals feel varied.
- **Hazards & variety**: oil slicks, moving barriers, branching road, tunnels
  with parallax city backdrops for depth.
- **Juicier feedback**: chromatic-aberration on boost, dynamic music layers
  that build with the combo multiplier, and a slow-mo "last near-miss" replay
  on game over.
- **Mobile touch controls** and screen-size-aware lane counts.
