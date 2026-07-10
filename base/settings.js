const RESTART_KEYS=new Set([
    "N","maxSpeedAI","acceleration","friction","steeringSensitivity",
    "trafficSpeed","laneCount","mutationRate","hiddenNeurons",
    "rayCount","rayLength","raySpread"
]);

const LIVE_KEYS=new Set([
    "nonBestOpacity","simSpeed","showSensors","paused","overtakeWeight"
]);

const DEGREE_KEYS=new Set(["raySpread"]);

function toggleSettings(){
    document.getElementById("settingsPanel").classList.toggle("collapsed");
}

function toggleHelp(){
    document.getElementById("helpOverlay").classList.toggle("hidden");
}

let listenersBound=false;

function populatePanel(){
    for(const key in CONFIG_DEFAULTS){
        const el=document.getElementById("cfg-"+key);
        if(!el) continue;

        let val=CONFIG[key];
        if(el.type==="checkbox"){
            el.checked=val;
        }else{
            if(DEGREE_KEYS.has(key)) val=Math.round(val*180/Math.PI);
            el.value=val;
            updateRangeDisplay(el);
        }
    }
    if(!listenersBound){
        bindLiveListeners();
        bindRangeDisplays();
        listenersBound=true;
    }
}

function updateRangeDisplay(input){
    const span=input.parentElement&&input.parentElement.querySelector(".range-val");
    if(span) span.textContent=input.value;
}

function bindRangeDisplays(){
    document.querySelectorAll('#settingsPanel input[type="range"]').forEach(input=>{
        input.addEventListener("input",()=>updateRangeDisplay(input));
    });
}

function bindLiveListeners(){
    const liveCheckboxes=["cfg-showSensors","cfg-paused"];
    liveCheckboxes.forEach(id=>{
        const el=document.getElementById(id);
        if(!el) return;
        el.addEventListener("change",()=>{
            const key=id.replace("cfg-","");
            CONFIG[key]=el.checked;
            CONFIG.save();
        });
    });

    const liveRanges=["cfg-nonBestOpacity","cfg-simSpeed","cfg-overtakeWeight"];
    liveRanges.forEach(id=>{
        const el=document.getElementById(id);
        if(!el) return;
        el.addEventListener("input",()=>{
            const key=id.replace("cfg-","");
            CONFIG[key]=parseFloat(el.value);
            CONFIG.save();
        });
    });
}

function readPanel(){
    const values={};
    for(const key in CONFIG_DEFAULTS){
        const el=document.getElementById("cfg-"+key);
        if(!el) continue;

        if(el.type==="checkbox"){
            values[key]=el.checked;
        }else{
            let val=parseFloat(el.value);
            if(DEGREE_KEYS.has(key)) val=val*Math.PI/180;
            values[key]=val;
        }
    }
    return values;
}

function applySettings(){
    const newValues=readPanel();
    const oldRayCount=CONFIG.rayCount;
    const oldHiddenNeurons=CONFIG.hiddenNeurons;

    let needsRestart=false;
    for(const key of RESTART_KEYS){
        if(newValues[key]!==undefined&&newValues[key]!==CONFIG[key]){
            needsRestart=true;
            break;
        }
    }

    if(needsRestart){
        const brainIncompat=(
            newValues.rayCount!==oldRayCount||
            newValues.hiddenNeurons!==oldHiddenNeurons
        );
        if(brainIncompat&&localStorage.getItem("bestBrain")){
            if(!confirm("Changing network architecture will invalidate your saved brain. Discard it?")){
                return;
            }
            localStorage.removeItem("bestBrain");
        }
    }

    for(const key in newValues){
        CONFIG[key]=newValues[key];
    }
    CONFIG.save();

    if(needsRestart){
        restartSimulation();
    }
}

const PRESETS={
    fast:{
        N:250,maxSpeedAI:3,acceleration:0.2,friction:0.05,
        steeringSensitivity:0.03,trafficSpeed:2,laneCount:3,
        mutationRate:0.15,hiddenNeurons:6,rayCount:7,
        rayLength:180,raySpread:120*Math.PI/180,overtakeWeight:50,
        nonBestOpacity:0.05,simSpeed:4,showSensors:true,paused:false
    },
    finetune:{
        N:200,maxSpeedAI:3,acceleration:0.2,friction:0.05,
        steeringSensitivity:0.03,trafficSpeed:2,laneCount:3,
        mutationRate:0.05,hiddenNeurons:6,rayCount:7,
        rayLength:180,raySpread:120*Math.PI/180,overtakeWeight:50,
        nonBestOpacity:0.05,simSpeed:3,showSensors:true,paused:false
    },
    wide:{
        N:300,maxSpeedAI:4,acceleration:0.2,friction:0.05,
        steeringSensitivity:0.03,trafficSpeed:2,laneCount:5,
        mutationRate:0.15,hiddenNeurons:10,rayCount:9,
        rayLength:200,raySpread:130*Math.PI/180,overtakeWeight:60,
        nonBestOpacity:0.05,simSpeed:3,showSensors:true,paused:false
    },
    default:Object.assign({},CONFIG_DEFAULTS)
};

function loadPreset(name){
    const preset=PRESETS[name];
    if(!preset) return;
    for(const key in preset){
        CONFIG[key]=preset[key];
    }
    populatePanel();
}

populatePanel();
