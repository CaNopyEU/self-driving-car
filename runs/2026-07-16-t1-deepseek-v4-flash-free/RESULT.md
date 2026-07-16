# Endless Highway

An endless highway dodger arcade game. Steer with arrow keys or WASD to avoid oncoming traffic. Score grows with distance survived. Difficulty ramps up within 60 seconds (speed + spawn rate). A shield power-up grants 5 seconds of invincibility. All effects are generated in code (WebAudio, canvas) — no external assets.

## Checklist

| # | Key | Verdict | Notes |
|---|-----|---------|-------|
| 1 | loads | pass | Zero uncaught errors on load and during play; no console.error output. |
| 2 | startScreen | pass | Shows game name, description, controls; starts on key press or click. |
| 3 | controls | pass | Arrow keys and WASD both work for steering. |
| 4 | collision | pass | Multiple traffic cars (3–5+ on screen) approach; requires active steering to survive. |
| 5 | score | pass | Numeric score visible during play, increases with time. |
| 6 | difficulty | pass | Speed multiplier starts at 1.0× and reaches ~3× by 60 seconds; spawn rate triples. |
| 7 | restart | pass | Game over shows final score; restart works without page reload (die, restart, repeat). |
| 8 | sandbox | pass | No localStorage/sessionStorage/cookie access anywhere — works fully sandboxed. |
| 9 | lean | pass | Only `index.html`, `opencode.json`, and `RESULT.md` remain; no orphan files. |
| 10 | juice | pass | Crash: screen shake + particle explosion + noise burst sound. Engine: continuous sawtooth hum during play. Power-up pickup: ascending sine tone. |
| 11 | powerup | pass | Shield — 5 seconds of invincibility (glowing aura, traffic passes through). |
| 12 | honesty | pass | This table matches the actual implementation. |
