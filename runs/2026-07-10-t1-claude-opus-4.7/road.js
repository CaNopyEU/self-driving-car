class Road{
    constructor(x,width,laneCount=3){
        this.x=x; this.width=width; this.laneCount=laneCount;
        this.left=x-width/2;
        this.right=x+width/2;
        const infinity=1000000;
        this.top=-infinity;
        this.bottom=infinity;
        this.borders=[
            [{x:this.left,y:this.top},{x:this.left,y:this.bottom}],
            [{x:this.right,y:this.top},{x:this.right,y:this.bottom}]
        ];
    }
    getLaneCenter(i){
        const laneWidth=this.width/this.laneCount;
        return this.left+laneWidth/2+Math.min(i,this.laneCount-1)*laneWidth;
    }
    draw(ctx,cameraY,viewH){
        // grass shoulders
        ctx.fillStyle="#1a3a1a";
        ctx.fillRect(-2000,cameraY-viewH,2000+this.left,viewH*3);
        ctx.fillRect(this.right,cameraY-viewH,2000,viewH*3);
        // road
        ctx.fillStyle="#2a2a30";
        ctx.fillRect(this.left,cameraY-viewH,this.width,viewH*3);
        // lane dashes (scroll with camera)
        ctx.lineWidth=3;
        ctx.strokeStyle="#f0e050";
        for(let i=1;i<=this.laneCount-1;i++){
            const x=lerp(this.left,this.right,i/this.laneCount);
            ctx.setLineDash([28,22]);
            ctx.lineDashOffset=cameraY%50;
            ctx.beginPath();
            ctx.moveTo(x,cameraY-viewH);
            ctx.lineTo(x,cameraY+viewH*2);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        // solid outer lines
        ctx.strokeStyle="#fff";
        ctx.lineWidth=4;
        ctx.beginPath();
        ctx.moveTo(this.left,cameraY-viewH); ctx.lineTo(this.left,cameraY+viewH*2);
        ctx.moveTo(this.right,cameraY-viewH); ctx.lineTo(this.right,cameraY+viewH*2);
        ctx.stroke();
    }
}
