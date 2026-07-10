class Sensor{
    constructor(car,opts={}){
        this.car=car;
        this.rayCount=opts.rayCount ?? 5;
        this.rayLength=opts.rayLength ?? 150;
        this.raySpread=opts.raySpread ?? Math.PI/2;
        this.rays=[];
        this.readings=[];
    }
    update(roadBorders,traffic){
        this.#castRays();
        this.readings=[];
        for(let i=0;i<this.rays.length;i++){
            this.readings.push(this.#getReading(this.rays[i],roadBorders,traffic));
        }
    }
    #getReading(ray,roadBorders,traffic){
        let touches=[];
        for(let i=0;i<roadBorders.length;i++){
            const t=getIntersection(ray[0],ray[1],roadBorders[i][0],roadBorders[i][1]);
            if(t) touches.push(t);
        }
        for(let i=0;i<traffic.length;i++){
            const poly=traffic[i].polygon;
            if(!poly) continue;
            for(let j=0;j<poly.length;j++){
                const v=getIntersection(ray[0],ray[1],poly[j],poly[(j+1)%poly.length]);
                if(v) touches.push(v);
            }
        }
        if(touches.length===0) return null;
        const minOffset=Math.min(...touches.map(e=>e.offset));
        return touches.find(e=>e.offset===minOffset);
    }
    #castRays(){
        this.rays=[];
        for(let i=0;i<this.rayCount;i++){
            const rayAngle=lerp(this.raySpread/2,-this.raySpread/2,
                this.rayCount===1?0.5:i/(this.rayCount-1))+this.car.angle;
            const start={x:this.car.x,y:this.car.y};
            const end={
                x:this.car.x-Math.sin(rayAngle)*this.rayLength,
                y:this.car.y-Math.cos(rayAngle)*this.rayLength
            };
            this.rays.push([start,end]);
        }
    }
}
