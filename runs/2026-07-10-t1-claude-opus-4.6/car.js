class Car{
    constructor(x,y,width,height,controlType,maxSpeed=4,color="#0088ff"){
        this.x=x;
        this.y=y;
        this.width=width;
        this.height=height;
        this.speed=0;
        this.maxSpeed=maxSpeed;
        this.acceleration=controlType==="DUMMY"?0.2:0.25;
        this.friction=controlType==="DUMMY"?0.02:0.05;
        this.angle=0;
        this.damaged=false;
        this.color=color;
        this.controlType=controlType;
        this.useBrain=controlType==="AI";
        this.steerSpeed=controlType==="DUMMY"?0:0.035;

        if(controlType==="AI"){
            this.sensor=new Sensor(this,5,150,Math.PI/2);
            this.brain=new NeuralNetwork([5,6,4]);
        }
        if(controlType==="KEYS"){
            this.steerSpeed=0.04;
        }
        this.controls=new Controls(controlType);
        this.polygon=this.#createPolygon();
    }

    update(roadBorders,traffic){
        if(this.damaged) return;
        this.#move();
        this.polygon=this.#createPolygon();
        this.damaged=this.#assessDamage(roadBorders,traffic);

        if(this.sensor){
            this.sensor.update(roadBorders,traffic);
            const offsets=this.sensor.readings.map(s=>s==null?0:1-s.offset);
            const outputs=NeuralNetwork.feedForward(offsets,this.brain);
            if(this.useBrain){
                this.controls.forward=outputs[0];
                this.controls.left=outputs[1];
                this.controls.right=outputs[2];
                this.controls.reverse=outputs[3];
            }
        }
    }

    #assessDamage(roadBorders,traffic){
        for(let i=0;i<roadBorders.length;i++){
            if(polysIntersect(this.polygon,roadBorders[i])) return true;
        }
        for(let i=0;i<traffic.length;i++){
            if(traffic[i]===this) continue;
            if(traffic[i].polygon&&polysIntersect(this.polygon,traffic[i].polygon)) return true;
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
        if(this.controls.forward) this.speed+=this.acceleration;
        if(this.controls.reverse) this.speed-=this.acceleration;
        if(this.speed>this.maxSpeed) this.speed=this.maxSpeed;
        if(this.speed<-this.maxSpeed/2) this.speed=-this.maxSpeed/2;
        if(this.speed>0) this.speed-=this.friction;
        if(this.speed<0) this.speed+=this.friction;
        if(Math.abs(this.speed)<this.friction) this.speed=0;

        if(this.speed!==0){
            const flip=this.speed>0?1:-1;
            if(this.controls.left) this.angle+=this.steerSpeed*flip;
            if(this.controls.right) this.angle-=this.steerSpeed*flip;
        }
        this.x-=Math.sin(this.angle)*this.speed;
        this.y-=Math.cos(this.angle)*this.speed;
    }

    draw(ctx,isPlayer=false){
        ctx.save();
        ctx.translate(this.x,this.y);
        ctx.rotate(-this.angle);

        // Draw car body
        const w=this.width,h=this.height;
        ctx.fillStyle=this.damaged?"#555":this.color;
        ctx.fillRect(-w/2,-h/2,w,h);

        // Windshield
        if(!this.damaged){
            ctx.fillStyle="rgba(100,200,255,0.5)";
            ctx.fillRect(-w/2+4,-h/4,w-8,h/4);
        }

        // Wheels
        ctx.fillStyle="#222";
        ctx.fillRect(-w/2-2,-h/2+4,5,10);
        ctx.fillRect(w/2-3,-h/2+4,5,10);
        ctx.fillRect(-w/2-2,h/2-14,5,10);
        ctx.fillRect(w/2-3,h/2-14,5,10);

        // Player glow
        if(isPlayer&&!this.damaged){
            ctx.shadowColor="#0ff";
            ctx.shadowBlur=15;
            ctx.strokeStyle="#0ff";
            ctx.lineWidth=2;
            ctx.strokeRect(-w/2,-h/2,w,h);
            ctx.shadowBlur=0;
        }

        ctx.restore();
    }
}
