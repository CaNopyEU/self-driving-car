/* Safe storage wrappers — sandboxed iframes throw on localStorage access */
const SafeStorage={
    get(k){try{return localStorage.getItem(k);}catch(e){return null;}},
    set(k,v){try{localStorage.setItem(k,v);}catch(e){}},
    remove(k){try{localStorage.removeItem(k);}catch(e){}}
};

function lerp(A,B,t){return A+(B-A)*t;}

function getIntersection(A,B,C,D){
    const tTop=(D.x-C.x)*(A.y-C.y)-(D.y-C.y)*(A.x-C.x);
    const uTop=(C.y-A.y)*(A.x-B.x)-(C.x-A.x)*(A.y-B.y);
    const bottom=(D.y-C.y)*(B.x-A.x)-(D.x-C.x)*(B.y-A.y);
    if(bottom!=0){
        const t=tTop/bottom;
        const u=uTop/bottom;
        if(t>=0&&t<=1&&u>=0&&u<=1){
            return {x:lerp(A.x,B.x,t),y:lerp(A.y,B.y,t),offset:t};
        }
    }
    return null;
}

function polysIntersect(poly1,poly2){
    for(let i=0;i<poly1.length;i++){
        for(let j=0;j<poly2.length;j++){
            if(getIntersection(
                poly1[i],poly1[(i+1)%poly1.length],
                poly2[j],poly2[(j+1)%poly2.length]
            )) return true;
        }
    }
    return false;
}

function rand(a,b){return a+Math.random()*(b-a);}
function randInt(a,b){return Math.floor(rand(a,b+1));}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

function trafficColor(){
    // avoid cyan (player) and red (hunter) so player can identify threats at a glance
    const hues=[45,60,30,280,300,140,100];
    return "hsl("+hues[randInt(0,hues.length-1)]+", 65%, 55%)";
}
