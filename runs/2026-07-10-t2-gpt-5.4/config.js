export const CONFIG={
    laneCount:4,
    laneWidth:4.5,
    shoulderWidth:2.4,
    roadSegmentLength:32,
    visibleSegments:26,
    startPlayerSpeed:34,
    maxPlayerSpeed:78,
    acceleration:30,
    braking:40,
    drag:10,
    steerAcceleration:4.8,
    steerReturn:5.6,
    maxSteer:1.25,
    trafficBaseCount:8,
    trafficCountPerStage:2,
    trafficSpeedMin:18,
    trafficSpeedMax:32,
    trafficGapMin:44,
    trafficGapMax:76,
    nearMissDistance:2.4,
    collisionLength:2.6,
    collisionWidth:1.55,
    stageDistance:420,
    boostMax:100,
    boostDrain:28,
    boostRecover:18,
    boostPower:22,
    scorePerMeter:8,
    nearMissScore:250,
    cleanStageBonus:600,
    storageKey:"neon-runaway-high-score"
};

const memoryStorage=new Map();

function getStorage(){
    try{
        if(typeof window!=="undefined"&&window.localStorage){
            const probe="__neon-runaway-probe__";
            window.localStorage.setItem(probe,"1");
            window.localStorage.removeItem(probe);
            return window.localStorage;
        }
    }catch(error){
        return null;
    }
    return null;
}

const safeLocalStorage=getStorage();

export const storage={
    getNumber(key,fallback=0){
        try{
            const raw=safeLocalStorage?safeLocalStorage.getItem(key):memoryStorage.get(key);
            if(raw==null){
                return fallback;
            }
            const value=Number(raw);
            return Number.isFinite(value)?value:fallback;
        }catch(error){
            return fallback;
        }
    },
    setNumber(key,value){
        try{
            if(safeLocalStorage){
                safeLocalStorage.setItem(key,String(value));
            }else{
                memoryStorage.set(key,String(value));
            }
        }catch(error){
            memoryStorage.set(key,String(value));
        }
    }
};
