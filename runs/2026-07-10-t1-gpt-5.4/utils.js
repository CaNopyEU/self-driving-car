function lerp(a,b,t){
    return a+(b-a)*t;
}

function clamp(value,min,max){
    return Math.max(min,Math.min(max,value));
}

function randomRange(min,max){
    return min+Math.random()*(max-min);
}

function randomInt(min,max){
    return Math.floor(randomRange(min,max+1));
}

function shuffle(items){
    const copy=items.slice();
    for(let i=copy.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
}

function getIntersection(A,B,C,D){
    const tTop=(D.x-C.x)*(A.y-C.y)-(D.y-C.y)*(A.x-C.x);
    const uTop=(C.y-A.y)*(A.x-B.x)-(C.x-A.x)*(A.y-B.y);
    const bottom=(D.y-C.y)*(B.x-A.x)-(D.x-C.x)*(B.y-A.y);

    if(bottom!==0){
        const t=tTop/bottom;
        const u=uTop/bottom;
        if(t>=0&&t<=1&&u>=0&&u<=1){
            return {
                x:lerp(A.x,B.x,t),
                y:lerp(A.y,B.y,t),
                offset:t
            };
        }
    }

    return null;
}

function polysIntersect(poly1,poly2){
    for(let i=0;i<poly1.length;i++){
        for(let j=0;j<poly2.length;j++){
            const touch=getIntersection(
                poly1[i],
                poly1[(i+1)%poly1.length],
                poly2[j],
                poly2[(j+1)%poly2.length]
            );
            if(touch){
                return true;
            }
        }
    }
    return false;
}

function safeStorageGet(key){
    try{
        return window.localStorage.getItem(key);
    }catch(error){
        return null;
    }
}

function safeStorageSet(key,value){
    try{
        window.localStorage.setItem(key,value);
    }catch(error){}
}

function safeStorageRemove(key){
    try{
        window.localStorage.removeItem(key);
    }catch(error){}
}
                
