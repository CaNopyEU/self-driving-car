// NEON RUSH — 3D arcade highway survival
// Single-file ES module. Three.js via CDN importmap.
import * as THREE from 'three';

// ---------- safe storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};

// ---------- tiny neural network (repurposed for AI Hunter behavior) ----------
// Kept from the original demo concept but reworked: a fixed feed-forward NN
// with hand-tuned weights that turns [dxToPlayer, dzToPlayer, mySpeed, myLaneOffset]
// into [steer, throttle]. It's small, deterministic, and drives the "Hunter" enemies.
class Brain {
  constructor(inSize, hidSize, outSize, seed = 1) {
    this.inSize = inSize; this.hidSize = hidSize; this.outSize = outSize;
    const rand = mulberry32(seed);
    this.w1 = mat(hidSize, inSize, () => (rand() * 2 - 1));
    this.b1 = arr(hidSize, () => (rand() * 2 - 1) * 0.3);
    this.w2 = mat(outSize, hidSize, () => (rand() * 2 - 1));
    this.b2 = arr(outSize, () => (rand() * 2 - 1) * 0.2);
  }
  forward(x) {
    const h = arr(this.hidSize, 0);
    for (let i = 0; i < this.hidSize; i++) {
      let s = this.b1[i];
      for (let j = 0; j < this.inSize; j++) s += this.w1[i][j] * x[j];
      h[i] = Math.tanh(s);
    }
    const o = arr(this.outSize, 0);
    for (let i = 0; i < this.outSize; i++) {
      let s = this.b2[i];
      for (let j = 0; j < this.hidSize; j++) s += this.w2[i][j] * h[j];
      o[i] = Math.tanh(s);
    }
    return o;
  }
}
function mat(r, c, f) { const m = []; for (let i = 0; i < r; i++) { const row = []; for (let j = 0; j < c; j++) row.push(f()); m.push(row); } return m; }
function arr(n, f) { const a = []; for (let i = 0; i < n; i++) a.push(typeof f === 'function' ? f() : f); return a; }
function mulberry32(a) { return function () { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- audio (WebAudio, no assets) ----------
class Sound {
  constructor() {
    this.ctx = null; this.muted = false;
    this.engineNode = null; this.engineGain = null;
  }
  ensure() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  beep(freq = 440, dur = 0.1, type = 'sine', vol = 0.2, slide = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur = 0.3, vol = 0.3, filterFreq = 800) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  }
  startEngine() {
    if (!this.ctx || this.engineNode) return;
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
    const o2 = this.ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 90;
    const g = this.ctx.createGain(); g.gain.value = 0;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    o1.connect(f); o2.connect(f); f.connect(g).connect(this.ctx.destination);
    o1.start(); o2.start();
    this.engineNode = { o1, o2, f }; this.engineGain = g;
  }
  setEngine(speed01) {
    if (!this.engineNode || this.muted) { if (this.engineGain) this.engineGain.gain.value = 0; return; }
    const n = this.engineNode;
    n.o1.frequency.value = 55 + speed01 * 140;
    n.o2.frequency.value = 82 + speed01 * 210;
    n.f.frequency.value = 400 + speed01 * 1400;
    this.engineGain.gain.value = 0.03 + speed01 * 0.05;
  }
  crash() { this.noise(0.5, 0.4, 1200); this.beep(120, 0.4, 'sawtooth', 0.3, -80); }
  coin() { this.beep(880, 0.08, 'square', 0.15); setTimeout(() => this.beep(1320, 0.1, 'square', 0.15), 60); }
  boostStart() { this.beep(220, 0.15, 'sawtooth', 0.15, 400); }
  wave() { this.beep(440, 0.15, 'square', 0.2); setTimeout(() => this.beep(660, 0.15, 'square', 0.2), 120); setTimeout(() => this.beep(880, 0.25, 'square', 0.2), 240); }
  hit() { this.noise(0.2, 0.3, 600); }
}

// ---------- game constants ----------
const LANE_WIDTH = 4;
const NUM_LANES = 5;
const ROAD_WIDTH = LANE_WIDTH * NUM_LANES;
const ROAD_HALF = ROAD_WIDTH / 2;
const SEGMENT_LEN = 40;      // road segments along z
const NUM_SEGMENTS = 40;     // total segments visible/recycled
const DRAW_DIST = SEGMENT_LEN * NUM_SEGMENTS;
const laneX = (i) => -ROAD_HALF + LANE_WIDTH / 2 + i * LANE_WIDTH;

// ---------- car factory ----------
function makeCarMesh(bodyColor, accentColor, isPlayer = false) {
  const g = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(1.8, 0.55, 3.6);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor, metalness: 0.6, roughness: 0.35,
    emissive: bodyColor, emissiveIntensity: 0.05
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);

  // Cabin (trapezoid using scaled box)
  const cabGeo = new THREE.BoxGeometry(1.5, 0.5, 1.6);
  const cabMat = new THREE.MeshStandardMaterial({
    color: 0x0a1224, metalness: 0.9, roughness: 0.1,
    emissive: accentColor, emissiveIntensity: 0.15
  });
  const cabin = new THREE.Mesh(cabGeo, cabMat);
  cabin.position.set(0, 1.0, -0.1);
  cabin.castShadow = true;
  g.add(cabin);

  // Neon underglow
  const glowGeo = new THREE.PlaneGeometry(2.2, 4.0);
  const glowMat = new THREE.MeshBasicMaterial({
    color: accentColor, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;
  g.add(glow);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111, roughness: 0.8 });
  const wheelPos = [[-0.85, 0.35, 1.2], [0.85, 0.35, 1.2], [-0.85, 0.35, -1.2], [0.85, 0.35, -1.2]];
  const wheels = [];
  for (const p of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(...p);
    w.castShadow = true;
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;

  // Headlights (front - -z is forward)
  const hlGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
  const hl1 = new THREE.Mesh(hlGeo, hlMat); hl1.position.set(-0.6, 0.6, -1.8); g.add(hl1);
  const hl2 = new THREE.Mesh(hlGeo, hlMat); hl2.position.set(0.6, 0.6, -1.8); g.add(hl2);

  // Taillights
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
  const tl1 = new THREE.Mesh(hlGeo, tlMat); tl1.position.set(-0.6, 0.6, 1.8); g.add(tl1);
  const tl2 = new THREE.Mesh(hlGeo, tlMat); tl2.position.set(0.6, 0.6, 1.8); g.add(tl2);
  g.userData.tail = [tl1, tl2];

  if (isPlayer) {
    // Actual light for the player
    const spot = new THREE.SpotLight(0xffe6b0, 3, 40, Math.PI / 5, 0.4, 1);
    spot.position.set(0, 1.2, -1.5);
    spot.target.position.set(0, 0, -20);
    g.add(spot); g.add(spot.target);
  }

  return g;
}

// ---------- Game ----------
class Game {
  constructor(root) {
    this.root = root;
    this.state = 'menu'; // 'menu' | 'playing' | 'paused' | 'gameover'
    this.sound = new Sound();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x05060d);
    root.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x05060d, 60, DRAW_DIST * 0.7);

    // Camera
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.cameraMode = 0; // 0 chase, 1 cockpit, 2 cinematic
    this.cameraModes = ['CHASE', 'COCKPIT', 'CINEMATIC'];

    this._buildWorld();
    this._buildPlayer();

    // Input
    this.keys = {};
    this._bindInput();

    // Game vars
    this.reset();

    // Resize
    window.addEventListener('resize', () => this._onResize());

    // Loop
    this.clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _buildWorld() {
    // Lights
    this.scene.add(new THREE.AmbientLight(0x223355, 0.5));
    const hemi = new THREE.HemisphereLight(0x4477ff, 0x220033, 0.4);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xaaccff, 0.6);
    dir.position.set(40, 80, 40);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -60; dir.shadow.camera.right = 60;
    dir.shadow.camera.top = 60; dir.shadow.camera.bottom = -60;
    dir.shadow.camera.near = 1; dir.shadow.camera.far = 200;
    this.scene.add(dir);
    this.sunLight = dir;

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < 800; i++) {
      const r = 800 + Math.random() * 400;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos.push(r * Math.sin(ph) * Math.cos(th), Math.abs(r * Math.cos(ph)) * 0.4 + 100, r * Math.sin(ph) * Math.sin(th));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x99bbff, size: 2, sizeAttenuation: false }));
    this.scene.add(stars);

    // Distant mountain silhouette (procedural)
    const mtnGeo = new THREE.PlaneGeometry(2000, 200, 60, 1);
    const pos = mtnGeo.attributes.position;
    for (let i = 0; i <= 60; i++) {
      const h = Math.sin(i * 0.6) * 40 + Math.sin(i * 1.9) * 20 + Math.random() * 15;
      pos.setY(i, h);
      pos.setY(60 + 1 + i, -80);
    }
    pos.needsUpdate = true;
    const mtnMat = new THREE.MeshBasicMaterial({ color: 0x1a1440, side: THREE.DoubleSide, fog: false });
    const mtnFront = new THREE.Mesh(mtnGeo, mtnMat); mtnFront.position.set(0, 0, -700); this.scene.add(mtnFront);
    const mtnBack = new THREE.Mesh(mtnGeo, mtnMat); mtnBack.position.set(0, 0, 700); mtnBack.rotation.y = Math.PI; this.scene.add(mtnBack);

    // Road segments (recycled)
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);
    this.segments = [];
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x0a0d18, roughness: 0.9, metalness: 0.1 });
    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x181428, roughness: 1 });
    const stripeMatWhite = new THREE.MeshBasicMaterial({ color: 0xf0f0ff });
    const stripeMatDash = new THREE.MeshBasicMaterial({ color: 0xf0f0ff });
    const neonMatCyan = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const neonMatMag = new THREE.MeshBasicMaterial({ color: 0xff00c8 });

    for (let s = 0; s < NUM_SEGMENTS; s++) {
      const seg = new THREE.Group();

      const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LEN), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.receiveShadow = true;
      seg.add(road);

      // shoulders
      for (const sx of [-1, 1]) {
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(6, SEGMENT_LEN), shoulderMat);
        sh.rotation.x = -Math.PI / 2;
        sh.position.set(sx * (ROAD_HALF + 3), 0.01, 0);
        seg.add(sh);
      }

      // solid edge stripes
      for (const sx of [-1, 1]) {
        const st = new THREE.Mesh(new THREE.PlaneGeometry(0.2, SEGMENT_LEN), stripeMatWhite);
        st.rotation.x = -Math.PI / 2;
        st.position.set(sx * ROAD_HALF, 0.02, 0);
        seg.add(st);
      }

      // dashed lane dividers
      for (let l = 1; l < NUM_LANES; l++) {
        const x = -ROAD_HALF + l * LANE_WIDTH;
        const dashCount = 5;
        for (let d = 0; d < dashCount; d++) {
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, SEGMENT_LEN / (dashCount * 2)), stripeMatDash);
          dash.rotation.x = -Math.PI / 2;
          const zOff = -SEGMENT_LEN / 2 + (d + 0.25) * (SEGMENT_LEN / dashCount);
          dash.position.set(x, 0.02, zOff);
          seg.add(dash);
        }
      }

      // Neon guard rails (long thin boxes)
      const railGeoC = new THREE.BoxGeometry(0.2, 0.15, SEGMENT_LEN);
      const railGeoM = new THREE.BoxGeometry(0.2, 0.15, SEGMENT_LEN);
      const railL = new THREE.Mesh(railGeoC, neonMatCyan);
      railL.position.set(-ROAD_HALF - 5.9, 0.5, 0);
      seg.add(railL);
      const railR = new THREE.Mesh(railGeoM, neonMatMag);
      railR.position.set(ROAD_HALF + 5.9, 0.5, 0);
      seg.add(railR);

      // Vertical light posts, alternating cyan/magenta
      for (let p = 0; p < 3; p++) {
        const zOff = -SEGMENT_LEN / 2 + (p + 0.5) * (SEGMENT_LEN / 3);
        const postGeo = new THREE.BoxGeometry(0.15, 3, 0.15);
        const useCyan = (s + p) % 2 === 0;
        const mat = useCyan ? neonMatCyan : neonMatMag;
        const postL = new THREE.Mesh(postGeo, mat);
        postL.position.set(-ROAD_HALF - 5.9, 1.5, zOff);
        seg.add(postL);
        const postR = new THREE.Mesh(postGeo, useCyan ? neonMatMag : neonMatCyan);
        postR.position.set(ROAD_HALF + 5.9, 1.5, zOff);
        seg.add(postR);
      }

      seg.position.z = -s * SEGMENT_LEN;
      this.roadGroup.add(seg);
      this.segments.push(seg);
    }

    // Obstacles / traffic / pickups pool
    this.traffic = [];
    this.hunters = [];
    this.pickups = [];
    this.explosions = [];

    // hunter brain (deterministic)
    this.hunterBrain = new Brain(4, 8, 2, 42);
  }

  _buildPlayer() {
    this.player = makeCarMesh(0x00e0ff, 0x00e0ff, true);
    this.scene.add(this.player);

    // trail particles for boost
    const trailGeo = new THREE.BufferGeometry();
    const trailCount = 60;
    const positions = new Float32Array(trailCount * 3);
    const alphas = new Float32Array(trailCount);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trailGeo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    const trailMat = new THREE.PointsMaterial({
      color: 0xff00d0, size: 1.2, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.trail = new THREE.Points(trailGeo, trailMat);
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);
    this.trailIdx = 0;
    this.trailCount = trailCount;
  }

  _bindInput() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (k === 'c' && this.state === 'playing') {
        this.cameraMode = (this.cameraMode + 1) % 3;
        this._popup('CAMERA: ' + this.cameraModes[this.cameraMode], '#7fb8ff');
      }
      if (k === 'm') {
        this.sound.muted = !this.sound.muted;
        this._popup(this.sound.muted ? 'MUTED' : 'SOUND ON', '#7fb8ff');
      }
      if (k === 'p' && (this.state === 'playing' || this.state === 'paused')) {
        this.togglePause();
      }
      if (k === 'shift' && this.state === 'playing' && this.boost > 0.1) {
        if (!this.boosting) this.sound.boostStart();
        this.boosting = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = false;
      if (k === 'shift') this.boosting = false;
    });
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  reset() {
    // clear traffic
    for (const t of this.traffic) this.scene.remove(t.mesh);
    for (const h of this.hunters) this.scene.remove(h.mesh);
    for (const p of this.pickups) this.scene.remove(p.mesh);
    for (const ex of this.explosions) this.scene.remove(ex.mesh);
    this.traffic = []; this.hunters = []; this.pickups = []; this.explosions = [];

    // player state
    this.player.position.set(0, 0, 0);
    this.player.rotation.set(0, 0, 0);
    this.px = 0; this.pz = 0; this.pv = 0; // velocity along z (negative = forward)
    this.plateralV = 0;
    this.pheading = 0; // yaw
    this.playerRoll = 0;

    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.distance = 0;
    this.wave = 1;
    this.waveTimer = 0;
    this.waveDuration = 22; // seconds per wave
    this.lives = 3;
    this.invuln = 0;
    this.boost = 1; // 0..1
    this.boosting = false;
    this.baseSpeedMax = 45; // m/s ~ 162 km/h
    this.spawnTimer = 0;
    this.pickupTimer = 0;
    this.hunterSpawned = 0;

    this.roadOffset = 0;

    this._updateHUD();
    this._updateLives();
  }

  start() {
    this.reset();
    this.state = 'playing';
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.sound.ensure(); this.sound.resume(); this.sound.startEngine();
    this._popup('WAVE 1', '#00e0ff');
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      document.getElementById('pauseScreen').classList.remove('hidden');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      document.getElementById('pauseScreen').classList.add('hidden');
    }
  }

  gameOver() {
    this.state = 'gameover';
    const best = Math.max(parseInt(store.get('neonrush_best', '0'), 10) || 0, Math.floor(this.score));
    store.set('neonrush_best', String(best));
    document.getElementById('goScore').textContent = Math.floor(this.score);
    document.getElementById('goBest').textContent = best;
    document.getElementById('goWave').textContent = this.wave;
    document.getElementById('goDist').textContent = Math.floor(this.distance) + ' m';
    document.getElementById('gameOver').classList.remove('hidden');
    this.sound.crash();
    this.sound.setEngine(0);
  }

  backToMenu() {
    this.state = 'menu';
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
    this.sound.setEngine(0);
  }

  // ---------- entity spawning ----------
  _spawnTraffic() {
    const lane = Math.floor(Math.random() * NUM_LANES);
    const speed = 15 + Math.random() * 15 + this.wave * 2; // slower than player usually
    const colors = [0xff3355, 0x33ff88, 0xffcc33, 0x8844ff, 0xff8833, 0x33ccff];
    const c = colors[Math.floor(Math.random() * colors.length)];
    const mesh = makeCarMesh(c, c);
    mesh.rotation.y = Math.PI; // face same direction as player (forward = -z), taillights face player
    mesh.position.set(laneX(lane), 0, this.pz - 200 - Math.random() * 80);
    this.scene.add(mesh);
    // seenAhead flips true once traffic is actually in front of player (z < pz)
    this.traffic.push({ mesh, lane, speed, hp: 1, seenAhead: false });
  }

  _spawnOncoming() {
    // Occasional oncoming (from far in front, faster) - later waves only
    if (this.wave < 3) return;
    const lane = Math.floor(Math.random() * 2); // outer left lanes
    const speed = 40 + Math.random() * 15 + this.wave * 2; // approach player fast
    const mesh = makeCarMesh(0xffaa22, 0xff5522);
    // oncoming faces player: headlights toward player (+z)
    mesh.rotation.y = 0;
    mesh.position.set(laneX(lane), 0, this.pz - 400);
    this.scene.add(mesh);
    this.traffic.push({ mesh, lane, speed, hp: 1, oncoming: true, seenAhead: true });
  }

  _spawnHunter() {
    const lane = Math.floor(Math.random() * NUM_LANES);
    const mesh = makeCarMesh(0xff0044, 0xff00aa);
    mesh.rotation.y = Math.PI;
    mesh.position.set(laneX(lane), 0, this.pz - 120);
    // pulsing scale
    this.scene.add(mesh);
    this.hunters.push({
      mesh, lane, speed: 30 + this.wave * 2, hp: 2,
      lateralV: 0, phase: Math.random() * Math.PI * 2
    });
    this._popup('HUNTER INBOUND', '#ff3366');
    this.sound.beep(200, 0.4, 'sawtooth', 0.25, -60);
  }

  _spawnPickup() {
    const lane = Math.floor(Math.random() * NUM_LANES);
    const geo = new THREE.OctahedronGeometry(0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffcf3f });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(laneX(lane), 1.2, this.pz - 150 - Math.random() * 100);
    // add glow sprite
    const glowGeo = new THREE.SphereGeometry(1.2, 12, 12);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffcf3f, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    mesh.add(glow);
    this.scene.add(mesh);
    this.pickups.push({ mesh, lane, type: 'coin' });
  }

  _spawnBoostPickup() {
    const lane = Math.floor(Math.random() * NUM_LANES);
    const geo = new THREE.ConeGeometry(0.5, 1.2, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI;
    mesh.position.set(laneX(lane), 1.2, this.pz - 180 - Math.random() * 100);
    const glowGeo = new THREE.SphereGeometry(1.4, 12, 12);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    mesh.add(new THREE.Mesh(glowGeo, glowMat));
    this.scene.add(mesh);
    this.pickups.push({ mesh, lane, type: 'boost' });
  }

  _explosion(x, y, z, color = 0xff5522) {
    const count = 30;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
      vels.push([
        (Math.random() - 0.5) * 20,
        Math.random() * 15 + 2,
        (Math.random() - 0.5) * 20
      ]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.6, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.explosions.push({ mesh: pts, vels, life: 0, maxLife: 1.2 });
  }

  // ---------- HUD ----------
  _updateHUD() {
    document.getElementById('score').textContent = Math.floor(this.score);
    const kmh = Math.floor(Math.abs(this.pv) * 3.6);
    document.getElementById('speed').innerHTML = kmh + '<span class="unit">km/h</span>';
    document.getElementById('wave').textContent = this.wave;
    document.getElementById('combo').textContent = 'x' + this.combo;
    document.getElementById('best').textContent = parseInt(store.get('neonrush_best', '0'), 10) || 0;
    document.getElementById('boost-bar').style.width = (this.boost * 100).toFixed(0) + '%';
  }
  _updateLives() {
    const el = document.getElementById('lives');
    el.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('div');
      d.className = 'life' + (i < this.lives ? '' : ' lost');
      el.appendChild(d);
    }
  }
  _popup(text, color = '#00e0ff') {
    const p = document.getElementById('popup');
    p.textContent = text;
    p.style.color = color;
    p.classList.add('show');
    clearTimeout(this._popupT);
    this._popupT = setTimeout(() => p.classList.remove('show'), 1000);
  }

  // ---------- main loop ----------
  _loop() {
    requestAnimationFrame(this._loop);
    let dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.state === 'playing') this._update(dt);
    this._render(dt);
  }

  _update(dt) {
    // ---- player physics ----
    const accel = 30;
    const brakeAccel = 60;
    const friction = 4;
    const steerRate = 2.4; // rad/s at low speed
    const speedMax = this.baseSpeedMax + this.wave * 2.5;
    const boostFactor = (this.boosting && this.boost > 0) ? 1.55 : 1;

    let throttle = 0;
    if (this.keys['w'] || this.keys['arrowup']) throttle = 1;
    if (this.keys['s'] || this.keys['arrowdown']) throttle = -1;

    let steer = 0;
    if (this.keys['a'] || this.keys['arrowleft']) steer += 1;
    if (this.keys['d'] || this.keys['arrowright']) steer -= 1;

    // apply throttle: pv is forward speed (positive = forward). Player moves toward -z.
    if (throttle > 0) this.pv += accel * dt;
    else if (throttle < 0) this.pv -= brakeAccel * dt;
    else this.pv -= Math.sign(this.pv) * Math.min(Math.abs(this.pv), friction * dt);

    const effMax = speedMax * boostFactor;
    if (this.pv > effMax) this.pv = effMax;
    if (this.pv < -15) this.pv = -15;

    // boost drain / regen
    if (this.boosting && this.boost > 0 && this.pv > 5) {
      this.boost -= dt * 0.35;
      if (this.boost <= 0) { this.boost = 0; this.boosting = false; }
    } else {
      this.boost = Math.min(1, this.boost + dt * 0.06);
    }

    // steering scales with speed
    const speedFactor = Math.min(1, Math.abs(this.pv) / 20);
    this.pheading += steer * steerRate * dt * (0.4 + 0.6 * speedFactor);

    // Move
    const forwardZ = -Math.cos(this.pheading) * this.pv * dt;
    const forwardX = Math.sin(this.pheading) * this.pv * dt;
    this.px += forwardX;
    this.pz += forwardZ;

    // Roll (visual bank on turn)
    const targetRoll = -steer * 0.15 * speedFactor;
    this.playerRoll += (targetRoll - this.playerRoll) * Math.min(1, dt * 8);

    // Clamp within road (soft wall damage)
    const maxX = ROAD_HALF - 1;
    if (Math.abs(this.px) > maxX) {
      const over = Math.abs(this.px) - maxX;
      this.px = Math.sign(this.px) * maxX;
      // scrape
      if (over > 0.05 && this.invuln <= 0 && this.pv > 5) {
        this.sound.hit();
        this.score = Math.max(0, this.score - 5);
        this.combo = 1; this.comboTimer = 0;
      }
      // slow down when scraping
      this.pv *= 0.94;
    }

    this.player.position.set(this.px, 0, this.pz);
    this.player.rotation.set(0, this.pheading, this.playerRoll);

    // Wheel spin
    const wheelSpin = this.pv * dt * 3;
    for (const w of this.player.userData.wheels) w.rotation.x += wheelSpin;

    // Distance & score
    if (this.pv > 0) {
      const d = this.pv * dt;
      this.distance += d;
      this.score += d * 0.5 * this.combo * (this.boosting ? 1.5 : 1);
    }

    // Combo timer decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }

    if (this.invuln > 0) this.invuln -= dt;

    // ---- Wave progression ----
    this.waveTimer += dt;
    if (this.waveTimer >= this.waveDuration) {
      this.wave++;
      this.waveTimer = 0;
      this.hunterSpawned = 0;
      this._popup('WAVE ' + this.wave, '#00ffb0');
      this.sound.wave();
      // small bonus
      this.score += 200 * this.wave;
    }

    // ---- Spawning ----
    this.spawnTimer -= dt;
    const spawnInterval = Math.max(0.4, 1.4 - this.wave * 0.08);
    if (this.spawnTimer <= 0) {
      this._spawnTraffic();
      if (Math.random() < 0.25 + this.wave * 0.03) this._spawnOncoming();
      this.spawnTimer = spawnInterval * (0.7 + Math.random() * 0.6);
    }
    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      if (Math.random() < 0.7) this._spawnPickup();
      else this._spawnBoostPickup();
      this.pickupTimer = 1.5 + Math.random() * 1.5;
    }
    // Hunters: 1 in wave 2, 2 in wave 3+, +1 each wave up to 4
    const targetHunters = this.wave >= 2 ? Math.min(4, this.wave - 1) : 0;
    if (this.hunters.length < targetHunters && this.hunterSpawned < targetHunters) {
      this._spawnHunter();
      this.hunterSpawned++;
    }

    // ---- Update traffic ----
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const t = this.traffic[i];
      t.mesh.position.z += t.speed * dt; // moves in +z direction (toward player when player advances -z)
      // spin wheels
      for (const w of t.mesh.userData.wheels) w.rotation.x -= t.speed * dt * 0.5;

      // recycle if far behind
      if (t.mesh.position.z > this.pz + 60 || t.mesh.position.z < this.pz - 600) {
        this.scene.remove(t.mesh);
        this.traffic.splice(i, 1);
        continue;
      }

      // Collision AABB (car ~ 1.8 x 3.6)
      if (this.invuln <= 0 && this._collide(this.player.position, t.mesh.position, 1.5, 3.2)) {
        this._hit();
        this._explosion(t.mesh.position.x, 1, t.mesh.position.z, 0xff8844);
        this.scene.remove(t.mesh);
        this.traffic.splice(i, 1);
        continue;
      }

      // Overtake bonus: when traffic passes from front to behind player
      if (!t.seenAhead && t.mesh.position.z < this.pz - 5) t.seenAhead = true;
      if (t.seenAhead && !t.overtaken && t.mesh.position.z > this.pz + 5 && !t.oncoming) {
        t.overtaken = true;
        this.combo = Math.min(20, this.combo + 1);
        this.comboTimer = 3.0;
        this.score += 10 * this.combo;
        this._popup('+' + (10 * this.combo) + ' OVERTAKE x' + this.combo, '#7fffcf');
        this.sound.beep(600 + this.combo * 30, 0.08, 'square', 0.1);
      }
    }

    // ---- Update hunters (NN driven) ----
    for (let i = this.hunters.length - 1; i >= 0; i--) {
      const h = this.hunters[i];
      // NN inputs
      const dx = (this.px - h.mesh.position.x) / 20;
      const dz = (this.pz - h.mesh.position.z) / 40;
      const mySpd = h.speed / 60;
      const laneOff = h.mesh.position.x / ROAD_HALF;
      const out = this.hunterBrain.forward([dx, dz, mySpd, laneOff]);
      // steer output blended with direct pursuit for reliability
      const desiredX = this.px;
      const pursuitSteer = Math.tanh((desiredX - h.mesh.position.x) * 0.5);
      const steerCmd = pursuitSteer * 0.7 + out[0] * 0.3;
      h.lateralV += steerCmd * 25 * dt;
      h.lateralV *= 0.9;
      h.mesh.position.x += h.lateralV * dt;
      h.mesh.position.x = Math.max(-ROAD_HALF + 1, Math.min(ROAD_HALF - 1, h.mesh.position.x));

      // throttle: try to catch up
      const throttleOut = 0.5 + out[1] * 0.5;
      const desiredSpeed = (this.pv + 8) * throttleOut;
      h.speed += (desiredSpeed - h.speed) * dt * 1.5;
      h.mesh.position.z -= h.speed * dt; // hunter moves in -z (chasing player)
      // Actually player moves -z. If hunter follows player, hunter should also move -z, but relative to player, hunter must approach player. Player pz decreases, hunter needs pz to decrease faster... let me reconsider.
      // We flipped: traffic moves in +z relative to world (they're slower going forward, so appear to move backward relative to player who is faster). Hunter should be faster than player.
      // In world coords: player velocity vector = (0,0,-pv). Hunter velocity should be (0,0,-h.speed) with h.speed > pv when chasing.
      // We already did: h.mesh.position.z -= h.speed * dt — good.

      h.phase += dt * 5;
      // pulse emissive
      h.mesh.children[0].material.emissiveIntensity = 0.2 + Math.sin(h.phase) * 0.2;

      // wheels
      for (const w of h.mesh.userData.wheels) w.rotation.x -= h.speed * dt * 0.5;

      // recycle if too far behind
      if (h.mesh.position.z > this.pz + 80) {
        this.scene.remove(h.mesh);
        this.hunters.splice(i, 1);
        this.hunterSpawned = Math.max(0, this.hunterSpawned - 1);
        continue;
      }

      // collision
      if (this.invuln <= 0 && this._collide(this.player.position, h.mesh.position, 1.6, 3.2)) {
        this._hit(true);
        this._explosion(h.mesh.position.x, 1, h.mesh.position.z, 0xff2266);
        this.scene.remove(h.mesh);
        this.hunters.splice(i, 1);
        this.hunterSpawned = Math.max(0, this.hunterSpawned - 1);
        continue;
      }
    }

    // ---- Pickups ----
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.mesh.rotation.y += dt * 3;
      p.mesh.position.y = 1.2 + Math.sin(performance.now() * 0.004 + i) * 0.15;
      if (p.mesh.position.z > this.pz + 40) {
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
        continue;
      }
      if (this._collide(this.player.position, p.mesh.position, 1.2, 1.2)) {
        if (p.type === 'coin') {
          this.score += 50 * this.combo;
          this.combo = Math.min(20, this.combo + 1);
          this.comboTimer = 3.0;
          this._popup('+' + (50 * this.combo) + '  x' + this.combo, '#ffcf3f');
          this.sound.coin();
        } else {
          this.boost = Math.min(1, this.boost + 0.5);
          this._popup('BOOST +50%', '#00ffcc');
          this.sound.boostStart();
        }
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }

    // ---- Explosions ----
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life += dt;
      const pos = ex.mesh.geometry.attributes.position;
      for (let j = 0; j < ex.vels.length; j++) {
        ex.vels[j][1] -= 20 * dt;
        pos.array[j * 3] += ex.vels[j][0] * dt;
        pos.array[j * 3 + 1] += ex.vels[j][1] * dt;
        pos.array[j * 3 + 2] += ex.vels[j][2] * dt;
      }
      pos.needsUpdate = true;
      ex.mesh.material.opacity = 1 - ex.life / ex.maxLife;
      if (ex.life >= ex.maxLife) {
        this.scene.remove(ex.mesh);
        this.explosions.splice(i, 1);
      }
    }

    // ---- Trail particles ----
    if (this.boosting && this.pv > 5) {
      const pos = this.trail.geometry.attributes.position;
      pos.array[this.trailIdx * 3] = this.px + (Math.random() - 0.5) * 1.5;
      pos.array[this.trailIdx * 3 + 1] = 0.5;
      pos.array[this.trailIdx * 3 + 2] = this.pz + 2 + Math.random();
      pos.needsUpdate = true;
      this.trailIdx = (this.trailIdx + 1) % this.trailCount;
    }

    // ---- Road recycling ----
    // Segments at s=0 is nearest, but we spread from pz forward (into -z direction).
    // Actually we placed segments at z = -s * SEGMENT_LEN from origin. We need them to follow the player.
    for (const seg of this.segments) {
      // if segment is well behind player, move it forward by NUM_SEGMENTS*SEGMENT_LEN
      while (seg.position.z > this.pz + SEGMENT_LEN * 2) {
        seg.position.z -= NUM_SEGMENTS * SEGMENT_LEN;
      }
      while (seg.position.z < this.pz - (NUM_SEGMENTS - 2) * SEGMENT_LEN) {
        seg.position.z += NUM_SEGMENTS * SEGMENT_LEN;
      }
    }

    // ---- Engine audio ----
    this.sound.setEngine(Math.min(1, Math.abs(this.pv) / speedMax) * (this.boosting ? 1.2 : 1));

    // ---- Camera ----
    this._updateCamera(dt);

    this._updateHUD();
  }

  _collide(a, b, w, l) {
    return Math.abs(a.x - b.x) < w && Math.abs(a.z - b.z) < l;
  }

  _hit(heavy = false) {
    this.lives--;
    this.invuln = 1.5;
    this.combo = 1; this.comboTimer = 0;
    this.pv *= heavy ? 0.4 : 0.65;
    this.sound.crash();
    this._popup('CRASH!', '#ff3355');
    this._updateLives();
    if (this.lives <= 0) {
      this._explosion(this.px, 1, this.pz, 0xffaa22);
      this.gameOver();
    }
  }

  _updateCamera(dt) {
    const car = this.player;
    let targetPos = new THREE.Vector3();
    let targetLook = new THREE.Vector3();

    if (this.cameraMode === 0) {
      // Chase
      const back = new THREE.Vector3(0, 3.5, 9);
      back.applyEuler(new THREE.Euler(0, this.pheading, 0));
      targetPos.copy(car.position).add(back);
      targetLook.copy(car.position);
      targetLook.y += 1.2;
      // forward look-ahead
      targetLook.z -= 8 * Math.cos(this.pheading);
      targetLook.x += 8 * Math.sin(this.pheading);
    } else if (this.cameraMode === 1) {
      // Cockpit
      const off = new THREE.Vector3(0, 1.05, -0.3);
      off.applyEuler(new THREE.Euler(0, this.pheading, 0));
      targetPos.copy(car.position).add(off);
      const look = new THREE.Vector3(0, 1.05, -12);
      look.applyEuler(new THREE.Euler(0, this.pheading, 0));
      targetLook.copy(car.position).add(look);
    } else {
      // Cinematic side-swoop
      const t = performance.now() * 0.0004;
      const off = new THREE.Vector3(Math.sin(t) * 8, 2.5 + Math.sin(t * 0.7) * 1.5, 5 + Math.cos(t) * 4);
      off.applyEuler(new THREE.Euler(0, this.pheading, 0));
      targetPos.copy(car.position).add(off);
      targetLook.copy(car.position); targetLook.y += 0.8;
    }

    // shake on invuln
    if (this.invuln > 0.8) {
      const s = (this.invuln - 0.8) * 0.5;
      targetPos.x += (Math.random() - 0.5) * s;
      targetPos.y += (Math.random() - 0.5) * s;
    }

    // FOV kick on boost
    const targetFov = 72 + (this.boosting && this.pv > 5 ? 14 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 6);
    this.camera.updateProjectionMatrix();

    // smooth
    const lerp = Math.min(1, dt * 8);
    this.camera.position.lerp(targetPos, lerp);
    const currentLook = new THREE.Vector3();
    this.camera.getWorldDirection(currentLook);
    // lookAt with smoothing via computing target quat
    const m = new THREE.Matrix4().lookAt(this.camera.position, targetLook, new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    this.camera.quaternion.slerp(q, lerp);
  }

  _render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// ---------- boot ----------
const root = document.getElementById('game-root');
const game = new Game(root);

document.getElementById('startBtn').addEventListener('click', () => game.start());
document.getElementById('restartBtn').addEventListener('click', () => game.start());
document.getElementById('menuBtn').addEventListener('click', () => game.backToMenu());
document.getElementById('resumeBtn').addEventListener('click', () => game.togglePause());
document.getElementById('pauseMenuBtn').addEventListener('click', () => { game.togglePause(); game.backToMenu(); });

// show best on menu
document.getElementById('best').textContent = parseInt(store.get('neonrush_best', '0'), 10) || 0;
