const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");

const screen=document.getElementById("screen");
const screenEyebrow=document.getElementById("screenEyebrow");
const screenTitle=document.getElementById("screenTitle");
const screenLead=document.getElementById("screenLead");
const screenStats=document.getElementById("screenStats");
const screenHint=document.getElementById("screenHint");
const primaryButton=document.getElementById("primaryButton");
const banner=document.getElementById("banner");

const controls=new Controls();

const STORAGE_KEY="slipstream-survivor-high-score";
const TRAFFIC_COLORS=[
    {color:"#f96b7b",trim:"#ffe8ef",glow:"rgba(255,122,151,0.55)"},
    {color:"#ffb347",trim:"#fff0c7",glow:"rgba(255,196,94,0.55)"},
    {color:"#7ddc6f",trim:"#eef9db",glow:"rgba(131,227,113,0.55)"},
    {color:"#65b8ff",trim:"#ebf6ff",glow:"rgba(111,188,255,0.55)"},
    {color:"#bd7bff",trim:"#f4e8ff",glow:"rgba(196,124,255,0.5)"}
];

let viewWidth=window.innerWidth;
let viewHeight=window.innerHeight;
let deviceScale=1;
let lastTime=0;

function formatNumber(value){
    return Math.round(value).toLocaleString();
}

class AudioEngine{
    constructor(){
        this.context=null;
        this.enabled=true;
    }

    unlock(){
        if(!this.enabled||typeof window.AudioContext==="undefined"&&typeof window.webkitAudioContext==="undefined"){
            return;
        }
        if(!this.context){
            const AudioContextClass=window.AudioContext||window.webkitAudioContext;
            this.context=new AudioContextClass();
        }
        if(this.context.state==="suspended"){
            this.context.resume().catch(()=>{});
        }
    }

    pulse(type,frequency,duration,volume,when=0){
        if(!this.context||!this.enabled){
            return;
        }
        const start=this.context.currentTime+when;
        const oscillator=this.context.createOscillator();
        const gain=this.context.createGain();
        oscillator.type=type;
        oscillator.frequency.setValueAtTime(frequency,start);
        gain.gain.setValueAtTime(0.0001,start);
        gain.gain.exponentialRampToValueAtTime(volume,start+0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
        oscillator.connect(gain);
        gain.connect(this.context.destination);
        oscillator.start(start);
        oscillator.stop(start+duration+0.02);
    }

    nearMiss(){
        this.pulse("triangle",820,0.12,0.06);
        this.pulse("triangle",1180,0.16,0.03,0.04);
    }

    wave(){
        this.pulse("sawtooth",420,0.18,0.05);
        this.pulse("triangle",620,0.22,0.04,0.06);
        this.pulse("triangle",840,0.26,0.03,0.12);
    }

    crash(){
        this.pulse("square",110,0.35,0.06);
        this.pulse("sawtooth",72,0.5,0.03,0.04);
    }

    boost(){
        this.pulse("triangle",180,0.1,0.04);
    }
}

class Game{
    constructor(){
        this.audio=new AudioEngine();
        this.highScore=parseInt(safeStorageGet(STORAGE_KEY),10)||0;
        this.state="title";
        this.previewScroll=0;
        this.bannerTimer=0;
        this.bannerText="";
        this.player=null;
        this.traffic=[];
        this.particles=[];
        this.resize();
        this.showTitle();
    }

    resize(){
        this.roadWidth=Math.min(viewWidth*0.7,460);
        this.road=new Road(viewWidth/2,this.roadWidth,4);
        if(this.player){
            this.player.x=clamp(this.player.x,this.road.left+36,this.road.right-36);
        }
    }

    resetRun(){
        this.player=new Car({
            type:"player",
            x:this.road.getLaneCenter(1),
            y:0,
            width:38,
            height:64,
            speed:310,
            maxSpeed:540,
            boostMaxSpeed:720,
            acceleration:360,
            drag:170,
            brakePower:470,
            minSpeed:230,
            steering:2.6,
            color:"#5ceaff",
            trimColor:"#fff2ad",
            glowColor:"rgba(92,234,255,0.85)"
        });
        this.traffic=[];
        this.particles=[];
        this.score=0;
        this.distance=0;
        this.wave=1;
        this.waveProgress=0;
        this.waveTarget=this.getWaveTarget(this.wave);
        this.combo=1;
        this.comboTimer=0;
        this.nearMissTextTimer=0;
        this.nearMissValue=0;
        this.boostMeter=45;
        this.boostSoundCooldown=0;
        this.spawnCooldown=0.35;
        this.cameraY=this.player.y-viewHeight*0.7;
        this.flash=0;
        this.shake=0;
        this.gameOverTimer=0;
        this.exhaustTimer=0;
    }

    getWaveTarget(wave){
        return 10+(wave-1)*3;
    }

    getDifficulty(){
        return {
            spawnInterval:Math.max(0.62,1.42-this.wave*0.07),
            trafficMin:150+this.wave*16,
            trafficMax:230+this.wave*24,
            laneChangeChance:Math.min(0.24,0.015*this.wave),
            laneChangeSpeed:150+this.wave*5,
            extraCars:Math.min(2,Math.floor(this.wave/3))
        };
    }

    startRun(){
        this.audio.unlock();
        this.resetRun();
        this.state="playing";
        this.hideBanner();
        this.showBanner("Wave 1  |  Clear 10 cars to level up",1.8);
        this.updateScreen();
    }

    pause(){
        if(this.state!=="playing"){
            return;
        }
        this.state="paused";
        this.updateScreen();
    }

    resume(){
        if(this.state!=="paused"){
            return;
        }
        this.audio.unlock();
        this.state="playing";
        this.updateScreen();
    }

    crash(){
        if(this.state!=="playing"){
            return;
        }
        this.state="gameover";
        this.audio.crash();
        this.flash=0.55;
        this.shake=18;
        this.spawnCrashParticles();
        const finalScore=Math.round(this.score);
        if(finalScore>this.highScore){
            this.highScore=finalScore;
            safeStorageSet(STORAGE_KEY,String(finalScore));
        }
        this.updateScreen();
    }

    showTitle(){
        this.state="title";
        this.updateScreen();
    }

    showBanner(text,duration){
        this.bannerText=text;
        this.bannerTimer=duration;
        banner.textContent=text;
        banner.classList.remove("hidden");
    }

    hideBanner(){
        this.bannerTimer=0;
        banner.classList.add("hidden");
    }

    updateScreen(){
        screen.classList.remove("hidden");

        if(this.state==="playing"){
            screen.classList.add("hidden");
            return;
        }

        if(this.state==="title"){
            screenEyebrow.textContent="Arcade Highway Run";
            screenTitle.textContent="Slipstream Survivor";
            screenLead.textContent="Thread impossible traffic, chain near misses, and burn boost to survive ever nastier waves.";
            primaryButton.textContent="Start Run";
            screenHint.textContent="Arrows or WASD steer. Up accelerates. Down brakes. Space boosts. P pauses.";
            screenStats.innerHTML=this.renderStats([
                ["High Score",formatNumber(this.highScore)],
                ["Target",`Clear traffic waves`],
                ["Style",`Near misses charge boost`]
            ]);
            return;
        }

        if(this.state==="paused"){
            screenEyebrow.textContent="Run Paused";
            screenTitle.textContent="Catch Your Breath";
            screenLead.textContent="Traffic is frozen. Resume when you are ready to dive back into the lane gaps.";
            primaryButton.textContent="Resume";
            screenHint.textContent="Press P or the button to jump back in.";
            screenStats.innerHTML=this.renderStats([
                ["Score",formatNumber(this.score)],
                ["Wave",String(this.wave)],
                ["Boost",`${Math.round(this.boostMeter)}%`]
            ]);
            return;
        }

        screenEyebrow.textContent="Wrecked";
        screenTitle.textContent="Run Over";
        screenLead.textContent="You finally ran out of road. Use what you learned, hit the boost later, and squeeze tighter gaps on the next run.";
        primaryButton.textContent="Run Again";
        screenHint.textContent="Press Enter or the button to restart immediately.";
        screenStats.innerHTML=this.renderStats([
            ["Score",formatNumber(this.score)],
            ["Best",formatNumber(this.highScore)],
            ["Wave",String(this.wave)]
        ]);
    }

    renderStats(items){
        return items.map(([label,value])=>`<div class="stat-card"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`).join("");
    }

    spawnTrafficGroup(){
        const difficulty=this.getDifficulty();
        const baseY=this.player.y-randomRange(760,940);
        const laneOrder=shuffle([0,1,2,3]);
        const maxBlockers=Math.min(this.road.laneCount-1,2+difficulty.extraCars);
        const blockers=randomInt(1,maxBlockers);

        for(let i=0;i<blockers;i++){
            const lane=laneOrder[i];
            const style=TRAFFIC_COLORS[(lane+this.wave+i)%TRAFFIC_COLORS.length];
            this.traffic.push(new Car({
                type:"traffic",
                x:this.road.getLaneCenter(lane),
                y:baseY-randomRange(0,48)*i,
                width:randomRange(34,39),
                height:randomRange(54,66),
                laneIndex:lane,
                speed:randomRange(difficulty.trafficMin,difficulty.trafficMax),
                color:style.color,
                trimColor:style.trim,
                glowColor:style.glow,
                laneChangeSpeed:difficulty.laneChangeSpeed,
                canChangeLane:this.wave>=3&&Math.random()<0.55
            }));
        }

        if(this.wave>=4&&Math.random()<0.45){
            const lane=laneOrder[blockers];
            const style=TRAFFIC_COLORS[(lane+blockers)%TRAFFIC_COLORS.length];
            this.traffic.push(new Car({
                type:"traffic",
                x:this.road.getLaneCenter(lane),
                y:baseY-randomRange(140,220),
                width:36,
                height:62,
                laneIndex:lane,
                speed:randomRange(difficulty.trafficMin+30,difficulty.trafficMax+25),
                color:style.color,
                trimColor:style.trim,
                glowColor:style.glow,
                laneChangeSpeed:difficulty.laneChangeSpeed+35,
                canChangeLane:Math.random()<0.8
            }));
        }

        this.spawnCooldown=difficulty.spawnInterval*randomRange(0.82,1.16);
    }

    scoreEvent(points){
        this.score+=points;
    }

    grantNearMiss(trafficCar){
        trafficCar.nearMissed=true;
        this.combo=Math.min(8,this.combo+1);
        this.comboTimer=2.8;
        this.boostMeter=clamp(this.boostMeter+18,0,100);
        const points=150*this.combo;
        this.nearMissValue=points;
        this.nearMissTextTimer=0.85;
        this.scoreEvent(points);
        this.shake=Math.max(this.shake,5);
        this.audio.nearMiss();
    }

    advanceWave(){
        this.wave++;
        this.waveProgress=0;
        this.waveTarget=this.getWaveTarget(this.wave);
        this.boostMeter=clamp(this.boostMeter+28,0,100);
        this.scoreEvent(600+this.wave*140);
        this.flash=0.2;
        this.shake=12;
        this.showBanner(`Wave ${this.wave}  |  Traffic gets meaner`,2.1);
        this.audio.wave();
    }

    spawnCrashParticles(){
        for(let i=0;i<30;i++){
            this.particles.push({
                x:this.player.x,
                y:this.player.y,
                vx:randomRange(-210,210),
                vy:randomRange(-160,180),
                size:randomRange(3,7),
                life:randomRange(0.45,0.95),
                maxLife:1,
                color:Math.random()<0.5?"#ffcc6f":"#7be8ff"
            });
        }
    }

    spawnExhaust(){
        const rearX=this.player.x+Math.sin(this.player.angle)*(this.player.height*0.35);
        const rearY=this.player.y+Math.cos(this.player.angle)*(this.player.height*0.35);
        this.particles.push({
            x:rearX+randomRange(-5,5),
            y:rearY+randomRange(-4,4),
            vx:randomRange(-18,18),
            vy:randomRange(80,130),
            size:this.player.boosting?randomRange(4,9):randomRange(2,5),
            life:this.player.boosting?randomRange(0.18,0.3):randomRange(0.12,0.22),
            maxLife:1,
            color:this.player.boosting?"rgba(106,236,255,0.85)":"rgba(255,222,130,0.45)"
        });
    }

    updateParticles(dt){
        for(let i=this.particles.length-1;i>=0;i--){
            const particle=this.particles[i];
            particle.life-=dt;
            if(particle.life<=0){
                this.particles.splice(i,1);
                continue;
            }
            particle.x+=particle.vx*dt;
            particle.y+=particle.vy*dt;
            particle.vx*=0.96;
            particle.vy*=0.96;
        }
    }

    update(dt){
        this.previewScroll+=dt*90;

        if(this.bannerTimer>0){
            this.bannerTimer-=dt;
            if(this.bannerTimer<=0){
                this.hideBanner();
            }
        }

        this.flash=Math.max(0,this.flash-dt*1.8);
        this.shake=Math.max(0,this.shake-dt*30);

        if(this.state!=="playing"){
            this.updateParticles(dt);
            return;
        }

        const boosting=controls.boost&&this.boostMeter>0;
        if(boosting&&this.boostSoundCooldown<=0){
            this.audio.boost();
            this.boostSoundCooldown=0.18;
        }

        this.boostSoundCooldown=Math.max(0,this.boostSoundCooldown-dt);
        const beforeY=this.player.y;
        this.player.updatePlayer(dt,controls,boosting);
        this.player.x=clamp(this.player.x,this.road.left-12,this.road.right+12);
        this.distance+=beforeY-this.player.y;
        this.scoreEvent((beforeY-this.player.y)*(1+(this.combo-1)*0.14));

        if(boosting){
            this.boostMeter=clamp(this.boostMeter-30*dt,0,100);
        }else{
            this.boostMeter=clamp(this.boostMeter+4*dt,0,100);
        }

        this.exhaustTimer-=dt;
        if(this.exhaustTimer<=0){
            this.spawnExhaust();
            this.exhaustTimer=this.player.boosting?0.025:0.05;
        }

        this.spawnCooldown-=dt;
        if(this.spawnCooldown<=0){
            this.spawnTrafficGroup();
        }

        const difficulty=this.getDifficulty();
        for(let i=this.traffic.length-1;i>=0;i--){
            const car=this.traffic[i];
            car.updateTraffic(dt,this.road,difficulty);

            const overlapDistance=(this.player.width+car.width)/2+24;
            if(!car.nearMissed&&Math.abs(car.y-this.player.y)<58&&Math.abs(car.x-this.player.x)<overlapDistance&&Math.abs(car.x-this.player.x)>(this.player.width+car.width)/2+2){
                this.grantNearMiss(car);
            }

            if(!car.passed&&this.player.y<car.y-78){
                car.passed=true;
                this.waveProgress++;
                this.scoreEvent(45);
                if(this.waveProgress>=this.waveTarget){
                    this.advanceWave();
                }
            }

            if(car.y>this.player.y+viewHeight+140){
                this.traffic.splice(i,1);
            }
        }

        if(this.comboTimer>0){
            this.comboTimer-=dt;
            if(this.comboTimer<=0){
                this.combo=1;
            }
        }

        this.nearMissTextTimer=Math.max(0,this.nearMissTextTimer-dt);
        this.cameraY=this.player.y-viewHeight*0.72;

        for(let i=0;i<this.road.borders.length;i++){
            if(polysIntersect(this.player.polygon,this.road.borders[i])){
                this.crash();
                break;
            }
        }

        if(this.state==="playing"){
            for(let i=0;i<this.traffic.length;i++){
                if(polysIntersect(this.player.polygon,this.traffic[i].polygon)){
                    this.crash();
                    break;
                }
            }
        }

        this.updateParticles(dt);
    }

    drawBackdrop(time){
        const gradient=ctx.createLinearGradient(0,0,0,viewHeight);
        gradient.addColorStop(0,"#08101f");
        gradient.addColorStop(0.55,"#090b16");
        gradient.addColorStop(1,"#020206");
        ctx.fillStyle=gradient;
        ctx.fillRect(0,0,viewWidth,viewHeight);

        for(let side=0;side<2;side++){
            const baseX=side===0?viewWidth*0.12:viewWidth*0.88;
            for(let i=0;i<16;i++){
                const y=(i*96+time*0.18*(80+i*6)+this.previewScroll)% (viewHeight+120)-60;
                const width=8+(i%3)*4;
                ctx.fillStyle=i%2===0?"rgba(123,232,255,0.16)":"rgba(255,108,162,0.14)";
                ctx.fillRect(baseX+(side===0?-width:0),y,width,36+(i%4)*18);
            }
        }
    }

    drawWorld(){
        const shakeX=this.shake?randomRange(-this.shake,this.shake):0;
        const shakeY=this.shake?randomRange(-this.shake,this.shake):0;

        ctx.save();
        ctx.translate(shakeX,shakeY);
        ctx.translate(0,-this.cameraY);

        this.road.draw(ctx,this.cameraY,viewHeight,this.wave||1);

        for(let i=0;i<this.particles.length;i++){
            const particle=this.particles[i];
            ctx.globalAlpha=clamp(particle.life/particle.maxLife,0,1);
            ctx.fillStyle=particle.color;
            ctx.beginPath();
            ctx.arc(particle.x,particle.y,particle.size,0,Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha=1;

        if(this.traffic){
            for(let i=0;i<this.traffic.length;i++){
                this.traffic[i].draw(ctx);
            }
        }

        if(this.player){
            this.player.draw(ctx);
        }

        ctx.restore();
    }

    drawPreviewCar(){
        const previewCar=new Car({
            type:"player",
            x:viewWidth/2,
            y:viewHeight*0.72,
            width:40,
            height:66,
            speed:0,
            color:"#5ceaff",
            trimColor:"#fff2ad",
            glowColor:"rgba(92,234,255,0.85)"
        });
        previewCar.boosting=true;

        ctx.save();
        previewCar.draw(ctx);
        ctx.restore();
    }

    drawHUD(){
        if(!this.player){
            return;
        }

        const panelHeight=92;
        ctx.fillStyle="rgba(5,8,18,0.7)";
        ctx.strokeStyle="rgba(255,255,255,0.09)";
        ctx.lineWidth=1;
        ctx.beginPath();
        ctx.roundRect(18,18,240,panelHeight,18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle="#7be8ff";
        ctx.font="700 12px Inter, sans-serif";
        ctx.fillText("Score",34,42);
        ctx.fillStyle="#ffffff";
        ctx.font="800 28px Inter, sans-serif";
        ctx.fillText(formatNumber(this.score),34,72);
        ctx.font="600 12px Inter, sans-serif";
        ctx.fillStyle="#9db2ca";
        ctx.fillText(`Best ${formatNumber(this.highScore)}`,34,95);

        ctx.fillStyle="rgba(5,8,18,0.7)";
        ctx.strokeStyle="rgba(255,255,255,0.09)";
        ctx.beginPath();
        ctx.roundRect(viewWidth-258,18,240,120,18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle="#9db2ca";
        ctx.font="700 12px Inter, sans-serif";
        ctx.fillText(`Wave ${this.wave}`,viewWidth-238,42);
        ctx.fillStyle="#ffffff";
        ctx.font="800 24px Inter, sans-serif";
        ctx.fillText(`${this.waveProgress}/${this.waveTarget} cleared`,viewWidth-238,72);
        ctx.fillStyle="#9db2ca";
        ctx.font="600 12px Inter, sans-serif";
        ctx.fillText(`Speed ${Math.round(this.player.speed)}  |  Combo x${this.combo}`,viewWidth-238,95);

        const barX=viewWidth-238;
        const barY=108;
        const barWidth=200;
        const barHeight=12;
        ctx.fillStyle="rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.roundRect(barX,barY,barWidth,barHeight,999);
        ctx.fill();
        ctx.fillStyle=this.boostMeter>30?"#62f6ff":"#ffd66c";
        ctx.beginPath();
        ctx.roundRect(barX,barY,barWidth*(this.boostMeter/100),barHeight,999);
        ctx.fill();
        ctx.fillStyle="#dbe8ff";
        ctx.font="700 11px Inter, sans-serif";
        ctx.fillText("Boost",barX,103);

        if(this.combo>1){
            ctx.textAlign="center";
            ctx.fillStyle=`rgba(255,240,145,${0.55+Math.sin(performance.now()/120)*0.2})`;
            ctx.font="800 30px Inter, sans-serif";
            ctx.fillText(`x${this.combo} COMBO`,viewWidth/2,74);
            ctx.textAlign="left";
        }

        if(this.nearMissTextTimer>0){
            ctx.textAlign="center";
            ctx.fillStyle=`rgba(123,232,255,${this.nearMissTextTimer})`;
            ctx.font="800 24px Inter, sans-serif";
            ctx.fillText(`Near Miss +${this.nearMissValue}`,viewWidth/2,112);
            ctx.textAlign="left";
        }

        if(this.state==="paused"){
            ctx.textAlign="center";
            ctx.fillStyle="rgba(255,255,255,0.75)";
            ctx.font="700 18px Inter, sans-serif";
            ctx.fillText("Paused",viewWidth/2,viewHeight-28);
            ctx.textAlign="left";
        }
    }

    render(time){
        ctx.setTransform(deviceScale,0,0,deviceScale,0,0);
        ctx.clearRect(0,0,viewWidth,viewHeight);

        this.drawBackdrop(time);

        if(this.state==="title"&&!this.player){
            this.cameraY=-this.previewScroll;
            this.road.draw(ctx,this.cameraY,viewHeight,1);
            this.drawPreviewCar();
        }else{
            this.drawWorld();
            this.drawHUD();
        }

        if(this.flash>0){
            ctx.fillStyle=`rgba(255,255,255,${this.flash*0.35})`;
            ctx.fillRect(0,0,viewWidth,viewHeight);
        }
    }
}

const game=new Game();

function resize(){
    viewWidth=window.innerWidth;
    viewHeight=window.innerHeight;
    deviceScale=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.floor(viewWidth*deviceScale);
    canvas.height=Math.floor(viewHeight*deviceScale);
    canvas.style.width=`${viewWidth}px`;
    canvas.style.height=`${viewHeight}px`;
    game.resize();
}

function animate(time){
    const dt=Math.min(0.032,(time-lastTime)/1000||0.016);
    lastTime=time;
    game.update(dt);
    game.render(time);
    requestAnimationFrame(animate);
}

primaryButton.addEventListener("click",()=>{
    if(game.state==="paused"){
        game.resume();
        return;
    }
    game.startRun();
});

document.addEventListener("keydown",(event)=>{
    const key=event.key.toLowerCase();
    if((key==="enter"||key===" ")&&(game.state==="title"||game.state==="gameover")){
        event.preventDefault();
        game.startRun();
        return;
    }

    if(key==="p"||key==="escape"){
        if(game.state==="playing"){
            event.preventDefault();
            game.pause();
        }else if(game.state==="paused"){
            event.preventDefault();
            game.resume();
        }
    }
});

resize();
requestAnimationFrame(animate);
