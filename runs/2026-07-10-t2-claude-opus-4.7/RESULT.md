# NEON RUSH — 3D

## 1. What I built
**NEON RUSH** is a synthwave-flavoured 3D highway survival arcade game. You drive a
neon-underglow car down an endless, procedurally-recycled five-lane freeway at night,
weaving through traffic, snatching floating pickups, and — from Wave 2 onward —
outrunning red **AI Hunter** cars that actively chase you down. Score compounds
through an overtake/coin combo meter; waves ramp difficulty every ~22 seconds.
Three lives, three cameras, one boost bar. Runs by opening `index.html`.

## 2. Features
- Full 3D scene: perspective camera, PBR-lit cars, cast shadows, neon guard rails,
  vertical light posts, procedural mountain silhouettes, 800-point starfield, fog.
- Player car (cyan) with wheels, cabin, headlights (real `SpotLight`), taillights,
  additive underglow, and visual roll on turns.
- Endless road: 40 recycling segments with dashed lane markers, edge stripes,
  shoulders and alternating cyan/magenta neon rails.
- Traffic: same-direction slower cars + oncoming fast cars (from wave 3).
- **AI Hunters** driven by the repurposed neural network (see §5).
- Pickups: gold coin octahedrons (score+combo) and cyan cones (boost refill).
- Score system: distance-based points × combo multiplier, +overtake bonuses,
  +coin bonuses. Combo climbs to x20, decays after 3 s of no action.
- Waves: every ~22 s wave counter increments, spawn rate rises, max speed rises,
  more hunters spawn (up to 4), bonus score awarded, on-screen banner.
- Boost: SHIFT drains a regenerating bar, +55% top speed, camera FOV kick, magenta
  particle trail, wooshy audio.
- Full game loop: **Start screen → Playing → Pause → Game Over → Restart / Menu**.
  No dead ends, every screen has a way forward.
- HUD: Score, Speed (km/h), Wave, Combo, Best, Boost bar, three life pips,
  center-screen popup for events (WAVE, +N OVERTAKE, CRASH!, etc).
- Camera cycling with `C`: **Chase**, **Cockpit** (interior look-ahead), **Cinematic**
  (auto-orbit swoop). Camera position & rotation smoothly slerp'd.
- Camera shake on crash + i-frames (1.5 s invulnerability window after a hit).
- Screen-space explosion particles with gravity on any collision.
- **WebAudio-only sound** (no external assets): two-oscillator engine that tracks
  speed, coin blip, boost whoosh, crash noise, wave fanfare. `M` toggles mute.
- Best score persists via `localStorage` **wrapped in try/catch** — degrades cleanly
  in sandboxed iframes where storage throws.
- Pause with `P`. Instant restart from game over.
- Zero build step. Three.js loaded from unpkg via an importmap.

## 3. How to play
Survive as long as possible; score as high as you can.

| Key | Action |
| --- | --- |
| `W` / `↑` | Accelerate |
| `S` / `↓` | Brake / reverse |
| `A` `D` / `←` `→` | Steer |
| `Shift` | Boost |
| `C` | Cycle camera (Chase / Cockpit / Cinematic) |
| `P` | Pause |
| `M` | Mute |

Weave through the slower cars ahead to bank overtake bonuses (combo grows).
Grab gold ◆ pickups for big multiplier points. Cyan boost cones refill your boost.
When red Hunter cars appear, they'll aim for your lane — juke them or ram them out.
Hitting anything costs a life. Three lives, then wreck.

## 4. Camera & 3D approach
This is real 3D: perspective camera, 3D geometry, dynamic lighting, cast shadows,
recycled road segments in world space. The default is a **chase cam** trailing the
car with position/quaternion smoothed via `Vector3.lerp` + `Quaternion.slerp`, plus
a look-ahead point offset along the car's heading so turns feel anticipatory. I
added two extra modes because "3D is spectacle": a **cockpit cam** for immersion
(FOV widens with boost — the classic Outrun feel), and a **cinematic** orbit swoop
for screenshots / gawking. FOV kicks +14° on boost, and the camera shakes for the
last ~700 ms of the crash invulnerability window. Fog + a starfield + procedural
mountain silhouettes sell distance.

## 5. The neural network
Kept, repurposed, not dead code. The original per-generation training loop is
gone — training is orthogonal to this game and would just be noise on screen.
Instead, the same tiny feed-forward network (`tanh` activations, hand-rolled
matrices) drives the **Hunter enemies**. Inputs are 4 features
`[dxToPlayer, dzToPlayer, mySpeed, myLaneOffset]`, hidden layer of 8 neurons,
2 outputs interpreted as steer/throttle. Weights are seeded (`mulberry32(42)`) so
behaviour is deterministic and testable. In practice pure NN output alone made
Hunters wobble and miss, so I blend the NN steer 30% with a 70% direct-pursuit
term — the NN adds jitter/personality, the pursuit term guarantees threat. This
justifies keeping the code: it's small, it's the enemy AI, it demos "neural net
drives cars" from the original brief without pretending to be a training sim.

## 6. Design decisions
- **Removed generational training + settings panel + net visualizer.** The user's
  product here is a game, not a lab. Every UI element that couldn't earn its
  keep in a 10-minute play session got cut.
- **Single ES module** instead of 12 script tags. Way easier to reason about,
  and importmap lets us pull Three.js without a build step.
- **Recycled road segments** instead of a curved spline. Curves look great but
  they wreck collision math and camera framing for the chase cam; a straight
  freeway lets the player focus on threats, and the neon rails + moving lights
  still sell speed convincingly.
- **Overtake combo instead of raw distance.** Distance-only scoring rewards
  boredom (drive straight, don't crash). The combo forces the player to
  actively weave, and combos decay so you can't cheese by hoarding.
- **Hunters gated to Wave 2+.** Wave 1 teaches the driving model; the game
  introduces its real antagonist only after the player is comfortable.
- **Storage in try/catch on every access.** Explicit requirement, honoured.
  `store.get`/`store.set` never throw regardless of iframe sandbox.
- **WebAudio synth over samples.** Zero external asset cost, self-contained,
  and the engine sound is genuinely reactive to `pv/speedMax`.
- **Fixed-seed NN.** Random per-run enemy AI would feel unfair. A seeded brain
  is repeatable and lets me tune the pursuit blend once.

## 7. Next
- Curved roads with actual banking, or discrete themed levels (city night,
  desert dawn, rain).
- Rammable Hunters that explode after 2 hits, worth big score.
- Traffic vehicle variety (trucks, wide loads, sirens) with distinct handling.
- Screen-space bloom for the neon (kept off currently to preserve perf on
  integrated GPUs — a proper `EffectComposer` pass would make it sing).
- Genetic training mode as an unlockable Easter-egg — bring the original
  demo's evolution loop back, but as a bonus toy, not the main product.
- Gamepad support (would take ~15 lines with the Gamepad API).
