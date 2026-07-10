"use strict";

// ---------- safe storage (sandboxed iframes throw on access) ----------
const storage={
    get(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } },
    set(key,val){ try{ localStorage.setItem(key,val); }catch(e){} }
};

// ---------- canvas ----------
const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");
function fitCanvas(){
    canvas.width=window.innerWidth;
    canvas.height=window.innerHeight;
}
fitCanvas();
window.addEventListener("resize",fitCanvas);

// ---------- audio (all generated, no assets) ----------
const AudioFX={
    ctx:null,
    engine:null,engineGain:null,
    init(){
        if(this.ctx) return;
        try{
            this.ctx=new (window.AudioContext||window.webkitAudioContext)();
            this.engine=this.ctx.createOscillator();
            this.engine.type="sawtooth";
            this.engine.frequency.value=55;
            this.engineGain=this.ctx.createGain();
            this.engineGain.gain.value=0;
            const filter=this.ctx.createBiquadFilter();
            filter.type="lowpass";
            filter.frequency.value=320;
            this.engine.connect(filter);
            filter.connect(this.engineGain);
            this.engineGain.connect(this.ctx.destination);
            this.engine.start();
        }catch(e){ this.ctx=null; }
    },
    setEngine(speedRatio,on){
        if(!this.ctx) return;
        this.engineGain.gain.setTargetAtTime(on?0.03+speedRatio*0.03:0,this.ctx.currentTime,0.1);
        this.engine.frequency.setTargetAtTime(50+speedRatio*110,this.ctx.currentTime,0.08);
    },
    beep(freq,dur=0.1,type="square",vol=0.12){
        if(!this.ctx) return;
        const o=this.ctx.createOscillator(),g=this.ctx.createGain();
        o.type=type; o.frequency.value=freq;
        g.gain.setValueAtTime(vol,this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime+dur);
    },
    nearMiss(){ this.beep(880,0.08,"triangle",0.15); },
    overtake(){ this.beep(520,0.07,"square",0.08); },
    levelUp(){
        [440,554,659,880].forEach((f,i)=>
            setTimeout(()=>this.beep(f,0.12,"triangle",0.14),i*90));
    },
    crash(){
        if(!this.ctx) return;
        const len=this.ctx.sampleRate*0.5;
        const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
        const data=buf.getChannelData(0);
        for(let i=0;i<len;i++) data[i]=(Math.random()*2-1)*(1-i/len);
        const src=this.ctx.createBufferSource();
        src.buffer=buf;
        const g=this.ctx.createGain();
        g.gain.value=0.35;
        src.connect(g); g.connect(this.ctx.destination);
        src.start();
    }
};

// ---------- game constants ----------
const LANE_COUNT=4;
const ROAD_WIDTH=Math.min(320,window.innerWidth*0.86);
const LEVEL_DISTANCE=2200;          // world units per level
const PX_PER_METER=8;
const NEAR_MISS_DIST=46;            // center-to-center
const COMBO_WINDOW=2500;            // ms to keep the combo alive

// ---------- game state ----------
const STATE={MENU:0,PLAYING:1,DYING:2,GAMEOVER:3};
let state=STATE.MENU;

let road,player,traffic,particles,floaters;
let score,distance,level,overtakes,nearMisses,combo,comboTime;
let shake,dieTime,spawnTimer,lastTime,levelBannerTime;
let highScore=parseInt(storage.get("hd-highscore"))||0;
let newHighScore=false;

const TRAFFIC_COLORS=["#e74c3c","#e67e22","#f1c40f","#9b59b6","#1abc9c","#3498db"];

function levelParams(lv){
    return {
        trafficSpeed:1.6+Math.min(lv,12)*0.22,
        spawnInterval:Math.max(240,650-lv*50),   // ms between spawn attempts
        maxTraffic:9+Math.min(lv*2,16),
        eliteChance:lv>=3?Math.min(0.12+(lv-3)*0.06,0.45):0,
        playerMaxSpeed:4.4+Math.min(lv,10)*0.15
    };
}

function resetGame(){
    road=new Road(canvas.width/2,ROAD_WIDTH,LANE_COUNT);
    player=new Car(road.getLaneCenter(1),0,30,50,"KEYS",levelParams(1).playerMaxSpeed,"#2980ff");
    traffic=[];
    particles=[];
    floaters=[];
    score=0; distance=0; level=1;
    overtakes=0; nearMisses=0;
    combo=0; comboTime=0;
    shake=0; dieTime=0; spawnTimer=0;
    levelBannerTime=performance.now();
    newHighScore=false;
}

// ---------- traffic ----------
function spawnTraffic(now,params){
    if(traffic.length>=params.maxTraffic) return;
    const spawnY=player.y-canvas.height*0.85-Math.random()*250;
    const lane=Math.floor(Math.random()*LANE_COUNT);
    const x=road.getLaneCenter(lane);
    // don't spawn on top of an existing car
    for(const t of traffic){
        if(Math.abs(t.x-x)<40&&Math.abs(t.y-spawnY)<130) return;
    }
    const elite=Math.random()<params.eliteChance;
    const speed=elite?params.trafficSpeed*1.25:
        params.trafficSpeed*(0.75+Math.random()*0.5);
    const color=elite?"#ff2d6f":TRAFFIC_COLORS[Math.floor(Math.random()*TRAFFIC_COLORS.length)];
    const c=new Car(x,spawnY,30,50,elite?"SMART":"DUMMY",speed,color);
    c.elite=elite;
    c.passed=false;
    c.nearMissed=false;
    traffic.push(c);
}

function addFloater(text,x,y,color){
    floaters.push({text,x,y,color,life:1});
}

function explode(x,y){
    for(let i=0;i<42;i++){
        const a=Math.random()*Math.PI*2;
        const sp=1+Math.random()*5;
        particles.push({
            x,y,
            vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
            life:1, size:2+Math.random()*4,
            color:Math.random()<0.5?"#ff6b35":(Math.random()<0.5?"#ffd23f":"#ff2d2d")
        });
    }
}

// ---------- update ----------
function update(now,dt){
    const params=levelParams(level);
    player.maxSpeed=params.playerMaxSpeed;

    // world update
    for(const t of traffic){
        // elites sense borders + other cars + the player
        const others=t.elite?traffic.filter(o=>o!==t).concat([player]):[];
        t.update(road.borders,others);
    }
    player.update(road.borders,traffic);

    distance=Math.max(distance,-player.y);
    const newLevel=Math.floor(distance/LEVEL_DISTANCE)+1;
    if(newLevel>level){
        level=newLevel;
        levelBannerTime=now;
        AudioFX.levelUp();
        addFloater("LEVEL "+level+"!",player.x,player.y-90,"#7fff6a");
    }

    // score: distance + bonuses
    score=Math.floor(distance/PX_PER_METER)+overtakes*50+nearMisses*25;

    // overtakes & near misses
    for(const t of traffic){
        if(!t.passed && t.y>player.y+40){
            t.passed=true;
            overtakes++;
            combo++;
            comboTime=now;
            const bonus=50*(t.elite?2:1);
            if(t.elite){ overtakes++; } // elite worth double
            addFloater("+"+bonus+(combo>2?"  x"+combo:""),t.x,t.y,"#ffd23f");
            AudioFX.overtake();
        }
        if(!t.nearMissed && !t.passed){
            const d=Math.hypot(t.x-player.x,t.y-player.y);
            if(d<NEAR_MISS_DIST && player.speed>2){
                t.nearMissed=true;
                nearMisses++;
                combo++;
                comboTime=now;
                addFloater("NEAR MISS +25",player.x,player.y-50,"#6ee7ff");
                AudioFX.nearMiss();
                shake=Math.min(shake+4,10);
            }
        }
    }
    if(now-comboTime>COMBO_WINDOW) combo=0;

    // spawn & cleanup
    spawnTimer+=dt;
    if(spawnTimer>params.spawnInterval){
        spawnTimer=0;
        spawnTraffic(now,params);
    }
    traffic=traffic.filter(t=>t.y<player.y+canvas.height*0.6);

    // player crashed?
    if(player.damaged){
        state=STATE.DYING;
        dieTime=now;
        explode(player.x,player.y);
        shake=18;
        AudioFX.crash();
        AudioFX.setEngine(0,false);
        if(score>highScore){
            highScore=score;
            newHighScore=true;
            storage.set("hd-highscore",String(highScore));
        }
    }else{
        AudioFX.setEngine(Math.abs(player.speed)/player.maxSpeed,true);
    }
}

// ---------- draw ----------
function drawWorld(now){
    ctx.fillStyle="#0d1117";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.save();
    if(shake>0){
        ctx.translate((Math.random()-0.5)*shake,(Math.random()-0.5)*shake);
        shake*=0.88;
        if(shake<0.4) shake=0;
    }
    const camY=-player.y+canvas.height*0.75;
    ctx.translate(0,camY);

    // grass edges
    ctx.fillStyle="#12331a";
    ctx.fillRect(0,player.y-canvas.height,road.left,canvas.height*2);
    ctx.fillRect(road.right,player.y-canvas.height,canvas.width-road.right,canvas.height*2);
    // asphalt
    ctx.fillStyle="#1c2128";
    ctx.fillRect(road.left,player.y-canvas.height,road.width,canvas.height*2);

    road.draw(ctx);

    // speed lines at high speed
    const sr=Math.abs(player.speed)/player.maxSpeed;
    if(sr>0.75){
        ctx.strokeStyle="rgba(255,255,255,"+(sr-0.75)*0.9+")";
        ctx.lineWidth=1;
        for(let i=0;i<8;i++){
            const lx=road.left+Math.random()*road.width;
            const ly=player.y-canvas.height*0.7+Math.random()*canvas.height;
            ctx.beginPath();
            ctx.moveTo(lx,ly);
            ctx.lineTo(lx,ly+18+sr*22);
            ctx.stroke();
        }
    }

    for(const t of traffic) t.draw(ctx,t.elite);
    if(state!==STATE.DYING||now-dieTime<150) player.draw(ctx);

    // particles
    for(const p of particles){
        p.x+=p.vx; p.y+=p.vy;
        p.vy+=0.05;
        p.life-=0.02;
        ctx.globalAlpha=Math.max(p.life,0);
        ctx.fillStyle=p.color;
        ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
    }
    ctx.globalAlpha=1;
    particles=particles.filter(p=>p.life>0);

    // floaters
    ctx.font="bold 16px monospace";
    ctx.textAlign="center";
    for(const f of floaters){
        f.y-=1.2;
        f.life-=0.015;
        ctx.globalAlpha=Math.max(f.life,0);
        ctx.fillStyle=f.color;
        ctx.fillText(f.text,f.x,f.y);
    }
    ctx.globalAlpha=1;
    floaters=floaters.filter(f=>f.life>0);

    ctx.restore();
}

function drawHUD(now){
    // top bar
    ctx.save();
    ctx.fillStyle="rgba(0,0,0,0.55)";
    ctx.fillRect(0,0,canvas.width,54);

    ctx.font="bold 22px monospace";
    ctx.textAlign="left";
    ctx.fillStyle="#fff";
    ctx.fillText("SCORE "+score,16,34);

    ctx.textAlign="center";
    ctx.fillStyle="#7fff6a";
    ctx.fillText("LV "+level,canvas.width/2,34);

    ctx.textAlign="right";
    ctx.font="14px monospace";
    ctx.fillStyle="#aaa";
    ctx.fillText("BEST "+highScore,canvas.width-16,22);
    ctx.fillText((distance/PX_PER_METER|0)+" m",canvas.width-16,42);

    // combo meter
    if(combo>1&&state===STATE.PLAYING){
        const remain=1-(now-comboTime)/COMBO_WINDOW;
        ctx.textAlign="center";
        ctx.font="bold 18px monospace";
        ctx.fillStyle="#ffd23f";
        ctx.fillText("COMBO x"+combo,canvas.width/2,80);
        ctx.fillStyle="rgba(255,210,63,0.8)";
        ctx.fillRect(canvas.width/2-50,88,100*Math.max(remain,0),4);
    }

    // speedometer bottom-left
    const sr=Math.abs(player.speed)/player.maxSpeed;
    ctx.textAlign="left";
    ctx.font="bold 16px monospace";
    ctx.fillStyle="rgba(0,0,0,0.5)";
    ctx.fillRect(12,canvas.height-46,150,34);
    ctx.fillStyle=sr>0.9?"#ff6b35":"#6ee7ff";
    ctx.fillText((sr*160|0)+" km/h",22,canvas.height-23);
    ctx.fillStyle="rgba(255,255,255,0.25)";
    ctx.fillRect(110,canvas.height-38,44,18);
    ctx.fillStyle=sr>0.9?"#ff6b35":"#6ee7ff";
    ctx.fillRect(110,canvas.height-38,44*sr,18);

    // level banner
    if(now-levelBannerTime<1800&&level>1){
        const a=1-(now-levelBannerTime)/1800;
        ctx.globalAlpha=a;
        ctx.textAlign="center";
        ctx.font="bold 42px monospace";
        ctx.fillStyle="#7fff6a";
        ctx.fillText("LEVEL "+level,canvas.width/2,canvas.height*0.4);
        if(level===3){
            ctx.font="bold 18px monospace";
            ctx.fillStyle="#ff2d6f";
            ctx.fillText("⚠ ELITE DRIVERS ON THE ROAD",canvas.width/2,canvas.height*0.4+34);
        }
        ctx.globalAlpha=1;
    }
    ctx.restore();
}

// ---------- overlays ----------
const menuEl=document.getElementById("menu");
const overEl=document.getElementById("gameover");
const statsEl=document.getElementById("finalStats");
const menuBest=document.getElementById("menuBest");

function showMenu(){
    state=STATE.MENU;
    menuBest.textContent=highScore>0?"BEST: "+highScore:"";
    menuEl.classList.remove("hidden");
    overEl.classList.add("hidden");
}
function startGame(){
    AudioFX.init();
    if(AudioFX.ctx&&AudioFX.ctx.state==="suspended") AudioFX.ctx.resume();
    resetGame();
    state=STATE.PLAYING;
    menuEl.classList.add("hidden");
    overEl.classList.add("hidden");
}
function showGameOver(){
    state=STATE.GAMEOVER;
    statsEl.innerHTML=
        "SCORE <b>"+score+"</b>"+(newHighScore?" <span class='hs'>NEW BEST!</span>":"")+"<br>"+
        (distance/PX_PER_METER|0)+" m &nbsp;·&nbsp; LV "+level+
        " &nbsp;·&nbsp; "+overtakes+" overtakes &nbsp;·&nbsp; "+nearMisses+" near misses";
    overEl.classList.remove("hidden");
}

document.getElementById("startBtn").addEventListener("click",startGame);
document.getElementById("restartBtn").addEventListener("click",startGame);
document.addEventListener("keydown",(e)=>{
    if(e.key===" "||e.key==="Enter"){
        if(state===STATE.MENU||state===STATE.GAMEOVER) startGame();
    }
});

// ---------- main loop ----------
function loop(now){
    if(lastTime===undefined) lastTime=now;
    const dt=Math.min(now-lastTime,50);
    lastTime=now;

    if(state===STATE.PLAYING){
        update(now,dt);
        drawWorld(now);
        drawHUD(now);
    }else if(state===STATE.DYING){
        // let the explosion play out
        for(const t of traffic) if(t.controlType==="DUMMY") t.update(road.borders,[]);
        drawWorld(now);
        drawHUD(now);
        if(now-dieTime>1300) showGameOver();
    }else{
        // menu / game-over backdrop: idle road
        if(!road) resetGame();
        drawWorld(now);
    }
    requestAnimationFrame(loop);
}

showMenu();
requestAnimationFrame(loop);
