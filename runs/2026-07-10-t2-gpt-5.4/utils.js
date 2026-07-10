export function clamp(value,min,max){
    return Math.min(max,Math.max(min,value));
}

export function lerp(a,b,t){
    return a+(b-a)*t;
}

export function rand(min,max){
    return min+Math.random()*(max-min);
}

export function randInt(min,max){
    return Math.floor(rand(min,max+1));
}

export function choose(list){
    return list[Math.floor(Math.random()*list.length)];
}

export function approach(value,target,delta){
    if(value<target){
        return Math.min(target,value+delta);
    }
    if(value>target){
        return Math.max(target,value-delta);
    }
    return value;
}
