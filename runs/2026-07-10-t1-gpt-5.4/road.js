class Road{
    constructor(x,width,laneCount=4){
        this.x=x;
        this.width=width;
        this.laneCount=laneCount;

        this.left=x-width/2;
        this.right=x+width/2;

        const infinity=1000000;
        this.top=-infinity;
        this.bottom=infinity;

        const topLeft={x:this.left,y:this.top};
        const topRight={x:this.right,y:this.top};
        const bottomLeft={x:this.left,y:this.bottom};
        const bottomRight={x:this.right,y:this.bottom};
        this.borders=[
            [topLeft,bottomLeft],
            [topRight,bottomRight]
        ];
    }

    setWidth(width){
        this.width=width;
        this.left=this.x-width/2;
        this.right=this.x+width/2;
        this.borders[0][0].x=this.left;
        this.borders[0][1].x=this.left;
        this.borders[1][0].x=this.right;
        this.borders[1][1].x=this.right;
    }

    getLaneCenter(laneIndex){
        const laneWidth=this.width/this.laneCount;
        return this.left+laneWidth/2+
            Math.min(laneIndex,this.laneCount-1)*laneWidth;
    }

    draw(ctx,cameraY,viewportHeight,wave){
        const top=cameraY-220;
        const bottom=cameraY+viewportHeight+220;
        const laneWidth=this.width/this.laneCount;

        ctx.fillStyle="#0f1220";
        ctx.fillRect(this.left-90,top,90,bottom-top);
        ctx.fillRect(this.right,top,90,bottom-top);

        ctx.fillStyle="#171c31";
        ctx.beginPath();
        ctx.moveTo(this.left,top);
        ctx.lineTo(this.right,top);
        ctx.lineTo(this.right,bottom);
        ctx.lineTo(this.left,bottom);
        ctx.closePath();
        ctx.fill();

        ctx.lineWidth=18;
        ctx.strokeStyle=`rgba(255,${Math.round(90+wave*8)},120,0.22)`;
        ctx.beginPath();
        ctx.moveTo(this.left,top);
        ctx.lineTo(this.left,bottom);
        ctx.moveTo(this.right,top);
        ctx.lineTo(this.right,bottom);
        ctx.stroke();

        ctx.lineWidth=5;
        ctx.strokeStyle="rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.moveTo(this.left,top);
        ctx.lineTo(this.left,bottom);
        ctx.moveTo(this.right,top);
        ctx.lineTo(this.right,bottom);
        ctx.stroke();

        ctx.setLineDash([30,26]);
        ctx.lineDashOffset=cameraY*0.8;
        ctx.lineWidth=4;
        ctx.strokeStyle="rgba(245,247,255,0.35)";
        for(let i=1;i<this.laneCount;i++){
            const x=this.left+laneWidth*i;
            ctx.beginPath();
            ctx.moveTo(x,top);
            ctx.lineTo(x,bottom);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        const rumbleStep=74;
        const rumbleHeight=38;
        const firstRumble=Math.floor(top/rumbleStep)*rumbleStep;
        for(let y=firstRumble;y<bottom;y+=rumbleStep){
            ctx.fillStyle=((Math.floor(y/rumbleStep)%2)===0)
                ?"rgba(255,116,116,0.75)"
                :"rgba(255,255,255,0.22)";
            ctx.fillRect(this.left-8,y,8,rumbleHeight);
            ctx.fillRect(this.right,y,8,rumbleHeight);
        }
    }
}
