(function(){
'use strict';

const ss = (() => {
  try {
    if (typeof localStorage === 'undefined') throw 1;
    localStorage.getItem('_t');
    return localStorage;
  } catch(e) {
    return { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} };
  }
})();

let ctx = null;
try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}

function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

let engineOsc = null, engineGain = null, engineLFO = null;

function startEngine() {
  if (!ctx || engineOsc) return;
  engineOsc = ctx.createOscillator();
  engineGain = ctx.createGain();
  engineLFO = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 80;
  engineLFO.type = 'sine';
  engineLFO.frequency.value = 8;
  lfoGain.gain.value = 15;
  engineLFO.connect(lfoGain);
  lfoGain.connect(engineOsc.frequency);
  engineGain.gain.value = 0.08;
  engineOsc.connect(engineGain);
  engineGain.connect(ctx.destination);
  engineOsc.start();
  engineLFO.start();
}

function stopEngine() {
  if (engineOsc) { try { engineOsc.stop(); } catch(e) {} engineOsc = null; }
  if (engineLFO) { try { engineLFO.stop(); } catch(e) {} engineLFO = null; }
  engineGain = null;
}

function playCrash() {
  if (!ctx) return;
  const bufferSize = ctx.sampleRate * 0.3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 0.3;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
}

function playPowerUp() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

function playScore() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 600;
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

const LANES = [-3, 0, 3];
let scene, camera, renderer;
let player, playerBody;
let traffic = [];
let roadDashes = [];
let powerUp = null;
let particles = [];

let state = 'START';
let score = 0;
let highScore = parseInt(ss.getItem('hwyHighScore')) || 0;
let currentLane = 1;
let targetX = 0;
let difficulty = 1;
let shieldTime = 0;
let shakeTime = 0;
let elapsed = 0;
let spawnTimer = 0;
let spawnInterval = 1.5;
let baseSpeed = 6;
let scrollSpeed = 8;
const LANE_W = 3;
let highwayDistance = 0;
let lastScoreMilestone = 0;

const carColors = [0xff4444, 0xffaa00, 0x44ff44, 0xff44ff, 0x44aaff, 0xffff44];

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.Fog(0x87CEEB, 40, 100);

  const w = window.innerWidth, h = window.innerHeight;
  camera = new THREE.PerspectiveCamera(65, w/h, 0.1, 150);
  camera.position.set(0, 5, 9);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('game-container').appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0x404060);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x87CEEB, 0x444422, 0.6);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 15, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -20;
  dirLight.shadow.camera.right = 20;
  dirLight.shadow.camera.top = 20;
  dirLight.shadow.camera.bottom = -20;
  scene.add(dirLight);

  buildRoad();
  createPlayer();
  createRoadDashes();

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  animate();
}

function buildRoad() {
  const roadGeo = new THREE.PlaneGeometry(12, 100);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x555555,
    roughness: 0.9,
    metalness: 0
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.01, -45);
  road.receiveShadow = true;
  scene.add(road);

  const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
  for (let x of [-6.5, 6.5]) {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(2, 100), shoulderMat);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(x, -0.005, -45);
    scene.add(shoulder);
  }

  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.7 });
  for (let x of [-7.5, 7.5]) {
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 100), barrierMat);
    barrier.position.set(x, 0.4, -45);
    barrier.castShadow = true;
    scene.add(barrier);
  }
}

function createRoadDashes() {
  const dashGeo = new THREE.PlaneGeometry(0.2, 1.5);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let x of [-1.5, 1.5]) {
    for (let z = -90; z <= 5; z += 3) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.005, z);
      scene.add(dash);
      roadDashes.push(dash);
    }
  }
}

function createPlayer() {
  const geo = new THREE.BoxGeometry(1.4, 0.6, 2.4);
  const mat = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.4, metalness: 0.3 });
  player = new THREE.Mesh(geo, mat);
  player.position.set(0, 0.3, 0);
  player.castShadow = true;
  scene.add(player);

  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.25, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.6 })
  );
  windshield.position.set(0, 0.55, -0.7);
  player.add(windshield);

  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.15, 0.15),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 })
  );
  bumper.position.set(0, 0.05, 1.2);
  player.add(bumper);

  const shieldRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.1, 24),
    new THREE.MeshBasicMaterial({ color: 0xffdd00, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
  );
  shieldRing.rotation.x = -Math.PI / 2;
  shieldRing.position.y = 0.1;
  shieldRing.visible = false;
  shieldRing.name = 'shieldRing';
  player.add(shieldRing);

  playerBody = player;
}

function createTrafficCar(lane, z) {
  const color = carColors[Math.floor(Math.random() * carColors.length)];
  const w = 1.2 + Math.random() * 0.4;
  const h = 0.5 + Math.random() * 0.3;
  const d = 2.0 + Math.random() * 0.8;
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 });
  const car = new THREE.Mesh(geo, mat);
  car.position.set(LANES[lane], h/2, z);
  car.castShadow = true;
  car.receiveShadow = true;
  car.userData = { lane, speed: (2 + Math.random() * 1.5) * difficulty };
  scene.add(car);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.7, h * 0.4, d * 0.5),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 })
  );
  roof.position.set(0, h * 0.5, 0);
  car.add(roof);

  traffic.push(car);
  return car;
}

function spawnPowerUp() {
  if (powerUp) return;
  const geo = new THREE.SphereGeometry(0.6, 12, 12);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffdd00,
    emissive: 0xff8800,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.5
  });
  powerUp = new THREE.Mesh(geo, mat);
  const lane = Math.floor(Math.random() * 3);
  powerUp.position.set(LANES[lane], 1.0, -35 - Math.random() * 25);
  powerUp.userData = { lane };
  scene.add(powerUp);

  const glowGeo = new THREE.SphereGeometry(1.0, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.2
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.userData.isGlow = true;
  powerUp.add(glow);
}

function createExplosion(pos) {
  const count = 30;
  const colors = [0xff4400, 0xff8800, 0xffff00, 0xff0000];
  for (let i = 0; i < count; i++) {
    const size = 0.1 + Math.random() * 0.2;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      emissive: 0xff4400,
      emissiveIntensity: 0.3
    });
    const p = new THREE.Mesh(geo, mat);
    p.position.copy(pos);
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 2,
      (Math.random() - 0.5) * 2
    ).normalize();
    const speed = 2 + Math.random() * 4;
    p.userData = {
      vel: dir.multiplyScalar(speed),
      life: 0.5 + Math.random() * 0.5
    };
    scene.add(p);
    particles.push(p);
  }
}

function resetGame() {
  for (const t of traffic) scene.remove(t);
  traffic = [];
  if (powerUp) { scene.remove(powerUp); powerUp = null; }
  for (const p of particles) scene.remove(p);
  particles = [];
  if (player) player.position.x = 0;
  currentLane = 1;
  targetX = 0;
  score = 0;
  difficulty = 1;
  elapsed = 0;
  spawnTimer = 0;
  spawnInterval = 1.5;
  baseSpeed = 6;
  scrollSpeed = 8;
  highwayDistance = 0;
  shieldTime = 0;
  shakeTime = 0;
  lastScoreMilestone = 0;
  stopEngine();
}

function startGame() {
  resumeAudio();
  startEngine();
  resetGame();
  state = 'PLAYING';
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-over').style.display = 'none';
}

function gameOver() {
  state = 'GAME_OVER';
  stopEngine();
  if (score > highScore) {
    highScore = score;
    ss.setItem('hwyHighScore', '' + highScore);
  }
  playCrash();
  document.getElementById('final-score').textContent = score;
  document.getElementById('high-score').textContent = highScore;
  document.getElementById('game-over').style.display = 'flex';
}

function restartGame() {
  resetGame();
  state = 'PLAYING';
  startEngine();
  document.getElementById('game-over').style.display = 'none';
}

function movePlayerLeft() {
  if (state !== 'PLAYING') return;
  if (currentLane > 0) {
    currentLane--;
    targetX = LANES[currentLane];
  }
}

function movePlayerRight() {
  if (state !== 'PLAYING') return;
  if (currentLane < 2) {
    currentLane++;
    targetX = LANES[currentLane];
  }
}

function update(dt) {
  if (state !== 'PLAYING') return;

  const clampedDt = Math.min(dt, 0.05);
  elapsed += clampedDt;
  highwayDistance += scrollSpeed * clampedDt;
  score = Math.floor(highwayDistance / 2);

  if (score >= lastScoreMilestone + 100) {
    lastScoreMilestone += 100;
    playScore();
  }

  difficulty = 1 + elapsed * 0.04;
  if (difficulty > 3.5) difficulty = 3.5;
  baseSpeed = 6 + (difficulty - 1) * 3;
  scrollSpeed = 8 + (difficulty - 1) * 4;
  spawnInterval = Math.max(0.4, 1.5 - elapsed * 0.012);

  if (shieldTime > 0) shieldTime -= clampedDt;

  // Smooth lane movement
  const diff = targetX - player.position.x;
  player.position.x += diff * clampedDt * 8;
  if (Math.abs(diff) < 0.01) player.position.x = targetX;

  // Move road dashes
  const dashMove = scrollSpeed * clampedDt;
  for (const dash of roadDashes) {
    dash.position.z += dashMove;
    if (dash.position.z > 5) {
      dash.position.z -= 95;
    }
  }

  // Spawn traffic
  spawnTimer += clampedDt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    const lane = Math.floor(Math.random() * 3);
    const speed = (2 + Math.random() * 2) * difficulty;
    const car = createTrafficCar(lane, -50 - Math.random() * 20);
    car.userData.speed = speed;
  }

  // Move traffic
  for (let i = traffic.length - 1; i >= 0; i--) {
    const car = traffic[i];
    car.position.z += (car.userData.speed + scrollSpeed * 0.3) * clampedDt;
    if (car.position.z > 8) {
      scene.remove(car);
      traffic.splice(i, 1);
    }
  }

  // Collision detection
  const playerBox = new THREE.Box3().setFromObject(player);
  playerBox.expandByScalar(-0.2);
  for (let i = traffic.length - 1; i >= 0; i--) {
    const car = traffic[i];
    const carBox = new THREE.Box3().setFromObject(car);
    carBox.expandByScalar(-0.1);
    if (playerBox.intersectsBox(carBox)) {
      if (shieldTime > 0) {
        shieldTime = 0;
        scene.remove(car);
        traffic.splice(i, 1);
        createExplosion(car.position.clone());
        playPowerUp();
      } else {
        createExplosion(player.position.clone());
        shakeTime = 0.4;
        gameOver();
        return;
      }
    }
  }

  // Power-up
  if (powerUp) {
    powerUp.position.z += scrollSpeed * clampedDt;
    powerUp.rotation.x += clampedDt * 2;
    powerUp.rotation.y += clampedDt * 3;
    if (powerUp.position.z > 8) {
      scene.remove(powerUp);
      powerUp = null;
    } else {
      const pBox = new THREE.Box3().setFromObject(powerUp);
      if (playerBox.intersectsBox(pBox)) {
        shieldTime = 5;
        playPowerUp();
        scene.remove(powerUp);
        powerUp = null;
      }
    }
  }

  // Spawn power-up periodically
  if (!powerUp && Math.random() < clampedDt * 0.15) {
    spawnPowerUp();
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.userData.life -= clampedDt;
    if (p.userData.life <= 0) {
      scene.remove(p);
      particles.splice(i, 1);
      continue;
    }
    p.position.x += p.userData.vel.x * clampedDt;
    p.position.y += p.userData.vel.y * clampedDt;
    p.position.z += p.userData.vel.z * clampedDt;
    p.userData.vel.y -= 9.8 * clampedDt;
    const scale = p.userData.life;
    p.scale.set(scale, scale, scale);
  }

  // Screen shake
  if (shakeTime > 0) {
    shakeTime -= clampedDt;
    const intensity = shakeTime * 2;
    camera.position.x = (Math.random() - 0.5) * intensity;
    camera.position.y = 5 + (Math.random() - 0.5) * intensity * 0.5;
  } else {
    camera.position.x = 0;
    camera.position.y = 5;
  }

  // Shield visual
  const shieldRing = player.getObjectByName('shieldRing');
  if (shieldTime > 0) {
    shieldRing.visible = true;
    shieldRing.rotation.z += clampedDt * 3;
    shieldRing.material.opacity = 0.3 + Math.sin(elapsed * 6) * 0.15;
    player.material.emissive = new THREE.Color(0x4488ff);
    player.material.emissiveIntensity = 0.3;
    document.getElementById('shield-indicator').style.display = 'block';
    document.getElementById('shield-indicator').textContent = 'SHIELD: ' + shieldTime.toFixed(1) + 's';
  } else {
    shieldRing.visible = false;
    player.material.emissive = new THREE.Color(0x000000);
    player.material.emissiveIntensity = 0;
    document.getElementById('shield-indicator').style.display = 'none';
  }

  // Update score HUD
  document.getElementById('score').textContent = score;
}

function animate(time) {
  requestAnimationFrame(animate);
  const dt = time ? Math.min((time - (lastTime || time)) / 1000, 0.05) : 0.016;
  lastTime = time;

  if (state === 'PLAYING') {
    update(dt);
  }

  camera.position.z = 9;
  camera.lookAt(0, 0.5, -5);

  if (player && state === 'PLAYING') {
    player.rotation.y = (targetX - player.position.x) * 0.15;
  }

  renderer.render(scene, camera);
}

let lastTime = 0;

document.addEventListener('keydown', (e) => {
  if (state === 'START') {
    if (e.key === ' ' || e.key === 'Enter' || (e.key >= 'ArrowLeft' && e.key <= 'ArrowDown')) {
      e.preventDefault();
      startGame();
      return;
    }
  }
  if (state === 'GAME_OVER') {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      restartGame();
      return;
    }
  }
  if (state === 'PLAYING') {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') movePlayerLeft();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') movePlayerRight();
  }
});

document.addEventListener('click', (e) => {
  if (state === 'START') { startGame(); return; }
});

document.getElementById('restart-btn').addEventListener('click', (e) => { e.stopPropagation(); restartGame(); });

document.getElementById('start-btn').addEventListener('click', (e) => { e.stopPropagation(); startGame(); });

init();
})();
