// ============================================================================
//  NEON RUSH — a top-down highway dodge racer.
//  Full game loop: START -> PLAYING -> GAMEOVER -> restart.
//  Player dodges traffic, races AI rivals (neural-net driven), collects boost
//  cells, chains near-misses for combo multipliers, and survives escalating
//  waves. Score = distance + overtakes + near-miss combos.
// ============================================================================

const carCanvas=document.getElementById("gameCanvas");
const ctx=carCanvas.getContext("2d");

const GAME={
    state:"START",       // START | PLAYING | GAMEOVER
    road:null,
    player:null,
    traffic:[],
    rivals:[],
    pickups:[],
    particles:[],
    floaters:[],         // floating score text
    nextObstacleId:0,

    score:0,
    distance:0,          // world distance travelled
    combo:1,
    comboTimer:0,
    overtakes:0,
    level:1,
    boostFuel:100,       // 0..100

    trafficSpeed:2,
    spawnGap:220,        // vertical gap between spawn rows (shrinks with level)
    lastSpawnY:0,
    startY:0,

    highScore:0,
    lastTime:0,
    screenShake:0,
    invuln:0             // brief i-frames after start
};

const LANES=4;
const ROAD_WIDTH=340;

// ---- storage (best-effort) ----
function loadHighScore(){
    const v=parseInt(Storage.get("neonRushHigh"));
    GAME.highScore=isNaN(v)?0:v;
}
function saveHighScore(){
    Storage.set("neonRushHigh",String(GAME.highScore));
}

// ---- sizing ----
function resize(){
    carCanvas.width=Math.min(window.innerWidth,520);
    carCanvas.height=window.innerHeight;
}
window.addEventListener("resize",resize);
resize();

// ---------------------------------------------------------------------------
//  Setup / reset
// ---------------------------------------------------------------------------
function initGame(){
    GAME.road=new Road(carCanvas.width/2,ROAD_WIDTH,LANES);
    GAME.player=new Car(GAME.road.getLaneCenter(1),0,32,54,"PLAYER",5,"#00e5ff");
    GAME.player.startY=0;
    GAME.startY=0;

    GAME.traffic=[];
    GAME.rivals=[];
    GAME.pickups=[];
    GAME.particles=[];
    GAME.floaters=[];
    GAME.nextObstacleId=0;

    GAME.score=0;
    GAME.distance=0;
    GAME.combo=1;
    GAME.comboTimer=0;
    GAME.overtakes=0;
    GAME.level=1;
    GAME.boostFuel=100;
    GAME.trafficSpeed=2;
    GAME.spawnGap=220;
    GAME.lastSpawnY=-120;
    GAME.screenShake=0;
    GAME.invuln=90;

    // spawn a couple of rival racers
    spawnRival();
    spawnRival();

    // prefill road ahead
    for(let i=0;i<6;i++) spawnRow(GAME.lastSpawnY);
}

function spawnRival(){
    const lane=Math.floor(Math.random()*LANES);
    const colors=["#ff2a6d","#c400ff","#ff9f1c"];
    const r=new Car(GAME.road.getLaneCenter(lane),GAME.player.y+rand(60,180),32,54,"RIVAL",4.4,colors[GAME.rivals.length%colors.length]);
    GAME.rivals.push(r);
}

// spawn a "row" of traffic + occasional pickup, ahead of the player (smaller y)
function spawnRow(fromY){
    const rowY=fromY-GAME.spawnGap-rand(0,60);
    GAME.lastSpawnY=rowY;

    // choose lanes to fill, always leave >=1 gap
    const filled=Math.min(LANES-1,1+Math.floor(GAME.level/2));
    const lanes=[0,1,2,3].sort(()=>Math.random()-0.5).slice(0,filled);
    for(const lane of lanes){
        const t=new Car(GAME.road.getLaneCenter(lane),rowY,30,52,"TRAFFIC",GAME.trafficSpeed+rand(-0.4,0.6),trafficColor());
        t.obstacleId=GAME.nextObstacleId++;
        GAME.traffic.push(t);
    }
    // occasional boost pickup in an empty lane
    if(Math.random()<0.35){
        const empty=[0,1,2,3].filter(l=>!lanes.includes(l));
        if(empty.length){
            const lane=empty[Math.floor(Math.random()*empty.length)];
            GAME.pickups.push({x:GAME.road.getLaneCenter(lane),y:rowY-rand(20,80),r:11,phase:Math.random()*6});
        }
    }
}

function trafficColor(){
    const g=["#4a5568","#718096","#2d3748","#5a6b8c"];
    return g[Math.floor(Math.random()*g.length)];
}

// ---------------------------------------------------------------------------
//  Effects
// ---------------------------------------------------------------------------
function burst(x,y,color,n,spread){
    for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2;
        const s=rand(1,spread||5);
        GAME.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,color});
    }
}
function floater(x,y,text,color){
    GAME.floaters.push({x,y,text,color,life:1});
}

// ---------------------------------------------------------------------------
//  Update
// ---------------------------------------------------------------------------
function update(dt){
    const p=GAME.player;
    p.update(GAME.road.borders,[...GAME.traffic,...GAME.rivals]);

    if(GAME.invuln>0){ GAME.invuln--; p.damaged=false; }

    // world scroll reference = player's y (negative = forward)
    const forwardDist=Math.max(0,GAME.startY-p.y);
    GAME.distance=forwardDist;

    // engine sound
    const frac=clamp(Math.abs(p.speed)/(p.maxSpeed*1.7),0,1);
    Sound.setEngine(frac,p.controls.boost&&p.controls.forward);

    // boost fuel
    if(p.controls.boost && p.controls.forward && p.speed>0.5){
        GAME.boostFuel=clamp(GAME.boostFuel-0.8,0,100);
        if(GAME.boostFuel<=0){ p.controls.boost=false; }
        if(Math.random()<0.5) burst(p.x,p.y+26,"#ff8a00",1,2);
    }else{
        GAME.boostFuel=clamp(GAME.boostFuel+0.15,0,100);
    }

    // traffic + rivals
    for(const t of GAME.traffic) t.update(GAME.road.borders,[]);
    for(const r of GAME.rivals){
        r.update(GAME.road.borders,[...GAME.traffic,...GAME.rivals.filter(x=>x!==r)]);
        if(r.damaged){ burst(r.x,r.y,r.color,18,6); Sound.crash(); }
    }
    // respawn crashed rivals ahead after a beat
    GAME.rivals=GAME.rivals.filter(r=>!r.damaged);
    while(GAME.rivals.length<2) spawnRival();

    // overtakes (passing traffic)
    for(const t of GAME.traffic){
        if(!t.passed && p.y<t.y){
            t.passed=true;
            GAME.overtakes++;
            GAME.score+=25*GAME.combo;
            floater(t.x,t.y,"+"+(25*GAME.combo),"#00e5ff");
            Sound.overtake();
        }
    }

    // near-miss combo: traffic close but not hit
    for(const t of GAME.traffic){
        if(t.damaged) continue;
        const dx=Math.abs(t.x-p.x), dy=Math.abs(t.y-p.y);
        if(dx<46 && dx>18 && dy<34 && p.y<t.y+10 && !t.nearCounted && p.speed>1){
            t.nearCounted=true;
            GAME.combo=Math.min(GAME.combo+1,9);
            GAME.comboTimer=140;
            GAME.score+=10*GAME.combo;
            floater(p.x,p.y-30,"NEAR! x"+GAME.combo,"#ffcf00");
            Sound.near();
        }
    }
    if(GAME.comboTimer>0){ GAME.comboTimer--; if(GAME.comboTimer===0) GAME.combo=1; }

    // pickups
    for(let i=GAME.pickups.length-1;i>=0;i--){
        const pk=GAME.pickups[i];
        pk.phase+=0.1;
        if(Math.abs(pk.x-p.x)<26 && Math.abs(pk.y-p.y)<32){
            GAME.boostFuel=clamp(GAME.boostFuel+40,0,100);
            GAME.score+=50;
            floater(pk.x,pk.y,"+FUEL","#00ffb3");
            burst(pk.x,pk.y,"#00ffb3",16,5);
            Sound.pickup();
            GAME.pickups.splice(i,1);
        }
    }

    // score from distance travelled (continuous)
    GAME.score+=frac*0.6*dt;

    // level ramp by distance
    const newLevel=1+Math.floor(forwardDist/1400);
    if(newLevel>GAME.level){
        GAME.level=newLevel;
        GAME.trafficSpeed=Math.min(2+GAME.level*0.35,5.5);
        GAME.spawnGap=Math.max(120,220-GAME.level*10);
        floater(p.x,p.y-60,"WAVE "+GAME.level,"#c400ff");
        burst(p.x,p.y,"#c400ff",24,7);
        Sound.levelUp();
    }

    // spawn ahead
    while(GAME.lastSpawnY>p.y-carCanvas.height*1.3){
        spawnRow(GAME.lastSpawnY);
    }
    // cull behind
    GAME.traffic=GAME.traffic.filter(t=>t.y<p.y+carCanvas.height);
    GAME.pickups=GAME.pickups.filter(pk=>pk.y<p.y+carCanvas.height);

    // particles
    for(let i=GAME.particles.length-1;i>=0;i--){
        const pt=GAME.particles[i];
        pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.02; pt.life-=0.03;
        if(pt.life<=0) GAME.particles.splice(i,1);
    }
    for(let i=GAME.floaters.length-1;i>=0;i--){
        const f=GAME.floaters[i];
        f.y-=1; f.life-=0.018;
        if(f.life<=0) GAME.floaters.splice(i,1);
    }
    if(GAME.screenShake>0) GAME.screenShake*=0.85;

    // crash = game over
    if(p.damaged && GAME.invuln<=0){
        gameOver();
    }
}

function gameOver(){
    const finalScore=Math.floor(GAME.score);
    burst(GAME.player.x,GAME.player.y,GAME.player.color,40,9);
    GAME.screenShake=20;
    Sound.crash();
    Sound.stopEngine();
    if(finalScore>GAME.highScore){ GAME.highScore=finalScore; saveHighScore(); }
    GAME.state="GAMEOVER";
    showGameOver(finalScore);
}

// ---------------------------------------------------------------------------
//  Render
// ---------------------------------------------------------------------------
function render(){
    const p=GAME.player;
    ctx.fillStyle="#0a0a12";
    ctx.fillRect(0,0,carCanvas.width,carCanvas.height);

    ctx.save();
    if(GAME.screenShake>0.5){
        ctx.translate(rand(-GAME.screenShake,GAME.screenShake),rand(-GAME.screenShake,GAME.screenShake));
    }
    // camera: player ~70% down the screen
    ctx.translate(0,-p.y+carCanvas.height*0.72);

    GAME.road.draw(ctx);

    // pickups (spinning boost cells)
    for(const pk of GAME.pickups){
        const pulse=0.6+0.4*Math.sin(pk.phase);
        ctx.save();
        ctx.translate(pk.x,pk.y);
        ctx.rotate(pk.phase*0.5);
        ctx.shadowBlur=16; ctx.shadowColor="#00ffb3";
        ctx.fillStyle="rgba(0,255,179,"+pulse+")";
        ctx.beginPath();
        for(let i=0;i<6;i++){
            const a=i/6*Math.PI*2;
            ctx.lineTo(Math.cos(a)*pk.r,Math.sin(a)*pk.r);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    for(const t of GAME.traffic) t.draw(ctx);
    for(const r of GAME.rivals) r.draw(ctx);
    p.draw(ctx);

    // particles
    for(const pt of GAME.particles){
        ctx.globalAlpha=Math.max(0,pt.life);
        ctx.fillStyle=pt.color;
        ctx.fillRect(pt.x-2,pt.y-2,4,4);
    }
    ctx.globalAlpha=1;

    // floaters
    ctx.textAlign="center";
    ctx.font="bold 15px 'Segoe UI',sans-serif";
    for(const f of GAME.floaters){
        ctx.globalAlpha=Math.max(0,f.life);
        ctx.fillStyle=f.color;
        ctx.fillText(f.text,f.x,f.y);
    }
    ctx.globalAlpha=1;

    ctx.restore();

    drawHUD();
}

function drawHUD(){
    const w=carCanvas.width;
    // top bar
    ctx.fillStyle="rgba(0,0,0,0.35)";
    ctx.fillRect(0,0,w,54);

    ctx.textAlign="left";
    ctx.font="bold 22px 'Segoe UI',sans-serif";
    ctx.fillStyle="#fff";
    ctx.fillText(Math.floor(GAME.score).toLocaleString(),14,34);
    ctx.font="11px 'Segoe UI',sans-serif";
    ctx.fillStyle="#8899bb";
    ctx.fillText("SCORE",14,48);

    ctx.textAlign="right";
    ctx.font="bold 16px 'Segoe UI',sans-serif";
    ctx.fillStyle="#c400ff";
    ctx.fillText("WAVE "+GAME.level,w-14,26);
    ctx.font="11px 'Segoe UI',sans-serif";
    ctx.fillStyle="#8899bb";
    ctx.fillText(Math.floor(GAME.distance)+" m",w-14,44);

    // combo
    if(GAME.combo>1){
        ctx.textAlign="center";
        ctx.font="bold 18px 'Segoe UI',sans-serif";
        const a=0.5+0.5*Math.sin(Date.now()/100);
        ctx.fillStyle="rgba(255,207,0,"+a+")";
        ctx.fillText("COMBO x"+GAME.combo,w/2,34);
    }

    // boost bar (bottom)
    const bw=w-28, bh=10, bx=14, by=carCanvas.height-24;
    ctx.fillStyle="rgba(255,255,255,0.12)";
    ctx.fillRect(bx,by,bw,bh);
    const g=ctx.createLinearGradient(bx,0,bx+bw,0);
    g.addColorStop(0,"#00e5ff"); g.addColorStop(1,"#00ffb3");
    ctx.fillStyle=g;
    ctx.fillRect(bx,by,bw*GAME.boostFuel/100,bh);
    ctx.textAlign="left";
    ctx.font="10px 'Segoe UI',sans-serif";
    ctx.fillStyle="#8899bb";
    ctx.fillText("BOOST (SHIFT)",bx,by-5);
}

// ---------------------------------------------------------------------------
//  Loop
// ---------------------------------------------------------------------------
function loop(time){
    const dt=Math.min((time-GAME.lastTime)/16.67,3)||1;
    GAME.lastTime=time;

    if(GAME.state==="PLAYING"){
        update(dt);
        render();
    }else if(GAME.state==="GAMEOVER"){
        // keep rendering the frozen scene + fading particles
        for(let i=GAME.particles.length-1;i>=0;i--){
            const pt=GAME.particles[i];
            pt.x+=pt.vx; pt.y+=pt.vy; pt.life-=0.02;
            if(pt.life<=0) GAME.particles.splice(i,1);
        }
        if(GAME.screenShake>0.5) GAME.screenShake*=0.85;
        render();
    }
    requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
//  UI wiring
// ---------------------------------------------------------------------------
function startGame(){
    document.getElementById("startScreen").classList.add("hidden");
    document.getElementById("gameOverScreen").classList.add("hidden");
    Sound.unlock();
    Sound.startEngine();
    initGame();
    GAME.state="PLAYING";
}

function showGameOver(score){
    document.getElementById("finalScore").textContent=score.toLocaleString();
    document.getElementById("finalWave").textContent=GAME.level;
    document.getElementById("finalHigh").textContent=GAME.highScore.toLocaleString();
    const nb=document.getElementById("newBest");
    nb.style.display=(score>=GAME.highScore && score>0)?"block":"none";
    document.getElementById("gameOverScreen").classList.remove("hidden");
}

function bindUI(){
    document.getElementById("startBtn").addEventListener("click",()=>{ Sound.uiClick(); startGame(); });
    document.getElementById("restartBtn").addEventListener("click",()=>{ Sound.uiClick(); startGame(); });
    const mute=document.getElementById("muteBtn");
    mute.addEventListener("click",()=>{
        const m=Sound.toggleMute();
        mute.textContent=m?"🔇":"🔊";
    });
    // start / restart on Enter/Space
    document.addEventListener("keydown",(e)=>{
        if((e.key==="Enter"||e.key===" ")){
            if(GAME.state==="START") startGame();
            else if(GAME.state==="GAMEOVER") startGame();
        }
    });
}

// boot
(function boot(){
    loadHighScore();
    document.getElementById("startHigh").textContent=GAME.highScore.toLocaleString();
    bindUI();
    // evolve rival brain in the background (fast, headless). Fall back gracefully.
    try{ RivalAI.evolve(); }catch(e){ /* rivals use random brain */ }
    requestAnimationFrame(loop);
})();
