# What I built

I turned the self-driving-car demo into `Slipstream Survivor`, a self-contained arcade survival racer built for repeated human play. You manually steer through dense highway traffic, score by surviving distance and styling close overtakes, charge boost with risky near misses, and push through escalating traffic waves until you wreck.

# Features

- Replaced the training simulator with a full player-first arcade game loop
- Added a start screen, in-run HUD, pause state, game over screen, and instant restart
- Added keyboard driving with arrow keys or WASD
- Added a readable score system based on distance, clears, near misses, combos, and wave bonuses
- Added boost as a player resource charged by risky play and spent for bursts of speed
- Added progression through increasingly aggressive traffic waves
- Added traffic variety with grouped spawns, lane pressure, and later lane-changing opponents
- Added screen shake, flash, particle trails, banners, combo feedback, and responsive HUD polish
- Added generated sound effects using the Web Audio API with no external assets
- Added safe high-score persistence with storage access wrapped in `try/catch`
- Removed unused simulator, settings, and neural-network files so there is no dead code path left behind

# How to play

- `Arrow keys` or `WASD`: steer, accelerate, and brake
- `Space`: boost while meter is available
- `P` or `Esc`: pause or resume
- `Enter` or click the main button: start or restart
- Goal: survive as long as possible, clear traffic to advance waves, and use near misses to build combo score and refill boost

# The neural network

I removed the neural network entirely. The original project was built around observing AI learning, but the task required the game itself to be the product. Keeping the network would have pulled design attention toward simulation UI, debugging, and spectator features instead of direct play. I kept the reusable parts that still served the game well, especially the road geometry and polygon collision approach, and deleted the rest so the shipped code matches the new design cleanly.

# Design decisions

- I chose an endless survival format instead of laps or checkpoints because the original vertical-road camera already supports readable forward pressure and natural difficulty scaling.
- I made near misses central to scoring so the best way to earn points is also the most exciting behavior to perform.
- I used waves rather than purely hidden scaling so progression is explicit and easy to read from the HUD.
- I generated simple synth effects in code instead of using files to stay fully self-contained and asset-free.
- I kept persistence minimal to one best score and made it best-effort only, since sandboxed iframe storage can throw.

# Next

- Add distinct traffic archetypes such as trucks, bikers, and roadwork hazards
- Add short boss-style wave events with special road patterns
- Add touch controls for mobile play
- Add a replay seed or daily challenge mode
- Add more layered music and audio mixing while staying self-contained
