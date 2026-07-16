(function(){
"use strict";

// --- Audio via WebAudio ---
var audioCtx;
function getAudio(){
  if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq,dur,type,vol){
  try{
    var ctx=getAudio();
    var o=ctx.createOscillator();
    var g=ctx.createGain();
    o.type=type||'square';
    o.frequency.value=freq;
    g.gain.value=vol||0.15;
    o.connect(g);g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    o.stop(ctx.currentTime+dur);
  }catch(e){}
}
function playExplosion(){
  try{
    var ctx=getAudio();
    var buf=ctx.createBuffer(1,ctx.sampleRate*0.5,ctx.sampleRate);
    var d=buf.getChannelData(0);
    for(var i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
    var s=ctx.createBufferSource();
    s.buffer=buf;
    var g=ctx.createGain();g.gain.value=0.4;
    s.connect(g);g.connect(ctx.destination);
    s.start();
  }catch(e){}
}
function playPowerup(){playTone(880,0.15,'sine',0.2);setTimeout(function(){playTone(1100,0.2,'sine',0.2);},100);}

// Engine sound
var engineOsc=null,engineGain=null;
function startEngine(){
  try{
    var ctx=getAudio();
    engineOsc=ctx.createOscillator();
    engineGain=ctx.createGain();
    engineOsc.type='sawtooth';
    engineOsc.frequency.value=80;
    engineGain.gain.value=0.04;
    engineOsc.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
  }catch(e){}
}
function stopEngine(){
  try{if(engineOsc){engineOsc.stop();engineOsc=null;}}catch(e){}
}
function updateEngine(speed){
  try{if(engineOsc)engineOsc.frequency.value=60+speed*3;if(engineGain)engineGain.gain.value=0.03+speed*0.002;}catch(e){}
}

// --- Three.js setup ---
var scene,camera,renderer;
var canvas=document.getElementById('c');
renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true});
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.setClearColor(0x87ceeb);
scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x87ceeb,80,250);
camera=new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,0.1,300);

window.addEventListener('resize',function(){
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});

// Lighting
var amb=new THREE.AmbientLight(0xffffff,0.6);scene.add(amb);
var dir=new THREE.DirectionalLight(0xffffff,0.8);dir.position.set(5,10,7);scene.add(dir);

// Road
var LANE_W=3.5, LANES=4, ROAD_W=LANE_W*LANES;
var roadGeo=new THREE.PlaneGeometry(ROAD_W,600);
var roadMat=new THREE.MeshLambertMaterial({color:0x333333});
var road=new THREE.Mesh(roadGeo,roadMat);
road.rotation.x=-Math.PI/2;
road.position.set(0,0,0);
scene.add(road);

// Lane markings
for(var ln=1;ln<LANES;ln++){
  for(var s=-30;s<30;s++){
    var mark=new THREE.Mesh(new THREE.PlaneGeometry(0.2,3),new THREE.MeshBasicMaterial({color:0xffffff}));
    mark.rotation.x=-Math.PI/2;
    mark.position.set(-ROAD_W/2+ln*LANE_W,0.01,s*10);
    scene.add(mark);
  }
}

// Grass
var grassL=new THREE.Mesh(new THREE.PlaneGeometry(60,600),new THREE.MeshLambertMaterial({color:0x228B22}));
grassL.rotation.x=-Math.PI/2;grassL.position.set(-ROAD_W/2-30,-.01,0);scene.add(grassL);
var grassR=new THREE.Mesh(new THREE.PlaneGeometry(60,600),new THREE.MeshLambertMaterial({color:0x228B22}));
grassR.rotation.x=-Math.PI/2;grassR.position.set(ROAD_W/2+30,-.01,0);scene.add(grassR);

// --- Car creation ---
function createCar(color,w,h,l){
  w=w||2;h=h||1.2;l=l||4;
  var g=new THREE.Group();
  // body
  var body=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),new THREE.MeshLambertMaterial({color:color}));
  body.position.y=h/2+0.3;
  g.add(body);
  // roof
  var roof=new THREE.Mesh(new THREE.BoxGeometry(w*0.7,h*0.6,l*0.5),new THREE.MeshLambertMaterial({color:color}));
  roof.position.y=h+h*0.3+0.3;
  g.add(roof);
  // wheels
  var wGeo=new THREE.CylinderGeometry(0.35,0.35,0.3,8);
  var wMat=new THREE.MeshLambertMaterial({color:0x111111});
  [[-w/2-0.15,0.35,l*0.3],[w/2+0.15,0.35,l*0.3],[-w/2-0.15,0.35,-l*0.3],[w/2+0.15,0.35,-l*0.3]].forEach(function(p){
    var wh=new THREE.Mesh(wGeo,wMat);
    wh.rotation.z=Math.PI/2;
    wh.position.set(p[0],p[1],p[2]);
    g.add(wh);
  });
  return g;
}

// Player
var player=createCar(0x0088ff);
scene.add(player);

// --- Game state ---
var STATE={START:0,PLAY:1,DEAD:2};
var state=STATE.START;
var score=0, distance=0, speed=0, baseSpeed=0.6, maxSpeed=1.5;
var playerX=0, playerLane=1;
var traffic=[], powerups=[];
var shakeTimer=0, explosionParticles=[];
var difficultyTimer=0;
var shieldActive=false, shieldTimer=0;
var shieldMesh=null;
var keys={};
var scoreEl=document.getElementById('score');
var startEl=document.getElementById('start');
var overEl=document.getElementById('gameover');
var finalEl=document.getElementById('final-score');
var powerupEl=document.getElementById('powerup-indicator');

// Shield visual
shieldMesh=new THREE.Mesh(new THREE.SphereGeometry(2.5,16,12),new THREE.MeshBasicMaterial({color:0x00ffff,transparent:true,opacity:0.3,wireframe:true}));
shieldMesh.visible=false;
player.add(shieldMesh);

// Input
document.addEventListener('keydown',function(e){
  keys[e.key]=true;keys[e.code]=true;
  if(state===STATE.START){startGame();}
  else if(state===STATE.DEAD&&!shakeTimer){restartGame();}
});
document.addEventListener('keyup',function(e){keys[e.key]=false;keys[e.code]=false;});
document.addEventListener('click',function(){
  if(state===STATE.START)startGame();
  else if(state===STATE.DEAD&&!shakeTimer)restartGame();
});

function startGame(){
  state=STATE.PLAY;
  startEl.style.display='none';
  scoreEl.style.display='block';
  resetGame();
  startEngine();
}
function restartGame(){
  overEl.style.display='none';
  scoreEl.style.display='block';
  state=STATE.PLAY;
  resetGame();
  startEngine();
}
function resetGame(){
  score=0;distance=0;speed=baseSpeed;playerX=0;
  difficultyTimer=0;
  shieldActive=false;shieldTimer=0;shieldMesh.visible=false;
  powerupEl.style.display='none';
  // clear traffic
  traffic.forEach(function(t){scene.remove(t.mesh);});
  traffic=[];
  powerups.forEach(function(p){scene.remove(p.mesh);});
  powerups=[];
  explosionParticles.forEach(function(p){scene.remove(p);});
  explosionParticles=[];
  shakeTimer=0;
  // spawn initial traffic
  for(var i=0;i<5;i++) spawnTraffic(50+i*40);
}

function spawnTraffic(zOffset){
  var lane=Math.floor(Math.random()*LANES);
  var x=-ROAD_W/2+LANE_W/2+lane*LANE_W;
  var colors=[0xff2222,0x22cc22,0xffcc00,0xff8800,0xaa22ff];
  var c=colors[Math.floor(Math.random()*colors.length)];
  var mesh=createCar(c);
  mesh.position.set(x,0,player.position.z-(zOffset||80)-Math.random()*40);
  scene.add(mesh);
  traffic.push({mesh:mesh,speed:0.2+Math.random()*0.3,lane:lane});
}

function spawnPowerup(){
  var lane=Math.floor(Math.random()*LANES);
  var x=-ROAD_W/2+LANE_W/2+lane*LANE_W;
  var geo=new THREE.OctahedronGeometry(0.8);
  var mat=new THREE.MeshLambertMaterial({color:0x00ffff,emissive:0x004444});
  var mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(x,1.5,player.position.z-120);
  scene.add(mesh);
  powerups.push({mesh:mesh});
}

// Collision AABB
function collides(ax,az,aw,al,bx,bz,bw,bl){
  return Math.abs(ax-bx)<(aw+bw)/2 && Math.abs(az-bz)<(al+bl)/2;
}

function die(){
  state=STATE.DEAD;
  stopEngine();
  playExplosion();
  shakeTimer=0.5;
  // explosion particles
  for(var i=0;i<20;i++){
    var pg=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3),new THREE.MeshBasicMaterial({color:Math.random()>0.5?0xff4400:0xffcc00}));
    pg.position.copy(player.position);
    pg.position.y+=1;
    pg.userData={vx:(Math.random()-0.5)*0.5,vy:Math.random()*0.4+0.2,vz:(Math.random()-0.5)*0.5,life:1};
    scene.add(pg);
    explosionParticles.push(pg);
  }
  // show gameover after shake
  setTimeout(function(){
    overEl.style.display='flex';
    finalEl.textContent='Score: '+Math.floor(score);
  },600);
}

// Score blip
var lastScoreMilestone=0;

// --- Main loop ---
var clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  var dt=clock.getDelta();
  if(dt>0.1)dt=0.1;

  if(state===STATE.PLAY){
    // Difficulty ramp
    difficultyTimer+=dt;
    var diffMult=1+difficultyTimer*0.03; // noticeable within 60s

    speed=baseSpeed*diffMult;
    if(speed>maxSpeed*2)speed=maxSpeed*2;
    var moveSpeed=speed*60*dt;

    // Input
    var steer=0;
    if(keys['ArrowLeft']||keys['KeyA']||keys['a'])steer=-1;
    if(keys['ArrowRight']||keys['KeyD']||keys['d'])steer=1;
    playerX+=steer*8*dt;
    var halfRoad=ROAD_W/2-1;
    if(playerX<-halfRoad)playerX=-halfRoad;
    if(playerX>halfRoad)playerX=halfRoad;

    player.position.x=playerX;
    player.position.z-=moveSpeed;
    distance+=moveSpeed;
    score=distance*0.5;

    // Score blip every 50 points
    if(Math.floor(score/50)>lastScoreMilestone){
      lastScoreMilestone=Math.floor(score/50);
      playTone(660,0.08,'sine',0.1);
    }

    updateEngine(speed*30);
    scoreEl.textContent='Score: '+Math.floor(score);

    // Traffic
    var spawnDist=Math.max(30,60-difficultyTimer*0.5);
    traffic.forEach(function(t){
      t.mesh.position.z-=t.speed*60*dt;
    });
    // remove far traffic, spawn new
    for(var i=traffic.length-1;i>=0;i--){
      if(traffic[i].mesh.position.z>player.position.z+30){
        scene.remove(traffic[i].mesh);
        traffic.splice(i,1);
        spawnTraffic();
      }
    }
    // ensure minimum traffic count (increases with difficulty)
    var minTraffic=3+Math.floor(difficultyTimer/10);
    while(traffic.length<minTraffic) spawnTraffic();

    // Collision
    if(!shieldActive){
      for(var i=0;i<traffic.length;i++){
        var t=traffic[i];
        if(collides(player.position.x,player.position.z,2,4,t.mesh.position.x,t.mesh.position.z,2,4)){
          die();break;
        }
      }
    }else{
      // Shield: destroy traffic on contact
      for(var i=traffic.length-1;i>=0;i--){
        var t=traffic[i];
        if(collides(player.position.x,player.position.z,3,5,t.mesh.position.x,t.mesh.position.z,2,4)){
          scene.remove(t.mesh);traffic.splice(i,1);
        }
      }
    }

    // Powerups
    if(Math.random()<0.003*dt*60) spawnPowerup();
    for(var i=powerups.length-1;i>=0;i--){
      var p=powerups[i];
      p.mesh.rotation.y+=2*dt;
      if(collides(player.position.x,player.position.z,2,4,p.mesh.position.x,p.mesh.position.z,1.6,1.6)){
        scene.remove(p.mesh);powerups.splice(i,1);
        activateShield();
        playPowerup();
      }else if(p.mesh.position.z>player.position.z+30){
        scene.remove(p.mesh);powerups.splice(i,1);
      }
    }

    // Shield timer
    if(shieldActive){
      shieldTimer-=dt;
      if(shieldTimer<=0){shieldActive=false;shieldMesh.visible=false;powerupEl.style.display='none';}
    }

    // Road repositioning (infinite road illusion)
    road.position.z=player.position.z;
    grassL.position.z=player.position.z;
    grassR.position.z=player.position.z;
  }

  // Explosion particles
  for(var i=explosionParticles.length-1;i>=0;i--){
    var ep=explosionParticles[i];
    ep.position.x+=ep.userData.vx;
    ep.position.y+=ep.userData.vy;
    ep.position.z+=ep.userData.vz;
    ep.userData.vy-=0.02;
    ep.userData.life-=dt*2;
    if(ep.userData.life<=0){scene.remove(ep);explosionParticles.splice(i,1);}
  }

  // Camera
  var camTarget=player.position.clone();
  var shakeX=0,shakeY=0;
  if(shakeTimer>0){
    shakeTimer-=dt;
    shakeX=(Math.random()-0.5)*shakeTimer*4;
    shakeY=(Math.random()-0.5)*shakeTimer*4;
  }
  camera.position.set(camTarget.x+shakeX,camTarget.y+8+shakeY,camTarget.z+14);
  camera.lookAt(camTarget.x,camTarget.y,camTarget.z-10);

  renderer.render(scene,camera);
}

function activateShield(){
  shieldActive=true;
  shieldTimer=5;
  shieldMesh.visible=true;
  powerupEl.style.display='block';
  powerupEl.textContent='SHIELD: 5s';
  var iv=setInterval(function(){
    if(!shieldActive){clearInterval(iv);return;}
    powerupEl.textContent='SHIELD: '+Math.ceil(shieldTimer)+'s';
  },200);
}

animate();
})();
