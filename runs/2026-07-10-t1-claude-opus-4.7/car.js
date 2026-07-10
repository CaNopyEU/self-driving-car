class Car{
    constructor(x,y,width,height,controlType,opts={}){
        this.x=x; this.y=y;
        this.width=width; this.height=height;
        this.speed=0;
        this.type=controlType; // PLAYER, HUNTER, DUMMY
        this.maxSpeed=opts.maxSpeed ?? (controlType==="PLAYER"?7:3);
        this.acceleration=opts.acceleration ?? (controlType==="DUMMY"?0.15:0.3);
        this.friction=controlType==="DUMMY"?0.02:0.05;
        this.angle=0;
        this.damaged=false;
        this.color=opts.color || "#4af";
        this.trafficId=opts.trafficId;
        this.invuln=0; // frames of invulnerability after respawn/hit

        this.controls=new Controls(controlType==="PLAYER"?"KEYS":(controlType==="DUMMY"?"DUMMY":"AI"));

        if(controlType==="HUNTER"){
            this.sensor=new Sensor(this,{rayCount:5,rayLength:180,raySpread:Math.PI*0.9});
            this.brain=NeuralNetwork.hunterBrain();
        }
        this.polygon=this.#createPolygon();
    }

    update(roadBorders,traffic,playerRef){
        if(this.damaged) return;
        if(this.invuln>0) this.invuln--;

        if(this.type==="HUNTER" && this.sensor && playerRef){
            // treat player + other traffic as obstacles
            const obstacles=traffic.filter(t=>t!==this);
            if(playerRef && !playerRef.damaged) obstacles.push(playerRef);
            this.sensor.update(roadBorders,obstacles);
            const readings=this.sensor.readings.map(r=>r==null?0:1-r.offset);
            // Also feed relative x to player as an extra input
            const dx=playerRef ? (playerRef.x-this.x)/200 : 0;
            const dy=playerRef ? (playerRef.y-this.y)/400 : 0;
            const inputs=[...readings,clamp(dx,-1,1),clamp(dy,-1,1)];
            const out=NeuralNetwork.feedForward(inputs,this.brain);
            this.controls.forward=out[0]>0.5;
            this.controls.left=out[1]>0.5;
            this.controls.right=out[2]>0.5;
            this.controls.reverse=out[3]>0.5;
        }

        this.#move();
        this.polygon=this.#createPolygon();
        if(this.invuln===0){
            this.damaged=this.#assessDamage(roadBorders,traffic);
        }
    }

    #assessDamage(roadBorders,traffic){
        for(let i=0;i<roadBorders.length;i++){
            if(polysIntersect(this.polygon,roadBorders[i])) return true;
        }
        for(let i=0;i<traffic.length;i++){
            if(traffic[i]===this) continue;
            if(traffic[i].damaged) continue;
            if(polysIntersect(this.polygon,traffic[i].polygon)) return true;
        }
        return false;
    }

    #createPolygon(){
        const points=[];
        const rad=Math.hypot(this.width,this.height)/2;
        const alpha=Math.atan2(this.width,this.height);
        points.push({x:this.x-Math.sin(this.angle-alpha)*rad, y:this.y-Math.cos(this.angle-alpha)*rad});
        points.push({x:this.x-Math.sin(this.angle+alpha)*rad, y:this.y-Math.cos(this.angle+alpha)*rad});
        points.push({x:this.x-Math.sin(Math.PI+this.angle-alpha)*rad, y:this.y-Math.cos(Math.PI+this.angle-alpha)*rad});
        points.push({x:this.x-Math.sin(Math.PI+this.angle+alpha)*rad, y:this.y-Math.cos(Math.PI+this.angle+alpha)*rad});
        return points;
    }

    #move(){
        let accel=this.acceleration;
        let topSpeed=this.maxSpeed;
        if(this.type==="PLAYER" && this.controls.boost && this.fuel>0){
            topSpeed=this.maxSpeed*1.6;
            accel*=1.5;
        }
        if(this.controls.forward) this.speed+=accel;
        if(this.controls.reverse) this.speed-=accel;
        if(this.speed>topSpeed) this.speed=topSpeed;
        if(this.speed<-topSpeed/2) this.speed=-topSpeed/2;
        if(this.speed>0) this.speed-=this.friction;
        if(this.speed<0) this.speed+=this.friction;
        if(Math.abs(this.speed)<this.friction) this.speed=0;

        if(this.speed!=0){
            const flip=this.speed>0?1:-1;
            const steer=this.type==="PLAYER"?0.04:0.03;
            if(this.controls.left) this.angle+=steer*flip;
            if(this.controls.right) this.angle-=steer*flip;
        }
        this.x-=Math.sin(this.angle)*this.speed;
        this.y-=Math.cos(this.angle)*this.speed;
    }

    draw(ctx){
        ctx.save();
        ctx.translate(this.x,this.y);
        ctx.rotate(-this.angle);

        const w=this.width, h=this.height;

        if(this.damaged){
            ctx.fillStyle="#444";
            ctx.fillRect(-w/2,-h/2,w,h);
            ctx.fillStyle="#222";
            for(let i=0;i<4;i++){
                ctx.fillRect(-w/2+i*w/4,-h/2+((i*7)%h),4,4);
            }
            ctx.restore();
            return;
        }

        // shadow
        ctx.fillStyle="rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(2,4,w/2,h/2,0,0,Math.PI*2);
        ctx.fill();

        // body
        ctx.fillStyle=this.color;
        this.#roundRect(ctx,-w/2,-h/2,w,h,5);
        ctx.fill();

        // windshield
        ctx.fillStyle="rgba(20,30,50,0.85)";
        this.#roundRect(ctx,-w/2+3,-h/2+6,w-6,h*0.3,3);
        ctx.fill();

        // rear window
        this.#roundRect(ctx,-w/2+3,h/2-h*0.28,w-6,h*0.22,3);
        ctx.fill();

        // roof stripe
        ctx.fillStyle="rgba(255,255,255,0.15)";
        ctx.fillRect(-w/2+2,-h/2+h*0.38,w-4,h*0.18);

        // headlights
        if(this.type==="PLAYER" || this.type==="HUNTER"){
            ctx.fillStyle=this.type==="HUNTER"?"#f33":"#fff5b0";
            ctx.fillRect(-w/2+3,-h/2+1,4,3);
            ctx.fillRect(w/2-7,-h/2+1,4,3);
        }else{
            // dummy: taillights (facing player - away from player it faces)
            ctx.fillStyle="#fff5b0";
            ctx.fillRect(-w/2+3,-h/2+1,4,3);
            ctx.fillRect(w/2-7,-h/2+1,4,3);
            ctx.fillStyle="#f22";
            ctx.fillRect(-w/2+3,h/2-4,4,3);
            ctx.fillRect(w/2-7,h/2-4,4,3);
        }

        // invulnerability flash outline
        if(this.invuln>0 && Math.floor(this.invuln/4)%2===0){
            ctx.strokeStyle="#fff";
            ctx.lineWidth=2;
            this.#roundRect(ctx,-w/2,-h/2,w,h,5);
            ctx.stroke();
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
