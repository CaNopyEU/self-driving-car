class Car{
    constructor(options){
        this.type=options.type||"traffic";
        this.x=options.x;
        this.y=options.y;
        this.width=options.width||36;
        this.height=options.height||60;
        this.angle=options.angle||0;
        this.speed=options.speed||0;
        this.maxSpeed=options.maxSpeed||520;
        this.boostMaxSpeed=options.boostMaxSpeed||700;
        this.acceleration=options.acceleration||340;
        this.drag=options.drag||180;
        this.brakePower=options.brakePower||400;
        this.minSpeed=options.minSpeed||220;
        this.steering=options.steering||2.4;
        this.color=options.color||"#57d8ff";
        this.trimColor=options.trimColor||"#ffffff";
        this.glowColor=options.glowColor||this.color;
        this.laneIndex=options.laneIndex??0;
        this.targetLane=this.laneIndex;
        this.laneChangeSpeed=options.laneChangeSpeed||150;
        this.canChangeLane=Boolean(options.canChangeLane);
        this.boosting=false;
        this.polygon=this.createPolygon();
    }

    updatePlayer(dt,controls,boosting){
        this.boosting=boosting;

        const throttle=controls.forward?1:0;
        const brake=controls.reverse?1:0;
        const turn=(controls.left?1:0)-(controls.right?1:0);
        const targetMaxSpeed=boosting?this.boostMaxSpeed:this.maxSpeed;
        const thrust=(0.55+throttle*0.55+(boosting?0.7:0))*this.acceleration;

        this.speed+=thrust*dt;
        this.speed-=this.drag*(1+Math.abs(turn)*0.16)*dt;
        if(brake){
            this.speed-=this.brakePower*dt;
        }
        this.speed=clamp(this.speed,this.minSpeed,targetMaxSpeed);

        const steerStrength=this.steering*dt*(0.32+this.speed/targetMaxSpeed);
        if(turn!==0){
            this.angle+=turn*steerStrength;
        }else{
            this.angle=lerp(this.angle,0,Math.min(dt*4,0.16));
        }

        this.x-=Math.sin(this.angle)*this.speed*dt;
        this.y-=Math.cos(this.angle)*this.speed*dt;
        this.polygon=this.createPolygon();
    }

    updateTraffic(dt,road,difficulty){
        this.y-=this.speed*dt;

        if(this.canChangeLane&&this.targetLane===this.laneIndex&&Math.random()<difficulty.laneChangeChance*dt){
            const options=[];
            if(this.laneIndex>0){
                options.push(this.laneIndex-1);
            }
            if(this.laneIndex<road.laneCount-1){
                options.push(this.laneIndex+1);
            }
            if(options.length){
                this.targetLane=options[Math.floor(Math.random()*options.length)];
            }
        }

        const desiredX=road.getLaneCenter(this.targetLane);
        const dx=desiredX-this.x;
        const previousX=this.x;
        if(Math.abs(dx)>1){
            const step=Math.sign(dx)*this.laneChangeSpeed*dt;
            this.x+=Math.abs(step)>Math.abs(dx)?dx:step;
        }else{
            this.x=desiredX;
            this.laneIndex=this.targetLane;
        }

        const sideways=this.x-previousX;
        const targetAngle=clamp(-sideways*0.018,-0.22,0.22);
        this.angle=lerp(this.angle,targetAngle,Math.min(dt*8,0.18));
        this.polygon=this.createPolygon();
    }

    createPolygon(){
        const points=[];
        const radius=Math.hypot(this.width,this.height)/2;
        const alpha=Math.atan2(this.width,this.height);
        points.push({
            x:this.x-Math.sin(this.angle-alpha)*radius,
            y:this.y-Math.cos(this.angle-alpha)*radius
        });
        points.push({
            x:this.x-Math.sin(this.angle+alpha)*radius,
            y:this.y-Math.cos(this.angle+alpha)*radius
        });
        points.push({
            x:this.x-Math.sin(Math.PI+this.angle-alpha)*radius,
            y:this.y-Math.cos(Math.PI+this.angle-alpha)*radius
        });
        points.push({
            x:this.x-Math.sin(Math.PI+this.angle+alpha)*radius,
            y:this.y-Math.cos(Math.PI+this.angle+alpha)*radius
        });
        return points;
    }

    draw(ctx){
        ctx.save();
        ctx.translate(this.x,this.y);
        ctx.rotate(-this.angle);

        if(this.type==="player"&&this.boosting){
            const flameGradient=ctx.createLinearGradient(0,this.height*0.25,0,this.height*0.75);
            flameGradient.addColorStop(0,"rgba(255,235,140,0.9)");
            flameGradient.addColorStop(1,"rgba(70,220,255,0)");
            ctx.fillStyle=flameGradient;
            ctx.beginPath();
            ctx.moveTo(-this.width*0.18,this.height*0.26);
            ctx.lineTo(0,this.height*0.82);
            ctx.lineTo(this.width*0.18,this.height*0.26);
            ctx.closePath();
            ctx.fill();
        }

        ctx.shadowBlur=this.type==="player"?22:12;
        ctx.shadowColor=this.glowColor;
        ctx.fillStyle=this.color;
        this.#roundedRect(ctx,-this.width/2,-this.height/2,this.width,this.height,12);
        ctx.fill();

        ctx.shadowBlur=0;
        ctx.fillStyle="rgba(255,255,255,0.1)";
        this.#roundedRect(ctx,-this.width*0.36,-this.height*0.2,this.width*0.72,this.height*0.44,8);
        ctx.fill();

        ctx.strokeStyle="rgba(255,255,255,0.28)";
        ctx.lineWidth=2;
        this.#roundedRect(ctx,-this.width/2,-this.height/2,this.width,this.height,12);
        ctx.stroke();

        ctx.fillStyle=this.trimColor;
        ctx.fillRect(-this.width*0.34,-this.height*0.36,this.width*0.68,4);
        ctx.fillRect(-this.width*0.18,-this.height*0.02,this.width*0.36,3);

        ctx.fillStyle="rgba(210,240,255,0.75)";
        this.#roundedRect(ctx,-this.width*0.24,-this.height*0.3,this.width*0.48,this.height*0.22,6);
        ctx.fill();

        ctx.fillStyle=this.type==="player"?"#ffe96b":"#ff6767";
        ctx.fillRect(-this.width*0.3,-this.height*0.44,this.width*0.14,6);
        ctx.fillRect(this.width*0.16,-this.height*0.44,this.width*0.14,6);

        ctx.fillStyle=this.type==="player"?"#73f1ff":"#ffd56a";
        ctx.fillRect(-this.width*0.3,this.height*0.34,this.width*0.14,6);
        ctx.fillRect(this.width*0.16,this.height*0.34,this.width*0.14,6);

        ctx.restore();
    }

    #roundedRect(ctx,x,y,width,height,radius){
        ctx.beginPath();
        ctx.moveTo(x+radius,y);
        ctx.arcTo(x+width,y,x+width,y+height,radius);
        ctx.arcTo(x+width,y+height,x,y+height,radius);
        ctx.arcTo(x,y+height,x,y,radius);
        ctx.arcTo(x,y,x+width,y,radius);
        ctx.closePath();
    }
}
