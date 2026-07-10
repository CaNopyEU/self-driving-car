// Car: PLAYER (keyboard), RIVAL (neural-net brain), TRAFFIC (dummy obstacle).
// All cars are drawn procedurally as neon vehicles — no external image needed.
class Car{
    constructor(x,y,width,height,type,maxSpeed=4,color="#00e5ff"){
        this.x=x;
        this.y=y;
        this.width=width;
        this.height=height;
        this.type=type;
        this.color=color;

        this.speed=0;
        this.angle=0;
        this.damaged=false;

        this.maxSpeed=maxSpeed;
        this.acceleration=type=="TRAFFIC"?0.15:0.28;
        this.friction=0.04;

        if(type=="PLAYER"){
            this.controls=new Controls("KEYS");
        }else if(type=="RIVAL"){
            this.controls=new Controls("AI");
            this.sensor=new Sensor(this,RivalAI.RAY_COUNT,150,Math.PI/2);
            this.brain=RivalAI.brain?NeuralNetwork.clone(RivalAI.brain):new NeuralNetwork([RivalAI.RAY_COUNT,RivalAI.HIDDEN,4]);
        }else{
            this.controls=new Controls("DUMMY");
        }

        this.polygon=this.#createPolygon();
    }

    update(roadBorders,obstacles){
        if(this.damaged) return;

        if(this.type=="RIVAL" && this.sensor){
            this.sensor.update(roadBorders,obstacles);
            const offsets=this.sensor.readings.map(s=>s==null?0:1-s.offset);
            const out=NeuralNetwork.feedForward(offsets,this.brain);
            this.controls.forward=!!out[0]||true; // always press forward, brain steers
            this.controls.left=!!out[1];
            this.controls.right=!!out[2];
            this.controls.reverse=!!out[3]&&!out[0];
        }

        this.#move();
        this.polygon=this.#createPolygon();
        this.damaged=this.#assessDamage(roadBorders,obstacles);
    }

    #assessDamage(roadBorders,obstacles){
        for(let i=0;i<roadBorders.length;i++){
            if(polysIntersect(this.polygon,roadBorders[i])){
                return true;
            }
        }
        for(let i=0;i<obstacles.length;i++){
            if(obstacles[i]===this) continue;
            if(obstacles[i].polygon && polysIntersect(this.polygon,obstacles[i].polygon)){
                return true;
            }
        }
        return false;
    }

    #createPolygon(){
        const points=[];
        const rad=Math.hypot(this.width,this.height)/2;
        const alpha=Math.atan2(this.width,this.height);
        points.push({x:this.x-Math.sin(this.angle-alpha)*rad,y:this.y-Math.cos(this.angle-alpha)*rad});
        points.push({x:this.x-Math.sin(this.angle+alpha)*rad,y:this.y-Math.cos(this.angle+alpha)*rad});
        points.push({x:this.x-Math.sin(Math.PI+this.angle-alpha)*rad,y:this.y-Math.cos(Math.PI+this.angle-alpha)*rad});
        points.push({x:this.x-Math.sin(Math.PI+this.angle+alpha)*rad,y:this.y-Math.cos(Math.PI+this.angle+alpha)*rad});
        return points;
    }

    #move(){
        const boosting=this.controls.boost&&this.type=="PLAYER";
        const topSpeed=this.maxSpeed*(boosting?1.7:1);
        const accel=this.acceleration*(boosting?1.6:1);

        if(this.controls.forward) this.speed+=accel;
        if(this.controls.reverse) this.speed-=accel;

        if(this.speed>topSpeed) this.speed=topSpeed;
        if(this.speed<-this.maxSpeed/2) this.speed=-this.maxSpeed/2;

        if(this.speed>0) this.speed-=this.friction;
        if(this.speed<0) this.speed+=this.friction;
        if(Math.abs(this.speed)<this.friction) this.speed=0;

        if(this.speed!=0){
            const flip=this.speed>0?1:-1;
            const steer=this.type=="PLAYER"?0.036:0.045;
            if(this.controls.left) this.angle+=steer*flip;
            if(this.controls.right) this.angle-=steer*flip;
            // keep cars roughly aligned with the road
            this.angle=clamp(this.angle,-0.6,0.6);
        }

        this.x-=Math.sin(this.angle)*this.speed;
        this.y-=Math.cos(this.angle)*this.speed;
    }

    draw(ctx){
        const boosting=this.controls&&this.controls.boost&&this.type=="PLAYER"&&this.speed>0.5;
        ctx.save();
        ctx.translate(this.x,this.y);
        ctx.rotate(-this.angle);

        const w=this.width, h=this.height;

        // boost flame behind player
        if(boosting){
            ctx.save();
            ctx.globalAlpha=0.8;
            const flame=ctx.createLinearGradient(0,h/2,0,h/2+30+Math.random()*20);
            flame.addColorStop(0,"#fff6a8");
            flame.addColorStop(0.4,"#ff8a00");
            flame.addColorStop(1,"rgba(255,42,109,0)");
            ctx.fillStyle=flame;
            ctx.beginPath();
            ctx.moveTo(-6,h/2);
            ctx.lineTo(6,h/2);
            ctx.lineTo(0,h/2+26+Math.random()*22);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        const body=this.damaged?"#555":this.color;
        ctx.shadowBlur=this.damaged?0:14;
        ctx.shadowColor=body;

        // body
        this.#roundRect(ctx,-w/2,-h/2,w,h,6);
        ctx.fillStyle=body;
        ctx.fill();
        ctx.shadowBlur=0;

        // windshield
        ctx.fillStyle="rgba(10,12,25,0.85)";
        this.#roundRect(ctx,-w/2+4,-h/2+8,w-8,h*0.32,3);
        ctx.fill();
        // rear window
        this.#roundRect(ctx,-w/2+4,h/2-h*0.28,w-8,h*0.20,3);
        ctx.fill();

        // headlights
        if(!this.damaged){
            ctx.fillStyle="#fffbe0";
            ctx.fillRect(-w/2+3,-h/2+2,5,3);
            ctx.fillRect(w/2-8,-h/2+2,5,3);
        }

        ctx.restore();
    }

    #roundRect(ctx,x,y,w,h,r){
        ctx.beginPath();
        ctx.moveTo(x+r,y);
        ctx.arcTo(x+w,y,x+w,y+h,r);
        ctx.arcTo(x+w,y+h,x,y+h,r);
        ctx.arcTo(x,y+h,x,y,r);
        ctx.arcTo(x,y,x+w,y,r);
        ctx.closePath();
    }
}
