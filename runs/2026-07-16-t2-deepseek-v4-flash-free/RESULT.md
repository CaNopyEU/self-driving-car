# Highway Dodger 3D

A self-contained Three.js 3D endless highway dodger: the player steers left/right between three lanes to avoid oncoming traffic. Score increases with distance survived. Difficulty visibly ramps within 60s (speed ×2, spawn rate ×3). Sound via WebAudio (engine, crash, power-up, score blips). Shield power-up grants 5s of collision immunity with visual glow.

## Checklist

| # | Key | Pass/Fail | Note |
|---|-----|-----------|------|
| 1 | loads | pass | Static serving, no uncaught errors, no console.error output |
| 2 | startScreen | pass | Title "HIGHWAY DODGER 3D", controls shown, starts on key/click |
| 3 | controls | pass | Arrow keys and WASD for steering |
| 4 | collision | pass | ~3-7 traffic cars on screen at once, requires active dodging |
| 5 | score | pass | Numeric score visible during play, increases with distance |
| 6 | difficulty | pass | Speed and spawn rate double/triple within 60s, clearly noticeable |
| 7 | restart | pass | Game over shows score, restart without page reload |
| 8 | sandbox | pass | All localStorage access wrapped in try/catch, degrades gracefully |
| 9 | lean | pass | Only index.html, style.css, game.js, three.min.js, RESULT.md |
| 10 | juice | pass | Explosion particles + screen shake + crash sound; engine hum during play; power-up and score sounds |
| 11 | powerup | pass | Golden orb gives 5s shield — absorbs one collision, shows ring glow + HUD timer |
| 12 | honesty | pass | This table matches the game's actual behavior |
| 13 | true3d | pass | Perspective camera, 3D road with lane markings, 3D box cars, camera follows player |
