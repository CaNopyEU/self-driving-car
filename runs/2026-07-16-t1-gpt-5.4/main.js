const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayCard = document.getElementById("overlayCard");
const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const powerLabel = document.getElementById("powerLabel");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const ROAD_WIDTH = 300;
const LANE_COUNT = 4;
const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;
const ROAD_LEFT = (WIDTH - ROAD_WIDTH) / 2;
const PLAYER_Y = HEIGHT - 130;
const STORAGE_KEY = "lean-arcade-best";

let audioContext = null;
let engineGain = null;
let engineOscillator = null;

const keys = {
    left: false,
    right: false
};

const state = {
    mode: "start",
    time: 0,
    distance: 0,
    speed: 220,
    trafficRate: 0.95,
    spawnClock: 0,
    powerClock: 0,
    flash: 0,
    shake: 0,
    score: 0,
    best: loadBestScore(),
    lastTime: 0,
    activePower: null,
    player: createPlayer(),
    traffic: [],
    particles: [],
    pickups: []
};

window.__leanArcadeState = state;

bestValue.textContent = String(state.best);

function createPlayer() {
    return {
        x: WIDTH / 2,
        y: PLAYER_Y,
        width: 34,
        height: 60,
        speed: 280,
        shield: 0
    };
}

function createTraffic(y) {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    return {
        lane,
        x: laneCenter(lane),
        y,
        width: 32,
        height: 58,
        color: randomTrafficColor()
    };
}

function createPickup(y) {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    return {
        lane,
        x: laneCenter(lane),
        y,
        width: 24,
        height: 24,
        spin: 0
    };
}

function laneCenter(lane) {
    return ROAD_LEFT + LANE_WIDTH * lane + LANE_WIDTH / 2;
}

function randomTrafficColor() {
    const colors = ["#ff6b6b", "#ffd93d", "#6bcBef", "#9d4edd", "#ff922b"];
    return colors[Math.floor(Math.random() * colors.length)];
}

function loadBestScore() {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        return value ? Math.max(0, Number.parseInt(value, 10) || 0) : 0;
    } catch {
        return 0;
    }
}

function saveBestScore() {
    try {
        window.localStorage.setItem(STORAGE_KEY, String(state.best));
    } catch {
        return;
    }
}

function ensureAudio() {
    if (audioContext) {
        return;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
        return;
    }
    audioContext = new Context();
    engineGain = audioContext.createGain();
    engineGain.gain.value = 0.03;
    engineGain.connect(audioContext.destination);
    engineOscillator = audioContext.createOscillator();
    engineOscillator.type = "sawtooth";
    engineOscillator.frequency.value = 90;
    engineOscillator.connect(engineGain);
    engineOscillator.start();
}

function playTone(frequency, duration, volume, type) {
    if (!audioContext) {
        return;
    }
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + duration);
}

function startGame() {
    ensureAudio();
    if (audioContext && audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
    }
    resetRun();
    state.mode = "playing";
    overlay.classList.remove("visible");
}

function resetRun() {
    state.time = 0;
    state.distance = 0;
    state.speed = 220;
    state.trafficRate = 0.95;
    state.spawnClock = 0;
    state.powerClock = 5;
    state.flash = 0;
    state.shake = 0;
    state.score = 0;
    state.activePower = null;
    state.player = createPlayer();
    state.traffic = [createTraffic(-120), createTraffic(-320), createTraffic(-520), createTraffic(-720)];
    state.pickups = [];
    state.particles = [];
    scoreValue.textContent = "0";
    powerLabel.textContent = "Power: none";
}

function endRun() {
    state.mode = "gameover";
    state.flash = 0.95;
    state.shake = 18;
    for (let i = 0; i < 36; i += 1) {
        spawnParticle(state.player.x, state.player.y, "#ffb703", 90 + Math.random() * 180);
    }
    playTone(65, 0.45, 0.18, "square");
    playTone(40, 0.7, 0.15, "sawtooth");
    if (state.score > state.best) {
        state.best = state.score;
        bestValue.textContent = String(state.best);
        saveBestScore();
    }
    overlayCard.innerHTML = "<h1>Game Over</h1><p>Final score: " + state.score + "</p><p>Press any movement key or click to restart.</p>";
    overlay.classList.add("visible");
}

function update(dt) {
    state.flash = Math.max(0, state.flash - dt * 2.3);
    state.shake = Math.max(0, state.shake - dt * 36);
    updateParticles(dt);

    if (state.mode !== "playing") {
        updateEngine();
        return;
    }

    state.time += dt;
    state.distance += state.speed * dt;
    state.speed = 220 + Math.min(220, state.time * 5.2);
    state.trafficRate = Math.min(2.5, 0.95 + state.time * 0.025);
    state.score = Math.floor(state.distance / 12);
    scoreValue.textContent = String(state.score);

    if (state.player.shield > 0) {
        state.player.shield = Math.max(0, state.player.shield - dt);
        state.activePower = "Shield";
        powerLabel.textContent = "Power: shield " + state.player.shield.toFixed(1) + "s";
    } else {
        state.activePower = null;
        powerLabel.textContent = "Power: none";
    }

    const move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    state.player.x += move * state.player.speed * dt;
    const half = state.player.width / 2;
    state.player.x = Math.max(ROAD_LEFT + half + 8, Math.min(ROAD_LEFT + ROAD_WIDTH - half - 8, state.player.x));

    state.spawnClock -= dt;
    if (state.spawnClock <= 0) {
        spawnTrafficWave();
        state.spawnClock = Math.max(0.32, 1.18 / state.trafficRate);
    }

    state.powerClock -= dt;
    if (state.powerClock <= 0) {
        state.pickups.push(createPickup(-80));
        state.powerClock = 10 + Math.random() * 7;
    }

    for (const car of state.traffic) {
        car.y += state.speed * dt;
    }
    for (const pickup of state.pickups) {
        pickup.y += state.speed * dt;
        pickup.spin += dt * 5;
    }

    state.traffic = state.traffic.filter((car) => car.y < HEIGHT + 100);
    state.pickups = state.pickups.filter((pickup) => pickup.y < HEIGHT + 80);

    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
        if (overlaps(state.player, state.pickups[i])) {
            state.player.shield = 5;
            state.pickups.splice(i, 1);
            playTone(880, 0.14, 0.08, "triangle");
            playTone(1320, 0.24, 0.05, "sine");
        }
    }

    for (let i = 0; i < state.traffic.length; i += 1) {
        if (!overlaps(state.player, state.traffic[i])) {
            continue;
        }
        if (state.player.shield > 0) {
            const hit = state.traffic[i];
            state.player.shield = 0;
            state.flash = 0.45;
            state.shake = 9;
            for (let j = 0; j < 12; j += 1) {
                spawnParticle(hit.x, hit.y, "#8ecae6", 50 + Math.random() * 120);
            }
            playTone(220, 0.12, 0.08, "square");
            state.traffic.splice(i, 1);
            i -= 1;
        } else {
            endRun();
            break;
        }
    }

    updateEngine();
}

function updateEngine() {
    if (!engineOscillator || !engineGain) {
        return;
    }
    const intensity = state.mode === "playing" ? state.speed / 440 : 0.15;
    engineOscillator.frequency.setTargetAtTime(90 + intensity * 130, audioContext.currentTime, 0.08);
    engineGain.gain.setTargetAtTime(state.mode === "playing" ? 0.025 + intensity * 0.03 : 0.012, audioContext.currentTime, 0.1);
}

function spawnTrafficWave() {
    const count = 1 + Math.floor(Math.random() * 2) + (Math.random() < Math.min(0.8, state.time / 45) ? 1 : 0);
    const used = new Set();
    for (let i = 0; i < count; i += 1) {
        let lane = Math.floor(Math.random() * LANE_COUNT);
        let guard = 0;
        while (used.has(lane) && guard < 8) {
            lane = Math.floor(Math.random() * LANE_COUNT);
            guard += 1;
        }
        used.add(lane);
        const car = createTraffic(-140 - i * 130 - Math.random() * 120);
        car.lane = lane;
        car.x = laneCenter(lane);
        state.traffic.push(car);
    }
}

function overlaps(a, b) {
    return Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2;
}

function spawnParticle(x, y, color, speed) {
    const angle = Math.random() * Math.PI * 2;
    state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.5,
        size: 3 + Math.random() * 5,
        color
    });
}

function updateParticles(dt) {
    for (const particle of state.particles) {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.98;
        particle.vy *= 0.98;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
}

function draw() {
    ctx.save();
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }

    drawBackground();
    drawRoad();
    drawPickups();
    drawTraffic();
    drawPlayer();
    drawParticles();

    if (state.flash > 0) {
        ctx.fillStyle = "rgba(255, 214, 102, " + state.flash.toFixed(3) + ")";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    ctx.restore();
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#10233b");
    gradient.addColorStop(1, "#06101d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#173014";
    ctx.fillRect(0, 0, ROAD_LEFT, HEIGHT);
    ctx.fillRect(ROAD_LEFT + ROAD_WIDTH, 0, WIDTH - ROAD_LEFT - ROAD_WIDTH, HEIGHT);
}

function drawRoad() {
    ctx.fillStyle = "#2f3640";
    ctx.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, HEIGHT);

    const stripeOffset = (state.distance * 0.9) % 80;
    ctx.strokeStyle = "#dfe6e9";
    ctx.lineWidth = 4;
    for (let lane = 1; lane < LANE_COUNT; lane += 1) {
        const x = ROAD_LEFT + lane * LANE_WIDTH;
        ctx.setLineDash([26, 24]);
        ctx.lineDashOffset = stripeOffset;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = "#f8f9fa";
    ctx.lineWidth = 6;
    ctx.strokeRect(ROAD_LEFT, 0, ROAD_WIDTH, HEIGHT);
}

function drawCar(x, y, width, height, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    roundedRectPath(-width / 2, -height / 2, width, height, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(-width / 2 + 4, -height / 2 + 8, width - 8, 12);
    ctx.fillRect(-width / 2 + 5, 4, width - 10, 15);
    ctx.fillStyle = "#111";
    ctx.fillRect(-width / 2 - 2, -height / 2 + 10, 4, 14);
    ctx.fillRect(width / 2 - 2, -height / 2 + 10, 4, 14);
    ctx.fillRect(-width / 2 - 2, height / 2 - 24, 4, 14);
    ctx.fillRect(width / 2 - 2, height / 2 - 24, 4, 14);
    ctx.restore();
}

function roundedRectPath(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawTraffic() {
    for (const car of state.traffic) {
        drawCar(car.x, car.y, car.width, car.height, car.color);
    }
}

function drawPlayer() {
    drawCar(state.player.x, state.player.y, state.player.width, state.player.height, "#00d1b2");
    if (state.player.shield > 0) {
        ctx.strokeStyle = "rgba(126, 200, 255, 0.85)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(state.player.x, state.player.y, 34 + Math.sin(state.time * 10) * 2, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawPickups() {
    for (const pickup of state.pickups) {
        ctx.save();
        ctx.translate(pickup.x, pickup.y);
        ctx.rotate(pickup.spin);
        ctx.fillStyle = "#8ecae6";
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(12, 0);
        ctx.lineTo(0, 16);
        ctx.lineTo(-12, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#e0fbfc";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

function drawParticles() {
    for (const particle of state.particles) {
        ctx.globalAlpha = Math.max(0, particle.life);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function frame(timestamp) {
    if (!state.lastTime) {
        state.lastTime = timestamp;
    }
    const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000);
    state.lastTime = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(frame);
}

function handleStartInput() {
    if (state.mode === "start") {
        overlayCard.innerHTML = "<h1>Lean Arcade</h1><p>Dodge highway traffic as long as you can.</p><p>Controls: Arrow keys or WASD to steer.</p><p>Press any movement key or click to start.</p>";
    }
    if (state.mode !== "playing") {
        startGame();
    }
}

function setKey(event, pressed) {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") {
        keys.left = pressed;
    }
    if (key === "arrowright" || key === "d") {
        keys.right = pressed;
    }
    if (pressed && (key === "arrowleft" || key === "arrowright" || key === "a" || key === "d")) {
        event.preventDefault();
        handleStartInput();
    }
}

window.addEventListener("keydown", (event) => {
    setKey(event, true);
});

window.addEventListener("keyup", (event) => {
    setKey(event, false);
});

overlay.addEventListener("click", () => {
    handleStartInput();
});

requestAnimationFrame(frame);
