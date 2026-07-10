// nn.js — Compact feed-forward neural network (repurposed from the original
// self-driving-car demo). Now it drives the AI "hunter" traffic cars: each
// hunter senses the player + neighbours and decides how to steer to block/chase.
// Sigmoid activations (instead of the original hard threshold) give smoother,
// more lifelike behaviour. Networks that survive longest get mutated into the
// next wave — lightweight evolution across waves.

export class NeuralNetwork {
  constructor(neuronCounts) {
    this.levels = [];
    for (let i = 0; i < neuronCounts.length - 1; i++) {
      this.levels.push(new Level(neuronCounts[i], neuronCounts[i + 1]));
    }
  }

  static feedForward(inputs, net) {
    let out = Level.feedForward(inputs, net.levels[0]);
    for (let i = 1; i < net.levels.length; i++) {
      out = Level.feedForward(out, net.levels[i]);
    }
    return out;
  }

  static mutate(net, amount = 1) {
    net.levels.forEach((lvl) => {
      for (let i = 0; i < lvl.biases.length; i++) {
        lvl.biases[i] = lerp(lvl.biases[i], Math.random() * 2 - 1, amount);
      }
      for (let i = 0; i < lvl.weights.length; i++) {
        for (let j = 0; j < lvl.weights[i].length; j++) {
          lvl.weights[i][j] = lerp(lvl.weights[i][j], Math.random() * 2 - 1, amount);
        }
      }
    });
  }

  static clone(net) {
    const c = new NeuralNetwork([1]); // placeholder, replaced below
    c.levels = net.levels.map((lvl) => {
      const nl = new Level(lvl.inputs.length, lvl.outputs.length);
      nl.biases = lvl.biases.slice();
      nl.weights = lvl.weights.map((row) => row.slice());
      return nl;
    });
    return c;
  }
}

class Level {
  constructor(inCount, outCount) {
    this.inputs = new Array(inCount);
    this.outputs = new Array(outCount);
    this.biases = new Array(outCount);
    this.weights = [];
    for (let i = 0; i < inCount; i++) this.weights[i] = new Array(outCount);
    Level.randomize(this);
  }

  static randomize(lvl) {
    for (let i = 0; i < lvl.inputs.length; i++)
      for (let j = 0; j < lvl.outputs.length; j++)
        lvl.weights[i][j] = Math.random() * 2 - 1;
    for (let i = 0; i < lvl.biases.length; i++)
      lvl.biases[i] = Math.random() * 2 - 1;
  }

  static feedForward(inputs, lvl) {
    for (let i = 0; i < lvl.inputs.length; i++) lvl.inputs[i] = inputs[i];
    for (let i = 0; i < lvl.outputs.length; i++) {
      let sum = 0;
      for (let j = 0; j < lvl.inputs.length; j++)
        sum += lvl.inputs[j] * lvl.weights[j][i];
      // Smooth sigmoid -> range (0,1); much better for steering than a step.
      lvl.outputs[i] = 1 / (1 + Math.exp(-(sum - lvl.biases[i])));
    }
    return lvl.outputs;
  }
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
