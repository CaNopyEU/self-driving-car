import * as THREE from "three";

const ROAD_WIDTH=18;
const LANE_COUNT=4;
const LANE_WIDTH=ROAD_WIDTH/LANE_COUNT;
const SEGMENT_LENGTH=42;
const SEGMENT_COUNT=34;
const TRAFFIC_COUNT=24;
const WORLD_AHEAD=980;
const WORLD_BEHIND=120;
const PLAYER_Z=0;

const gameEl=document.getElementById("game");
const hudEl=document.getElementById("hud");
const centerPanel=document.getElementById("centerPanel");
const panelText=document.getElementById("panelText");
const panelStats=document.getElementById("panelStats");
const startButton=document.getElementById("startButton");
const toastEl=document.getElementById("toast");

const scoreValue=document.getElementById("scoreValue");
const levelValue=document.getElementById("levelValue");
const speedValue=document.getElementById("speedValue");
const comboValue=document.getElementById("comboValue");
const healthValue=document.getElementById("healthValue");

const storage={
    get(key){
        try{
            return window.localStorage.getItem(key);
        }catch(error){
            return null;
        }
    },
    set(key,value){
        try{
            window.localStorage.setItem(key,value);
        }catch(error){
            return false;
        }
        return true;
    }
};

const state={
    mode:"menu",
    score:0,
    highScore:Number(storage.get("neonOverdriveHighScore"))||0,
    level:1,
    combo:1,
    comboTimer:0,
    health:100,
    distance:0,
    speed:0,
    lateralSpeed:0,
    playerX:0,
    cameraMode:0,
    muted:false,
    screenShake:0,
    lastTime:performance.now(),
    spawnSeed:0,
    passedIds:new Set(),
    flashTimer:0,
    toastTimer:0,
    boostTimer:0
};

const keys=new Set();
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.18;
gameEl.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x060817);
scene.fog=new THREE.FogExp2(0x060817,0.012);

const camera=new THREE.PerspectiveCamera(66,window.innerWidth/window.innerHeight,0.1,1800);
const clock=new THREE.Clock();

const world=new THREE.Group();
scene.add(world);

const ambientLight=new THREE.HemisphereLight(0x7edcff,0x17101e,1.4);
scene.add(ambientLight);

const moonLight=new THREE.DirectionalLight(0xaadfff,1.8);
moonLight.position.set(-18,34,24);
moonLight.castShadow=true;
moonLight.shadow.mapSize.set(2048,2048);
moonLight.shadow.camera.left=-55;
moonLight.shadow.camera.right=55;
moonLight.shadow.camera.top=65;
moonLight.shadow.camera.bottom=-45;
scene.add(moonLight);

const playerLight=new THREE.PointLight(0x00e5ff,1.5,26,2.2);
scene.add(playerLight);

const mats={
    asphalt:new THREE.MeshStandardMaterial({color:0x111827,roughness:0.78,metalness:0.05}),
    shoulder:new THREE.MeshStandardMaterial({color:0x080b16,roughness:0.9}),
    lane:new THREE.MeshBasicMaterial({color:0x66f6ff,transparent:true,opacity:0.72}),
    edgePink:new THREE.MeshBasicMaterial({color:0xff2c81}),
    edgeCyan:new THREE.MeshBasicMaterial({color:0x00e5ff}),
    grass:new THREE.MeshStandardMaterial({color:0x070b13,roughness:1}),
    player:new THREE.MeshStandardMaterial({color:0xff2c81,roughness:0.28,metalness:0.45,emissive:0x330015}),
    playerTrim:new THREE.MeshBasicMaterial({color:0x00e5ff}),
    rival:new THREE.MeshStandardMaterial({color:0xffc947,roughness:0.32,metalness:0.35,emissive:0x3b2100}),
    traffic:new THREE.MeshStandardMaterial({color:0x36e0ff,roughness:0.36,metalness:0.3,emissive:0x00252f}),
    obstacle:new THREE.MeshStandardMaterial({color:0x8a4cff,roughness:0.36,metalness:0.38,emissive:0x160433}),
    glass:new THREE.MeshStandardMaterial({color:0x08101f,roughness:0.08,metalness:0.2,transparent:true,opacity:0.72}),
    gate:new THREE.MeshBasicMaterial({color:0x7cff6b,transparent:true,opacity:0.72}),
    building:new THREE.MeshStandardMaterial({color:0x11152d,roughness:0.65,metalness:0.15,emissive:0x050919})
};

const carGeometry={
    body:new THREE.BoxGeometry(2.0,0.75,4.1),
    cabin:new THREE.BoxGeometry(1.35,0.62,1.6),
    spoiler:new THREE.BoxGeometry(2.15,0.16,0.42),
    wheel:new THREE.CylinderGeometry(0.42,0.42,0.42,18)
};

const roadSegments=[];
const sideObjects=[];
const traffic=[];
const particles=[];
const gates=[];

const roadGroup=new THREE.Group();
world.add(roadGroup);

createRoad();
const player=createCar(mats.player,true);
player.position.set(0,0.55,PLAYER_Z);
scene.add(player);

const rival=createCar(mats.rival,false);
rival.position.set(-LANE_WIDTH*0.5,0.55,-65);
scene.add(rival);

const audio={ctx:null,engine:null,engineGain:null,master:null,armed:false};

showMenu();
resetRun();
animate();

function createRoad(){
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(260,SEGMENT_LENGTH*SEGMENT_COUNT+500),mats.grass);
    ground.rotation.x=-Math.PI/2;
    ground.position.z=-SEGMENT_LENGTH*SEGMENT_COUNT/2+170;
    ground.receiveShadow=true;
    roadGroup.add(ground);

    for(let i=0;i<SEGMENT_COUNT;i++){
        const segment=new THREE.Group();
        segment.position.z=-i*SEGMENT_LENGTH+160;
        roadGroup.add(segment);
        roadSegments.push(segment);

        const asphalt=new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH,0.08,SEGMENT_LENGTH+0.6),mats.asphalt);
        asphalt.position.y=0;
        asphalt.receiveShadow=true;
        segment.add(asphalt);

        const leftShoulder=new THREE.Mesh(new THREE.BoxGeometry(4.6,0.09,SEGMENT_LENGTH+0.6),mats.shoulder);
        leftShoulder.position.set(-ROAD_WIDTH/2-2.3,0.01,0);
        leftShoulder.receiveShadow=true;
        segment.add(leftShoulder);

        const rightShoulder=leftShoulder.clone();
        rightShoulder.position.x=ROAD_WIDTH/2+2.3;
        segment.add(rightShoulder);

        for(let lane=1;lane<LANE_COUNT;lane++){
            const x=-ROAD_WIDTH/2+lane*LANE_WIDTH;
            for(let dash=0;dash<3;dash++){
                const stripe=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.04,7.2),mats.lane);
                stripe.position.set(x,0.085,-SEGMENT_LENGTH/2+8+dash*14);
                segment.add(stripe);
            }
        }

        const leftEdge=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.18,SEGMENT_LENGTH),i%2?mats.edgePink:mats.edgeCyan);
        leftEdge.position.set(-ROAD_WIDTH/2,0.14,0);
        segment.add(leftEdge);
        const rightEdge=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.18,SEGMENT_LENGTH),i%2?mats.edgeCyan:mats.edgePink);
        rightEdge.position.set(ROAD_WIDTH/2,0.14,0);
        segment.add(rightEdge);

        addSideScene(segment,i);
    }
}

function addSideScene(segment,index){
    const buildingCount=4;
    for(let i=0;i<buildingCount;i++){
        const side=i%2?-1:1;
        const height=8+randomFrom(index*31+i)*28;
        const width=5+randomFrom(index*17+i)*8;
        const depth=5+randomFrom(index*23+i)*9;
        const building=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),mats.building.clone());
        building.material.emissive=new THREE.Color(side>0?0x071328:0x16071d);
        building.position.set(side*(ROAD_WIDTH/2+13+randomFrom(index*41+i)*34),height/2-0.05,-SEGMENT_LENGTH/2+randomFrom(index*13+i)*SEGMENT_LENGTH);
        building.castShadow=true;
        building.receiveShadow=true;
        segment.add(building);
        sideObjects.push(building);

        const sign=new THREE.Mesh(new THREE.BoxGeometry(width*0.72,0.08,0.14),new THREE.MeshBasicMaterial({color:randomFrom(index+i)>0.5?0x00e5ff:0xff2c81}));
        sign.position.set(0,height*0.25,side>0?-depth/2-0.08:depth/2+0.08);
        building.add(sign);
    }
}

function createCar(material,isPlayer){
    const group=new THREE.Group();
    const body=new THREE.Mesh(carGeometry.body,material);
    body.castShadow=true;
    body.receiveShadow=true;
    group.add(body);

    const cabin=new THREE.Mesh(carGeometry.cabin,mats.glass);
    cabin.position.set(0,0.62,-0.34);
    cabin.castShadow=true;
    group.add(cabin);

    const nose=new THREE.Mesh(new THREE.BoxGeometry(1.72,0.2,0.16),isPlayer?mats.playerTrim:mats.edgePink);
    nose.position.set(0,0.16,-2.13);
    group.add(nose);

    const tail=new THREE.Mesh(carGeometry.spoiler,isPlayer?mats.playerTrim:mats.edgeCyan);
    tail.position.set(0,0.78,1.82);
    group.add(tail);

    for(const x of [-1.08,1.08]){
        for(const z of [-1.36,1.34]){
            const wheel=new THREE.Mesh(carGeometry.wheel,new THREE.MeshStandardMaterial({color:0x050509,roughness:0.62}));
            wheel.rotation.z=Math.PI/2;
            wheel.position.set(x,-0.33,z);
            wheel.castShadow=true;
            group.add(wheel);
        }
    }

    const lightColor=isPlayer?0x00e5ff:0xffc947;
    const glow=new THREE.PointLight(lightColor,isPlayer?1.2:0.75,12,2.3);
    glow.position.set(0,0.25,-2.25);
    group.add(glow);
    return group;
}

function resetRun(){
    state.score=0;
    state.level=1;
    state.combo=1;
    state.comboTimer=0;
    state.health=100;
    state.distance=0;
    state.speed=0;
    state.lateralSpeed=0;
    state.playerX=0;
    state.spawnSeed=0;
    state.passedIds.clear();
    state.flashTimer=0;
    state.boostTimer=0;
    state.screenShake=0;
    player.position.set(0,0.55,PLAYER_Z);
    rival.position.set(-LANE_WIDTH*0.5,0.55,-65);
    rival.userData={speed:31,lane:1,targetX:-LANE_WIDTH*0.5,phase:0};
    resetTraffic();
    resetGates();
    updateHud();
}

function resetTraffic(){
    for(const item of traffic){
        scene.remove(item.mesh);
    }
    traffic.length=0;
    for(let i=0;i<TRAFFIC_COUNT;i++){
        spawnTrafficCar(-80-i*(WORLD_AHEAD/TRAFFIC_COUNT),i);
    }
}

function resetGates(){
    for(const gate of gates){
        scene.remove(gate.mesh);
    }
    gates.length=0;
    for(let i=0;i<5;i++){
        spawnGate(-180-i*240,i);
    }
}

function spawnTrafficCar(z,id){
    const mat=randomFrom(id+state.spawnSeed)>0.72?mats.obstacle:mats.traffic;
    const mesh=createCar(mat,false);
    const lane=Math.floor(randomFrom(id*3+11+state.spawnSeed)*LANE_COUNT);
    const x=laneX(lane);
    mesh.position.set(x,0.55,z);
    scene.add(mesh);
    traffic.push({mesh,id,lane,targetX:x,speed:17+randomFrom(id*7+state.spawnSeed)*11,passed:false,wobble:randomFrom(id*19)*Math.PI*2});
}

function spawnGate(z,id){
    const group=new THREE.Group();
    const lane=Math.floor(randomFrom(id*5+state.spawnSeed+87)*LANE_COUNT);
    const x=laneX(lane);
    const leftPost=new THREE.Mesh(new THREE.BoxGeometry(0.16,3.2,0.16),mats.gate);
    const rightPost=leftPost.clone();
    const top=new THREE.Mesh(new THREE.BoxGeometry(LANE_WIDTH*0.78,0.16,0.16),mats.gate);
    leftPost.position.set(-LANE_WIDTH*0.38,1.6,0);
    rightPost.position.set(LANE_WIDTH*0.38,1.6,0);
    top.position.set(0,3.18,0);
    group.add(leftPost,rightPost,top);
    group.position.set(x,0.05,z);
    scene.add(group);
    gates.push({mesh:group,id,lane,claimed:false});
}

function startGame(){
    resetRun();
    armAudio();
    state.mode="playing";
    hudEl.classList.remove("hidden");
    centerPanel.classList.add("hidden");
    showToast("Run started");
}

function endGame(){
    state.mode="gameover";
    const previousHigh=state.highScore;
    state.highScore=Math.max(state.highScore,Math.floor(state.score));
    storage.set("neonOverdriveHighScore",String(state.highScore));
    hudEl.classList.add("hidden");
    centerPanel.classList.remove("hidden");
    startButton.textContent="Restart Run";
    panelText.textContent="The city finally caught you. Your run is over, but the road is ready for another attempt.";
    panelStats.innerHTML=`<span>Score ${Math.floor(state.score)}</span><span>Best ${state.highScore}</span><span>Level ${state.level}</span><span>${previousHigh<state.highScore?"New record":"Record chase"}</span>`;
    playTone(90,0.35,"sawtooth",0.12);
}

function showMenu(){
    hudEl.classList.add("hidden");
    centerPanel.classList.remove("hidden");
    startButton.textContent="Start Run";
    panelStats.innerHTML=`<span>Best ${state.highScore}</span><span>3D chase camera</span><span>Adaptive rivals</span>`;
}

function update(dt){
    if(state.mode!=="playing"){
        updateCamera(dt);
        updateAudio();
        return;
    }

    const throttle=keys.has("KeyW")||keys.has("ArrowUp");
    const brake=keys.has("KeyS")||keys.has("ArrowDown");
    const left=keys.has("KeyA")||keys.has("ArrowLeft");
    const right=keys.has("KeyD")||keys.has("ArrowRight");
    const handbrake=keys.has("Space");
    const levelFactor=1+(state.level-1)*0.075;
    const maxSpeed=42+state.level*2.4+(state.boostTimer>0?8:0);

    state.speed+=throttle?38*dt:-10*dt;
    if(brake) state.speed-=34*dt;
    state.speed=clamp(state.speed,0,maxSpeed);

    const steer=(right?1:0)-(left?1:0);
    const grip=handbrake?0.68:1;
    state.lateralSpeed+=steer*(21+state.speed*0.19)*dt*grip;
    state.lateralSpeed*=Math.pow(handbrake?0.86:0.55,dt*4.8);
    state.playerX+=state.lateralSpeed*dt;
    state.playerX=clamp(state.playerX,-ROAD_WIDTH/2+1.15,ROAD_WIDTH/2-1.15);

    state.distance+=state.speed*dt;
    state.score+=state.speed*dt*(0.75+state.level*0.12)*state.combo;
    state.comboTimer=Math.max(0,state.comboTimer-dt);
    state.boostTimer=Math.max(0,state.boostTimer-dt);
    if(state.comboTimer<=0) state.combo=Math.max(1,state.combo-0.35*dt);

    const newLevel=Math.floor(state.distance/520)+1;
    if(newLevel>state.level){
        state.level=newLevel;
        state.health=Math.min(100,state.health+10);
        showToast(`Level ${state.level}`);
        playTone(440+state.level*30,0.16,"triangle",0.1);
    }

    player.position.x=lerp(player.position.x,state.playerX,1-Math.pow(0.001,dt));
    player.rotation.z=lerp(player.rotation.z,-state.lateralSpeed*0.035,1-Math.pow(0.02,dt));
    player.rotation.y=lerp(player.rotation.y,-state.lateralSpeed*0.012,1-Math.pow(0.04,dt));
    player.position.y=0.55+Math.sin(performance.now()*0.018)*0.025+Math.min(0.18,Math.abs(state.lateralSpeed)*0.006);
    playerLight.position.copy(player.position).add(new THREE.Vector3(0,2.5,2.8));

    updateWorldWrap();
    updateTraffic(dt,levelFactor);
    updateRival(dt,levelFactor);
    updateGates(dt);
    updateParticles(dt);
    checkRoadDamage(dt);
    updateCamera(dt);
    updateHud();
    updateAudio();

    if(state.health<=0){
        state.health=0;
        endGame();
    }
}

function updateWorldWrap(){
    for(const segment of roadSegments){
        const worldZ=segment.position.z+state.distance;
        if(worldZ>WORLD_BEHIND){
            segment.position.z-=SEGMENT_LENGTH*SEGMENT_COUNT;
        }
    }
}

function updateTraffic(dt,levelFactor){
    for(const item of traffic){
        const relSpeed=state.speed-(item.speed*levelFactor);
        item.mesh.position.z+=relSpeed*dt;
        item.wobble+=dt*(0.6+state.level*0.05);
        if(randomFrom(Math.floor(state.distance/240)+item.id*13)>0.996){
            item.lane=clamp(item.lane+(randomFrom(item.id+state.spawnSeed)>0.5?1:-1),0,LANE_COUNT-1);
            item.targetX=laneX(item.lane);
        }
        item.mesh.position.x=lerp(item.mesh.position.x,item.targetX+Math.sin(item.wobble)*0.15,dt*1.6);
        item.mesh.rotation.y=lerp(item.mesh.rotation.y,(item.targetX-item.mesh.position.x)*0.08,dt*4);

        if(!item.passed&&item.mesh.position.z>2.8){
            item.passed=true;
            rewardOvertake(item.mesh.position.x);
        }

        if(item.mesh.position.z>WORLD_BEHIND){
            state.spawnSeed++;
            item.mesh.position.z=-WORLD_AHEAD-randomFrom(state.spawnSeed+item.id)*260;
            item.lane=Math.floor(randomFrom(item.id*5+state.spawnSeed)*LANE_COUNT);
            item.targetX=laneX(item.lane);
            item.mesh.position.x=item.targetX;
            item.speed=18+randomFrom(item.id*9+state.spawnSeed)*13+state.level*0.65;
            item.passed=false;
        }

        if(Math.abs(item.mesh.position.z-PLAYER_Z)<3.25&&Math.abs(item.mesh.position.x-player.position.x)<1.95){
            crash(22+state.level*1.7,item.mesh.position.x-player.position.x);
            item.mesh.position.z=-WORLD_AHEAD-randomFrom(item.id+state.spawnSeed)*180;
            item.passed=false;
        }
    }
}

function updateRival(dt,levelFactor){
    rival.userData.phase+=dt;
    if(rival.position.z>24||rival.position.z<-110||Math.sin(rival.userData.phase*0.58)>0.985){
        rival.userData.lane=Math.floor(randomFrom(Math.floor(state.distance/180)+17)*LANE_COUNT);
        rival.userData.targetX=laneX(rival.userData.lane);
    }
    const rivalSpeed=(31+state.level*1.4)*levelFactor;
    rival.position.z+=(state.speed-rivalSpeed)*dt;
    rival.position.x=lerp(rival.position.x,rival.userData.targetX+Math.sin(rival.userData.phase*2.2)*0.42,dt*1.2);
    rival.rotation.y=lerp(rival.rotation.y,(rival.userData.targetX-rival.position.x)*0.08,dt*3.2);
    if(rival.position.z>WORLD_BEHIND) rival.position.z=-WORLD_AHEAD*0.68;
    if(rival.position.z<-WORLD_AHEAD) rival.position.z=-70;

    if(Math.abs(rival.position.z-PLAYER_Z)<3.45&&Math.abs(rival.position.x-player.position.x)<2.05){
        crash(18+state.level,rival.position.x-player.position.x);
        rival.position.z=-95;
    }
}

function updateGates(dt){
    for(const gate of gates){
        gate.mesh.position.z+=state.speed*dt;
        gate.mesh.rotation.z=Math.sin(performance.now()*0.003+gate.id)*0.03;
        const gateCenter=gate.mesh.position.x;
        if(!gate.claimed&&Math.abs(gate.mesh.position.z-PLAYER_Z)<2.2){
            gate.claimed=true;
            if(Math.abs(gateCenter-player.position.x)<LANE_WIDTH*0.43){
                state.combo=Math.min(8,state.combo+0.8);
                state.comboTimer=5.4;
                state.boostTimer=1.2;
                state.score+=350*state.combo;
                showToast("Gate boost");
                playTone(620,0.1,"triangle",0.09);
                burst(gateCenter,0x7cff6b,16);
            }else{
                state.combo=Math.max(1,state.combo-1.2);
            }
        }
        if(gate.mesh.position.z>WORLD_BEHIND){
            state.spawnSeed++;
            gate.mesh.position.z=-WORLD_AHEAD-randomFrom(gate.id+state.spawnSeed)*300;
            gate.lane=Math.floor(randomFrom(gate.id*7+state.spawnSeed)*LANE_COUNT);
            gate.mesh.position.x=laneX(gate.lane);
            gate.claimed=false;
        }
    }
}

function rewardOvertake(x){
    const near=Math.abs(x-player.position.x)<2.75;
    state.combo=Math.min(8,state.combo+(near?0.55:0.22));
    state.comboTimer=4.2;
    state.score+=near?220*state.combo:90*state.combo;
    if(near){
        showToast("Close pass");
        playTone(330+state.combo*30,0.08,"square",0.055);
        burst((x+player.position.x)/2,0x00e5ff,8);
    }
}

function crash(amount,side){
    state.health-=amount;
    state.speed*=0.48;
    state.lateralSpeed-=Math.sign(side||0.1)*7;
    state.combo=1;
    state.comboTimer=0;
    state.screenShake=0.55;
    state.flashTimer=0.18;
    showToast("Impact");
    playTone(70,0.16,"sawtooth",0.12);
    burst(player.position.x,0xff2c81,18);
}

function checkRoadDamage(dt){
    const edge=ROAD_WIDTH/2-1.25;
    if(Math.abs(player.position.x)>edge){
        state.health-=12*dt;
        state.speed*=Math.pow(0.7,dt);
        state.screenShake=Math.max(state.screenShake,0.08);
    }
}

function burst(x,color,count){
    for(let i=0;i<count;i++){
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.12),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1}));
        mesh.position.set(x+(Math.random()-0.5)*1.5,0.65+Math.random()*1.2,-1+Math.random()*2);
        scene.add(mesh);
        particles.push({mesh,life:0.55+Math.random()*0.38,vel:new THREE.Vector3((Math.random()-0.5)*8,Math.random()*5,(Math.random()-0.5)*8+state.speed*0.08)});
    }
}

function updateParticles(dt){
    for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];
        p.life-=dt;
        p.vel.y-=7*dt;
        p.mesh.position.addScaledVector(p.vel,dt);
        p.mesh.material.opacity=Math.max(0,p.life);
        if(p.life<=0){
            scene.remove(p.mesh);
            particles.splice(i,1);
        }
    }

    state.flashTimer=Math.max(0,state.flashTimer-dt);
    state.screenShake=Math.max(0,state.screenShake-dt*1.7);
    state.toastTimer=Math.max(0,state.toastTimer-dt);
    if(state.toastTimer<=0) toastEl.classList.add("hidden");
}

function updateCamera(dt){
    let target;
    let look;
    if(state.cameraMode===1){
        target=new THREE.Vector3(player.position.x*0.72,2.05,2.45);
        look=new THREE.Vector3(player.position.x+state.lateralSpeed*0.05,1.25,-26);
        camera.fov=lerp(camera.fov,78,dt*2.2);
    }else if(state.cameraMode===2){
        const orbit=Math.sin(performance.now()*0.00035)*12;
        target=new THREE.Vector3(player.position.x+orbit,7.4,13.5);
        look=new THREE.Vector3(player.position.x,1.1,-22);
        camera.fov=lerp(camera.fov,58,dt*2.2);
    }else{
        target=new THREE.Vector3(player.position.x*0.55,5.4+state.speed*0.018,12.2+state.speed*0.055);
        look=new THREE.Vector3(player.position.x+state.lateralSpeed*0.045,1.25,-18-state.speed*0.13);
        camera.fov=lerp(camera.fov,66+state.speed*0.1,dt*2.2);
    }
    if(state.screenShake>0){
        target.x+=(Math.random()-0.5)*state.screenShake*0.7;
        target.y+=(Math.random()-0.5)*state.screenShake*0.5;
    }
    camera.position.lerp(target,1-Math.pow(0.0008,dt));
    camera.lookAt(look);
    camera.updateProjectionMatrix();
}

function updateHud(){
    scoreValue.textContent=String(Math.floor(state.score));
    levelValue.textContent=String(state.level);
    speedValue.textContent=String(Math.floor(state.speed*6));
    comboValue.textContent=`x${state.combo.toFixed(state.combo>=2?1:0)}`;
    healthValue.textContent=`${Math.max(0,Math.ceil(state.health))}%`;
}

function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(0.033,clock.getDelta()||0.016);
    update(dt);
    renderer.render(scene,camera);
}

function showToast(text){
    toastEl.textContent=text;
    toastEl.classList.remove("hidden");
    state.toastTimer=1.05;
}

function armAudio(){
    if(audio.armed||state.muted) return;
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext) return;
    audio.ctx=new AudioContext();
    audio.master=audio.ctx.createGain();
    audio.master.gain.value=0.22;
    audio.master.connect(audio.ctx.destination);
    audio.engine=audio.ctx.createOscillator();
    audio.engine.type="sawtooth";
    audio.engine.frequency.value=80;
    audio.engineGain=audio.ctx.createGain();
    audio.engineGain.gain.value=0.035;
    audio.engine.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engine.start();
    audio.armed=true;
}

function updateAudio(){
    if(!audio.armed||!audio.ctx) return;
    const now=audio.ctx.currentTime;
    const targetGain=state.muted||state.mode!=="playing"?0.006:0.035+state.speed/1500;
    audio.engine.frequency.setTargetAtTime(58+state.speed*4.6,now,0.04);
    audio.engineGain.gain.setTargetAtTime(targetGain,now,0.08);
}

function playTone(freq,duration,type,volume){
    if(state.muted) return;
    armAudio();
    if(!audio.ctx||!audio.master) return;
    const osc=audio.ctx.createOscillator();
    const gain=audio.ctx.createGain();
    osc.type=type;
    osc.frequency.value=freq;
    gain.gain.setValueAtTime(volume,audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,audio.ctx.currentTime+duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    osc.stop(audio.ctx.currentTime+duration);
}

function laneX(lane){
    return -ROAD_WIDTH/2+LANE_WIDTH*(lane+0.5);
}

function clamp(value,min,max){
    return Math.max(min,Math.min(max,value));
}

function lerp(a,b,t){
    return a+(b-a)*clamp(t,0,1);
}

function randomFrom(seed){
    const x=Math.sin(seed*999.41+17.17)*43758.5453123;
    return x-Math.floor(x);
}

window.addEventListener("keydown",event=>{
    keys.add(event.code);
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(event.code)) event.preventDefault();
    if(event.code==="Enter"&&(state.mode==="menu"||state.mode==="gameover")) startGame();
    if(event.code==="KeyC"){
        state.cameraMode=(state.cameraMode+1)%3;
        showToast(["Chase cam","Cockpit cam","Cinematic cam"][state.cameraMode]);
    }
    if(event.code==="KeyM"){
        state.muted=!state.muted;
        showToast(state.muted?"Muted":"Sound on");
    }
});

window.addEventListener("keyup",event=>{
    keys.delete(event.code);
});

window.addEventListener("resize",()=>{
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
});

startButton.addEventListener("click",startGame);
