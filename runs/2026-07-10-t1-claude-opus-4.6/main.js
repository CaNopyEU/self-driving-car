// Neural Racer - Main Game Logic
const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");

let gameState="start"; // start, playing, gameover
let player,road,traffic,aiRivals;
let score,level,lives,distance,highScore;
let animationId,lastTime,levelTimer;
let screenShake=0;
let particles=[];
let passedTraffic=new Set();

// Sound synthesis
const AudioCtx=window.AudioContext||window.webkitAudioContext;
let audioCtx=null;
function initAudio(){
    if(!audioCtx) try{audioCtx=new AudioCtx()}catch(e){}
}
function playTone(freq,duration,type="square",vol=0.1){
    if(!audioCtx) return;
    try{
        const o=audioCtx.createOscillator();
        const g=audioCtx.createGain();
        o.type=type;o.frequency.value=freq;
        g.gain.value=vol;
        g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+duration);
        o.connect(g);g.connect(audioCtx.destination);
        o.start();o.stop(audioCtx.currentTime+duration);
    }catch(e){}
}
function playOvertake(){playTone(880,0.1,"sine",0.08)}
function playLevelUp(){playTone(523,0.1);setTimeout(()=>playTone(659,0.1),100);setTimeout(()=>playTone(784,0.15),200)}
function playCrash(){playTone(100,0.3,"sawtooth",0.15)}
function playGameOver(){playTone(300,0.2);setTimeout(()=>playTone(200,0.3),200)}

// High score with storage safety
function getHighScore(){
    try{return parseInt(localStorage.getItem("neuralRacerHigh"))||0}catch(e){return 0}
}
function setHighScore(s){
    try{localStorage.setItem("neuralRacerHigh",s)}catch(e){}
}

function resize(){
    canvas.width=window.innerWidth;
    canvas.height=window.innerHeight;
}
window.addEventListener("resize",resize);
resize();

highScore=getHighScore();
const hsEl=document.getElementById("startHighScore");
if(highScore>0) hsEl.textContent="HIGH SCORE: "+highScore;

function startGame(){
    initAudio();
    document.getElementById("startScreen").classList.add("hidden");
    document.getElementById("gameOverScreen").classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");

    gameState="playing";
    score=0;level=1;lives=3;distance=0;
    passedTraffic=new Set();
    particles=[];
    screenShake=0;

    const roadWidth=Math.min(canvas.width*0.6,300);
    road=new Road(canvas.width/2,roadWidth,4);
    player=new Car(road.getLaneCenter(1),100,30,50,"KEYS",5,"#00ddff");
    
    traffic=[];
    aiRivals=[];
    spawnInitialTraffic();
    spawnAIRivals();

    lastTime=performance.now();
    if(animationId) cancelAnimationFrame(animationId);
    animationId=requestAnimationFrame(gameLoop);
}

function spawnInitialTraffic(){
    for(let i=0;i<8;i++){
        spawnTrafficCar(player.y - 200 - i*200);
    }
}

function spawnTrafficCar(y){
    const lane=Math.floor(Math.random()*road.laneCount);
    const speed=1.5+level*0.3+Math.random()*0.5;
    const colors=["#ff4444","#44ff44","#ffaa00","#ff44ff","#4488ff","#ffffff"];
    const c=new Car(road.getLaneCenter(lane),y,30,50,"DUMMY",speed,
        colors[Math.floor(Math.random()*colors.length)]);
    c.id=Math.random();
    traffic.push(c);
}

function spawnAIRivals(){
    aiRivals=[];
    const count=Math.min(level,3);
    for(let i=0;i<count;i++){
        const rival=new Car(road.getLaneCenter(2+i%road.laneCount),
            player.y-50-i*30,28,48,"AI",4+level*0.5,
            ["#ff0066","#ff6600","#aa00ff"][i]);
        // Give each a slightly different brain
        NeuralNetwork.mutate(rival.brain,0.3+i*0.2);
        aiRivals.push(rival);
    }
}

function getLevelConfig(){
    return {
        trafficDensity: 300 - level*20, // closer spacing
        trafficSpeed: 1.5+level*0.3,
        aiSpeed: 4+level*0.5,
        scoreMultiplier: level
    };
}

function gameLoop(time){
    const dt=Math.min(time-lastTime,50)/16.67; // normalize to ~60fps
    lastTime=time;

    if(gameState!=="playing"){return}

    update(dt);
    render();

    animationId=requestAnimationFrame(gameLoop);
}

function update(dt){
    // Update player
    player.update(road.borders,traffic.concat(aiRivals));

    if(player.damaged){
        screenShake=10;
        playCrash();
        spawnExplosion(player.x,player.y);
        lives--;
        if(lives<=0){
            gameOver();
            return;
        }
        // Respawn player
        player.damaged=false;
        player.speed=0;
        player.angle=0;
        player.x=road.getLaneCenter(1);
        // brief invincibility handled by just resetting
    }

    // Update traffic
    for(let i=traffic.length-1;i>=0;i--){
        traffic[i].update(road.borders,[]);
        // Remove far away traffic
        if(traffic[i].y>player.y+800){
            traffic.splice(i,1);
        }
    }

    // Spawn new traffic ahead
    let minY=traffic.length?Math.min(...traffic.map(t=>t.y)):player.y;
    const density=getLevelConfig().trafficDensity;
    while(minY>player.y-1200){
        const ny=minY-density-Math.random()*100;
        spawnTrafficCar(ny);
        minY=ny;
    }

    // Update AI rivals
    const allObstacles=traffic.concat([player]);
    for(const rival of aiRivals){
        if(!rival.damaged){
            rival.update(road.borders,allObstacles);
        }
    }

    // Score: distance traveled
    const moved=Math.max(0, 100-player.y - distance);
    if(moved>0){
        distance=100-player.y;
        score+=Math.round(moved*getLevelConfig().scoreMultiplier);
    }

    // Overtake scoring
    for(const t of traffic){
        if(!passedTraffic.has(t.id)&&player.y<t.y-30){
            passedTraffic.add(t.id);
            score+=50*level;
            playOvertake();
            spawnSparkle(player.x,player.y);
        }
    }

    // Level progression: every 3000 points
    const newLevel=Math.floor(score/3000)+1;
    if(newLevel>level){
        level=newLevel;
        showLevelUp();
        playLevelUp();
        // Spawn new AI rivals
        spawnAIRivals();
    }

    // Particles
    for(let i=particles.length-1;i>=0;i--){
        particles[i].life-=0.03;
        particles[i].x+=particles[i].vx;
        particles[i].y+=particles[i].vy;
        if(particles[i].life<=0) particles.splice(i,1);
    }

    // Screen shake decay
    if(screenShake>0) screenShake*=0.9;
    if(screenShake<0.5) screenShake=0;
}

function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();

    // Camera follows player
    const shakeX=screenShake?(Math.random()-0.5)*screenShake:0;
    const shakeY=screenShake?(Math.random()-0.5)*screenShake:0;
    ctx.translate(shakeX, -player.y+canvas.height*0.7+shakeY);

    // Road background
    ctx.fillStyle="#333";
    ctx.fillRect(road.left-10,player.y-canvas.height,road.width+20,canvas.height*2);

    road.draw(ctx);

    // Speed lines effect
    if(player.speed>3){
        ctx.globalAlpha=Math.min((player.speed-3)/3,0.3);
        ctx.strokeStyle="#fff";
        ctx.lineWidth=1;
        for(let i=0;i<5;i++){
            const lx=road.left+Math.random()*road.width;
            const ly=player.y-canvas.height*0.5+Math.random()*canvas.height;
            ctx.beginPath();
            ctx.moveTo(lx,ly);
            ctx.lineTo(lx,ly+30+player.speed*5);
            ctx.stroke();
        }
        ctx.globalAlpha=1;
    }

    // Draw traffic
    for(const t of traffic) t.draw(ctx);

    // Draw AI rivals
    for(const r of aiRivals){
        if(!r.damaged) r.draw(ctx);
    }

    // Draw player
    player.draw(ctx,true);

    // Particles
    for(const p of particles){
        ctx.globalAlpha=p.life;
        ctx.fillStyle=p.color;
        ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
    }
    ctx.globalAlpha=1;

    ctx.restore();

    // HUD
    document.getElementById("hudScore").textContent="SCORE: "+score;
    document.getElementById("hudLevel").textContent="LEVEL "+level;
    document.getElementById("hudSpeed").textContent="SPEED: "+Math.round(player.speed*20)+"km/h";
    document.getElementById("hudLives").textContent="♥".repeat(Math.max(0,lives));
}

function gameOver(){
    gameState="gameover";
    playGameOver();
    if(score>highScore){
        highScore=score;
        setHighScore(highScore);
    }
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("gameOverScreen").classList.remove("hidden");
    document.getElementById("finalScore").textContent="SCORE: "+score;
    document.getElementById("finalLevel").textContent="Reached Level "+level;
    document.getElementById("gameOverHighScore").textContent="HIGH SCORE: "+highScore;
}

function showLevelUp(){
    const el=document.getElementById("levelUp");
    document.getElementById("levelUpNum").textContent=level;
    el.classList.remove("hidden");
    // Re-trigger animation
    el.style.animation="none";
    el.offsetHeight;
    el.style.animation="";
    setTimeout(()=>el.classList.add("hidden"),1500);
}

function spawnExplosion(x,y){
    for(let i=0;i<20;i++){
        particles.push({
            x,y,
            vx:(Math.random()-0.5)*4,
            vy:(Math.random()-0.5)*4,
            life:1,
            size:3+Math.random()*4,
            color:["#ff4400","#ffaa00","#ff0"][Math.floor(Math.random()*3)]
        });
    }
}

function spawnSparkle(x,y){
    for(let i=0;i<5;i++){
        particles.push({
            x:x+(Math.random()-0.5)*20,
            y:y-20,
            vx:(Math.random()-0.5)*2,
            vy:-1-Math.random()*2,
            life:0.8,
            size:2+Math.random()*2,
            color:"#0f0"
        });
    }
}
