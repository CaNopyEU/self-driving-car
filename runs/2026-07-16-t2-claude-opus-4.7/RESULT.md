# Highway Dasher 3D

A Three.js endless-highway dodger. Drive a 3D car down an infinite road, dodge traffic, grab blue shield power-ups. Score grows with distance; speed and spawn rate ramp up within the first minute.

| # | Key | Verdict | Note |
|---|---|---|---|
| 1 | loads | pass | Served statically; sandbox tested, no console errors. |
| 2 | startScreen | pass | Title + controls + START button; any key or click starts. |
| 3 | controls | pass | Arrow keys / WASD steer and throttle. |
| 4 | collision | pass | 3+ traffic cars always on screen; AABB hit ends run. |
| 5 | score | pass | Score + speed shown live top-left. |
| 6 | difficulty | pass | Speed +1.5/s and spawn interval shrinks — clearly harder by 30s. |
| 7 | restart | pass | Game-over overlay, R/click restarts without reload; scene fully reset. |
| 8 | sandbox | pass | No storage calls; init in try/catch. |
| 9 | lean | pass | Only `index.html`, `three.min.js`, `RESULT.md`. |
| 10 | juice | pass | Explosion sphere + camera shake + noise crash SFX; engine drone + shield chime + score blips during play (all WebAudio). |
| 11 | powerup | pass | Blue cube = 6s shield (invincible, destroys hit cars). |
| 12 | honesty | pass | This file. |
| 13 | true3d | pass | THREE.PerspectiveCamera follows a 3D car on a 3D road with 3D traffic. |
