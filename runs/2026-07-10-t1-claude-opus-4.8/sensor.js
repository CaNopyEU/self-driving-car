// Sensor rays — used by AI RIVAL cars so their neural-net brain can "see"
// nearby traffic and road edges to weave through them.
class Sensor{
    constructor(car,rayCount=5,rayLength=150,raySpread=Math.PI/2){
        this.car=car;
        this.rayCount=rayCount;
        this.rayLength=rayLength;
        this.raySpread=raySpread;
        this.rays=[];
        this.readings=[];
    }

    update(roadBorders,obstacles){
        this.#castRays();
        this.readings=[];
        for(let i=0;i<this.rays.length;i++){
            this.readings.push(
                this.#getReading(this.rays[i],roadBorders,obstacles)
            );
        }
    }

    #getReading(ray,roadBorders,obstacles){
        let touches=[];
        for(let i=0;i<roadBorders.length;i++){
            const touch=getIntersection(ray[0],ray[1],roadBorders[i][0],roadBorders[i][1]);
            if(touch) touches.push(touch);
        }
        for(let i=0;i<obstacles.length;i++){
            const poly=obstacles[i].polygon;
            if(!poly) continue;
            for(let j=0;j<poly.length;j++){
                const value=getIntersection(ray[0],ray[1],poly[j],poly[(j+1)%poly.length]);
                if(value) touches.push(value);
            }
        }
        if(touches.length==0) return null;
        const minOffset=Math.min(...touches.map(e=>e.offset));
        return touches.find(e=>e.offset==minOffset);
    }

    #castRays(){
        this.rays=[];
        for(let i=0;i<this.rayCount;i++){
            const rayAngle=lerp(
                this.raySpread/2,
                -this.raySpread/2,
                this.rayCount==1?0.5:i/(this.rayCount-1)
            )+this.car.angle;
            const start={x:this.car.x, y:this.car.y};
            const end={
                x:this.car.x-Math.sin(rayAngle)*this.rayLength,
                y:this.car.y-Math.cos(rayAngle)*this.rayLength
            };
            this.rays.push([start,end]);
        }
    }
}
