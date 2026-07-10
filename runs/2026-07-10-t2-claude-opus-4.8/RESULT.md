# NEON RUSH — 3D

## 1. What I built
**NEON RUSH** is a 3D arcade highway dodger. You pilot a glowing neon car down an
endless synthwave freeway at speed, weaving through traffic, snatching coins and
shields, and chaining overtakes into a score multiplier. Every ~15 seconds the game
rolls into a new **wave**: faster world, denser traffic, and more of the red
**hunter** cars — AI drivers powered by the original demo's neural network that
actively swerve to cut you off. It's a fast, punchy, "one more run" score-chaser
with a proper start → play → game-over → retry loop, and it's built to be enjoyed in
short bursts.

## 2. Features
- True 3D scene in **Three.js** (perspective camera, real lighting, shadows, fog).
- Chase-cam that leans with your steering, pulls back and widens FOV on boost, and
  screen-shakes on impact.
- Hand-built low-poly neon cars: body, cabin, spinning wheels, underglow, taillights,
  plus real spotlight headlights on the player.
- Infinite scrolling road built from recycled segments, glowing magenta/cyan side
  rails, lane dashes, side pylons, and a starfield for depth.
- **NN-driven "hunter" AI traffic** that senses the player + neighbours and steers to
  block you (see §5).
- Score system: distance + coins + overtakes, all scaled by a combo multiplier.
- **Combo/multiplier** (x1–x9) built by chained overtakes, decays if you stop passing.
- **Waves** with escalating base speed, spawn rate, and hunter probability.
- Pickups: **coins** (points) and **shields** (one free hit).
- **Boost** on Space with a rechargeable meter; brake/accelerate modulate speed.
- Full HUD: score, wave, speed (km/h), best, combo pill, shield bar, boost bar, toasts.
- Full game loop: animated start screen, pause (P), game over with stats + NEW BEST,
  instant retry. No dead ends.
- Procedural **WebAudio** SFX (no external assets): engine drone that tracks speed,
  coins, shields, overtakes, boost, crash, wave chimes. Mute with M.
- Best score persisted via **try/catch-wrapped localStorage** — degrades silently in
  sandboxed iframes.

## 3. How to play
- **Steer:** ← → or A D
- **Accelerate / brake:** ↑/W and ↓/S
- **Boost:** Space (drains the boost meter, recharges over time)
- **Pause:** P **Mute:** M
- **Goal:** survive as long as possible and rack up the highest score. Dodge traffic,
  grab coins and shields, and keep overtaking to hold a high multiplier. One crash
  without a shield ends the run.

## 4. Camera & 3D approach
I chose a **chase cam** (behind-and-above the player). Rationale: for a
reflex-based dodging game the player needs to read traffic several car-lengths ahead,
and a chase cam gives the widest, most legible read of the lanes while still selling
speed and spectacle. Cockpit would hide too much of the road; a cinematic orbit would
fight the twitch controls. The camera is *game-feel active*, not static: it eases
toward the car's lateral position, tilts, pulls back and widens FOV during boost, and
adds impulse shake on collisions. The directional (shadow-casting) light follows the
player so shadows stay crisp on the infinite road.

## 5. The neural network
I **repurposed** it rather than deleting it. The original feed-forward net (levels of
weights + biases + `mutate`) now drives the red **hunter** traffic cars. Each hunter
feeds 5 normalized senses into the net — player horizontal offset, how far ahead it
is, nearest blocker on the left, nearest blocker on the right, and its own distance to
the road edge — and the 2 outputs decide steer-left vs steer-right, so hunters try to
slide into your path and box you in. Two deliberate changes: I swapped the original
hard threshold for a **sigmoid** activation (smoother, more lifelike steering than a
binary flip), and I added lightweight **cross-wave evolution** — the hunters that
survived longest have their brains cloned and lightly mutated into the next wave, so
the swarm feels like it's adapting run over run. This keeps the "it learns" identity of
the original demo but turns it into an actual antagonist the player fights against.

## 6. Design decisions
- **Endless dodger over a lap racer:** infinite recycled road segments give constant
  spectacle and instant restarts with almost no content authoring — the right call for
  a 10-minute score-chaser.
- **NN as villain, not autopilot:** the original project's point was cars learning to
  drive. Making the *enemies* the learners preserves that spirit while keeping the
  human firmly the product's protagonist.
- **Object pooling** for AI cars, pickups, and particle bursts — zero per-frame
  allocation, smooth on modest hardware, no GC hitches.
- **Procedural audio** to honor the "no external assets" constraint while still
  delivering game feel (speed-reactive engine hum is most of the sense of speed).
- **Storage is best-effort:** every localStorage touch is wrapped; the game runs
  identically in a sandboxed iframe, it just won't remember your best score.
- **Zero build step:** Three.js via an importmap from a CDN; everything else is three
  local files. Serve the dir, open `index.html`, done.
- Traffic is tuned slower than the player so overtaking (and thus the combo loop) is
  the core rewarded verb, while hunters are faster and NN-steered to reintroduce threat.

## 7. Next
- **Track variety:** gentle curves and elevation using a spline the road segments
  follow, plus tunnels and set-piece hazards per wave.
- **Post-processing bloom** for a stronger synthwave glow (UnrealBloomPass).
- **Weapons / power-ups:** a dash-through, an EMP that scatters the hunter swarm.
- **Richer NN evolution UI:** a small readout showing the hunters getting smarter, as
  a callback to the original visualizer.
- **Mobile touch/tilt controls** and a proper music track (still procedural).
