import * as THREE from 'three';

// === SAFE STORAGE ===
function safeGet(key) {
    try { return localStorage.getItem(key); } catch(e) { return null; }
}
function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch(e) {}
}

// === NEURAL NETWORK (used for AI traffic behavior) ===
class NeuralNetwork {
    constructor(neuronCounts) {
        this.levels = [];
        for (let i = 0; i < neuronCounts.length - 1; i++) {
            this.levels.push(new NNLevel(neuronCounts[i], neuronCounts[i+1]));
        }
    }
    static feedForward(inputs, network) {
        let outputs = NNLevel.feedForward(inputs, network.levels[0]);
        for (let i = 1; i < network.levels.length; i++) {
            outputs = NNLevel.feedForward(outputs, network.levels[i]);
        }
        return outputs;
    }
    static mutate(network, amount) {
        network.levels.forEach(level => {
            for (let i = 0; i < level.biases.length; i++)
                level.biases[i] = lerp(level.biases[i], Math.random()*2-1, amount);
            for (let i = 0; i < level.weights.length; i++)
                for (let j = 0; j < level.weights[i].length; j++)
                    level.weights[i][j] = lerp(level.weights[i][j], Math.random()*2-1, amount);
        });
    }
}
class NNLevel {
    constructor(inputCount, outputCount) {
        this.inputs = new Array(inputCount);
        this.outputs = new Array(outputCount);
        this.biases = new Array(outputCount);
        this.weights = [];
        for (let i = 0; i < inputCount; i++) this.weights[i] = new Array(outputCount);
        NNLevel.randomize(this);
    }
    static randomize(level) {
        for (let i = 0; i < level.inputs.length; i++)
            for (let j = 0; j < level.outputs.length; j++)
                level.weights[i][j] = Math.random()*2-1;
        for (let i = 0; i < level.biases.length; i++)
            level.biases[i] = Math.random()*2-1;
    }
    static feedForward(givenInputs, level) {
        for (let i = 0; i < level.inputs.length; i++) level.inputs[i] = givenInputs[i];
        for (let i = 0; i < level.outputs.length; i++) {
            let sum = 0;
            for (let j = 0; j < level.inputs.length; j++)
                sum += level.inputs[j] * level.weights[j][i];
            level.outputs[i] = sum > level.biases[i] ? 1 : 0;
        }
        return level.outputs;
    }
}
function lerp(a, b, t) { return a + (b - a) * t; }

// === GAME STATE ===
const State = { START: 0, PLAYING: 1, GAME_OVER: 2 };
let state = State.START;
let score = 0, highScore = parseInt(safeGet('neonrush_high')) || 0;
let combo = 0, maxCombo = 0, comboTimer = 0;
let carsPassed = 0, lives = 3;
let level = 1, levelTimer = 0;
let playerSpeed = 0, playerMaxSpeed = 180;
let playerX = 0, playerZ = 0;
let playerLane = 1.5; // continuous lane position
let steerVel = 0;
let invincibleTimer = 0;
let shakeTimer = 0, shakeIntensity = 0;

// Road config
const LANE_COUNT = 4;
const LANE_WIDTH = 3.2;
const ROAD_WIDTH = LANE_COUNT * LANE_WIDTH;

// Traffic
let traffic = [];
let trafficSpawnTimer = 0;
let trafficBaseSpeed = 80;
let trafficDensity = 1.2; // seconds between spawns

// Input
const keys = {};
document.addEventListener('keydown', e => {
    keys[e.key] = true;
    keys[e.code] = true;
    if ((e.key === 'Enter' || e.key === ' ') && state === State.START) startGame();
    if ((e.key === 'Enter' || e.key === ' ') && state === State.GAME_OVER) startGame();
});
document.addEventListener('keyup', e => { keys[e.key] = false; keys[e.code] = false; });
document.getElementById('start-btn').onclick = startGame;
document.getElementById('restart-btn').onclick = startGame;

// === THREE.JS SETUP ===
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000011, 0.008);
scene.background = new THREE.Color(0x000011);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// === LIGHTING ===
const ambientLight = new THREE.AmbientLight(0x222244, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0x8888ff, 0.3);
dirLight.position.set(10, 30, -10);
scene.add(dirLight);

// Player headlights
const headlightL = new THREE.SpotLight(0xffffff, 30, 60, Math.PI/6, 0.5);
const headlightR = new THREE.SpotLight(0xffffff, 30, 60, Math.PI/6, 0.5);
scene.add(headlightL); scene.add(headlightR);
const headlightTarget = new THREE.Object3D();
scene.add(headlightTarget);
headlightL.target = headlightTarget;
headlightR.target = headlightTarget;

// === ROAD CONSTRUCTION ===
const roadGroup = new THREE.Group();
scene.add(roadGroup);

// Road surface segments (recycled)
const ROAD_SEGMENT_LENGTH = 20;
const ROAD_SEGMENT_COUNT = 30;
const roadSegments = [];
const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.8 });

for (let i = 0; i < ROAD_SEGMENT_COUNT; i++) {
    const geo = new THREE.PlaneGeometry(ROAD_WIDTH + 4, ROAD_SEGMENT_LENGTH);
    const mesh = new THREE.Mesh(geo, roadMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.z = -i * ROAD_SEGMENT_LENGTH;
    mesh.receiveShadow = true;
    roadGroup.add(mesh);
    roadSegments.push(mesh);
}

// Lane markings
const markingMat = new THREE.MeshBasicMaterial({ color: 0x444466 });
const markings = [];
for (let i = 0; i < 80; i++) {
    const geo = new THREE.PlaneGeometry(0.15, 3);
    const mesh = new THREE.Mesh(geo, markingMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    roadGroup.add(mesh);
    markings.push(mesh);
}

// Road edge neon strips
const edgeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const edgeGeo = new THREE.PlaneGeometry(0.2, ROAD_SEGMENT_LENGTH * ROAD_SEGMENT_COUNT);
const edgeL = new THREE.Mesh(edgeGeo, edgeMat.clone());
edgeL.rotation.x = -Math.PI / 2;
edgeL.position.set(-ROAD_WIDTH/2 - 0.5, 0.02, -ROAD_SEGMENT_LENGTH * ROAD_SEGMENT_COUNT / 2);
roadGroup.add(edgeL);
const edgeR = new THREE.Mesh(edgeGeo, edgeMat.clone());
edgeR.rotation.x = -Math.PI / 2;
edgeR.position.set(ROAD_WIDTH/2 + 0.5, 0.02, -ROAD_SEGMENT_LENGTH * ROAD_SEGMENT_COUNT / 2);
roadGroup.add(edgeR);

// Side buildings/environment
const buildingMat = new THREE.MeshStandardMaterial({ color: 0x0a0a1a, emissive: 0x050510 });
for (let i = 0; i < 40; i++) {
    const h = 5 + Math.random() * 20;
    const w = 3 + Math.random() * 5;
    const d = 3 + Math.random() * 5;
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, buildingMat);
    const side = Math.random() > 0.5 ? 1 : -1;
    mesh.position.set(side * (ROAD_WIDTH/2 + 5 + Math.random() * 10), h/2, -i * 15 - Math.random() * 10);
    roadGroup.add(mesh);
    // Neon accent
    const accentGeo = new THREE.PlaneGeometry(w * 0.8, 0.3);
    const accentMat = new THREE.MeshBasicMaterial({ 
        color: [0xff00ff, 0x00ffff, 0xff4400, 0x00ff88][Math.floor(Math.random()*4)]
    });
    const accent = new THREE.Mesh(accentGeo, accentMat);
    accent.position.set(mesh.position.x - side * w/2, h * (0.3 + Math.random()*0.5), mesh.position.z);
    accent.rotation.y = side > 0 ? -Math.PI/2 : Math.PI/2;
    roadGroup.add(accent);
}

// === PLAYER CAR ===
function createCarMesh(color, isPlayer = false) {
    const group = new THREE.Group();
    // Body
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.6, 4);
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);
    // Roof
    const roofGeo = new THREE.BoxGeometry(1.4, 0.5, 2);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.5, roughness: 0.2 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 1.0, -0.2);
    group.add(roof);
    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    [[-0.9, 0.3, 1.2], [0.9, 0.3, 1.2], [-0.9, 0.3, -1.2], [0.9, 0.3, -1.2]].forEach(p => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(...p);
        group.add(w);
    });
    if (isPlayer) {
        // Taillights
        const tlGeo = new THREE.PlaneGeometry(0.3, 0.2);
        const tlMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const tl1 = new THREE.Mesh(tlGeo, tlMat);
        tl1.position.set(-0.6, 0.6, 2.01);
        group.add(tl1);
        const tl2 = new THREE.Mesh(tlGeo, tlMat);
        tl2.position.set(0.6, 0.6, 2.01);
        group.add(tl2);
        // Headlights
        const hlGeo = new THREE.PlaneGeometry(0.3, 0.2);
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        const hl1 = new THREE.Mesh(hlGeo, hlMat);
        hl1.position.set(-0.6, 0.6, -2.01);
        group.add(hl1);
        const hl2 = new THREE.Mesh(hlGeo, hlMat);
        hl2.position.set(0.6, 0.6, -2.01);
        group.add(hl2);
    }
    // Neon underglow
    if (isPlayer) {
        const glowGeo = new THREE.PlaneGeometry(2.2, 4.4);
        const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.05;
        group.add(glow);
    }
    return group;
}

const playerCar = createCarMesh(0x00aaff, true);
scene.add(playerCar);

// === TRAFFIC CARS ===
const TRAFFIC_COLORS = [0xff3366, 0xffaa00, 0x33ff66, 0xff6600, 0xaa33ff, 0xff0066, 0x33ccff];

class TrafficCar {
    constructor(lane, z, speed) {
        this.lane = lane;
        this.x = laneToX(lane);
        this.z = z;
        this.speed = speed;
        this.passed = false;
        this.nearMiss = false;
        const color = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
        this.mesh = createCarMesh(color);
        scene.add(this.mesh);
        // AI brain for lane-changing behavior
        this.brain = new NeuralNetwork([3, 4, 2]); // inputs: gap left, gap right, player proximity
        this.laneChangeTimer = 2 + Math.random() * 3;
        this.targetLane = lane;
    }
    update(dt) {
        this.laneChangeTimer -= dt;
        if (this.laneChangeTimer <= 0) {
            // Use neural network to decide lane change
            const gapLeft = this.lane > 0 ? 1 : 0;
            const gapRight = this.lane < LANE_COUNT - 1 ? 1 : 0;
            const playerNear = Math.abs(this.z - playerZ) < 30 ? 1 : 0;
            const outputs = NeuralNetwork.feedForward([gapLeft, gapRight, playerNear], this.brain);
            if (outputs[0] && this.lane > 0) this.targetLane = this.lane - 1;
            else if (outputs[1] && this.lane < LANE_COUNT - 1) this.targetLane = this.lane + 1;
            this.laneChangeTimer = 2 + Math.random() * 4;
        }
        // Smoothly move to target lane
        this.lane = lerp(this.lane, this.targetLane, dt * 2);
        this.x = laneToX(this.lane);
        this.z += this.speed * dt;
        this.mesh.position.set(this.x, 0, this.z);
    }
    destroy() {
        scene.remove(this.mesh);
    }
}

function laneToX(lane) {
    return (lane - (LANE_COUNT - 1) / 2) * LANE_WIDTH;
}

// === AUDIO (procedural) ===
let audioCtx = null;
function initAudio() {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
}
function playTone(freq, duration, vol = 0.1, type = 'square') {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}
function playPassSound() { playTone(800, 0.1, 0.05); playTone(1200, 0.08, 0.04); }
function playComboSound(c) { playTone(600 + c * 100, 0.15, 0.06, 'sawtooth'); }
function playCrashSound() { 
    if (!audioCtx) return;
    try {
        const bufSize = audioCtx.sampleRate * 0.3;
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i/bufSize);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const g = audioCtx.createGain();
        g.gain.value = 0.2;
        src.connect(g); g.connect(audioCtx.destination);
        src.start();
    } catch(e) {}
}
function playEngineFrame(speed) {
    // Engine sound handled via oscillator tick - simplified
}

// === GAME LOGIC ===
function startGame() {
    initAudio();
    state = State.PLAYING;
    score = 0; combo = 0; maxCombo = 0; comboTimer = 0;
    carsPassed = 0; lives = 3; level = 1; levelTimer = 0;
    playerSpeed = 100; playerX = 0; playerZ = 0;
    playerLane = (LANE_COUNT - 1) / 2;
    steerVel = 0; invincibleTimer = 0;
    trafficBaseSpeed = 80; trafficDensity = 1.2;
    trafficSpawnTimer = 0;
    // Clear traffic
    traffic.forEach(t => t.destroy());
    traffic = [];
    // UI
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('hud').style.display = 'block';
}

function gameOver() {
    state = State.GAME_OVER;
    if (score > highScore) { highScore = score; safeSet('neonrush_high', highScore); }
    document.getElementById('hud').style.display = 'none';
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('final-score').textContent = score;
    document.getElementById('high-score').textContent = highScore > 0 ? `HIGH SCORE: ${highScore}` : '';
    document.getElementById('cars-passed').textContent = carsPassed;
    document.getElementById('max-combo').textContent = maxCombo;
    playCrashSound();
}

function hitTraffic() {
    lives--;
    invincibleTimer = 2;
    shakeTimer = 0.4; shakeIntensity = 0.5;
    playCrashSound();
    if (lives <= 0) gameOver();
}

function updateGame(dt) {
    if (state !== State.PLAYING) return;
    dt = Math.min(dt, 0.05); // cap

    // Level progression
    levelTimer += dt;
    if (levelTimer > 15) {
        levelTimer = 0;
        level++;
        trafficBaseSpeed += 10;
        trafficDensity = Math.max(0.4, trafficDensity - 0.1);
        playerMaxSpeed += 10;
        playTone(440, 0.3, 0.08, 'sine');
        playTone(660, 0.3, 0.06, 'sine');
    }

    // Player acceleration
    const accel = (keys['ArrowUp'] || keys['KeyW']) ? 200 : 
                  (keys['ArrowDown'] || keys['KeyS']) ? -100 : -30;
    playerSpeed += accel * dt;
    playerSpeed = Math.max(60, Math.min(playerMaxSpeed, playerSpeed));

    // Steering
    const steerInput = ((keys['ArrowLeft'] || keys['KeyA']) ? -1 : 0) + 
                       ((keys['ArrowRight'] || keys['KeyD']) ? 1 : 0);
    steerVel += steerInput * 12 * dt;
    steerVel *= 0.9; // damping
    playerLane += steerVel * dt;
    playerLane = Math.max(-0.3, Math.min(LANE_COUNT - 0.7, playerLane));
    playerX = laneToX(playerLane);

    playerZ -= playerSpeed * dt * 0.1; // move forward in world

    // Score from distance
    score += Math.floor(playerSpeed * dt * 0.5);

    // Combo decay
    if (comboTimer > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) combo = 0;
    }

    // Invincibility
    if (invincibleTimer > 0) invincibleTimer -= dt;
    if (shakeTimer > 0) shakeTimer -= dt;

    // Spawn traffic
    trafficSpawnTimer -= dt;
    if (trafficSpawnTimer <= 0) {
        trafficSpawnTimer = trafficDensity * (0.7 + Math.random() * 0.6);
        const lane = Math.floor(Math.random() * LANE_COUNT);
        const speed = (trafficBaseSpeed + Math.random() * 20) * 0.1;
        const t = new TrafficCar(lane, playerZ - 120, speed);
        // Mutate brain slightly for variety
        NeuralNetwork.mutate(t.brain, 0.5);
        traffic.push(t);
    }

    // Update traffic
    for (let i = traffic.length - 1; i >= 0; i--) {
        const t = traffic[i];
        t.update(dt);
        
        // Check if passed
        if (!t.passed && t.z > playerZ + 3) {
            t.passed = true;
            carsPassed++;
            score += 50 + combo * 20;
            playPassSound();
            
            // Near miss check
            const dx = Math.abs(t.x - playerX);
            if (dx < 2.5) {
                combo++;
                comboTimer = 2;
                if (combo > maxCombo) maxCombo = combo;
                score += combo * 30;
                playComboSound(combo);
            }
        }

        // Collision
        if (!t.passed && invincibleTimer <= 0) {
            const dx = Math.abs(t.x - playerX);
            const dz = Math.abs(t.z - playerZ);
            if (dx < 1.7 && dz < 3.5) {
                t.passed = true; // don't re-collide
                hitTraffic();
            }
        }

        // Remove far behind
        if (t.z > playerZ + 50) {
            t.destroy();
            traffic.splice(i, 1);
        }
    }
}

// === RENDER ===
function updateMarkings() {
    const segLen = 8;
    for (let i = 0; i < markings.length; i++) {
        const laneIdx = Math.floor(i / (markings.length / (LANE_COUNT - 1)));
        const markIdx = i % Math.floor(markings.length / (LANE_COUNT - 1));
        const x = laneToX(laneIdx + 0.5) + LANE_WIDTH/2;
        let z = playerZ - 100 + markIdx * segLen;
        z = z - ((z % segLen) + segLen) % segLen; // snap
        // Unique offset per marking
        z -= (markIdx * segLen);
        const baseZ = playerZ - 60;
        const offset = ((baseZ - markIdx * segLen) % (segLen * Math.floor(markings.length / (LANE_COUNT-1))));
        markings[i].position.set(
            laneToX(laneIdx + 1) - LANE_WIDTH + LANE_WIDTH,
            0.01,
            playerZ - 5 - markIdx * segLen + (playerZ % segLen)
        );
        // Recompute properly
        const totalMarks = Math.floor(markings.length / (LANE_COUNT - 1));
        const lI = Math.floor(i / totalMarks);
        const mI = i % totalMarks;
        const lx = (lI + 1 - (LANE_COUNT) / 2) * LANE_WIDTH;
        let mz = playerZ + 10 - mI * segLen;
        mz -= (mz % segLen);
        markings[i].position.set(lx, 0.01, mz);
    }
}

function updateRoadSegments() {
    for (let i = 0; i < roadSegments.length; i++) {
        let z = playerZ + 20 - i * ROAD_SEGMENT_LENGTH;
        roadSegments[i].position.z = z;
    }
    edgeL.position.z = playerZ - ROAD_SEGMENT_LENGTH * ROAD_SEGMENT_COUNT / 2 + 20;
    edgeR.position.z = playerZ - ROAD_SEGMENT_LENGTH * ROAD_SEGMENT_COUNT / 2 + 20;
}

let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    updateGame(dt);

    // Position player car
    playerCar.position.set(playerX, 0, playerZ);
    // Tilt on steering
    playerCar.rotation.y = -steerVel * 0.05;
    playerCar.rotation.z = steerVel * 0.02;
    // Blink on invincible
    playerCar.visible = invincibleTimer <= 0 || Math.floor(time / 100) % 2 === 0;

    // Camera - chase cam
    const camTargetX = playerX * 0.5;
    const camZ = playerZ + 12;
    const camY = 5 + playerSpeed * 0.01;
    camera.position.set(
        lerp(camera.position.x, camTargetX, 0.05),
        lerp(camera.position.y, camY, 0.05),
        lerp(camera.position.z, camZ, 0.05)
    );
    // Shake
    if (shakeTimer > 0) {
        camera.position.x += (Math.random() - 0.5) * shakeIntensity;
        camera.position.y += (Math.random() - 0.5) * shakeIntensity * 0.5;
    }
    camera.lookAt(playerX * 0.3, 1, playerZ - 20);

    // Headlights
    headlightL.position.set(playerX - 0.6, 1, playerZ - 2);
    headlightR.position.set(playerX + 0.6, 1, playerZ - 2);
    headlightTarget.position.set(playerX, 0, playerZ - 40);

    // Update road
    updateRoadSegments();
    updateMarkings();

    // Edge color pulse
    const pulse = (Math.sin(time * 0.003) + 1) * 0.5;
    edgeL.material.color.setHSL(0.5 + pulse * 0.2, 1, 0.5);
    edgeR.material.color.setHSL(0.5 + pulse * 0.2, 1, 0.5);

    // HUD
    if (state === State.PLAYING) {
        document.getElementById('hud-score').textContent = score;
        document.getElementById('hud-speed').textContent = `${Math.floor(playerSpeed)} km/h`;
        document.getElementById('hud-level').textContent = `LEVEL ${level}`;
        const comboEl = document.getElementById('hud-combo');
        if (combo > 0) {
            comboEl.textContent = `x${combo} COMBO!`;
            comboEl.style.opacity = '1';
            comboEl.style.fontSize = `${18 + combo * 2}px`;
        } else {
            comboEl.style.opacity = '0';
        }
        document.getElementById('hud-lives').textContent = '❤️'.repeat(lives);
    }

    renderer.render(scene, camera);
}

requestAnimationFrame(animate);
