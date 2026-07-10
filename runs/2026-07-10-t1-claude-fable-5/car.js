class Car{
    constructor(x,y,width,height,controlType,maxSpeed=3,color="blue"){
        this.x=x;
        this.y=y;
        this.width=width;
        this.height=height;

        this.speed=0;
        this.acceleration=controlType=="KEYS"?0.25:0.2;
        this.maxSpeed=maxSpeed;
        this.friction=0.05;
        this.angle=0;
        this.damaged=false;
        this.color=color;
        this.controlType=controlType;

        this.useBrain=controlType=="SMART";

        if(this.useBrain){
            // Elite cars "see" with 5 rays and steer via the neural network.
            this.sensor=new Sensor(this,5,140,Math.PI*0.9);
            this.brain=Car.makeDodgerBrain();
        }
        this.controls=new Controls(controlType);

        this.img=new Image();
        this.img.src="car.png";

        this.mask=document.createElement("canvas");
        this.mask.width=width;
        this.mask.height=height;

        const maskCtx=this.mask.getContext("2d");
        this.img.onload=()=>{
            maskCtx.fillStyle=color;
            maskCtx.rect(0,0,this.width,this.height);
            maskCtx.fill();

            maskCtx.globalCompositeOperation="destination-atop";
            maskCtx.drawImage(this.img,0,0,this.width,this.height);
        };
    }

    // Hand-crafted network weights, then slightly mutated so every elite
    // car has its own "personality". Inputs are 1-offset per ray
    // (closer obstacle => higher value). Ray 0 is leftmost.
    // Outputs: [forward, left, right, reverse].
    static makeDodgerBrain(){
        const brain=new NeuralNetwork([5,4]);
        const lvl=brain.levels[0];
        const W=[ // weights[input][output]
            //  fwd  left right rev
            [   0,    0,  0.9,  0.1],  // leftmost ray blocked -> steer right
            [   0,    0,  0.6,  0.2],
            [   0,    0,    0,  0.9],  // straight ahead blocked -> brake
            [   0,  0.6,    0,  0.2],
            [   0,  0.9,    0,  0.1]   // rightmost ray blocked -> steer left
        ];
        for(let i=0;i<5;i++)
            for(let j=0;j<4;j++)
                lvl.weights[i][j]=W[i][j];
        lvl.biases=[-0.5,0.35,0.35,0.9]; // forward always on
        NeuralNetwork.mutate(brain,0.08);
        return brain;
    }

    update(roadBorders,traffic){
        if(this.damaged) return;

        this.#move();
        this.polygon=this.#createPolygon();
        this.damaged=this.#assessDamage(roadBorders,traffic);

        if(this.sensor){
            this.sensor.update(roadBorders,traffic);
            const offsets=this.sensor.readings.map(
                s=>s==null?0:1-s.offset
            );
            const outputs=NeuralNetwork.feedForward(offsets,this.brain);

            this.controls.forward=outputs[0];
            this.controls.left=outputs[1];
            this.controls.right=outputs[2];
            this.controls.reverse=outputs[3];
        }
    }

    #assessDamage(roadBorders,traffic){
        for(let i=0;i<roadBorders.length;i++){
            if(polysIntersect(this.polygon,roadBorders[i])){
                return true;
            }
        }
        for(let i=0;i<traffic.length;i++){
            if(traffic[i].damaged) continue;
            if(polysIntersect(this.polygon,traffic[i].polygon)){
                return true;
            }
        }
        return false;
    }

    #createPolygon(){
        const points=[];
        const rad=Math.hypot(this.width,this.height)/2;
        const alpha=Math.atan2(this.width,this.height);
        points.push({
            x:this.x-Math.sin(this.angle-alpha)*rad,
            y:this.y-Math.cos(this.angle-alpha)*rad
        });
        points.push({
            x:this.x-Math.sin(this.angle+alpha)*rad,
            y:this.y-Math.cos(this.angle+alpha)*rad
        });
        points.push({
            x:this.x-Math.sin(Math.PI+this.angle-alpha)*rad,
            y:this.y-Math.cos(Math.PI+this.angle-alpha)*rad
        });
        points.push({
            x:this.x-Math.sin(Math.PI+this.angle+alpha)*rad,
            y:this.y-Math.cos(Math.PI+this.angle+alpha)*rad
        });
        return points;
    }

    #move(){
        if(this.controls.forward){
            this.speed+=this.acceleration;
        }
        if(this.controls.reverse){
            this.speed-=this.acceleration;
        }

        if(this.speed>this.maxSpeed){
            this.speed=this.maxSpeed;
        }
        if(this.speed<-this.maxSpeed/2){
            this.speed=-this.maxSpeed/2;
        }

        if(this.speed>0){
            this.speed-=this.friction;
        }
        if(this.speed<0){
            this.speed+=this.friction;
        }
        if(Math.abs(this.speed)<this.friction){
            this.speed=0;
        }

        if(this.speed!=0){
            const flip=this.speed>0?1:-1;
            const steer=this.controlType=="KEYS"?0.035:0.025;
            if(this.controls.left){
                this.angle+=steer*flip;
            }
            if(this.controls.right){
                this.angle-=steer*flip;
            }
        }

        // keep player pointed roughly up the road
        if(this.controlType=="KEYS"){
            this.angle=Math.max(-1.1,Math.min(1.1,this.angle));
            if(!this.controls.left&&!this.controls.right){
                this.angle*=0.94; // auto-straighten
            }
        }

        this.x-=Math.sin(this.angle)*this.speed;
        this.y-=Math.cos(this.angle)*this.speed;
    }

    draw(ctx,drawSensor=false){
        if(this.sensor && drawSensor && !this.damaged){
            this.sensor.draw(ctx);
        }

        ctx.save();
        ctx.translate(this.x,this.y);
        ctx.rotate(-this.angle);
        if(!this.damaged){
            ctx.drawImage(this.mask,
                -this.width/2,
                -this.height/2,
                this.width,
                this.height);
            ctx.globalCompositeOperation="multiply";
        }else{
            ctx.globalAlpha=0.5;
        }
        ctx.drawImage(this.img,
            -this.width/2,
            -this.height/2,
            this.width,
            this.height);
        ctx.restore();
    }
}
