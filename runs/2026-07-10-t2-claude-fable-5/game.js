// NEON RUSH — 3D highway arcade. three.js via CDN importmap, zero build step.
import * as THREE from 'three';
import { NeuralNetwork } from './network.js';

/* ============================= utilities ============================= */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// storage is best-effort: sandboxed iframes may throw on any access
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* no-op */ } }
};

/* ============================= audio ============================= */
const AudioFX = {
  ctx: null, master: null, engineOsc: null, engineGain: null, engineFilter: null,
  muted: false,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // engine hum: saw through lowpass
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 300;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    } catch { this.ctx = null; }
  },
  resume() { try { this.ctx && this.ctx.state === 'suspended' && this.ctx.resume(); } catch {} },
  engine(speedNorm, on) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(40 + speedNorm * 140, t, 0.1);
      this.engineFilter.frequency.setTargetAtTime(200 + speedNorm * 900, t, 0.1);
      this.engineGain.gain.setTargetAtTime(on && !this.muted ? 0.05 + speedNorm * 0.06 : 0, t, 0.15);
    } catch {}
  },
  blip(freq = 880, dur = 0.09, type = 'square', vol = 0.15) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + dur);
    } catch {}
  },
  whoosh() { // near miss: noise sweep
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime, len = 0.25;
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5;
      f.frequency.setValueAtTime(3000, t);
      f.frequency.exponentialRampToValueAtTime(500, t + len);
      const g = this.ctx.createGain(); g.gain.value = 0.35;
      src.connect(f).connect(g).connect(this.master);
      src.start(t);
    } catch {}
  },
  crash() {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime, len = 0.6;
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = this.ctx.createGain(); g.gain.value = 0.7;
      src.connect(f).connect(g).connect(this.master);
      src.start(t);
      this.blip(80, 0.4, 'sawtooth', 0.3);
    } catch {}
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.14, 'triangle', 0.2), i * 90));
  }
};

/* ============================= constants ============================= */
const LANES = [-8, -4, 0, 4, 8];
const LANE_W = 4;
const ROAD_HALF = 11;          // player clamped to ±(ROAD_HALF - 1.4)
const LEVEL_DIST = 500;        // metres per level
const SEG_LEN = 60, SEG_COUNT = 12;

/* ============================= renderer / scene ============================= */
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05010f);
scene.fog = new THREE.Fog(0x0a0220, 60, 320);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 600);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* lights */
scene.add(new THREE.HemisphereLight(0x3040aa, 0x0a0118, 0.9));
const sunLight = new THREE.DirectionalLight(0xff54d7, 1.2);
sunLight.position.set(0, 60, 200);
scene.add(sunLight);
const headlight = new THREE.PointLight(0x99ddff, 30, 60, 2);
scene.add(headlight);

/* ============================= environment ============================= */
// synthwave sun: gradient canvas texture on a large disc far ahead
function makeSun() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ffe14d'); grad.addColorStop(0.55, '#ff54d7'); grad.addColorStop(1, '#7b2cff');
  g.fillStyle = grad; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let y = 150; y < 256; y += 18) g.fillRect(0, y, 256, 6 + (y - 150) / 14);
  const tex = new THREE.CanvasTexture(c);
  const sun = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false })
  );
  sun.position.set(0, 48, 420);
  sun.rotation.y = Math.PI;
  return sun;
}
const sun = makeSun(); scene.add(sun);

// star field
{
  const n = 700, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rand(-400, 400);
    pos[i * 3 + 1] = rand(20, 260);
    pos[i * 3 + 2] = rand(100, 550);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaaccff, size: 1.4, sizeAttenuation: false, fog: false }));
  stars.name = 'stars'; scene.add(stars);
}

/* road: recycled segments with emissive edges + dashed centre lines */
const roadGroup = new THREE.Group(); scene.add(roadGroup);
const roadSegs = [];
{
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x14122a, roughness: 0.85, metalness: 0.2 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xff54d7 });
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x0a0322 });
  for (let i = 0; i < SEG_COUNT; i++) {
    const seg = new THREE.Group();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, SEG_LEN), roadMat);
    plane.rotation.x = -Math.PI / 2; seg.add(plane);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, SEG_LEN), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; seg.add(ground);
    for (const sx of [-ROAD_HALF, ROAD_HALF]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, SEG_LEN), edgeMat);
      edge.position.set(sx, 0.05, 0); seg.add(edge);
    }
    for (let l = 1; l < LANES.length; l++) {
      const lx = (LANES[l - 1] + LANES[l]) / 2;
      for (let d = -SEG_LEN / 2 + 3; d < SEG_LEN / 2; d += 8) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 3.4), dashMat);
        dash.position.set(lx, 0.02, d); seg.add(dash);
      }
    }
    // neon pylons on both sides
    for (const sx of [-ROAD_HALF - 2.2, ROAD_HALF + 2.2]) {
      const py = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 6, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff })
      );
      py.position.set(sx, 3, -SEG_LEN / 2 + 8); seg.add(py);
    }
    seg.position.z = i * SEG_LEN;
    roadGroup.add(seg); roadSegs.push(seg);
  }
}

/* neon city blocks on the sides, recycled */
const buildings = [];
{
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 46; i++) {
    const hue = pick([0.52, 0.85, 0.62, 0.95]);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue, 0.7, 0.09),
      emissive: new THREE.Color().setHSL(hue, 0.9, 0.35),
      emissiveIntensity: 0.7, roughness: 0.6
    });
    const b = new THREE.Mesh(geo, mat);
    const side = i % 2 ? 1 : -1;
    b.userData.side = side;
    respawnBuilding(b, i * 26);
    scene.add(b); buildings.push(b);
  }
}
function respawnBuilding(b, z) {
  const w = rand(6, 16), h = rand(8, 46), d = rand(6, 16);
  b.scale.set(w, h, d);
  b.position.set(b.userData.side * rand(24, 70), h / 2, z);
}

/* ============================= car factory ============================= */
function makeCarMesh(bodyColor, glowColor) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.65; g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.1),
    new THREE.MeshStandardMaterial({ color: 0x0b1020, roughness: 0.1, metalness: 0.9 })
  );
  cabin.position.set(0, 1.25, -0.25); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [wx, wz] of [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w);
  }
  const glowMat = new THREE.MeshBasicMaterial({ color: glowColor });
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.1), new THREE.MeshBasicMaterial({ color: 0xcfffff }));
  head.position.set(0, 0.72, 2.21); g.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.1), glowMat);
  tail.position.set(0, 0.72, -2.21); g.add(tail);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.08, 4.2), glowMat);
  strip.position.y = 0.3; g.add(strip);
  return g;
}

/* ============================= particles (explosions) ============================= */
const particles = [];
const particleGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
function explode(pos, color, count = 26) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color }));
    m.position.copy(pos);
    m.userData.v = new THREE.Vector3(rand(-9, 9), rand(3, 14), rand(-9, 9));
    m.userData.life = rand(0.5, 1.1);
    scene.add(m); particles.push(m);
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.userData.life -= dt;
    if (p.userData.life <= 0) { scene.remove(p); p.material.dispose(); particles.splice(i, 1); continue; }
    p.userData.v.y -= 25 * dt;
    p.position.addScaledVector(p.userData.v, dt);
    p.rotation.x += dt * 7; p.rotation.y += dt * 5;
    if (p.position.y < 0.1) { p.position.y = 0.1; p.userData.v.y *= -0.4; }
  }
}

/* ============================= game state ============================= */
const TRAFFIC_COLORS = [0xff3b5c, 0xff9d2f, 0x7b2cff, 0x2fff8f, 0xff54d7];
const G = {
  state: 'menu',          // menu | playing | over | paused
  player: null,
  traffic: [], pickups: [],
  elitePool: [],          // best traffic brains, evolved against the player
  score: 0, combo: 1, comboTimer: 0, nearMisses: 0, dodged: 0,
  level: 1, distance: 0,
  shields: 3, invuln: 0,
  boost: 100,
  speed: 0, baseSpeed: 28,
  spawnTimer: 0, pickupTimer: 6,
  shake: 0, camMode: 0,   // 0 chase, 1 cockpit, 2 cinematic
  time: 0, hiScore: parseInt(store.get('neonrush-hi') || '0', 10) || 0
};

/* player */
const playerMesh = makeCarMesh(0x00b7e5, 0x00e5ff);
scene.add(playerMesh);
G.player = { x: 0, z: 0, vx: 0, mesh: playerMesh };

/* input */
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyC' && G.state === 'playing') { G.camMode = (G.camMode + 1) % 3; toast(['CHASE CAM', 'COCKPIT CAM', 'CINEMATIC CAM'][G.camMode]); }
  if (e.code === 'KeyM') { AudioFX.muted = !AudioFX.muted; toast(AudioFX.muted ? 'MUTED' : 'SOUND ON'); }
  if (e.code === 'KeyP' && (G.state === 'playing' || G.state === 'paused')) togglePause();
  if ((e.code === 'Enter' || e.code === 'Space')) {
    if (G.state === 'menu') startGame();
    else if (G.state === 'over') startGame();
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });

/* ============================= traffic (NN-driven) ============================= */
function freshBrain() { return new NeuralNetwork([5, 6, 4]); }

function spawnTraffic() {
  const lane = pick(LANES);
  const color = pick(TRAFFIC_COLORS);
  const mesh = makeCarMesh(color, 0xffb02f);
  mesh.rotation.y = 0;
  // brain: mutate an elite (traffic that troubled the player before) or start fresh
  let brain;
  if (G.elitePool.length && Math.random() < 0.75) {
    brain = NeuralNetwork.clone(pick(G.elitePool));
    NeuralNetwork.mutate(brain, 0.15);
  } else {
    brain = freshBrain();
  }
  const t = {
    mesh, brain, color,
    x: lane, targetX: lane,
    z: G.player.z + rand(130, 240),
    speed: G.speed * rand(0.42, 0.62),
    baseSpeed: 0,
    fitness: 0, thinkTimer: rand(0, 0.2),
    counted: false
  };
  t.baseSpeed = t.speed;
  scene.add(mesh);
  G.traffic.push(t);
}

function laneBlocked(self, x, dir) {
  const tx = x + dir * LANE_W;
  if (Math.abs(tx) > ROAD_HALF - 1.6) return 1;
  for (const o of G.traffic) {
    if (o !== self && Math.abs(o.x - tx) < 2.4 && Math.abs(o.z - self.z) < 10) return 1;
  }
  return 0;
}

function updateTraffic(dt) {
  const p = G.player;
  for (let i = G.traffic.length - 1; i >= 0; i--) {
    const t = G.traffic[i];

    // --- neural brain: decides drift / brake / surge, ~5x per second ---
    t.thinkTimer -= dt;
    if (t.thinkTimer <= 0) {
      t.thinkTimer = 0.2;
      const inputs = [
        clamp((p.x - t.x) / 10, -1, 1),          // where is the player, laterally
        clamp((t.z - p.z) / 80, -1, 1),          // gap ahead of the player
        laneBlocked(t, t.x, -1),                  // left lane occupied
        laneBlocked(t, t.x, 1),                   // right lane occupied
        clamp(t.speed / (G.speed || 1), 0, 1)     // own relative speed
      ];
      const [left, right, brake, surge] = NeuralNetwork.feedForward(inputs, t.brain);
      if (left && !right && !inputs[2]) t.targetX = clamp(t.x - LANE_W, -ROAD_HALF + 1.6, ROAD_HALF - 1.6);
      if (right && !left && !inputs[3]) t.targetX = clamp(t.x + LANE_W, -ROAD_HALF + 1.6, ROAD_HALF - 1.6);
      if (brake && !surge) t.speed = Math.max(t.baseSpeed * 0.55, t.speed - 6);
      if (surge && !brake) t.speed = Math.min(t.baseSpeed * 1.35, t.speed + 6);
      // fitness: staying in the player's path close ahead = being a threat
      const dz = t.z - p.z;
      if (dz > 0 && dz < 45 && Math.abs(t.x - p.x) < 2.6) t.fitness += 1;
    }

    t.x = lerp(t.x, t.targetX, clamp(3 * dt, 0, 1));
    t.z += t.speed * dt;
    t.mesh.position.set(t.x, 0, t.z);
    t.mesh.rotation.y = clamp((t.targetX - t.x) * 0.12, -0.3, 0.3);

    const dz = t.z - p.z, dx = t.x - p.x;

    // collision
    if (G.invuln <= 0 && Math.abs(dx) < 2.05 && Math.abs(dz) < 4.1) {
      hitTraffic(t, i);
      continue;
    }

    // near miss: the moment we overtake it
    if (!t.counted && dz < -2.2) {
      t.counted = true;
      G.dodged++;
      if (Math.abs(dx) < 3.4) nearMiss(t);
    }

    // despawn behind — harvest brain into elite pool
    if (dz < -40) {
      if (t.fitness > 2) {
        G.elitePool.push(t.brain);
        G.elitePool.sort(() => 0); // insertion order fine; cap below
        if (G.elitePool.length > 8) G.elitePool.shift();
      }
      scene.remove(t.mesh);
      G.traffic.splice(i, 1);
    }
  }
}

function nearMiss(t) {
  G.nearMisses++;
  G.combo = Math.min(10, G.combo + 1);
  G.comboTimer = 5;
  G.score += 100 * G.combo;
  AudioFX.whoosh();
  popCombo();
  toast(`NEAR MISS +${100 * G.combo}`);
}

function hitTraffic(t, idx) {
  explode(t.mesh.position.clone().setY(1), t.color, 30);
  scene.remove(t.mesh);
  G.traffic.splice(idx, 1);
  G.shields--;
  G.combo = 1; G.comboTimer = 0;
  G.shake = 1;
  AudioFX.crash();
  if (G.shields < 0) return gameOver();
  G.invuln = 1.6;
  toast('SHIELD DOWN!');
  updateHud(true);
}

/* ============================= pickups ============================= */
function spawnPickup() {
  const type = Math.random() < 0.5 ? 'shield' : 'boost';
  const mesh = new THREE.Mesh(
    type === 'shield' ? new THREE.OctahedronGeometry(0.9) : new THREE.IcosahedronGeometry(0.85),
    new THREE.MeshBasicMaterial({ color: type === 'shield' ? 0x00e5ff : 0xffe14d })
  );
  const item = { mesh, type, x: pick(LANES), z: G.player.z + rand(150, 220) };
  mesh.position.set(item.x, 1.4, item.z);
  scene.add(mesh);
  G.pickups.push(item);
}
function updatePickups(dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const it = G.pickups[i];
    it.mesh.rotation.y += dt * 3;
    it.mesh.position.y = 1.4 + Math.sin(G.time * 4 + i) * 0.25;
    const dz = it.z - p.z;
    if (Math.abs(it.x - p.x) < 2.2 && Math.abs(dz) < 3.4) {
      if (it.type === 'shield') {
        G.shields = Math.min(3, G.shields + 1);
        toast('+SHIELD'); AudioFX.blip(1320, 0.12, 'triangle', 0.25);
      } else {
        G.boost = Math.min(100, G.boost + 45);
        toast('+BOOST'); AudioFX.blip(990, 0.12, 'triangle', 0.25);
      }
      G.score += 50 * G.combo;
      explode(it.mesh.position, it.mesh.material.color.getHex(), 14);
      scene.remove(it.mesh); G.pickups.splice(i, 1);
      updateHud(true);
      continue;
    }
    if (dz < -30) { scene.remove(it.mesh); G.pickups.splice(i, 1); }
  }
}

/* ============================= player & camera ============================= */
function updatePlayer(dt) {
  const p = G.player;
  const steer = (keys['ArrowLeft'] || keys['KeyA'] ? -1 : 0) + (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0);
  p.vx = lerp(p.vx, steer * 22, clamp(8 * dt, 0, 1));
  p.x = clamp(p.x + p.vx * dt, -ROAD_HALF + 1.5, ROAD_HALF - 1.5);
  if (Math.abs(p.x) >= ROAD_HALF - 1.5) p.vx = 0;

  const boosting = (keys['ArrowUp'] || keys['KeyW']) && G.boost > 0;
  const braking = keys['ArrowDown'] || keys['KeyS'];
  if (boosting) G.boost = Math.max(0, G.boost - 32 * dt);
  else G.boost = Math.min(100, G.boost + 7 * dt);

  const target = G.baseSpeed * (boosting ? 1.5 : braking ? 0.55 : 1);
  G.speed = lerp(G.speed, target, clamp(2.5 * dt, 0, 1));
  p.z += G.speed * dt;
  G.distance = p.z;

  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = clamp(-p.vx * 0.018, -0.35, 0.35);
  p.mesh.rotation.z = clamp(p.vx * 0.012, -0.18, 0.18);
  p.mesh.visible = !(G.invuln > 0 && Math.floor(G.time * 12) % 2 === 0);

  headlight.position.set(p.x, 2, p.z + 6);

  // scoring: distance
  G.score += G.speed * dt * G.combo * 0.5;

  // combo decay
  if (G.comboTimer > 0) { G.comboTimer -= dt; if (G.comboTimer <= 0) G.combo = 1; }

  // level progression
  const lvl = Math.floor(G.distance / LEVEL_DIST) + 1;
  if (lvl > G.level) {
    G.level = lvl;
    G.baseSpeed = 28 + (lvl - 1) * 3.5;
    toast(`LEVEL ${lvl} — TRAFFIC ADAPTS`);
    AudioFX.fanfare();
    scene.fog.color.setHSL((0.72 + lvl * 0.045) % 1, 0.55, 0.08);
  }

  G.invuln = Math.max(0, G.invuln - dt);
}

const camTmp = new THREE.Vector3();
function updateCamera(dt) {
  const p = G.player;
  const speedN = clamp(G.speed / 60, 0, 1);
  let tx, ty, tz, lx, ly, lz, fov = 70 + speedN * 22;

  if (G.camMode === 0) {           // chase
    tx = p.x * 0.75; ty = 5.2; tz = p.z - 11;
    lx = p.x * 0.9; ly = 1.6; lz = p.z + 18;
  } else if (G.camMode === 1) {    // cockpit
    tx = p.x; ty = 1.55; tz = p.z + 0.4;
    lx = p.x + p.vx * 0.05; ly = 1.2; lz = p.z + 40;
    fov = 78 + speedN * 16;
  } else {                          // cinematic: low, offset, drifting
    const sway = Math.sin(G.time * 0.5) * 7;
    tx = p.x + 9 + sway * 0.3; ty = 2.2; tz = p.z - 7;
    lx = p.x; ly = 1.2; lz = p.z + 22;
  }

  if (G.shake > 0) {
    G.shake = Math.max(0, G.shake - dt * 2.2);
    tx += rand(-1, 1) * G.shake; ty += rand(-1, 1) * G.shake * 0.6;
  }

  camTmp.set(tx, ty, tz);
  camera.position.lerp(camTmp, G.state === 'playing' ? clamp(6 * dt, 0, 1) : 1);
  camera.lookAt(lx, ly, lz);
  camera.fov = lerp(camera.fov, fov, clamp(4 * dt, 0, 1));
  camera.updateProjectionMatrix();
}

/* ============================= world recycling ============================= */
function recycleWorld() {
  const pz = G.player.z;
  for (const seg of roadSegs) {
    while (seg.position.z < pz - SEG_LEN * 1.5) seg.position.z += SEG_LEN * SEG_COUNT;
  }
  for (const b of buildings) {
    if (b.position.z < pz - 40) respawnBuilding(b, pz + rand(300, 560));
  }
  sun.position.z = pz + 420;
  const stars = scene.getObjectByName('stars');
  if (stars) stars.position.z = pz;
}

/* ============================= HUD ============================= */
const $ = id => document.getElementById(id);
let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1300);
}
function popCombo() {
  const el = $('combo');
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 110);
}
function updateHud(force) {
  $('score').textContent = Math.floor(G.score).toLocaleString();
  $('level').textContent = 'LVL ' + G.level;
  $('speed').textContent = Math.round(G.speed * 3.6) + ' km/h';
  $('shields').textContent = '◆'.repeat(Math.max(0, G.shields)) + '◇'.repeat(3 - Math.max(0, G.shields));
  const combo = $('combo');
  if (G.combo > 1) { combo.classList.remove('hidden'); combo.textContent = 'x' + G.combo; }
  else combo.classList.add('hidden');
  $('boost-fill').style.width = G.boost + '%';
}

/* ============================= game flow ============================= */
function resetWorld() {
  for (const t of G.traffic) scene.remove(t.mesh);
  for (const it of G.pickups) scene.remove(it.mesh);
  for (const pm of particles) scene.remove(pm);
  G.traffic.length = G.pickups.length = particles.length = 0;
  Object.assign(G, {
    score: 0, combo: 1, comboTimer: 0, nearMisses: 0, dodged: 0,
    level: 1, distance: 0, shields: 3, invuln: 0, boost: 100,
    speed: 0, baseSpeed: 28, spawnTimer: 0.4, pickupTimer: 5, shake: 0, time: 0
  });
  G.elitePool.length = 0;
  G.player.x = 0; G.player.z = 0; G.player.vx = 0;
  scene.fog.color.set(0x0a0220);
  camera.position.set(0, 5.2, -11);
}

function startGame() {
  AudioFX.init(); AudioFX.resume();
  resetWorld();
  G.state = 'playing';
  $('menu').classList.add('hidden');
  $('gameover').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('boost-bar').classList.remove('hidden');
  updateHud(true);
  AudioFX.fanfare();
}

function gameOver() {
  G.state = 'over';
  explode(G.player.mesh.position.clone().setY(1), 0x00e5ff, 60);
  AudioFX.crash();
  AudioFX.engine(0, false);
  const final = Math.floor(G.score);
  const isRecord = final > G.hiScore;
  if (isRecord) { G.hiScore = final; store.set('neonrush-hi', String(final)); }
  $('final-score').textContent = final.toLocaleString();
  $('final-stats').innerHTML =
    `distance ${Math.round(G.distance)} m &nbsp;•&nbsp; level ${G.level}<br>` +
    `${G.nearMisses} near misses &nbsp;•&nbsp; ${G.dodged} cars passed<br>` +
    `best: ${G.hiScore.toLocaleString()}`;
  $('new-record').classList.toggle('hidden', !isRecord);
  setTimeout(() => {
    $('gameover').classList.remove('hidden');
    $('hud').classList.add('hidden');
  }, 900);
}

function togglePause() {
  if (G.state === 'playing') {
    G.state = 'paused';
    $('paused').classList.remove('hidden');
    AudioFX.engine(0, false);
  } else if (G.state === 'paused') {
    G.state = 'playing';
    $('paused').classList.add('hidden');
  }
}

$('btn-start').addEventListener('click', startGame);
$('btn-restart').addEventListener('click', startGame);
$('hiscore-line').textContent = G.hiScore > 0 ? `best score: ${G.hiScore.toLocaleString()}` : '';

/* ============================= main loop ============================= */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;

  if (G.state === 'playing' || G.state === 'over') {
    if (G.state === 'playing') {
      updatePlayer(dt);
      // spawn traffic — density ramps with level
      G.spawnTimer -= dt;
      if (G.spawnTimer <= 0) {
        const maxCars = Math.min(4 + G.level * 2, 18);
        if (G.traffic.length < maxCars) spawnTraffic();
        G.spawnTimer = Math.max(0.35, 1.5 - G.level * 0.12);
      }
      G.pickupTimer -= dt;
      if (G.pickupTimer <= 0) { spawnPickup(); G.pickupTimer = rand(6, 11); }
      updateTraffic(dt);
      updatePickups(dt);
      AudioFX.engine(clamp(G.speed / 70, 0, 1), true);
      updateHud();
    }
    recycleWorld();
    updateCamera(dt);
  } else if (G.state === 'menu') {
    // idle attract camera slowly orbiting the parked player car
    const a = G.time * 0.3;
    camera.position.set(Math.sin(a) * 14, 5 + Math.sin(G.time * 0.7), G.player.z + Math.cos(a) * 14);
    camera.lookAt(G.player.x, 1, G.player.z);
    recycleWorld();
  }

  updateParticles(dt);
  // pulse pickup / edge glow subtly
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
