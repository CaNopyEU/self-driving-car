import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js";
import {CONFIG, storage} from "./config.js";
import {Controls} from "./controls.js";
import {PlayerCar, TrafficCar} from "./car.js";
import {Road} from "./road.js";
import {choose, clamp, rand, randInt} from "./utils.js";

const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.shadowMap.enabled=false;
document.body.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2("#080812",0.028);

const camera=new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,0.1,250);

const controls=new Controls();
const road=new Road(scene);
const player=new PlayerCar(road);
scene.add(player.mesh);

const trafficGroup=new THREE.Group();
scene.add(trafficGroup);

const roadLight=new THREE.HemisphereLight("#88a7ff","#04030a",1.4);
scene.add(roadLight);

const sunLight=new THREE.DirectionalLight("#ffe3ba",1.8);
sunLight.position.set(8,18,-6);
scene.add(sunLight);

const chaseGlow=new THREE.PointLight("#ff6bc6",18,28,2);
scene.add(chaseGlow);

const underglow=new THREE.PointLight("#5ed4ff",8,18,2);
scene.add(underglow);

const starField=createStarField();
scene.add(starField);

const skyline=createSkyline();
scene.add(skyline);

const hud=document.getElementById("hud");
const banner=document.getElementById("banner");
const menuOverlay=document.getElementById("menuOverlay");
const gameOverOverlay=document.getElementById("gameOverOverlay");
const startButton=document.getElementById("startButton");
const restartButton=document.getElementById("restartButton");
const scoreValue=document.getElementById("scoreValue");
const speedValue=document.getElementById("speedValue");
const stageValue=document.getElementById("stageValue");
const closeCallValue=document.getElementById("closeCallValue");
const menuHighScore=document.getElementById("menuHighScore");
const finalScore=document.getElementById("finalScore");
const bestScore=document.getElementById("bestScore");
const finalDistance=document.getElementById("finalDistance");
const finalStage=document.getElementById("finalStage");
const gameOverSummary=document.getElementById("gameOverSummary");

const game={
    state:"menu",
    stage:1,
    score:0,
    displayedScore:0,
    distance:0,
    closeCalls:0,
    cleanStage:true,
    lastStageDistance:0,
    highScore:storage.getNumber(CONFIG.storageKey,0),
    traffic:[],
    trafficSpawnZ:60,
    crashTimer:0,
    bannerTimer:0,
    bannerText:"",
    time:0
};

const audio=createAudio();

startButton.addEventListener("click",()=>startGame());
restartButton.addEventListener("click",()=>startGame());

window.addEventListener("resize",onResize);

updateHighScoreLabels();
showMenu();

let previousTime=performance.now();
requestAnimationFrame(loop);

function createSkyline(){
    const group=new THREE.Group();
    const colors=["#24144a","#1d2d60","#332050"];
    for(let side of [-1,1]){
        for(let i=0;i<28;i++){
            const width=rand(3,7);
            const height=rand(6,20);
            const depth=rand(3,8);
            const mesh=new THREE.Mesh(
                new THREE.BoxGeometry(width,height,depth),
                new THREE.MeshStandardMaterial({
                    color:choose(colors),
                    emissive:side<0?"#123d7a":"#6b1f5a",
                    emissiveIntensity:0.22,
                    roughness:0.9
                })
            );
            mesh.position.set(side*rand(18,36),height/2-0.5,-rand(0,220));
            group.add(mesh);
        }
    }
    return group;
}

function createStarField(){
    const points=[];
    for(let i=0;i<350;i++){
        points.push(rand(-120,120),rand(15,70),rand(-220,40));
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(points,3));
    const material=new THREE.PointsMaterial({color:"#d8e7ff",size:0.45,sizeAttenuation:true});
    return new THREE.Points(geometry,material);
}

function createAudio(){
    let context=null;
    let master=null;
    let engineOscillator=null;
    let engineGain=null;

    function ensure(){
        if(context){
            return true;
        }
        try{
            context=new (window.AudioContext||window.webkitAudioContext)();
            master=context.createGain();
            master.gain.value=0.18;
            master.connect(context.destination);

            engineOscillator=context.createOscillator();
            engineOscillator.type="sawtooth";
            engineGain=context.createGain();
            engineGain.gain.value=0.0001;
            engineOscillator.connect(engineGain);
            engineGain.connect(master);
            engineOscillator.start();
            return true;
        }catch(error){
            return false;
        }
    }

    function pulse(type,frequency,duration,volume,slide=0){
        if(!ensure()) return;
        const now=context.currentTime;
        const oscillator=context.createOscillator();
        const gain=context.createGain();
        oscillator.type=type;
        oscillator.frequency.setValueAtTime(frequency,now);
        oscillator.frequency.linearRampToValueAtTime(Math.max(40,frequency+slide),now+duration);
        gain.gain.setValueAtTime(volume,now);
        gain.gain.exponentialRampToValueAtTime(0.0001,now+duration);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(now);
        oscillator.stop(now+duration);
    }

    return {
        ensure,
        updateEngine(speed,boosting){
            if(!ensure()) return;
            const now=context.currentTime;
            if(context.state==="suspended"){
                context.resume().catch(()=>{});
            }
            const targetFrequency=80+speed*3.2+(boosting?28:0);
            const targetGain=0.015+speed/4200+(boosting?0.03:0);
            engineOscillator.frequency.linearRampToValueAtTime(targetFrequency,now+0.08);
            engineGain.gain.linearRampToValueAtTime(targetGain,now+0.08);
        },
        nearMiss(){
            pulse("triangle",840,0.16,0.08,180);
        },
        stageUp(){
            pulse("square",520,0.12,0.07,150);
            pulse("square",740,0.18,0.06,80);
        },
        crash(){
            pulse("sawtooth",180,0.35,0.12,-120);
        }
    };
}

function startGame(){
    audio.ensure();
    player.reset();
    clearTraffic();
    game.state="playing";
    game.stage=1;
    game.score=0;
    game.displayedScore=0;
    game.distance=0;
    game.closeCalls=0;
    game.cleanStage=true;
    game.lastStageDistance=0;
    game.trafficSpawnZ=130;
    game.crashTimer=0;
    game.bannerTimer=2.6;
    game.bannerText="Stage 1: Midnight Sprint";
    player.mesh.visible=true;
    spawnTrafficWave();
    hud.classList.remove("hidden");
    menuOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");
    banner.classList.remove("hidden");
    banner.textContent=game.bannerText;
}

function showMenu(){
    game.state="menu";
    hud.classList.add("hidden");
    menuOverlay.classList.remove("hidden");
    gameOverOverlay.classList.add("hidden");
    banner.classList.add("hidden");
    menuHighScore.textContent=formatScore(game.highScore);
}

function endGame(){
    game.state="gameover";
    game.crashTimer=0;
    audio.crash();
    game.highScore=Math.max(game.highScore,Math.round(game.score));
    storage.setNumber(CONFIG.storageKey,game.highScore);
    updateHighScoreLabels();
    finalScore.textContent=formatScore(Math.round(game.score));
    bestScore.textContent=formatScore(game.highScore);
    finalDistance.textContent=`${Math.round(game.distance)} m`;
    finalStage.textContent=String(game.stage);
    gameOverSummary.textContent=`You carved through ${game.closeCalls} close calls before traffic clipped the run.`;
    gameOverOverlay.classList.remove("hidden");
    banner.classList.add("hidden");
}

function clearTraffic(){
    for(const trafficCar of game.traffic){
        trafficGroup.remove(trafficCar.mesh);
    }
    game.traffic.length=0;
}

function spawnTrafficWave(){
    const targetCount=CONFIG.trafficBaseCount+(game.stage-1)*CONFIG.trafficCountPerStage;
    while(game.traffic.length<targetCount){
        const laneIndex=pickTrafficLane(game.traffic.length<3);
        const speed=rand(CONFIG.trafficSpeedMin+game.stage*1.6,CONFIG.trafficSpeedMax+game.stage*2.2);
        const kind=choose(getTrafficKinds());
        const car=new TrafficCar(road,laneIndex,game.trafficSpawnZ,speed,kind);
        game.trafficSpawnZ+=rand(CONFIG.trafficGapMin,CONFIG.trafficGapMax)-game.stage*1.25;
        game.traffic.push(car);
        trafficGroup.add(car.mesh);
    }
}

function getTrafficKinds(){
    if(game.stage>=5){
        return ["car","car","truck","swerve"];
    }
    if(game.stage>=3){
        return ["car","car","truck"];
    }
    return ["car","car","car","truck"];
}

function recycleTraffic(trafficCar){
    const laneIndex=pickTrafficLane(false);
    const speed=rand(CONFIG.trafficSpeedMin+game.stage*1.6,CONFIG.trafficSpeedMax+game.stage*2.2);
    const kind=choose(getTrafficKinds());
    trafficCar.recycle(laneIndex,game.trafficSpawnZ,speed,kind);
    game.trafficSpawnZ+=rand(CONFIG.trafficGapMin,CONFIG.trafficGapMax)-game.stage*1.25;
}

function pickTrafficLane(avoidCenter){
    const centerLane=Math.floor(CONFIG.laneCount/2);
    if(!avoidCenter){
        return randInt(0,CONFIG.laneCount-1);
    }

    const lanes=[];
    for(let lane=0;lane<CONFIG.laneCount;lane++){
        if(lane!==centerLane&&lane!==centerLane-1){
            lanes.push(lane);
        }
    }
    return choose(lanes.length?lanes:[0,CONFIG.laneCount-1]);
}

function onResize(){
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
}

function loop(now){
    const delta=Math.min((now-previousTime)/1000,0.05);
    previousTime=now;
    game.time+=delta;

    if(game.state==="menu"){
        animateBackdrop(delta);
        if(controls.startPressed){
            startGame();
        }
    }else if(game.state==="playing"){
        updatePlaying(delta);
    }else if(game.state==="gameover"){
        updateGameOver(delta);
        if(controls.restartPressed){
            startGame();
        }
    }

    renderer.render(scene,camera);
    requestAnimationFrame(loop);
}

function animateBackdrop(delta){
    player.mesh.position.x=Math.sin(game.time*0.7)*2.6;
    player.mesh.position.y=0.2;
    player.mesh.rotation.y=Math.sin(game.time*0.7)*0.18;
    player.mesh.rotation.z=-Math.sin(game.time*0.7)*0.08;
    const previewDistance=game.time*18;
    road.update(previewDistance);
    updateEnvironment(previewDistance,32,false,delta);
    positionCamera(delta,32);
}

function updatePlaying(delta){
    const boosting=player.update(delta,controls);
    game.distance=player.distance;
    road.update(player.distance);
    updateTraffic(delta);
    updateScoring(delta,boosting);
    updateStage();
    updateEnvironment(player.distance,player.speed,boosting,delta);
    updateHud();
    positionCamera(delta,player.speed);
    audio.updateEngine(player.speed,boosting);
}

function updateGameOver(delta){
    game.crashTimer+=delta;
    player.mesh.rotation.z=Math.min(player.mesh.rotation.z+delta*1.1,0.6);
    player.mesh.position.x*=0.99;
    road.update(player.distance);
    for(const trafficCar of game.traffic){
        trafficCar.update(delta,player.distance);
    }
    updateEnvironment(player.distance,player.speed*0.5,false,delta);
    positionCamera(delta,Math.max(24,player.speed*0.7));
}

function updateTraffic(delta){
    const playerBounds=player.getBounds();
    for(const trafficCar of game.traffic){
        trafficCar.update(delta,player.distance);

        if(trafficCar.worldZ<player.distance-28){
            recycleTraffic(trafficCar);
            continue;
        }

        const bounds=trafficCar.getBounds();
        const dz=bounds.z-playerBounds.z;
        const dx=Math.abs(bounds.x-playerBounds.x);
        const overlapX=dx<(bounds.halfWidth+playerBounds.halfWidth);
        const overlapZ=Math.abs(dz)<(bounds.halfLength+playerBounds.halfLength);

        if(overlapX&&overlapZ){
            game.cleanStage=false;
            player.crashed=true;
            endGame();
            return;
        }

        const closingWindow=dz>-2.4&&dz<3.8;
        if(!trafficCar.nearMissed&&closingWindow&&dx<CONFIG.nearMissDistance&&dx>(bounds.halfWidth+0.25)){
            trafficCar.nearMissed=true;
            game.closeCalls++;
            game.score+=CONFIG.nearMissScore+game.stage*35;
            flashBanner(`Close Call +${CONFIG.nearMissScore}`);
            audio.nearMiss();
        }
    }
}

function updateScoring(delta,boosting){
    const speedFactor=player.speed/(CONFIG.maxPlayerSpeed+10);
    game.score+=player.speed*CONFIG.scorePerMeter*delta*(0.75+speedFactor*0.9);
    if(boosting){
        game.score+=28*delta;
    }
    game.displayedScore+=Math.min((game.score-game.displayedScore)*0.16+12,game.score-game.displayedScore);
}

function updateStage(){
    const targetStage=Math.floor(game.distance/CONFIG.stageDistance)+1;
    if(targetStage>game.stage){
        if(game.cleanStage){
            game.score+=CONFIG.cleanStageBonus*game.stage;
            flashBanner(`Clean Stage Bonus +${CONFIG.cleanStageBonus*game.stage}`);
        }
        game.stage=targetStage;
        game.cleanStage=true;
        game.bannerTimer=2.4;
        game.bannerText=`Stage ${game.stage}: ${getStageName(game.stage)}`;
        banner.textContent=game.bannerText;
        banner.classList.remove("hidden");
        spawnTrafficWave();
        audio.stageUp();
    }
}

function getStageName(stage){
    const names=["Midnight Sprint","Tunnel Fever","Velocity District","Signal Storm","Gridlock Royale","Afterburner"];
    return names[Math.min(names.length-1,stage-1)];
}

function flashBanner(text){
    game.bannerText=text;
    game.bannerTimer=1.4;
    banner.textContent=text;
    banner.classList.remove("hidden");
}

function updateEnvironment(distance,speed,boosting,delta){
    chaseGlow.position.set(player.mesh.position.x,1.8,3.2);
    underglow.position.set(player.mesh.position.x,0.4,1.4);
    starField.position.z=(distance*0.15)%180;
    skyline.position.z=((distance*0.22)%180)-160;
    skyline.children.forEach((building,index)=>{
        building.position.y+=Math.sin(game.time*0.3+index)*0.0015;
    });

    const fogDensity=0.024+Math.min(0.014,game.stage*0.0016);
    scene.fog.density=fogDensity;
    chaseGlow.intensity=boosting?24:18;
    underglow.intensity=6+speed*0.08;

    if(game.bannerTimer>0){
        game.bannerTimer-=delta;
        if(game.bannerTimer<=0&&game.state==="playing"){
            banner.classList.add("hidden");
        }
    }
}

function positionCamera(delta,speed){
    const speedRatio=clamp(speed/CONFIG.maxPlayerSpeed,0,1.2);
    const targetCameraPosition=new THREE.Vector3(
        player.mesh.position.x*0.35,
        4.6+speedRatio*1.15,
        9.2-speedRatio*1.4
    );
    camera.position.lerp(targetCameraPosition,1-Math.pow(0.001,delta));
    const targetLookAt=new THREE.Vector3(player.mesh.position.x*0.48,1.05,-12-speedRatio*11);
    camera.lookAt(targetLookAt);
    camera.fov=60+speedRatio*12;
    camera.updateProjectionMatrix();
}

function updateHud(){
    scoreValue.textContent=formatScore(Math.round(game.displayedScore));
    speedValue.textContent=`${Math.round(player.speed)} mph`;
    stageValue.textContent=String(game.stage);
    closeCallValue.textContent=String(game.closeCalls);
}

function updateHighScoreLabels(){
    menuHighScore.textContent=formatScore(game.highScore);
    bestScore.textContent=formatScore(game.highScore);
}

function formatScore(value){
    return value.toLocaleString("en-US");
}
