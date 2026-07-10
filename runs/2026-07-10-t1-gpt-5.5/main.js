const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");

const storage={
    get(key){
        try{return window.localStorage.getItem(key);}catch(error){return null;}
    },
    set(key,value){
        try{window.localStorage.setItem(key,value);}catch(error){}
    }
};

const keys={left:false,right:false,up:false,down:false,boost:false};
const game={
    state:"title",
    width:0,
    height:0,
    dpr:1,
    time:0,
    lastTime:0,
    shake:0,
    flash:0,
    score:0,
    best:parseInt(storage.get("neonOverdriveBest"),10)||0,
    level:1,
    distance:0,
    passed:0,
    streak:0,
    comboText:0,
    speed:360,
    spawnTimer:0,
    coinTimer:0,
    rivalTimer:7,
    obstacles:[],
    coins:[],
    particles:[],
    roadMarks:[],
    player:null,
    message:"",
    audio:null,
    muted:false
};

function resize(){
    game.dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
    game.width=window.innerWidth;
    game.height=window.innerHeight;
    canvas.width=Math.floor(game.width*game.dpr);
    canvas.height=Math.floor(game.height*game.dpr);
    canvas.style.width=game.width+"px";
    canvas.style.height=game.height+"px";
    ctx.setTransform(game.dpr,0,0,game.dpr,0,0);
    resetRoadMarks();
}

function roadBounds(){
    const width=Math.min(game.width*0.78,520);
    const left=(game.width-width)/2;
    return {left,right:left+width,width,laneCount:4,laneWidth:width/4};
}

function laneCenter(lane){
    const road=roadBounds();
    return road.left+road.laneWidth*(lane+0.5);
}

function resetRoadMarks(){
    game.roadMarks=[];
    const spacing=74;
    for(let y=-spacing;y<game.height+spacing;y+=spacing){
        game.roadMarks.push({y});
    }
}

function resetGame(){
    const road=roadBounds();
    game.state="playing";
    game.time=0;
    game.lastTime=performance.now();
    game.shake=0;
    game.flash=0;
    game.score=0;
    game.level=1;
    game.distance=0;
    game.passed=0;
    game.streak=0;
    game.comboText=0;
    game.speed=360;
    game.spawnTimer=0.8;
    game.coinTimer=1.1;
    game.rivalTimer=5.5;
    game.obstacles=[];
    game.coins=[];
    game.particles=[];
    game.message="";
    game.player={
        x:laneCenter(1),
        y:game.height*0.78,
        lane:1,
        width:34,
        height:58,
        vx:0,
        invuln:1.1,
        boost:1,
        boostHeat:0,
        alive:true
    };
    for(let i=0;i<6;i++){
        spawnTraffic(-i*150-160,true);
    }
    resetRoadMarks();
    burst(game.player.x,game.player.y+34,"#44e7ff",16,150);
    playTone(450,0.08,"sine",0.08);
}

function startAudio(){
    if(game.audio||game.muted) return;
    try{
        const AudioContext=window.AudioContext||window.webkitAudioContext;
        if(!AudioContext) return;
        game.audio=new AudioContext();
    }catch(error){
        game.muted=true;
    }
}

function playTone(freq,duration,type="square",volume=0.035){
    const audio=game.audio;
    if(!audio||game.muted) return;
    const osc=audio.createOscillator();
    const gain=audio.createGain();
    osc.type=type;
    osc.frequency.value=freq;
    gain.gain.setValueAtTime(0.0001,audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume,audio.currentTime+0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001,audio.currentTime+duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime+duration+0.02);
}

function playCrash(){
    playTone(92,0.16,"sawtooth",0.08);
    setTimeout(()=>playTone(55,0.2,"square",0.05),70);
}

function spawnTraffic(y,quiet=false){
    const occupied=new Set(game.obstacles.filter(o=>Math.abs(o.y-y)<130).map(o=>o.lane));
    const lanes=[0,1,2,3].filter(lane=>!occupied.has(lane));
    if(lanes.length===0) return;
    const lane=lanes[Math.floor(Math.random()*lanes.length)];
    const palette=["#ff386f","#ffb13d","#7dff7a","#9a7dff","#38e8ff"];
    game.obstacles.push({
        type:"traffic",
        lane,
        x:laneCenter(lane),
        y,
        width:34,
        height:56,
        speed:70+Math.random()*60+game.level*7,
        color:palette[Math.floor(Math.random()*palette.length)],
        scored:false,
        wobble:Math.random()*Math.PI*2
    });
    if(!quiet&&Math.random()<0.22) spawnTraffic(y-90,true);
}

function spawnRival(){
    const rivalLane=chooseRivalLane();
    game.obstacles.push({
        type:"rival",
        lane:rivalLane,
        targetLane:rivalLane,
        x:laneCenter(rivalLane),
        y:-90,
        width:38,
        height:64,
        speed:130+game.level*20,
        color:"#ff2bd1",
        scored:false,
        brainTick:0,
        wobble:0
    });
    game.message="RIVAL DRONE";
    playTone(760,0.07,"triangle",0.045);
}

function chooseRivalLane(){
    const playerLane=Math.max(0,Math.min(3,Math.round((game.player.x-roadBounds().left)/roadBounds().laneWidth-0.5)));
    const danger=[0,0,0,0];
    for(const o of game.obstacles){
        if(o.y>-240&&o.y<180) danger[o.lane]+=1;
    }
    let bestLane=playerLane;
    let bestScore=-Infinity;
    for(let lane=0;lane<4;lane++){
        const aggression=lane===playerLane?1.35:0;
        const centerBias=1-Math.abs(1.5-lane)*0.14;
        const score=aggression+centerBias-danger[lane]*0.9+Math.random()*0.25;
        if(score>bestScore){
            bestScore=score;
            bestLane=lane;
        }
    }
    return bestLane;
}

function spawnCoin(){
    const lane=Math.floor(Math.random()*4);
    game.coins.push({x:laneCenter(lane),y:-30,lane,r:11,spin:Math.random()*6});
}

function update(dt){
    if(game.state!=="playing") return;
    const p=game.player;
    game.time+=dt;
    game.distance+=game.speed*dt*0.03;
    game.level=1+Math.floor(game.distance/260);
    game.speed=Math.min(760,350+game.level*38+game.time*3);
    game.score+=dt*(18+game.level*4)*(keys.boost&&p.boost>0?1.6:1);
    game.flash=Math.max(0,game.flash-dt*2.8);
    game.shake=Math.max(0,game.shake-dt*18);
    game.comboText=Math.max(0,game.comboText-dt);
    p.invuln=Math.max(0,p.invuln-dt);

    const road=roadBounds();
    let input=0;
    if(keys.left) input-=1;
    if(keys.right) input+=1;
    const boostActive=keys.boost&&p.boost>0;
    const targetSpeed=boostActive?620:420;
    p.vx+=input*targetSpeed*dt;
    p.vx*=Math.pow(0.0008,dt);
    p.x+=p.vx*dt;
    p.x=Math.max(road.left+p.width/2+8,Math.min(road.right-p.width/2-8,p.x));
    p.lane=Math.max(0,Math.min(3,Math.round((p.x-road.left)/road.laneWidth-0.5)));
    p.boost=Math.max(0,Math.min(1,p.boost+(boostActive?-0.42:0.18)*dt));
    p.boostHeat=boostActive?1:Math.max(0,p.boostHeat-dt*4);
    if(boostActive){
        game.score+=34*dt;
        addParticle(p.x+(Math.random()-0.5)*18,p.y+34,"#ffd65c",80+Math.random()*90);
    }

    game.spawnTimer-=dt;
    const spawnEvery=Math.max(0.34,0.92-game.level*0.035);
    if(game.spawnTimer<=0){
        game.spawnTimer=spawnEvery+Math.random()*0.35;
        spawnTraffic(-80-Math.random()*90);
    }
    game.coinTimer-=dt;
    if(game.coinTimer<=0){
        game.coinTimer=Math.max(0.75,1.7-game.level*0.04)+Math.random()*0.8;
        spawnCoin();
    }
    game.rivalTimer-=dt;
    if(game.rivalTimer<=0){
        game.rivalTimer=Math.max(5.5,11-game.level*0.32)+Math.random()*3;
        spawnRival();
    }

    for(const mark of game.roadMarks){
        mark.y+=game.speed*dt;
        if(mark.y>game.height+90) mark.y-=Math.ceil((game.height+180)/74)*74;
    }

    for(const obstacle of game.obstacles){
        if(obstacle.type==="rival"){
            obstacle.brainTick-=dt;
            if(obstacle.brainTick<=0){
                obstacle.brainTick=0.35;
                obstacle.targetLane=chooseRivalLane();
            }
            obstacle.x+=(laneCenter(obstacle.targetLane)-obstacle.x)*Math.min(1,dt*2.4);
            obstacle.lane=Math.max(0,Math.min(3,Math.round((obstacle.x-road.left)/road.laneWidth-0.5)));
        }else{
            obstacle.x=laneCenter(obstacle.lane)+Math.sin(game.time*2+obstacle.wobble)*2.4;
        }
        obstacle.y+=(game.speed-obstacle.speed)*dt;
        if(!obstacle.scored&&obstacle.y>p.y+obstacle.height){
            obstacle.scored=true;
            game.passed++;
            game.streak++;
            const bonus=40+game.streak*12+game.level*8;
            game.score+=bonus;
            game.comboText=0.9;
            if(game.streak%5===0){
                playTone(520+game.streak*8,0.05,"sine",0.04);
            }
        }
    }
    game.obstacles=game.obstacles.filter(o=>o.y<game.height+120);

    for(const coin of game.coins){
        coin.y+=game.speed*dt;
        coin.spin+=dt*8;
        if(rectCircleHit(p,coin)&&p.invuln<=0){
            coin.collected=true;
            game.score+=175+game.level*20;
            p.boost=Math.min(1,p.boost+0.24);
            burst(coin.x,coin.y,"#ffe66d",18,180);
            playTone(900,0.06,"triangle",0.045);
        }
    }
    game.coins=game.coins.filter(c=>!c.collected&&c.y<game.height+40);

    for(const obstacle of game.obstacles){
        if(p.invuln<=0&&rectsHit(p,obstacle)){
            endGame(obstacle);
            break;
        }
    }

    for(const particle of game.particles){
        particle.life-=dt;
        particle.x+=particle.vx*dt;
        particle.y+=particle.vy*dt+game.speed*dt*0.45;
        particle.vy+=160*dt;
    }
    game.particles=game.particles.filter(particle=>particle.life>0);
}

function endGame(obstacle){
    game.state="gameover";
    game.shake=14;
    game.flash=1;
    game.score=Math.floor(game.score);
    if(game.score>game.best){
        game.best=game.score;
        storage.set("neonOverdriveBest",String(game.best));
    }
    burst(game.player.x,game.player.y,"#ff4d6d",42,280);
    burst(obstacle.x,obstacle.y,"#fff",18,180);
    playCrash();
}

function rectsHit(a,b){
    const aw=a.width*0.74;
    const ah=a.height*0.78;
    const bw=b.width*0.78;
    const bh=b.height*0.82;
    return Math.abs(a.x-b.x)<(aw+bw)/2&&Math.abs(a.y-b.y)<(ah+bh)/2;
}

function rectCircleHit(rect,circle){
    const cx=Math.max(rect.x-rect.width/2,Math.min(circle.x,rect.x+rect.width/2));
    const cy=Math.max(rect.y-rect.height/2,Math.min(circle.y,rect.y+rect.height/2));
    return Math.hypot(circle.x-cx,circle.y-cy)<circle.r+4;
}

function addParticle(x,y,color,speed){
    game.particles.push({
        x,y,color,
        vx:(Math.random()-0.5)*speed,
        vy:(Math.random()-1.1)*speed,
        life:0.25+Math.random()*0.35,
        maxLife:0.6,
        size:2+Math.random()*4
    });
}

function burst(x,y,color,count,speed){
    for(let i=0;i<count;i++) addParticle(x,y,color,speed);
}

function draw(){
    ctx.save();
    ctx.clearRect(0,0,game.width,game.height);
    if(game.shake>0){
        ctx.translate((Math.random()-0.5)*game.shake,(Math.random()-0.5)*game.shake);
    }
    drawBackdrop();
    drawRoad();
    if(game.state==="playing"||game.state==="gameover"){
        for(const coin of game.coins) drawCoin(coin);
        for(const obstacle of game.obstacles) drawCar(obstacle,false);
        drawCar(game.player,true);
        drawParticles();
    }
    ctx.restore();
    drawHud();
    if(game.state==="title") drawTitle();
    if(game.state==="gameover") drawGameOver();
    if(game.flash>0){
        ctx.fillStyle="rgba(255,255,255,"+(game.flash*0.28)+")";
        ctx.fillRect(0,0,game.width,game.height);
    }
}

function drawBackdrop(){
    const gradient=ctx.createLinearGradient(0,0,0,game.height);
    gradient.addColorStop(0,"#10172c");
    gradient.addColorStop(1,"#050611");
    ctx.fillStyle=gradient;
    ctx.fillRect(0,0,game.width,game.height);
    ctx.fillStyle="rgba(104,221,255,0.08)";
    for(let i=0;i<28;i++){
        const x=(i*173+Math.floor(game.time*20))%Math.max(game.width,1);
        const y=(i*97+Math.floor(game.time*60))%Math.max(game.height,1);
        ctx.fillRect(x,y,2,2);
    }
}

function drawRoad(){
    const road=roadBounds();
    ctx.save();
    ctx.fillStyle="#151925";
    roundRect(road.left-18,-20,road.width+36,game.height+40,34);
    ctx.fill();
    const roadGrad=ctx.createLinearGradient(road.left,0,road.right,0);
    roadGrad.addColorStop(0,"#20283a");
    roadGrad.addColorStop(0.5,"#121722");
    roadGrad.addColorStop(1,"#20283a");
    ctx.fillStyle=roadGrad;
    ctx.fillRect(road.left,0,road.width,game.height);
    ctx.strokeStyle="#42e8ff";
    ctx.lineWidth=4;
    ctx.shadowColor="#42e8ff";
    ctx.shadowBlur=12;
    ctx.beginPath();
    ctx.moveTo(road.left,0);
    ctx.lineTo(road.left,game.height);
    ctx.moveTo(road.right,0);
    ctx.lineTo(road.right,game.height);
    ctx.stroke();
    ctx.shadowBlur=0;
    for(let lane=1;lane<road.laneCount;lane++){
        const x=road.left+lane*road.laneWidth;
        ctx.strokeStyle="rgba(255,255,255,0.28)";
        ctx.lineWidth=3;
        ctx.setLineDash([28,28]);
        ctx.lineDashOffset=-game.time*game.speed*0.15;
        ctx.beginPath();
        ctx.moveTo(x,0);
        ctx.lineTo(x,game.height);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    for(const mark of game.roadMarks){
        ctx.fillStyle="rgba(255,255,255,0.07)";
        ctx.fillRect(road.left+12,mark.y,road.width-24,2);
    }
    ctx.restore();
}

function drawCar(car,isPlayer){
    if(!car) return;
    const tilt=isPlayer?Math.max(-0.28,Math.min(0.28,car.vx/850)):Math.sin(game.time*4+car.wobble)*0.025;
    ctx.save();
    ctx.translate(car.x,car.y);
    ctx.rotate(tilt);
    if(isPlayer&&car.invuln>0&&Math.floor(game.time*16)%2===0){
        ctx.globalAlpha=0.45;
    }
    const body=isPlayer?"#33e7ff":car.color;
    ctx.shadowColor=body;
    ctx.shadowBlur=isPlayer?18:10;
    ctx.fillStyle="rgba(0,0,0,0.35)";
    roundRect(-car.width*0.46,car.height*0.22,car.width*0.92,car.height*0.44,12);
    ctx.fill();
    ctx.fillStyle=body;
    roundRect(-car.width/2,-car.height/2,car.width,car.height,10);
    ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle=isPlayer?"#eaffff":"#1a1230";
    roundRect(-car.width*0.32,-car.height*0.29,car.width*0.64,car.height*0.28,7);
    ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.78)";
    ctx.fillRect(-car.width*0.33,-car.height*0.48,car.width*0.18,5);
    ctx.fillRect(car.width*0.15,-car.height*0.48,car.width*0.18,5);
    ctx.fillStyle=isPlayer?"#ffee78":"#ff4d6d";
    ctx.fillRect(-car.width*0.35,car.height*0.42,car.width*0.22,6);
    ctx.fillRect(car.width*0.13,car.height*0.42,car.width*0.22,6);
    if(isPlayer&&car.boostHeat>0){
        ctx.fillStyle="rgba(255,211,76,"+car.boostHeat+")";
        ctx.beginPath();
        ctx.moveTo(-9,car.height/2-1);
        ctx.lineTo(0,car.height/2+24+Math.random()*14);
        ctx.lineTo(9,car.height/2-1);
        ctx.fill();
    }
    if(car.type==="rival"){
        ctx.strokeStyle="#fff";
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.arc(0,-7,8,0,Math.PI*2);
        ctx.stroke();
    }
    ctx.restore();
}

function drawCoin(coin){
    ctx.save();
    ctx.translate(coin.x,coin.y);
    ctx.scale(Math.abs(Math.cos(coin.spin))*0.75+0.25,1);
    ctx.shadowColor="#ffe66d";
    ctx.shadowBlur=16;
    ctx.fillStyle="#ffd84d";
    ctx.beginPath();
    ctx.arc(0,0,coin.r,0,Math.PI*2);
    ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle="#7a4b00";
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.arc(0,0,coin.r*0.56,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
}

function drawParticles(){
    for(const p of game.particles){
        const alpha=Math.max(0,p.life/p.maxLife);
        ctx.globalAlpha=alpha;
        ctx.fillStyle=p.color;
        ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
    }
    ctx.globalAlpha=1;
}

function drawHud(){
    if(game.state==="title") return;
    const pad=18;
    panel(pad,pad,Math.min(330,game.width-36),94);
    ctx.fillStyle="#eaffff";
    ctx.font="800 28px Arial";
    ctx.fillText(Math.floor(game.score).toLocaleString(),pad+18,pad+36);
    ctx.font="700 12px Arial";
    ctx.fillStyle="#8beeff";
    ctx.fillText("SCORE",pad+20,pad+58);
    ctx.fillStyle="#ffffff";
    ctx.fillText("LEVEL "+game.level,pad+120,pad+58);
    ctx.fillText("PASSED "+game.passed,pad+200,pad+58);
    const boostW=Math.min(280,game.width-74);
    ctx.fillStyle="rgba(255,255,255,0.13)";
    roundRect(pad+18,pad+70,boostW,10,5);
    ctx.fill();
    ctx.fillStyle=game.player&&game.player.boost>0.25?"#ffd957":"#ff586f";
    roundRect(pad+18,pad+70,boostW*(game.player?game.player.boost:0),10,5);
    ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.74)";
    ctx.font="700 12px Arial";
    ctx.textAlign="right";
    ctx.fillText("BEST "+game.best.toLocaleString(),game.width-pad,pad+30);
    ctx.textAlign="left";
    if(game.comboText>0){
        ctx.save();
        ctx.globalAlpha=game.comboText;
        ctx.fillStyle="#fff06c";
        ctx.font="900 24px Arial";
        ctx.textAlign="center";
        ctx.fillText("STREAK x"+game.streak,game.width/2,90);
        ctx.restore();
    }
    if(game.message){
        ctx.save();
        ctx.globalAlpha=Math.max(0,Math.min(1,game.rivalTimer>4?1:0.6));
        ctx.fillStyle="#ff8bec";
        ctx.font="900 18px Arial";
        ctx.textAlign="center";
        ctx.fillText(game.message,game.width/2,130);
        ctx.restore();
        if(game.rivalTimer<8) game.message="";
    }
}

function drawTitle(){
    ctx.save();
    ctx.fillStyle="rgba(2,4,12,0.54)";
    ctx.fillRect(0,0,game.width,game.height);
    const w=Math.min(620,game.width-36);
    const h=360;
    const x=(game.width-w)/2;
    const y=Math.max(42,(game.height-h)/2);
    panel(x,y,w,h);
    ctx.textAlign="center";
    ctx.fillStyle="#ffffff";
    ctx.font="900 "+Math.min(56,game.width/9)+"px Arial";
    ctx.shadowColor="#35eaff";
    ctx.shadowBlur=18;
    ctx.fillText("NEON",game.width/2,y+82);
    ctx.fillStyle="#ff4bd8";
    ctx.fillText("OVERDRIVE",game.width/2,y+137);
    ctx.shadowBlur=0;
    ctx.fillStyle="#c7f7ff";
    ctx.font="700 17px Arial";
    ctx.fillText("Dodge traffic, grab cells, boost through the city.",game.width/2,y+180);
    ctx.fillStyle="#ffffff";
    ctx.font="800 18px Arial";
    ctx.fillText("Press SPACE or ENTER to start",game.width/2,y+228);
    ctx.font="700 13px Arial";
    ctx.fillStyle="#94a8c5";
    ctx.fillText("Arrows/WASD steer   Up/W/Space boosts   R restarts",game.width/2,y+260);
    ctx.fillText("Best: "+game.best.toLocaleString()+"   Storage is optional and sandbox-safe",game.width/2,y+292);
    ctx.restore();
}

function drawGameOver(){
    ctx.save();
    ctx.fillStyle="rgba(3,5,13,0.68)";
    ctx.fillRect(0,0,game.width,game.height);
    const w=Math.min(520,game.width-36);
    const h=310;
    const x=(game.width-w)/2;
    const y=Math.max(64,(game.height-h)/2);
    panel(x,y,w,h);
    ctx.textAlign="center";
    ctx.fillStyle="#ff6680";
    ctx.font="900 42px Arial";
    ctx.fillText("CRASHED",game.width/2,y+70);
    ctx.fillStyle="#fff";
    ctx.font="900 36px Arial";
    ctx.fillText(game.score.toLocaleString(),game.width/2,y+126);
    ctx.fillStyle="#9eefff";
    ctx.font="700 15px Arial";
    ctx.fillText("Level "+game.level+"  |  Passed "+game.passed+"  |  Best "+game.best.toLocaleString(),game.width/2,y+164);
    ctx.fillStyle="#fff";
    ctx.font="800 18px Arial";
    ctx.fillText("Press SPACE, ENTER, or R to restart",game.width/2,y+225);
    ctx.fillStyle="#91a5c2";
    ctx.font="700 13px Arial";
    ctx.fillText("Coins refill boost. The pink rival predicts busy lanes and hunts your line.",game.width/2,y+258);
    ctx.restore();
}

function panel(x,y,w,h){
    ctx.save();
    ctx.fillStyle="rgba(6,11,25,0.74)";
    ctx.strokeStyle="rgba(124,237,255,0.28)";
    ctx.lineWidth=1;
    ctx.shadowColor="rgba(56,231,255,0.22)";
    ctx.shadowBlur=22;
    roundRect(x,y,w,h,24);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function roundRect(x,y,w,h,r){
    const radius=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+radius,y);
    ctx.arcTo(x+w,y,x+w,y+h,radius);
    ctx.arcTo(x+w,y+h,x,y+h,radius);
    ctx.arcTo(x,y+h,x,y,radius);
    ctx.arcTo(x,y,x+w,y,radius);
    ctx.closePath();
}

function loop(now){
    const dt=Math.min(0.033,(now-game.lastTime)/1000||0);
    game.lastTime=now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}

function handleStart(){
    startAudio();
    if(game.state==="title"||game.state==="gameover") resetGame();
}

window.addEventListener("resize",resize);
window.addEventListener("keydown",event=>{
    if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(event.key)) event.preventDefault();
    if(event.key==="ArrowLeft"||event.key.toLowerCase()==="a") keys.left=true;
    if(event.key==="ArrowRight"||event.key.toLowerCase()==="d") keys.right=true;
    if(event.key==="ArrowUp"||event.key.toLowerCase()==="w") keys.boost=true;
    if(event.key==="ArrowDown"||event.key.toLowerCase()==="s") keys.down=true;
    if(event.key===" ") keys.boost=true;
    if(event.key==="Enter"||event.key===" "||event.key.toLowerCase()==="r") handleStart();
});
window.addEventListener("keyup",event=>{
    if(event.key==="ArrowLeft"||event.key.toLowerCase()==="a") keys.left=false;
    if(event.key==="ArrowRight"||event.key.toLowerCase()==="d") keys.right=false;
    if(event.key==="ArrowUp"||event.key.toLowerCase()==="w") keys.boost=false;
    if(event.key==="ArrowDown"||event.key.toLowerCase()==="s") keys.down=false;
    if(event.key===" ") keys.boost=false;
});

canvas.addEventListener("pointerdown",handleStart);
bindTouch("touchLeft","left");
bindTouch("touchRight","right");
bindTouch("touchBoost","boost");

function bindTouch(id,key){
    const el=document.getElementById(id);
    const on=event=>{event.preventDefault();startAudio();keys[key]=true;handleStart();};
    const off=event=>{event.preventDefault();keys[key]=false;};
    el.addEventListener("pointerdown",on);
    el.addEventListener("pointerup",off);
    el.addEventListener("pointercancel",off);
    el.addEventListener("pointerleave",off);
}

resize();
game.lastTime=performance.now();
requestAnimationFrame(loop);
