const CONFIG={
    // Auto & Physics
    N:100,
    maxSpeedAI:3,
    acceleration:0.2,
    friction:0.05,
    steeringSensitivity:0.03,

    // Traffic
    trafficSpeed:2,
    laneCount:3,

    // Neural Network
    mutationRate:0.1,
    hiddenNeurons:6,
    rayCount:5,
    rayLength:150,
    raySpread:Math.PI/2,

    // Fitness
    overtakeWeight:50,

    // Visual & Simulation
    paused:false,
    nonBestOpacity:0.2,
    showSensors:true,
    simSpeed:1
};

const CONFIG_DEFAULTS=Object.assign({},CONFIG);

const CONFIG_RANGES={
    N:{min:1,max:500,type:"int"},
    maxSpeedAI:{min:0.5,max:10,type:"float"},
    acceleration:{min:0.05,max:1,type:"float"},
    friction:{min:0.01,max:0.2,type:"float"},
    steeringSensitivity:{min:0.01,max:0.1,type:"float"},
    trafficSpeed:{min:0.5,max:5,type:"float"},
    laneCount:{min:2,max:6,type:"int"},
    mutationRate:{min:0,max:1,type:"float"},
    hiddenNeurons:{min:2,max:20,type:"int"},
    rayCount:{min:1,max:15,type:"int"},
    rayLength:{min:50,max:400,type:"float"},
    raySpread:{min:Math.PI/6,max:Math.PI*2,type:"float"},
    overtakeWeight:{min:0,max:200,type:"int"},
    nonBestOpacity:{min:0,max:1,type:"float"},
    simSpeed:{min:1,max:5,type:"int"},
    showSensors:{type:"bool"},
    paused:{type:"bool"}
};

function validateConfig(){
    for(const key in CONFIG_RANGES){
        const rule=CONFIG_RANGES[key];
        let val=CONFIG[key];

        if(rule.type==="bool"){
            if(typeof val!=="boolean") CONFIG[key]=CONFIG_DEFAULTS[key];
            continue;
        }

        if(typeof val!=="number"||isNaN(val)){
            CONFIG[key]=CONFIG_DEFAULTS[key];
            continue;
        }

        if(rule.type==="int") val=Math.round(val);
        val=Math.max(rule.min,Math.min(rule.max,val));
        CONFIG[key]=val;
    }
}

CONFIG.save=function(){
    const data={};
    for(const key in CONFIG_DEFAULTS){
        data[key]=CONFIG[key];
    }
    localStorage.setItem("simConfig",JSON.stringify(data));
};

CONFIG.load=function(){
    const stored=localStorage.getItem("simConfig");
    if(stored){
        try{
            const data=JSON.parse(stored);
            for(const key in CONFIG_DEFAULTS){
                if(data[key]!==undefined){
                    CONFIG[key]=data[key];
                }
            }
        }catch(e){}
    }
    validateConfig();
};

CONFIG.load();
