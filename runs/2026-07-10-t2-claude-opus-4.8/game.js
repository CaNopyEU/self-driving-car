// game.js — NEON RUSH: a 3D arcade highway dodger built on Three.js.
import * as THREE from "three";
import { NeuralNetwork, lerp } from "./nn.js";

/* ------------------------------------------------------------------ *
 * Safe storage: sandboxed iframes make localStorage throw. Wrap it.
 * ------------------------------------------------------------------ */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* best-effort */ } },
};

/* ------------------------------------------------------------------ *
 * Tiny WebAudio SFX — no external assets.
 * ------------------------------------------------------------------ */
const Sound = (() => {
  let ctx = null, muted = false, master = null;
  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      } catch { ctx = null; }
    }
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  }
  function blip(freq, dur, type = "sine", vol = 1, slideTo = null) {
    if (muted) return; ensure(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }
  // Engine drone hum, pitch tracks speed.
  let engOsc = null, engGain = null;
  function engineStart() {
    ensure(); if (!ctx || engOsc) return;
    engOsc = ctx.createOscillator(); engGain = ctx.createGain();
    engOsc.type = "sawtooth"; engOsc.frequency.value = 60;
    engGain.gain.value = 0.0;
    const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 400;
    engOsc.connect(filt); filt.connect(engGain); engGain.connect(master); engOsc.start();
  }
  function engineSet(t) { // t: 0..1
    if (!engOsc || muted) { if (engGain) engGain.gain.value = 0; return; }
    engOsc.frequency.value = 55 + t * 130;
    engGain.gain.value = 0.06 + t * 0.10;
  }
  function engineStop() { if (engOsc) { try { engOsc.stop(); } catch {} engOsc = null; engGain = null; } }
  return {
    coin: () => blip(880, 0.12, "square", 0.5, 1760),
    shield: () => blip(440, 0.25, "sine", 0.6, 990),
    overtake: () => blip(660, 0.08, "triangle", 0.4, 990),
    boost: () => blip(220, 0.3, "sawtooth", 0.4, 660),
    crash: () => { blip(160, 0.4, "sawtooth", 0.9, 40); blip(90, 0.5, "square", 0.7, 30); },
    wave: () => { blip(523, 0.12, "square", 0.5); setTimeout(() => blip(784, 0.18, "square", 0.5), 120); },
    click: () => blip(500, 0.05, "square", 0.3),
    engineStart, engineSet, engineStop,
    toggleMute() { muted = !muted; if (muted) engineSet(0); return muted; },
    isMuted: () => muted, ensure,
  };
})();

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */
const LANES = 5;
const LANE_W = 4;
const ROAD_W = LANES * LANE_W;
const laneX = (i) => (i - (LANES - 1) / 2) * LANE_W;

/* ------------------------------------------------------------------ *
 * Scene setup
 * ------------------------------------------------------------------ */
const gameEl = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
gameEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060f);
scene.fog = new THREE.Fog(0x05060f, 60, 190);

const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
camera.position.set(0, 7, 14);

// Lights
const hemi = new THREE.HemisphereLight(0x334488, 0x080810, 0.7);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xbfd4ff, 1.1);
dir.position.set(-30, 60, 20);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.camera.near = 1; dir.shadow.camera.far = 200;
dir.shadow.camera.left = -40; dir.shadow.camera.right = 40;
dir.shadow.camera.top = 40; dir.shadow.camera.bottom = -40;
scene.add(dir);
const dirTarget = new THREE.Object3D(); scene.add(dirTarget); dir.target = dirTarget;

// Neon side strips (accent lights)
const neonL = new THREE.PointLight(0xff2fd0, 0.0, 40); scene.add(neonL);
const neonR = new THREE.PointLight(0x2fd0ff, 0.0, 40); scene.add(neonR);

/* ---- Road: long scrolling segments so it feels infinite ---- */
const roadSegs = [];
const SEG_LEN = 40, SEG_COUNT = 12;
const roadMat = new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.85, metalness: 0.1 });
const stripeMat = new THREE.MeshBasicMaterial({ color: 0x39406a });
const edgeMatL = new THREE.MeshBasicMaterial({ color: 0xff2fd0 });
const edgeMatR = new THREE.MeshBasicMaterial({ color: 0x2fd0ff });

function makeSegment() {
  const g = new THREE.Group();
  const road = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W, 0.5, SEG_LEN), roadMat);
  road.position.y = -0.25; road.receiveShadow = true;
  g.add(road);
  // lane dashes
  for (let l = 1; l < LANES; l++) {
    const x = laneX(l) - LANE_W / 2;
    for (let d = 0; d < 4; d++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 3), stripeMat);
      dash.position.set(x, 0.03, -SEG_LEN / 2 + d * (SEG_LEN / 4) + 3);
      g.add(dash);
    }
  }
  // glowing edge rails
  const railGeo = new THREE.BoxGeometry(0.3, 0.6, SEG_LEN);
  const rl = new THREE.Mesh(railGeo, edgeMatL); rl.position.set(-ROAD_W / 2 - 0.2, 0.3, 0); g.add(rl);
  const rr = new THREE.Mesh(railGeo, edgeMatR); rr.position.set(ROAD_W / 2 + 0.2, 0.3, 0); g.add(rr);
  // ground beyond road
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x07070f, roughness: 1 });
  const gl = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, SEG_LEN), groundMat);
  gl.position.set(-ROAD_W / 2 - 30, -0.4, 0); gl.receiveShadow = true; g.add(gl);
  const gr = gl.clone(); gr.position.x = ROAD_W / 2 + 30; g.add(gr);
  // occasional side pylons for depth/spectacle
  for (let s = 0; s < 2; s++) {
    const px = (s === 0 ? -1 : 1) * (ROAD_W / 2 + 6);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 10, 6),
      new THREE.MeshStandardMaterial({ color: 0x151530, emissive: s === 0 ? 0x33113a : 0x11333a, emissiveIntensity: 0.6, roughness: 0.5 })
    );
    pillar.position.set(px, 5, (Math.random() - 0.5) * SEG_LEN);
    pillar.castShadow = true;
    g.add(pillar);
  }
  scene.add(g);
  return g;
}
for (let i = 0; i < SEG_COUNT; i++) {
  const s = makeSegment();
  s.position.z = -i * SEG_LEN;
  roadSegs.push(s);
}

// Starfield above for atmosphere
(() => {
  const geo = new THREE.BufferGeometry();
  const n = 600, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 300;
    arr[i * 3 + 1] = 20 + Math.random() * 80;
    arr[i * 3 + 2] = -Math.random() * 300 + 40;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8899ff, size: 0.6, transparent: true, opacity: 0.7 })));
})();

/* ------------------------------------------------------------------ *
 * Car builder — a chunky low-poly neon vehicle.
 * ------------------------------------------------------------------ */
function buildCar(bodyColor, glowColor) {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 3.8), bodyMat);
  body.position.y = 0.55; body.castShadow = true; car.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.6, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.1, metalness: 0.3, emissive: glowColor, emissiveIntensity: 0.15 })
  );
  cabin.position.set(0, 1.05, -0.2); cabin.castShadow = true; car.add(cabin);
  // underglow
  const glow = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 4.0), new THREE.MeshBasicMaterial({ color: glowColor }));
  glow.position.y = 0.16; car.add(glow);
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  const wheelPos = [[-1, 0.5, 1.2], [1, 0.5, 1.2], [-1, 0.5, -1.2], [1, 0.5, -1.2]];
  car.wheels = [];
  for (const [x, y, z] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, y, z); w.castShadow = true;
    car.add(w); car.wheels.push(w);
  }
  // taillights
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.1), new THREE.MeshBasicMaterial({ color: 0xff3344 }));
  tl.position.set(0, 0.7, 1.95); car.add(tl);
  return car;
}

/* ------------------------------------------------------------------ *
 * Player
 * ------------------------------------------------------------------ */
const player = buildCar(0x22ff88, 0x2fffc0);
scene.add(player);
// headlights
const hlL = new THREE.SpotLight(0xffffff, 2, 60, 0.5, 0.6, 1.5);
const hlR = new THREE.SpotLight(0xffffff, 2, 60, 0.5, 0.6, 1.5);
player.add(hlL, hlR);
hlL.position.set(-0.6, 0.8, -2); hlR.position.set(0.6, 0.8, -2);
const hlT = new THREE.Object3D(); hlT.position.set(0, 0, -20); player.add(hlT);
hlL.target = hlT; hlR.target = hlT;

/* ------------------------------------------------------------------ *
 * Pools: AI cars, pickups, particles
 * ------------------------------------------------------------------ */
const AI_COLORS = [
  [0xff4466, 0xff6688], [0x4488ff, 0x66aaff], [0xffaa22, 0xffcc55],
  [0xaa44ff, 0xcc77ff], [0xffffff, 0xaaddff],
];
class AICar {
  constructor() {
    const c = AI_COLORS[Math.floor(Math.random() * AI_COLORS.length)];
    this.mesh = buildCar(c[0], c[1]);
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.active = false;
    this.brain = new NeuralNetwork([5, 6, 2]); // inputs->hidden->[steerLeft,steerRight]
    this.isHunter = false;
    this.lifetime = 0;
  }
  spawn(z, lane, speed, hunter, brain) {
    this.active = true; this.mesh.visible = true;
    this.z = z; this.x = laneX(lane); this.speed = speed;
    this.targetX = this.x; this.isHunter = hunter; this.counted = false;
    this.lifetime = 0;
    if (brain) this.brain = brain;
    else if (Math.random() < 0.5) NeuralNetwork.mutate(this.brain, 1); // fresh random
    this.mesh.position.set(this.x, 0, z);
    // Hunters glow menacingly.
    this.mesh.children[2].material.color.setHex(hunter ? 0xff2222 : (Math.random() * 0xffffff | 0));
  }
  despawn() { this.active = false; this.mesh.visible = false; }
}
const aiCars = []; for (let i = 0; i < 40; i++) aiCars.push(new AICar());

class Pickup {
  constructor() {
    this.group = new THREE.Group();
    this.coin = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.18, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xffdd33, emissive: 0xffaa00, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.2 })
    );
    this.shield = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7),
      new THREE.MeshStandardMaterial({ color: 0x33ddff, emissive: 0x0088ff, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.2, transparent: true, opacity: 0.9 })
    );
    this.group.add(this.coin); this.group.add(this.shield);
    this.group.visible = false; scene.add(this.group);
    this.active = false;
  }
  spawn(z, lane, kind) {
    this.active = true; this.kind = kind; this.z = z; this.x = laneX(lane);
    this.group.visible = true;
    this.coin.visible = kind === "coin"; this.shield.visible = kind === "shield";
    this.group.position.set(this.x, 1.1, z);
  }
  despawn() { this.active = false; this.group.visible = false; }
}
const pickups = []; for (let i = 0; i < 20; i++) pickups.push(new Pickup());

// Particle burst pool
class Burst {
  constructor() {
    this.n = 14;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.5, transparent: true, depthWrite: false }));
    this.pts.visible = false; scene.add(this.pts);
    this.vel = []; for (let i = 0; i < this.n; i++) this.vel.push(new THREE.Vector3());
    this.active = false;
  }
  fire(x, y, z, color) {
    this.active = true; this.life = 1; this.pts.visible = true;
    this.pts.material.color.setHex(color);
    for (let i = 0; i < this.n; i++) {
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i].set((Math.random() - 0.5) * 12, Math.random() * 10, (Math.random() - 0.5) * 12);
    }
  }
  update(dt) {
    if (!this.active) return;
    this.life -= dt * 1.6;
    if (this.life <= 0) { this.active = false; this.pts.visible = false; return; }
    for (let i = 0; i < this.n; i++) {
      this.vel[i].y -= 20 * dt;
      this.pos[i * 3] += this.vel[i].x * dt;
      this.pos[i * 3 + 1] += this.vel[i].y * dt;
      this.pos[i * 3 + 2] += this.vel[i].z * dt;
    }
    this.pts.material.opacity = this.life;
    this.pts.geometry.attributes.position.needsUpdate = true;
  }
}
const bursts = []; for (let i = 0; i < 8; i++) bursts.push(new Burst());
function burstAt(x, y, z, color) { const b = bursts.find((b) => !b.active); if (b) b.fire(x, y, z, color); }

/* ------------------------------------------------------------------ *
 * Game state
 * ------------------------------------------------------------------ */
const State = { MENU: 0, PLAYING: 1, PAUSED: 2, OVER: 3 };
let state = State.MENU;

let G = null;
function newGame() {
  G = {
    px: 0, pxTarget: 0, pvx: 0,       // player x + velocity
    speed: 34, baseSpeed: 34,          // world units/sec forward
    dist: 0, score: 0, wave: 1,
    combo: 1, comboTimer: 0, overtakes: 0,
    shield: 0, maxShield: 100,
    boost: 100, boosting: false,
    spawnTimer: 0, pickupTimer: 1.5,
    waveTimer: 0, waveDur: 18,
    shake: 0, tilt: 0,
    survivorBrains: [], // NN evolution across waves
    invuln: 1.2,
  };
  best = +store.get("neonrush_best", 0) || 0;
  document.getElementById("best").textContent = fmt(best);
}
let best = 0;
const fmt = (n) => Math.floor(n).toLocaleString();

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */
const keys = {};
window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  if (e.key === "p" || e.key === "P") { if (state === State.PLAYING) pause(); else if (state === State.PAUSED) resume(); }
  if (e.key === "m" || e.key === "M") { const m = Sound.toggleMute(); toast(m ? "MUTED" : "SOUND ON"); }
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

/* ------------------------------------------------------------------ *
 * UI
 * ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $("hud"), overlay: $("overlay"),
  start: $("startScreen"), pause: $("pauseScreen"), over: $("gameOverScreen"),
  score: $("score"), wave: $("wave"), speed: $("speed"), bestEl: $("best"),
  multi: $("multiPill"), shieldFill: $("shieldFill"), boostBar: $("boostBar"),
  toast: $("toast"),
};
let toastTimer = 0;
function toast(msg) { ui.toast.textContent = msg; ui.toast.classList.add("show"); toastTimer = 1.6; }

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function startGame() {
  Sound.ensure(); Sound.engineStart();
  newGame();
  // reset pools
  aiCars.forEach((a) => a.despawn());
  pickups.forEach((p) => p.despawn());
  player.position.set(0, 0, 0);
  state = State.PLAYING;
  hide(ui.overlay); hide(ui.start); hide(ui.over); hide(ui.pause);
  show(ui.hud);
  Sound.wave();
}
function pause() { if (state !== State.PLAYING) return; state = State.PAUSED; show(ui.overlay); show(ui.pause); Sound.click(); }
function resume() { if (state !== State.PAUSED) return; state = State.PLAYING; hide(ui.overlay); hide(ui.pause); }
function gameOver() {
  state = State.OVER; Sound.crash(); Sound.engineSet(0);
  const s = Math.floor(G.score);
  const isBest = s > best;
  if (isBest) { best = s; store.set("neonrush_best", best); }
  $("finalScore").textContent = fmt(s);
  $("finalBest").textContent = fmt(best);
  $("finalWave").textContent = G.wave;
  $("finalOvertakes").textContent = G.overtakes;
  $("newBest").classList.toggle("hidden", !isBest);
  show(ui.overlay); show(ui.over); hide(ui.hud);
}
function quit() { state = State.MENU; hide(ui.pause); show(ui.start); Sound.engineStop(); }

$("startBtn").onclick = () => startGame();
$("restartBtn").onclick = () => startGame();
$("resumeBtn").onclick = () => resume();
$("quitBtn").onclick = () => quit();

/* ------------------------------------------------------------------ *
 * Spawning & waves
 * ------------------------------------------------------------------ */
function spawnTraffic() {
  // choose 1-2 lanes to fill, keep at least one gap
  const free = aiCars.find((a) => !a.active);
  if (!free) return;
  const lane = Math.floor(Math.random() * LANES);
  const hunterChance = Math.min(0.12 + G.wave * 0.05, 0.55);
  const hunter = Math.random() < hunterChance;
  // slower than player so player overtakes; hunters a touch faster
  const base = G.baseSpeed * (hunter ? 0.62 : 0.42) + G.wave * 1.2;
  const speed = base + Math.random() * 6;
  // brain: reuse a survivor sometimes for "learning" feel
  let brain = null;
  if (hunter && G.survivorBrains.length && Math.random() < 0.6) {
    brain = NeuralNetwork.clone(G.survivorBrains[Math.floor(Math.random() * G.survivorBrains.length)]);
    NeuralNetwork.mutate(brain, 0.25);
  }
  free.spawn(-160, lane, speed, hunter, brain);
}
function spawnPickup() {
  const free = pickups.find((p) => !p.active); if (!free) return;
  const lane = Math.floor(Math.random() * LANES);
  const kind = Math.random() < 0.22 ? "shield" : "coin";
  free.spawn(-150, lane, kind);
}
function nextWave() {
  G.wave++; G.waveTimer = 0;
  G.baseSpeed = 34 + G.wave * 3.2;
  G.waveDur = Math.max(12, 18 - G.wave * 0.4);
  // keep top surviving hunter brains for evolution
  const survivors = aiCars.filter((a) => a.active && a.isHunter).sort((a, b) => b.lifetime - a.lifetime);
  G.survivorBrains = survivors.slice(0, 4).map((a) => NeuralNetwork.clone(a.brain));
  Sound.wave(); toast("WAVE " + G.wave);
  ui.wave.textContent = G.wave;
}

/* ------------------------------------------------------------------ *
 * AI brain: hunters use the NN to pick a target lane offset that
 * tries to cut off the player. Inputs are normalized senses.
 * ------------------------------------------------------------------ */
function driveHunter(a, dt) {
  const dx = (G.px - a.x) / ROAD_W;           // player horizontal offset
  const dz = (a.z - player.position.z) / 60;  // how far ahead of player
  // nearest neighbour on each side (blocking awareness)
  let leftBlk = 1, rightBlk = 1;
  for (const o of aiCars) {
    if (!o.active || o === a) continue;
    if (Math.abs(o.z - a.z) < 5) {
      const rel = o.x - a.x;
      if (rel < 0 && Math.abs(rel) < LANE_W * 1.5) leftBlk = Math.min(leftBlk, Math.abs(rel) / (LANE_W * 1.5));
      if (rel > 0 && Math.abs(rel) < LANE_W * 1.5) rightBlk = Math.min(rightBlk, Math.abs(rel) / (LANE_W * 1.5));
    }
  }
  const edge = a.x / (ROAD_W / 2); // -1..1
  const out = NeuralNetwork.feedForward([dx, dz, leftBlk, rightBlk, edge], a.brain);
  const steer = (out[1] - out[0]); // right minus left
  a.targetX = a.x + steer * LANE_W * 2;
  a.targetX = Math.max(-ROAD_W / 2 + 1, Math.min(ROAD_W / 2 - 1, a.targetX));
  a.x = lerp(a.x, a.targetX, Math.min(1, dt * 2.5));
}

/* ------------------------------------------------------------------ *
 * Collision helper (AABB-ish in x/z)
 * ------------------------------------------------------------------ */
function hitPlayer(x, z, halfW, halfL) {
  return Math.abs(x - G.px) < (halfW + 0.95) && Math.abs(z - player.position.z) < (halfL + 1.9);
}

/* ------------------------------------------------------------------ *
 * Update
 * ------------------------------------------------------------------ */
function update(dt) {
  const g = G;

  // ----- input / steering -----
  const steerL = keys["arrowleft"] || keys["a"];
  const steerR = keys["arrowright"] || keys["d"];
  const accel = keys["arrowup"] || keys["w"];
  const brake = keys["arrowdown"] || keys["s"];
  const wantBoost = keys[" "] && g.boost > 5;

  let steer = 0;
  if (steerL) steer -= 1;
  if (steerR) steer += 1;
  g.pvx = lerp(g.pvx, steer * 22, dt * 8);
  g.px += g.pvx * dt;
  const limit = ROAD_W / 2 - 1;
  if (g.px > limit) { g.px = limit; g.pvx = 0; }
  if (g.px < -limit) { g.px = -limit; g.pvx = 0; }
  g.tilt = lerp(g.tilt, -g.pvx * 0.02, dt * 8);

  // ----- speed / boost -----
  g.boosting = wantBoost;
  let targetSpeed = g.baseSpeed;
  if (accel) targetSpeed += 12;
  if (brake) targetSpeed -= 22;
  if (g.boosting) { targetSpeed += 40; g.boost = Math.max(0, g.boost - dt * 40); if (Math.random() < 0.2) Sound.boost(); }
  else g.boost = Math.min(100, g.boost + dt * 12);
  targetSpeed = Math.max(16, targetSpeed);
  g.speed = lerp(g.speed, targetSpeed, dt * 3);

  // ----- world scroll -----
  const dz = g.speed * dt;
  g.dist += dz;
  // move road segments toward camera; recycle
  for (const s of roadSegs) {
    s.position.z += dz;
    if (s.position.z > SEG_LEN) s.position.z -= SEG_LEN * SEG_COUNT;
  }

  // ----- scoring -----
  g.score += dz * 0.6 * g.combo;
  if (g.comboTimer > 0) { g.comboTimer -= dt; if (g.comboTimer <= 0) g.combo = 1; }

  // ----- waves -----
  g.waveTimer += dt;
  if (g.waveTimer >= g.waveDur) nextWave();

  // ----- spawn traffic -----
  g.spawnTimer -= dt;
  const spawnRate = Math.max(0.35, 1.1 - g.wave * 0.06);
  if (g.spawnTimer <= 0) { spawnTraffic(); g.spawnTimer = spawnRate * (0.6 + Math.random() * 0.8); }
  g.pickupTimer -= dt;
  if (g.pickupTimer <= 0) { spawnPickup(); g.pickupTimer = 1.4 + Math.random() * 1.6; }

  if (g.invuln > 0) g.invuln -= dt;

  // ----- AI cars -----
  for (const a of aiCars) {
    if (!a.active) continue;
    a.lifetime += dt;
    a.z += (dz - a.speed * dt); // relative to world scroll: they move toward player
    if (a.isHunter) driveHunter(a, dt);
    a.mesh.position.set(a.x, 0, a.z);
    a.mesh.rotation.y = lerp(a.mesh.rotation.y, (a.targetX - a.x) * -0.1, dt * 6);

    // overtake scoring: passed behind the player
    if (!a.counted && a.z > player.position.z + 3) {
      a.counted = true; g.overtakes++;
      g.combo = Math.min(9, g.combo + 1); g.comboTimer = 3.5;
      g.score += 25 * g.combo;
      Sound.overtake();
    }
    // collision
    if (g.invuln <= 0 && hitPlayer(a.x, a.z, 0.95, 1.9)) {
      if (g.shield > 0) {
        g.shield = 0; g.invuln = 1.0; g.shake = 0.5;
        burstAt(a.x, 1, a.z, 0x33ddff); Sound.shield(); toast("SHIELD DOWN");
        a.despawn(); burstAt(a.x, 1, a.z, 0xff4444);
      } else {
        g.shake = 1; burstAt(player.position.x + g.px, 1, player.position.z, 0xff4444);
        gameOver(); return;
      }
    }
    // recycle when far behind
    if (a.z > player.position.z + 40) a.despawn();
  }

  // ----- pickups (static in world, scroll toward player with the road) -----
  for (const p of pickups) {
    if (!p.active) continue;
    p.z += dz;
    p.group.position.set(p.x, 1.1, p.z);
    p.group.rotation.y += dt * 3;
    p.coin.rotation.x += dt * 4;
    if (hitPlayer(p.x, p.z, 0.6, 0.6)) {
      if (p.kind === "coin") { g.score += 50 * g.combo; Sound.coin(); burstAt(p.x, 1.1, p.z, 0xffdd33); toast("+" + (50 * g.combo)); }
      else { g.shield = g.maxShield; Sound.shield(); burstAt(p.x, 1.1, p.z, 0x33ddff); toast("SHIELD UP"); }
      p.despawn();
    } else if (p.z > player.position.z + 20) p.despawn();
  }

  // ----- player mesh + wheels -----
  player.position.x = lerp(player.position.x, g.px, dt * 14);
  player.rotation.z = g.tilt;
  player.rotation.y = -g.pvx * 0.02;
  const wheelSpin = g.speed * dt * 2;
  for (const w of player.wheels) w.rotation.x += wheelSpin;

  // ----- camera (chase cam) with shake -----
  g.shake = Math.max(0, g.shake - dt * 2);
  const camBack = 13 + (g.boosting ? 2.5 : 0);
  const camY = 6.5 + (g.boosting ? 0.6 : 0);
  const shk = g.shake * 0.6;
  camera.position.x = lerp(camera.position.x, g.px * 0.5 + (Math.random() - 0.5) * shk, dt * 6);
  camera.position.y = lerp(camera.position.y, camY + (Math.random() - 0.5) * shk, dt * 6);
  camera.position.z = lerp(camera.position.z, camBack, dt * 6);
  camera.lookAt(g.px * 0.4, 1.5, -18);
  camera.fov = lerp(camera.fov, g.boosting ? 82 : 70, dt * 5);
  camera.updateProjectionMatrix();

  // keep directional light shadow following player
  dir.position.set(g.px - 30, 60, player.position.z + 20);
  dirTarget.position.set(g.px, 0, player.position.z - 10);

  // neon accent lights react to speed
  const sp = (g.speed - 16) / 90;
  neonL.intensity = 0.6 + sp; neonL.position.set(-ROAD_W / 2, 2, camera.position.z - 20);
  neonR.intensity = 0.6 + sp; neonR.position.set(ROAD_W / 2, 2, camera.position.z - 20);

  // engine sound pitch
  Sound.engineSet(Math.min(1, sp + (g.boosting ? 0.3 : 0)));

  // ----- HUD -----
  ui.score.textContent = fmt(g.score);
  ui.speed.innerHTML = Math.floor(g.speed * 3.6) + '<span class="unit">km/h</span>';
  ui.multi.textContent = "x" + g.combo;
  ui.multi.classList.toggle("hot", g.combo >= 3);
  ui.shieldFill.style.width = (g.shield / g.maxShield * 100) + "%";
  ui.boostBar.style.width = g.boost + "%";
  ui.boostBar.classList.toggle("low", g.boost < 20);

  for (const b of bursts) b.update(dt);
}

/* ------------------------------------------------------------------ *
 * Resize + loop
 * ------------------------------------------------------------------ */
function resize() {
  const w = gameEl.clientWidth, h = gameEl.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize); resize();

let last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000; last = now;
  dt = Math.min(dt, 0.05);
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) ui.toast.classList.remove("show"); }
  if (state === State.PLAYING) update(dt);
  else for (const b of bursts) b.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// menu idle camera drift
camera.position.set(0, 7, 16);
camera.lookAt(0, 1.5, -18);
