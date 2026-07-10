// Self-contained WebAudio SFX + ambient engine drone. No external assets.
// All access guarded — never throws if audio is unavailable/blocked.
const Sound=(function(){
    let ctx=null, master=null, engine=null, engineGain=null, muted=false;

    function ensure(){
        if(ctx) return true;
        try{
            const AC=window.AudioContext||window.webkitAudioContext;
            if(!AC) return false;
            ctx=new AC();
            master=ctx.createGain();
            master.gain.value=0.35;
            master.connect(ctx.destination);
            return true;
        }catch(e){ return false; }
    }

    function resume(){
        try{ if(ctx&&ctx.state==="suspended") ctx.resume(); }catch(e){}
    }

    function beep(freq,dur,type,vol,slideTo){
        if(muted||!ensure()) return;
        try{
            resume();
            const o=ctx.createOscillator();
            const g=ctx.createGain();
            o.type=type||"square";
            o.frequency.setValueAtTime(freq,ctx.currentTime);
            if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo,ctx.currentTime+dur);
            g.gain.setValueAtTime(vol||0.3,ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
            o.connect(g); g.connect(master);
            o.start(); o.stop(ctx.currentTime+dur);
        }catch(e){}
    }

    function noise(dur,vol){
        if(muted||!ensure()) return;
        try{
            resume();
            const buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
            const d=buf.getChannelData(0);
            for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
            const src=ctx.createBufferSource(); src.buffer=buf;
            const g=ctx.createGain(); g.gain.value=vol||0.5;
            const f=ctx.createBiquadFilter(); f.type="lowpass"; f.frequency.value=1200;
            src.connect(f); f.connect(g); g.connect(master);
            src.start();
        }catch(e){}
    }

    return {
        startEngine(){
            if(muted||!ensure()) return;
            try{
                resume();
                if(engine) return;
                engine=ctx.createOscillator();
                engine.type="sawtooth";
                engine.frequency.value=60;
                engineGain=ctx.createGain();
                engineGain.gain.value=0.0;
                const f=ctx.createBiquadFilter(); f.type="lowpass"; f.frequency.value=400;
                engine.connect(f); f.connect(engineGain); engineGain.connect(master);
                engine.start();
            }catch(e){}
        },
        setEngine(speedFrac,boosting){
            if(!engine||!ctx) return;
            try{
                engine.frequency.setTargetAtTime(50+speedFrac*180+(boosting?90:0),ctx.currentTime,0.05);
                engineGain.gain.setTargetAtTime(0.04+speedFrac*0.10,ctx.currentTime,0.1);
            }catch(e){}
        },
        stopEngine(){
            try{ if(engine){ engine.stop(); engine.disconnect(); engine=null; } }catch(e){ engine=null; }
        },
        overtake(){ beep(660,0.12,"square",0.25,990); },
        near(){ beep(1400,0.05,"sine",0.12); },
        boost(){ beep(220,0.3,"sawtooth",0.2,540); },
        levelUp(){ beep(523,0.1,"square",0.3); setTimeout(()=>beep(784,0.18,"square",0.3),110); },
        crash(){ noise(0.5,0.7); beep(140,0.4,"sawtooth",0.35,60); },
        pickup(){ beep(880,0.08,"sine",0.25,1320); },
        uiClick(){ beep(440,0.06,"square",0.2); },
        toggleMute(){ muted=!muted; if(muted) this.stopEngine(); return muted; },
        isMuted(){ return muted; },
        unlock(){ ensure(); resume(); }
    };
})();
