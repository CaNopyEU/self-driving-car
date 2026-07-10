/*
 * NeuralNetwork: repurposed from the original self-driving-car training rig.
 * Instead of evolving thousands of cars, we use ONE hand-tuned network to power
 * the "hunter" AI opponents that chase the player. Feed-forward with sigmoid.
 *
 * Inputs (7): [ray0..ray4 obstacle proximities 0..1, dxToPlayer -1..1, dyToPlayer -1..1]
 * Hidden (6): tanh
 * Outputs (4): [forward, left, right, reverse] as 0..1 activations (thresholded at 0.5)
 */
class NeuralNetwork{
    constructor(counts){
        this.levels=[];
        for(let i=0;i<counts.length-1;i++){
            this.levels.push(new Level(counts[i],counts[i+1]));
        }
    }

    static feedForward(inputs,network){
        let out=Level.feedForward(inputs,network.levels[0],Math.tanh);
        for(let i=1;i<network.levels.length;i++){
            out=Level.feedForward(out,network.levels[i],sigmoid);
        }
        return out;
    }

    // Hand-tuned brain for hunters. Deterministic, no training data required.
    // Logic encoded:
    //   - always accelerate forward
    //   - if player is to the RIGHT (dx>0), steer right
    //   - if player is to the LEFT (dx<0), steer left
    //   - if front/side sensors detect close obstacle, steer away from it
    //   - never reverse (would let player escape)
    static hunterBrain(){
        const nn=new NeuralNetwork([7,6,4]);
        const L0=nn.levels[0];
        const L1=nn.levels[1];
        // zero everything
        for(let i=0;i<L0.weights.length;i++)
            for(let j=0;j<L0.weights[i].length;j++) L0.weights[i][j]=0;
        for(let i=0;i<L0.biases.length;i++) L0.biases[i]=0;
        for(let i=0;i<L1.weights.length;i++)
            for(let j=0;j<L1.weights[i].length;j++) L1.weights[i][j]=0;
        for(let i=0;i<L1.biases.length;i++) L1.biases[i]=0;

        // Input indices: 0..4 = rays (left..right), 5 = dxToPlayer, 6 = dyToPlayer
        // Hidden neuron roles:
        //  H0: "obstacle on left" (rays 0,1)
        //  H1: "obstacle on right" (rays 3,4)
        //  H2: "obstacle straight ahead" (ray 2)
        //  H3: "player is to the left" (-dx)
        //  H4: "player is to the right" (+dx)
        //  H5: "go" bias (always on)
        L0.weights[0][0]=1.2; L0.weights[1][0]=0.8;                // H0
        L0.weights[3][1]=0.8; L0.weights[4][1]=1.2;                // H1
        L0.weights[2][2]=1.5;                                       // H2
        L0.weights[5][3]=-1.5;                                      // H3 fires when dx<0
        L0.weights[5][4]=1.5;                                       // H4 fires when dx>0
        L0.biases[0]=0.3; L0.biases[1]=0.3; L0.biases[2]=0.3;
        L0.biases[3]=0.0; L0.biases[4]=0.0;
        L0.biases[5]=-1.0; // constant "on"

        // Output indices: 0 forward, 1 left, 2 right, 3 reverse
        // forward: always on (from H5)
        L1.weights[5][0]=2.0;
        // steer LEFT when H1 (obstacle right) OR H3 (player left) OR H2 (obstacle ahead)
        L1.weights[1][1]=2.0; L1.weights[3][1]=1.5; L1.weights[2][1]=0.8;
        // steer RIGHT when H0 (obstacle left) OR H4 (player right) OR H2 (obstacle ahead, negative bias to not both)
        L1.weights[0][2]=2.0; L1.weights[4][2]=1.5;
        L1.biases[0]=0.3;  // needs push, but H5*2=2 will clear it
        L1.biases[1]=0.5;
        L1.biases[2]=0.5;
        L1.biases[3]=2.0;  // never reverse

        return nn;
    }
}

class Level{
    constructor(inputCount,outputCount){
        this.inputs=new Array(inputCount);
        this.outputs=new Array(outputCount);
        this.biases=new Array(outputCount);
        this.weights=[];
        for(let i=0;i<inputCount;i++) this.weights[i]=new Array(outputCount).fill(0);
        for(let i=0;i<outputCount;i++) this.biases[i]=0;
    }
    static feedForward(givenInputs,level,activation){
        for(let i=0;i<level.inputs.length;i++) level.inputs[i]=givenInputs[i]||0;
        for(let i=0;i<level.outputs.length;i++){
            let sum=0;
            for(let j=0;j<level.inputs.length;j++){
                sum+=level.inputs[j]*level.weights[j][i];
            }
            level.outputs[i]=activation(sum-level.biases[i]);
        }
        return level.outputs;
    }
}

function sigmoid(x){return 1/(1+Math.exp(-x));}
