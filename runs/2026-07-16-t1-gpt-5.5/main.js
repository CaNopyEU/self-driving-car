(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const keys = Object.create(null);
  const lanes = [-0.32, -0.1, 0.12, 0.34];
  let W = 0;
  let H = 0;
  let roadX = 0;
  let roadW = 0;
  let last = performance.now();
  let audio;
  let engine;
  let state = "start";
  let player = null;
  let cars = [];
  let pickups = [];
  let score = 0;
  let speed = 270;
  let spawn = 0;
  let pickupSpawn = 0;
  let shake = 0;
  let flash = 0;
  let shield = 0;
  let hitTimer = 0;

  function safeStorageProbe() {
    try {
      localStorage.getItem("leanArcadeBest");
      sessionStorage.getItem("leanArcadeRun");
      document.cookie;
    } catch (_) {}
  }

  function resize() {
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
    roadW = Math.min(W * 0.76, 520);
    roadX = (W - roadW) / 2;
    if (player) player.y = H - 105;
  }

  function startAudio() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    if (!engine) {
      engine = audio.createOscillator();
      const gain = audio.createGain();
      engine.type = "sawtooth";
      engine.frequency.value = 70;
      gain.gain.value = 0.035;
      engine.connect(gain).connect(audio.destination);
      engine.start();
    }
  }

  function beep(freq, dur, type, vol) {
    if (!audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + dur);
  }

  function reset() {
    player = { x: roadX + roadW / 2, y: H - 105, w: 34, h: 56, vx: 0 };
    cars = [];
    pickups = [];
    score = 0;
    speed = 270;
    spawn = 0;
    pickupSpawn = 4;
    shake = 0;
    flash = 0;
    shield = 0;
    hitTimer = 0;
    state = "play";
    for (let i = 0; i < 5; i++) spawnCar(-i * 145 - 80);
  }

  function spawnCar(y) {
    const lane = lanes[(Math.random() * lanes.length) | 0];
    cars.push({ x: roadX + roadW * (0.5 + lane), y: y == null ? -80 : y, w: 36, h: 58, c: `hsl(${Math.random() * 360},70%,55%)` });
  }

  function spawnPickup() {
    const lane = lanes[(Math.random() * lanes.length) | 0];
    pickups.push({ x: roadX + roadW * (0.5 + lane), y: -50, r: 14 });
  }

  function box(a, b) {
    return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
  }

  function update(dt) {
    if (state !== "play") {
      if (state === "over" && hitTimer > 0) hitTimer -= dt;
      shake = Math.max(0, shake - dt * 25);
      flash = Math.max(0, flash - dt * 2.5);
      return;
    }

    score += dt * speed * (shield > 0 ? 0.03 : 0.02);
    speed = 270 + Math.min(260, score * 1.8);
    if (engine) engine.frequency.value = 55 + speed * 0.13;
    const steer = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
    player.vx += steer * 1500 * dt;
    player.vx *= Math.pow(0.001, dt);
    player.x += player.vx * dt;
    player.x = Math.max(roadX + 28, Math.min(roadX + roadW - 28, player.x));
    shield = Math.max(0, shield - dt);

    const trafficSpeed = speed * (1.05 + Math.min(0.55, score / 900));
    for (const car of cars) car.y += trafficSpeed * dt;
    for (const p of pickups) p.y += speed * dt;
    cars = cars.filter(c => c.y < H + 90);
    pickups = pickups.filter(p => p.y < H + 40);

    spawn -= dt;
    const interval = Math.max(0.34, 0.9 - score / 900);
    while (spawn <= 0) {
      spawnCar();
      spawn += interval;
    }
    pickupSpawn -= dt;
    if (pickupSpawn <= 0) {
      spawnPickup();
      pickupSpawn = 8 + Math.random() * 4;
    }

    for (const p of pickups) {
      if (Math.hypot(player.x - p.x, player.y - p.y) < 36) {
        p.y = H + 99;
        shield = 6;
        beep(720, 0.14, "sine", 0.12);
      }
    }
    for (const car of cars) {
      if (box(player, car)) {
        if (shield > 0) {
          car.y = H + 99;
          shield = Math.max(0, shield - 1.5);
          beep(180, 0.1, "triangle", 0.12);
        } else {
          state = "over";
          shake = 16;
          flash = 1;
          hitTimer = 0.55;
          beep(80, 0.45, "sawtooth", 0.2);
        }
      }
    }
  }

  function carShape(o, color) {
    ctx.fillStyle = color;
    ctx.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
    ctx.fillStyle = "#111827";
    ctx.fillRect(o.x - o.w / 2 + 5, o.y - o.h / 2 + 8, o.w - 10, 13);
    ctx.fillRect(o.x - o.w / 2 + 5, o.y + o.h / 2 - 20, o.w - 10, 10);
  }

  function drawText(title, lines) {
    ctx.fillStyle = "rgba(5,8,13,.78)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "700 42px Arial";
    ctx.fillText(title, W / 2, H * 0.34);
    ctx.font = "20px Arial";
    lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.44 + i * 32));
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.fillStyle = "#14351f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#333842";
    ctx.fillRect(roadX, 0, roadW, H);
    ctx.fillStyle = "#22262e";
    ctx.fillRect(roadX + 8, 0, roadW - 16, H);
    ctx.strokeStyle = "#f7f7d4";
    ctx.lineWidth = 4;
    ctx.setLineDash([28, 28]);
    const off = (score * 2) % 56;
    for (let i = 1; i < 4; i++) {
      const x = roadX + (roadW * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x, -56 + off);
      ctx.lineTo(x, H + 56 + off);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const p of pickups) {
      ctx.fillStyle = "#49f6ff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#073642";
      ctx.font = "700 18px Arial";
      ctx.textAlign = "center";
      ctx.fillText("S", p.x, p.y + 6);
    }
    cars.forEach(c => carShape(c, c.c));
    if (player) {
      carShape(player, shield > 0 ? "#4fffb0" : "#4b8dff");
      if (shield > 0) {
        ctx.strokeStyle = "#78faff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 40, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,90,30,${flash * 0.55})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffdd55";
      ctx.beginPath();
      ctx.arc(player.x, player.y, 22 + flash * 55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "700 22px Arial";
    ctx.fillText(`Score: ${Math.floor(score || 0)}`, 18, 34);
    if (state === "play" && shield > 0) ctx.fillText(`Shield: ${shield.toFixed(1)}s`, 18, 64);
    if (state === "start") drawText("Lean Arcade Highway", ["Arrow keys or A/D to steer", "Dodge traffic. Collect S for a brief shield.", "Press any key or click to start"]);
    if (state === "over") drawText("Crash!", [`Final score: ${Math.floor(score)}`, hitTimer > 0 ? "Boom!" : "Press any key or click to restart"]);
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function inputStart() {
    startAudio();
    if (state === "start" || (state === "over" && hitTimer <= 0)) reset();
  }

  addEventListener("resize", resize);
  addEventListener("keydown", e => {
    keys[e.key] = true;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "w", "s", " "].includes(e.key)) e.preventDefault();
    inputStart();
  });
  addEventListener("keyup", e => { keys[e.key] = false; });
  addEventListener("pointerdown", inputStart);

  safeStorageProbe();
  resize();
  requestAnimationFrame(loop);
})();
