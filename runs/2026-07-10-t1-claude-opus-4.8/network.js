// Neural network — REPURPOSED.
// In the original project this powered generational self-driving training.
// Here it drives the AI RIVAL RACERS: cars that read sensor rays and decide
// how to weave through traffic. We evolve a competent "dodger" brain once at
// startup (headless, off-screen) so rivals feel intelligent, not scripted.

class NeuralNetwork{
    constructor(neuronCounts){
        this.levels=[];
        for(let i=0;i<neuronCounts.length-1;i++){
            this.levels.push(new Level(
                neuronCounts[i],neuronCounts[i+1]
            ));
        }
    }

    static feedForward(givenInputs,network){
        let outputs=Level.feedForward(
            givenInputs,network.levels[0]);
        for(let i=1;i<network.levels.length;i++){
            outputs=Level.feedForward(
                outputs,network.levels[i]);
        }
        return outputs;
    }

    static mutate(network,amount=1){
        network.levels.forEach(level => {
            for(let i=0;i<level.biases.length;i++){
                level.biases[i]=lerp(
                    level.biases[i],
                    Math.random()*2-1,
                    amount
                )
            }
            for(let i=0;i<level.weights.length;i++){
                for(let j=0;j<level.weights[i].length;j++){
                    level.weights[i][j]=lerp(
                        level.weights[i][j],
                        Math.random()*2-1,
                        amount
                    )
                }
            }
        });
    }

    static clone(network){
        return JSON.parse(JSON.stringify(network));
    }
}

class Level{
    constructor(inputCount,outputCount){
        this.inputs=new Array(inputCount);
        this.outputs=new Array(outputCount);
        this.biases=new Array(outputCount);

        this.weights=[];
        for(let i=0;i<inputCount;i++){
            this.weights[i]=new Array(outputCount);
        }

        Level.#randomize(this);
    }

    static #randomize(level){
        for(let i=0;i<level.inputs.length;i++){
            for(let j=0;j<level.outputs.length;j++){
                level.weights[i][j]=Math.random()*2-1;
            }
        }
        for(let i=0;i<level.biases.length;i++){
            level.biases[i]=Math.random()*2-1;
        }
    }

    static feedForward(givenInputs,level){
        for(let i=0;i<level.inputs.length;i++){
            level.inputs[i]=givenInputs[i];
        }
        for(let i=0;i<level.outputs.length;i++){
            let sum=0
            for(let j=0;j<level.inputs.length;j++){
                sum+=level.inputs[j]*level.weights[j][i];
            }
            level.outputs[i]=sum>level.biases[i]?1:0;
        }
        return level.outputs;
    }
}

// -------- Headless evolution of a rival "dodger" brain --------
// Runs a tiny physics sim (no rendering) to select a brain that stays alive
// and weaves through traffic. Cheap: a few generations, small populations.
const RivalAI={
    RAY_COUNT:5,
    HIDDEN:8,
    brain:null,

    evolve(){
        const POP=60, GENS=8, STEPS=600;
        let population=[];
        for(let i=0;i<POP;i++){
            population.push(new NeuralNetwork([this.RAY_COUNT,this.HIDDEN,4]));
        }
        let best=population[0], bestFit=-Infinity;

        for(let g=0;g<GENS;g++){
            let genBest=null, genBestFit=-Infinity;
            for(const brain of population){
                const fit=this._evalBrain(brain,STEPS);
                if(fit>genBestFit){ genBestFit=fit; genBest=brain; }
            }
            if(genBestFit>bestFit){ bestFit=genBestFit; best=genBest; }
            // next generation: mutated copies of gen best
            const next=[NeuralNetwork.clone(best)];
            for(let i=1;i<POP;i++){
                const c=NeuralNetwork.clone(best);
                NeuralNetwork.mutate(c,0.15+Math.random()*0.35);
                next.push(c);
            }
            population=next;
        }
        this.brain=best;
        return best;
    },

    // Minimal headless dodging sim on a 3-lane strip.
    _evalBrain(brain,steps){
        const laneW=60, lanes=3, roadW=laneW*lanes;
        let x=laneW*1.5, y=0, angle=0, speed=3;
        const rayLen=140, spread=Math.PI/2, rc=this.RAY_COUNT;
        // obstacles: {x, y}
        let obs=[];
        for(let i=0;i<6;i++) obs.push({x:laneW*(0.5+Math.floor(Math.random()*lanes)), y:-150-i*180});
        let fit=0;
        for(let s=0;s<steps;s++){
            // sensors: distance to nearest obstacle / wall along each ray
            const inputs=[];
            for(let r=0;r<rc;r++){
                const a=lerp(spread/2,-spread/2,rc==1?0.5:r/(rc-1))+angle;
                const ex=x-Math.sin(a)*rayLen, ey=y-Math.cos(a)*rayLen;
                let closest=1;
                // walls
                for(const wx of [0,roadW]){
                    const t=getIntersection({x,y},{x:ex,y:ey},{x:wx,y:-1e6},{x:wx,y:1e6});
                    if(t) closest=Math.min(closest,t.offset);
                }
                for(const o of obs){
                    const half=25;
                    const box=[{x:o.x-15,y:o.y-half},{x:o.x+15,y:o.y-half},{x:o.x+15,y:o.y+half},{x:o.x-15,y:o.y+half}];
                    for(let j=0;j<4;j++){
                        const t=getIntersection({x,y},{x:ex,y:ey},box[j],box[(j+1)%4]);
                        if(t) closest=Math.min(closest,t.offset);
                    }
                }
                inputs.push(1-closest);
            }
            const out=NeuralNetwork.feedForward(inputs,brain);
            // out: forward,left,right,reverse
            if(out[1]) angle+=0.04;
            if(out[2]) angle-=0.04;
            angle=clamp(angle,-0.5,0.5);
            speed=out[0]?3.2:(out[3]?1.5:2.6);
            x-=Math.sin(angle)*speed;
            y-=Math.cos(angle)*speed;
            // move obstacles down relative (they are slower, so approach)
            for(const o of obs) o.y+=speed-2;
            // recycle obstacles that passed
            for(const o of obs){
                if(o.y>y+120){
                    o.y=y-200-Math.random()*200;
                    o.x=laneW*(0.5+Math.floor(Math.random()*lanes));
                }
            }
            // crash check
            if(x<12||x>roadW-12){ fit-=200; break; }
            let crash=false;
            for(const o of obs){
                if(Math.abs(o.x-x)<28 && Math.abs(o.y-y)<45){ crash=true; break; }
            }
            if(crash){ fit-=200; break; }
            fit+=1; // survival
        }
        return fit;
    }
};
