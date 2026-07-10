# RESULT

## 1. What I built
**Neon Highway** is a fast-paced, synthwave-inspired 3D endless runner where you pilot a cyber-car down an infinite glowing grid. As you survive longer, the game progressively speeds up and obstacles become denser, demanding sharper reflexes in a visually striking, polished retro-futuristic setting.

## 2. Features
- **True 3D Rendering**: Built with Three.js, featuring perspective projection, dynamic lighting, and fog.
- **Progressive Difficulty**: The game dynamically increases speed and obstacle density (leveling up) as your score climbs.
- **Responsive Controls**: Snappy keyboard controls (Arrow Keys or A/D) with visual feedback (car leaning/banking).
- **Dynamic Camera**: A chase cam that subtly interpolates its position based on the car's movement to enhance the sensation of speed and weight.
- **Full Game Loop**: Complete with start screen, HUD (score, hi-score, level), collision detection, game over state, and instant restart.
- **Graceful Degradation**: High score saves to `localStorage`, safely wrapped in a try/catch block to avoid crashing in sandboxed iframes.

## 3. How to play
- **Goal**: Survive as long as possible by dodging the glowing red obstacles. Your score increases passively over distance and actively when you clear an obstacle.
- **Controls**: Use the **Left/Right Arrow Keys** or **A/D** to steer the car across the lanes.

## 4. Camera & 3D approach
I opted for a **dynamic chase camera** slightly elevated behind the player. This is the gold standard for endless runners and racing games because it provides maximum visibility of upcoming obstacles while keeping the player character anchored in the lower third of the screen. I added a slight lerp (linear interpolation) to the camera's X position and look target so it slightly "lags" behind sharp turns, giving the car a sense of weight and making the steering feel more visceral. The synthwave aesthetic (neon grid, black void, glowing boxes) was chosen because it delivers immediate visual polish and spectacle using simple 3D primitives and basic materials, without requiring external textures or heavy assets.

## 5. The neural network
I **removed the neural network entirely**. In the context of an endless runner meant for human enjoyment, evolutionary AI doesn't serve a clear purpose unless it's for training enemy cars over long periods. Given the constraints and the goal to create a 10-minute playable arcade experience, predictable or heuristic-based obstacles are far more fun and readable for the player. Removing the NN (and its associated dead code) allowed me to focus all complexity and performance budget on the 3D game loop, visual polish, and game feel.

## 6. Design decisions
- **Zero External Assets**: Aside from the Three.js library from a CDN, all visuals (car, road, obstacles) are constructed procedurally from basic geometry and emissive materials. This ensures the game loads instantly and guarantees zero build-step compliance.
- **Illusion of Movement**: Instead of moving the car forward through world space (which eventually leads to floating-point precision issues), the car remains stationary on the Z-axis. The grid texture (via position resetting) and the obstacles move *towards* the camera. This is a classic infinite-runner trade-off that simplifies logic and guarantees stability.
- **Forgiving Hitboxes**: I slightly scaled down the bounding boxes used for collision detection compared to the visual meshes. This prevents frustrating "cheap" deaths that happen when the very edge of a mesh clips an obstacle.

## 7. Next
With one more attempt, I would add:
- **Audio**: Synthesizer engine hum, crash sound effects, and a driving synthwave backing track using the Web Audio API.
- **Post-Processing**: Adding a bloom pass (unreal bloom) to make the neon elements truly glow, which heavily elevates the synthwave aesthetic.
- **Particle Systems**: Sparks flying off the car when steering sharply or a localized explosion of cubes upon crashing.
- **Power-ups**: Collectibles that offer a temporary shield, score multiplier, or allow you to smash through obstacles.
