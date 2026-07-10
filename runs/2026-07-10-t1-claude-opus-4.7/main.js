// ===== NEURAL RUSH =====
const carCanvas=document.getElementById("carCanvas");
const carCtx=carCanvas.getContext("2d");

const ROAD_W=360;
const LANES=4;
let W=window.innerWidth, H=window.innerHeight;
function resize(){
    W=window.innerWidth; H=window.innerHeight;
    carCanvas.width=W; carCanvas.height=H;
}
window.addEventListener("resize",resize);
resize();

// ---- Audio (WebAudio, no external assets) ----
const Sound=(()=>{
    let ctx=null, muted=false;
    function ensure(){
        if(!ctx){
            try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){}
        }
        if(ctx && ctx.state==="suspended") ctx.resume();
    }
    function beep(freq,dur,type="sine",vol=0.15){
        if(muted) return;
        ensure(); if(!ctx) return;
        const o=ctx.createOscillator(), g=ctx.createGain();
        o.type=type; o.frequency.value=freq;
        g.gain.setValueAtTime(vol,ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+dur);
        o.connect(g).connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime+dur);
    }
    return {
        coin:()=>{beep(880,0.08,"square",0.12); setTimeout(()=>beep(1320,0.08,"square",0.10),60);},
        crash:()=>{beep(120,0.4,"sawtooth",0.25); beep(60,0.5,"triangle",0.2);},
        nearMiss:()=>beep(1500,0.05,"triangle",0.08),
        levelUp:()=>{beep(660,0.1,"square",0.15); setTimeout(()=>beep(880,0.1,"square",0.15),100); setTimeout(()=>beep(1320,0.15,"square",0.18),200);},
        gameOver:()=>{beep(400,0.2,"sawtooth",0.2); setTimeout(()=>beep(200,0.4,"sawtooth",0.2),200);},
        boost:()=>beep(200,0.05,"sawtooth",0.05),
        toggle:()=>{muted=!muted;},
        isMuted:()=>muted
    };
})();

// ---- Game State ----
const State={ MENU:"MENU", PLAY:"PLAYING", OVER:"OVER", PAUSED:"PAUSED" };
let state=State.MENU;
let road, player, traffic, hunters, coins, particles;
let nextTrafficId=0;
let score=0, best=0, combo=1, comboTimer=0, comboDecay=180;
let level=1, levelScore=0;
let lives=3;
let cameraY=0, cameraShake=0;
let lastTime=0;
let paused=false;
let bannerText="", bannerTimer=0;
let starfield=[];

// load best
try{ best=parseInt(SafeStorage.get("neuralRushBest"))||0; }catch(e){ best=0; }

function seedStarfield(){
    starfield=[];
    for(let i=0;i<60;i++){
        starfield.push({x:rand(-W,W*2),y:rand(-H,H*2),s:rand(0.5,1.5)});
    }
}
seedStarfield();

// ---- Init ----
function initGame(){
    road=new Road(W/2,ROAD_W,LANES);
    player=new Car(road.getLaneCenter(Math.floor(LANES/2)),0,32,52,"PLAYER",{maxSpeed:7,color:"#38d0ff"});
    player.fuel=100;
    player.invuln=90;
    traffic=[];
    hunters=[];
    coins=[];
    particles=[];
    nextTrafficId=0;
    score=0; combo=1; comboTimer=0;
    level=1; levelScore=0;
    lives=3;
    cameraY=0; cameraShake=0;
    spawnBatch(true);
    bannerText="LEVEL 1"; bannerTimer=90;
}

function levelParams(){
    // Escalating: more traffic, faster, more hunters
    const density = clamp(1 + level*0.25, 1, 4.5);
    const tSpeed = 1.5 + level*0.35;
    const hunterCount = Math.min(Math.floor((level-1)/2), 6);
    return {density,tSpeed,hunterCount};
}

function spawnBatch(initial){
    const {tSpeed}=levelParams();
    if(initial){
        // Seed the road ahead with a nice initial pattern of traffic
        for(let i=0;i<10;i++){
            spawnTrafficAt(-300 - i*rand(140,220), tSpeed);
        }
    }else{
        spawnTrafficAt(player.y - 900 - rand(0,400), tSpeed);
    }
}

function spawnTrafficAt(y,tSpeed){
    // avoid spawning on top of another car
    for(let tries=0;tries<6;tries++){
        const lane=randInt(0,LANES-1);
        const x=road.getLaneCenter(lane);
        let ok=true;
        for(const t of traffic){
            if(Math.abs(t.y-y)<80 && Math.abs(t.x-x)<40){ ok=false; break; }
        }
        if(ok){
            const c=new Car(x,y,30,50,"DUMMY",{maxSpeed:tSpeed,color:trafficColor()});
            c.trafficId=nextTrafficId++;
            traffic.push(c);
            return;
        }
        y -= 60;
    }
}

function spawnHunter(){
    const lane=randInt(0,LANES-1);
    // Hunters spawn BEHIND player and try to catch up (faster than base player, slower than boost)
    const c=new Car(road.getLaneCenter(lane), player.y + 500 + rand(0,300), 32, 52, "HUNTER",
        {maxSpeed: 7.5 + level*0.2, color:"#e63a3a"});
    hunters.push(c);
}

function spawnCoin(){
    const lane=randInt(0,LANES-1);
    coins.push({
        x:road.getLaneCenter(lane),
        y: player.y - 800 - rand(0,400),
        r:12, spin:0, collected:false
    });
}

function addParticle(x,y,color,count=8,speed=3){
    for(let i=0;i<count;i++){
        const a=rand(0,Math.PI*2);
        particles.push({x,y,vx:Math.cos(a)*rand(1,speed),vy:Math.sin(a)*rand(1,speed),life:30,max:30,color});
    }
}

// ---- Update ----
function update(){
    if(state!==State.PLAY) return;

    // update player
    player.update(road.borders, [...traffic, ...hunters], null);

    // player fuel / boost
    if(player.controls.boost && player.fuel>0){
        player.fuel-=0.4;
        if(Math.random()<0.3) Sound.boost();
        // exhaust particles
        const bx=player.x+Math.sin(player.angle)*(player.height/2);
        const by=player.y+Math.cos(player.angle)*(player.height/2);
        if(Math.random()<0.6) particles.push({x:bx+rand(-4,4),y:by,vx:rand(-1,1),vy:rand(2,5),life:20,max:20,color:"#ff8"});
    }
    if(player.fuel<0) player.fuel=0;

    // update traffic
    for(let i=0;i<traffic.length;i++){
        traffic[i].update(road.borders, [player, ...hunters, ...traffic], null);
    }
    // hunters
    for(let i=0;i<hunters.length;i++){
        hunters[i].update(road.borders, [player, ...traffic, ...hunters.filter((_,j)=>j!==i)], player);
    }

    // player crash handling
    if(player.damaged){
        onPlayerCrash();
        return;
    }

    // camera follow
    const targetY = player.y - H*0.7;
    cameraY = lerp(cameraY,targetY,0.15);
    if(cameraShake>0) cameraShake*=0.85;

    // score
    const dist = Math.max(0, -Math.round(player.y/10));
    // distance-based score
    if(dist > levelScore){
        const gain = dist - levelScore;
        score += gain * combo;
        levelScore = dist;
    }

    // combo decay
    if(comboTimer>0) comboTimer--;
    else if(combo>1){ combo=Math.max(1,combo-1); comboTimer=30; }

    // near-miss detection
    checkNearMiss();

    // pickups
    for(let i=coins.length-1;i>=0;i--){
        const c=coins[i]; c.spin+=0.15;
        const dx=c.x-player.x, dy=c.y-player.y;
        if(!c.collected && dx*dx+dy*dy < (c.r+20)*(c.r+20)){
            c.collected=true;
            score += 100 * combo;
            player.fuel = Math.min(100, player.fuel+15);
            combo += 1; comboTimer=comboDecay;
            addParticle(c.x,c.y,"#ffcf3a",12,4);
            Sound.coin();
        }
        if(c.y > player.y + 400) coins.splice(i,1);
    }

    // cull traffic behind
    for(let i=traffic.length-1;i>=0;i--){
        if(traffic[i].y > player.y + 400) traffic.splice(i,1);
        else if(traffic[i].damaged && traffic[i].y > player.y + 200) traffic.splice(i,1);
    }
    for(let i=hunters.length-1;i>=0;i--){
        if(hunters[i].y > player.y + 500 || hunters[i].damaged) hunters.splice(i,1);
    }

    // spawn new stuff ahead
    const {density,tSpeed,hunterCount}=levelParams();
    const desiredTraffic = Math.floor(10 * density);
    while(traffic.length < desiredTraffic){
        spawnTrafficAt(player.y - 900 - rand(0,600), tSpeed);
    }
    while(hunters.length < hunterCount){
        spawnHunter();
    }
    // coins occasional
    if(coins.length < 3 && Math.random()<0.02) spawnCoin();

    // particles
    for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.1; p.life--;
        if(p.life<=0) particles.splice(i,1);
    }

    // level progression
    const nextLevelAt = level*1500;
    if(score >= nextLevelAt){
        level++;
        bannerText="LEVEL "+level;
        bannerTimer=100;
        Sound.levelUp();
    }
}

let lastNearMissFrame={};
function checkNearMiss(){
    const all=[...traffic,...hunters];
    for(const t of all){
        if(t.damaged) continue;
        const dx=t.x-player.x, dy=t.y-player.y;
        const d=Math.hypot(dx,dy);
        if(d<45 && d>28 && Math.abs(dy)<50){
            const id=t.trafficId ?? ("h"+all.indexOf(t));
            if(!lastNearMissFrame[id] || performance.now()-lastNearMissFrame[id]>800){
                lastNearMissFrame[id]=performance.now();
                score += 25 * combo;
                combo += 1;
                comboTimer=comboDecay;
                Sound.nearMiss();
                addParticle(player.x,player.y,"#8ff",4,2);
            }
        }
    }
}

function onPlayerCrash(){
    Sound.crash();
    addParticle(player.x,player.y,"#f80",30,6);
    cameraShake=20;
    lives--;
    combo=1;
    if(lives<=0){
        gameOver();
    }else{
        // respawn
        player.damaged=false;
        player.speed=0;
        player.angle=0;
        player.x=road.getLaneCenter(Math.floor(LANES/2));
        player.invuln=90;
        // clear nearby cars
        for(let i=traffic.length-1;i>=0;i--){
            if(Math.abs(traffic[i].y-player.y)<200) traffic.splice(i,1);
        }
        for(let i=hunters.length-1;i>=0;i--){
            if(Math.abs(hunters[i].y-player.y)<300) hunters.splice(i,1);
        }
        bannerText=lives+" LIVES LEFT"; bannerTimer=80;
    }
}

function gameOver(){
    state=State.OVER;
    Sound.gameOver();
    if(score>best){
        best=score;
        SafeStorage.set("neuralRushBest",String(best));
    }
    showOverlay(true);
}

// ---- Draw ----
function draw(){
    carCtx.fillStyle="#0b0b18";
    carCtx.fillRect(0,0,W,H);

    // starfield / lights (parallax)
    carCtx.save();
    for(const s of starfield){
        const y=(s.y - cameraY*0.15)%(H+200); const yy=y<-100?y+H+200:y;
        carCtx.fillStyle="rgba(255,255,255,"+(0.2+s.s*0.3)+")";
        carCtx.fillRect(s.x,yy,s.s,s.s);
    }
    carCtx.restore();

    if(!road) return;

    carCtx.save();
    const shakeX=cameraShake>0?rand(-cameraShake,cameraShake):0;
    const shakeY=cameraShake>0?rand(-cameraShake,cameraShake):0;
    carCtx.translate(shakeX, -cameraY + shakeY);

    road.draw(carCtx, cameraY, H);

    // coins
    for(const c of coins){
        if(c.collected) continue;
        carCtx.save();
        carCtx.translate(c.x,c.y);
        carCtx.rotate(c.spin);
        carCtx.fillStyle="#ffcf3a";
        carCtx.strokeStyle="#7a5000";
        carCtx.lineWidth=2;
        carCtx.beginPath();
        carCtx.moveTo(0,-c.r); carCtx.lineTo(c.r,0); carCtx.lineTo(0,c.r); carCtx.lineTo(-c.r,0);
        carCtx.closePath(); carCtx.fill(); carCtx.stroke();
        carCtx.fillStyle="#fff5a0";
        carCtx.fillRect(-3,-c.r*0.6,2,c.r*1.2);
        carCtx.restore();
    }

    // cars
    for(const t of traffic) t.draw(carCtx);
    for(const h of hunters) h.draw(carCtx);
    if(player) player.draw(carCtx);

    // particles
    for(const p of particles){
        const a=p.life/p.max;
        carCtx.fillStyle=p.color;
        carCtx.globalAlpha=a;
        carCtx.fillRect(p.x-2,p.y-2,4,4);
    }
    carCtx.globalAlpha=1;

    carCtx.restore();

    // HUD updates
    updateHUD();

    if(bannerTimer>0){
        drawBanner();
        bannerTimer--;
    }

    if(state===State.PAUSED){
        carCtx.fillStyle="rgba(0,0,0,0.5)";
        carCtx.fillRect(0,0,W,H);
        carCtx.fillStyle="#fff";
        carCtx.font="bold 48px sans-serif";
        carCtx.textAlign="center";
        carCtx.fillText("PAUSED",W/2,H/2);
        carCtx.font="16px sans-serif";
        carCtx.fillText("Press P to resume",W/2,H/2+30);
    }
}

function drawBanner(){
    const a=Math.min(1,bannerTimer/30);
    carCtx.save();
    carCtx.globalAlpha=a;
    carCtx.font="bold 42px sans-serif";
    carCtx.textAlign="center";
    carCtx.fillStyle="#ffcf3a";
    carCtx.strokeStyle="#000"; carCtx.lineWidth=4;
    carCtx.strokeText(bannerText,W/2,H*0.3);
    carCtx.fillText(bannerText,W/2,H*0.3);
    carCtx.restore();
}

// ---- HUD ----
const hud={
    score:document.getElementById("hudScore"),
    best:document.getElementById("hudBest"),
    level:document.getElementById("hudLevel"),
    speed:document.getElementById("hudSpeed"),
    lives:document.getElementById("hudLives"),
    combo:document.getElementById("hudCombo")
};
function updateHUD(){
    hud.score.textContent=score;
    hud.best.textContent=best;
    hud.level.textContent=level;
    hud.speed.textContent=player? Math.round(Math.abs(player.speed)*15):0;
    hud.lives.textContent=lives>0?"♥".repeat(lives):"—";
    hud.combo.textContent="x"+combo;
    hud.combo.style.color=combo>=5?"#ffcf3a":(combo>=2?"#8ff":"#aaa");
    // fuel bar via css var on combo? put in speed area — draw a fuel gauge
}

// ---- Overlay ----
const overlay=document.getElementById("overlay");
const overlayCard=document.getElementById("overlayCard");
function showOverlay(gameOver){
    overlay.classList.add("show");
    if(gameOver){
        overlayCard.innerHTML=`
            <h1>GAME OVER</h1>
            <div class="finalScore">SCORE ${score}</div>
            <div class="finalBest">BEST ${best}${score===best&&score>0?" ★ NEW":""}</div>
            <div class="finalLevel">Reached level ${level}</div>
            <button id="startBtn">PLAY AGAIN</button>
            <p class="hint">Press <kbd>R</kbd> to restart quickly.</p>
        `;
        document.getElementById("startBtn").onclick=startGame;
    }
}
function hideOverlay(){ overlay.classList.remove("show"); }

function startGame(){
    hideOverlay();
    initGame();
    state=State.PLAY;
    Sound.crash; // ensure audio ctx
}

document.addEventListener("DOMContentLoaded",()=>{
    const btn=document.getElementById("startBtn");
    if(btn) btn.onclick=startGame;
});
// also bind now in case DOM already ready
{
    const btn=document.getElementById("startBtn");
    if(btn) btn.onclick=startGame;
}

document.addEventListener("keydown",(e)=>{
    if(e.key==="p"||e.key==="P"){
        if(state===State.PLAY){ state=State.PAUSED; }
        else if(state===State.PAUSED){ state=State.PLAY; }
    }
    if(e.key==="m"||e.key==="M"){ Sound.toggle(); }
    if(e.key==="r"||e.key==="R"){
        if(state===State.OVER || state===State.MENU) startGame();
    }
    if(e.key===" " || e.key==="Enter"){
        if(state===State.MENU || state===State.OVER) startGame();
    }
});

// ---- Loop ----
function loop(t){
    const dt=t-lastTime; lastTime=t;
    if(state===State.PLAY) update();
    draw();
    // fuel gauge overlay bottom-left
    if(player && state===State.PLAY){
        carCtx.save();
        carCtx.fillStyle="rgba(0,0,0,0.5)";
        carCtx.fillRect(20,H-40,220,22);
        carCtx.fillStyle=player.fuel<25?"#f55":"#5ec8ff";
        carCtx.fillRect(22,H-38,216*player.fuel/100,18);
        carCtx.fillStyle="#fff";
        carCtx.font="bold 12px monospace";
        carCtx.textAlign="left";
        carCtx.fillText("FUEL / BOOST",26,H-24);
        carCtx.restore();
        if(Sound.isMuted()){
            carCtx.fillStyle="#f66";
            carCtx.font="bold 12px monospace";
            carCtx.fillText("🔇 MUTED (M)",W-110,H-24);
        }
    }
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
