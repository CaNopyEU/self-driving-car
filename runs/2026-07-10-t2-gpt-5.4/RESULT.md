# What I built

I turned the training demo into `Neon Runaway`, a full 3D arcade highway survival game built in vanilla JS with Three.js from CDN. You drive a neon-lit car through dense nighttime traffic with a fast chase camera, score by surviving at speed and skimming past vehicles for close-call bonuses, and push through escalating stages that steadily turn the road into chaos.

# Features

- Replaced the 2D simulator with a true 3D perspective highway game.
- Added keyboard-controlled player car with arcade steering, braking, acceleration, and boost.
- Added a polished chase camera with dynamic height, FOV, and lean based on speed.
- Built a complete game loop: start screen, active play, game over, and restart.
- Added clear HUD for score, speed, stage, and close calls.
- Added meaningful scoring from distance, high-speed driving, boost use, and near misses.
- Added progression through stages with rising traffic count, traffic speed, and harder vehicle types.
- Added scripted 3D traffic including trucks and swerving cars.
- Added procedural visuals: fog, skyline, star field, neon guard rails, roadside lights, and emissive vehicles.
- Added lightweight synthesized audio for engine tone, near misses, stage-up, and crash feedback.
- Added safe best-score persistence that degrades gracefully when storage access is blocked.
- Removed the old simulator-only neural network, sensor, visualizer, and settings runtime.

# How to play

- `W` / `Up Arrow`: accelerate
- `S` / `Down Arrow`: brake
- `A` `D` / `Left` `Right`: steer
- `Space` or `Shift`: boost
- `Enter`: start or restart
- Goal: survive as long as possible, keep speed high, and pass close to traffic for bonus points without crashing.

# Camera & 3D approach

I used a low chase camera behind the car rather than a cockpit view. It keeps the game readable at high speed, shows lane position clearly, and lets the 3D spectacle do real work: perspective compression, speed-based FOV changes, camera rise, emissive traffic, fog, and skyline depth all reinforce that this is a spatial 3D road rather than a flat 2D simulation with tilted art.

# The neural network

I removed it entirely from the shipped game. The original neural-network system was the center of a training simulator, but this task needed a polished playable arcade game. Keeping it would have added dead UI, dead logic, and maintenance cost without helping the player experience. I replaced it with scripted traffic behaviors that better serve gameplay and pacing.

# Design decisions

- Chose an endless survival format instead of lap racing so progression could ramp continuously without level-loading complexity.
- Kept the player car in a stable chase-cam space and moved the road/traffic relative to player distance for simpler endless-road management.
- Made score strongly tied to speed and close calls so the safest possible play is not the highest-scoring play.
- Used synthesized Web Audio instead of external assets to stay self-contained and zero-build.
- Wrapped storage behind a safe adapter so sandboxed iframe restrictions never crash the game.

# Next

With one more attempt, I would add heavier rival behaviors, more stage-specific hazards, better crash animation, touch controls for mobile, and a second camera mode such as cockpit or replay cam.
