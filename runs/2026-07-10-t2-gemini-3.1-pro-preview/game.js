import * as THREE from 'three';

// --- State ---
let scene, camera, renderer;
let carGroup;
let obstacles = [];
let gridHelper;
let speed = 0;
let baseSpeed = 1.0;
let gameState = 'start'; // start, playing, gameover
let score = 0;
let hiScore = 0;
let level = 1;
let distance = 0;
let lanes = [-15, -5, 5, 15]; // 4 lanes
let lastObstacleZ = 0;
let time = 0;

// Input
const keys = { left: false, right: false };

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreEl = document.getElementById('score');
const hiScoreEl = document.getElementById('hi-score');
const finalScoreEl = document.getElementById('final-score');
const levelEl = document.getElementById('level');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// --- Initialization ---
function init() {
    // Load high score
    try {
        const savedHi = localStorage.getItem('neonHighwayHiScore');
        if (savedHi) hiScore = parseInt(savedHi, 10);
        hiScoreEl.innerText = hiScore;
    } catch (e) {
        console.warn("Storage access restricted. High score won't persist.");
    }

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.FogExp2(0x050510, 0.008);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 30); // Chase cam
    camera.lookAt(0, 0, -20);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // optimize
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffaaee, 1);
    dirLight.position.set(0, 50, -50);
    scene.add(dirLight);

    // World / Grid
    gridHelper = new THREE.GridHelper(400, 100, 0xff00ff, 0x440088);
    gridHelper.position.y = -1;
    scene.add(gridHelper);
    
    // Add glowing road edges
    const edgeGeo = new THREE.BoxGeometry(1, 2, 400);
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.5 });
    const leftEdge = new THREE.Mesh(edgeGeo, edgeMat);
    leftEdge.position.set(-20, 0, -100);
    scene.add(leftEdge);
    const rightEdge = new THREE.Mesh(edgeGeo, edgeMat);
    rightEdge.position.set(20, 0, -100);
    scene.add(rightEdge);

    // Car
    createCar();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);

    // Start loop
    renderer.setAnimationLoop(animate);
}

function createCar() {
    carGroup = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(3, 1.5, 6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.75;
    carGroup.add(body);

    // Cockpit
    const glassGeo = new THREE.BoxGeometry(2.5, 1, 3);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 1.75, -0.5);
    carGroup.add(glass);

    // Neon Strips
    const stripGeo = new THREE.BoxGeometry(3.1, 0.2, 0.2);
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 1 });
    const backStrip = new THREE.Mesh(stripGeo, stripMat);
    backStrip.position.set(0, 0.5, 3.01);
    carGroup.add(backStrip);

    // Engine glow
    const pointLight = new THREE.PointLight(0x00ffff, 2, 20);
    pointLight.position.set(0, 1, 4);
    carGroup.add(pointLight);

    carGroup.position.set(0, -1, 0); // Ride on grid
    scene.add(carGroup);
}

function spawnObstacle(zPos) {
    const geo = new THREE.BoxGeometry(3, 3, 3);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.8 });
    const obs = new THREE.Mesh(geo, mat);
    
    // Pick random lane
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    obs.position.set(lane, 0.5, zPos);
    
    scene.add(obs);
    obstacles.push(obs);
}

function startGame() {
    gameState = 'playing';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    // Reset state
    score = 0;
    level = 1;
    speed = baseSpeed;
    distance = 0;
    carGroup.position.x = 0;
    carGroup.rotation.y = 0;
    carGroup.rotation.z = 0;
    
    // Clear obstacles
    obstacles.forEach(obs => scene.remove(obs));
    obstacles = [];
    lastObstacleZ = -50;
    
    // Initial obstacles
    for(let i=0; i<10; i++) {
        lastObstacleZ -= 40;
        spawnObstacle(lastObstacleZ);
    }
    
    updateHUD();
}

function gameOver() {
    gameState = 'gameover';
    gameOverScreen.classList.remove('hidden');
    finalScoreEl.innerText = score;
    
    if (score > hiScore) {
        hiScore = score;
        try {
            localStorage.setItem('neonHighwayHiScore', hiScore);
        } catch(e) {}
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
}

function onKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
}

function updateHUD() {
    scoreEl.innerText = score;
    hiScoreEl.innerText = hiScore;
    levelEl.innerText = level;
}

// --- Main Loop ---
function animate() {
    if (gameState === 'playing') {
        time += 0.016; // approx dt

        // Speed curve based on score (Progression)
        level = Math.floor(score / 500) + 1;
        speed = baseSpeed + (level * 0.2); // ramps up
        
        // Update Grid (scrolling effect)
        gridHelper.position.z += speed;
        if (gridHelper.position.z > 4) {
            gridHelper.position.z -= 4; // loop size
        }

        // Car Movement
        const turnSpeed = 0.5;
        let turn = 0;
        if (keys.left) turn = -1;
        if (keys.right) turn = 1;

        carGroup.position.x += turn * turnSpeed;
        
        // Clamp to road bounds
        const bounds = 18;
        if (carGroup.position.x < -bounds) carGroup.position.x = -bounds;
        if (carGroup.position.x > bounds) carGroup.position.x = bounds;
        
        // Lean effect
        carGroup.rotation.z = THREE.MathUtils.lerp(carGroup.rotation.z, turn * -0.2, 0.1);
        carGroup.rotation.y = THREE.MathUtils.lerp(carGroup.rotation.y, turn * -0.1, 0.1);

        // Bobbing effect
        carGroup.position.y = -1 + Math.sin(time * 15) * 0.05;

        // Move Obstacles and check collisions
        const carBox = new THREE.Box3().setFromObject(carGroup);
        // Make car hitbox a bit smaller for fairness
        carBox.expandByScalar(-0.5); 

        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.position.z += speed;
            
            // Spin obstacles slightly
            obs.rotation.x += 0.02;
            obs.rotation.y += 0.02;

            // Collision Check
            const obsBox = new THREE.Box3().setFromObject(obs);
            obsBox.expandByScalar(-0.5); // forgiving hitbox

            if (carBox.intersectsBox(obsBox)) {
                gameOver();
                // Add a simple crash visual effect
                carGroup.rotation.z = Math.PI / 4;
                carGroup.position.y = 1;
                break;
            }

            // Recycle past camera
            if (obs.position.z > 30) {
                scene.remove(obs);
                obstacles.splice(i, 1);
                
                // Score for passing obstacle
                score += 10;
                updateHUD();
                
                // Spawn new
                lastObstacleZ -= Math.max(30, 80 - (level * 5)); // denser as levels increase
                spawnObstacle(lastObstacleZ);
                
                // Add score visual tick
                scoreEl.style.transform = 'scale(1.5)';
                setTimeout(() => scoreEl.style.transform = 'scale(1)', 100);
            }
        }
        
        // Passive score from distance
        distance += speed;
        if (distance > 100) {
            distance = 0;
            score += 1;
            updateHUD();
        }
        
        // Camera follow (slight dynamic lag)
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, carGroup.position.x * 0.5, 0.05);
        camera.lookAt(carGroup.position.x * 0.2, 0, -20);
    } else if (gameState === 'start' || gameState === 'gameover') {
        // Idling animation
        camera.position.x = Math.sin(Date.now() * 0.0005) * 10;
        camera.lookAt(0,0,-20);
    }

    renderer.render(scene, camera);
}

// Start
init();
