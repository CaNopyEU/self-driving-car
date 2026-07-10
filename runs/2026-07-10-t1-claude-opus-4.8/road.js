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

    getLaneCenter(laneIndex){
        const laneWidth=this.width/this.laneCount;
        return this.left+laneWidth/2+
            clamp(laneIndex,0,this.laneCount-1)*laneWidth;
    }

    draw(ctx){
        // asphalt
        ctx.fillStyle="#12121a";
        ctx.fillRect(this.left,this.top,this.width,this.bottom-this.top);

        // lane dashes (neon cyan)
        ctx.lineWidth=4;
        ctx.strokeStyle="rgba(0,229,255,0.35)";
        ctx.setLineDash([26,30]);
        for(let i=1;i<=this.laneCount-1;i++){
            const x=lerp(this.left,this.right,i/this.laneCount);
            ctx.beginPath();
            ctx.moveTo(x,this.top);
            ctx.lineTo(x,this.bottom);
            ctx.stroke();
        }

        // glowing borders
        ctx.setLineDash([]);
        ctx.lineWidth=6;
        ctx.shadowBlur=18;
        ctx.shadowColor="#ff2a6d";
        ctx.strokeStyle="#ff2a6d";
        this.borders.forEach(border=>{
            ctx.beginPath();
            ctx.moveTo(border[0].x,border[0].y);
            ctx.lineTo(border[1].x,border[1].y);
            ctx.stroke();
        });
        ctx.shadowBlur=0;
    }
}
