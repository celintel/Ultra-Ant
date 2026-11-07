// /src/lib/turing.ts
export const TAPE_SIZE = 4_000_000;
export const TAPE_DIM = 2000;

export type Config = {
  states: number;
  symbols: number;
  densityBias: number;
  locality: number;
  directionalLocality: boolean;
  symbolLocality: boolean;
  localMutation: boolean;
  sensorRadius: number;
  topology: '1D space-time' | '1D mirrored boundary' | '1D fractal jump' | '1D relativistic jump' | '2D surface' | '2D hex grid' | '2D radial' | '2D spiral' | '2D quantum walk' | '3D ortho projection' | '3D isometric projection' | '2D triangular grid' | '2D moore (8-way)' | '3D perspective projection' | '3D spherical projection' | '2D random walk' | '3D random walk' | '2D mobius strip' | '2D klein bottle' | '3D lorenz attractor' | '4D tesseract projection' | '2D alien wormhole' | '1D cellular automaton' | '2D hyperbolic grid' | '2D penrose tiling' | '3D torus' | '4D hypersphere' | '5D hypercube shadow' | 'neural synapse network' | 'fractal mandelbrot seed' | 'schrodinger wave' | 'hyper-dimensional string' | 'quantum entanglement network' | 'fluid dynamics matrix' | 'event horizon' | 'tachyon field';
  colorMap: 'symbol' | 'state' | 'visits';
  palette: 'Standard' | 'Cyberpunk' | 'Inferno' | 'Monochrome' | 'Neon' | 'Matrix' | 'Psycho' | 'Alien Flesh';
  writeMode: 'overwrite' | 'add' | 'xor' | 'multiply' | 'subtract' | 'bitwise AND' | 'bitwise OR' | 'max' | 'min' | 'modulo' | 'bitwise NAND' | 'bitwise NOR' | 'bitwise XNOR' | 'average' | 'difference' | 'power' | 'collatz step' | 'rule 30' | 'quantum cascade' | 'alien entropy' | 'prime sift' | 'fibonacci scatter' | 'schrodinger superposition' | 'mandelbrot seed' | 'langton ant hybrid' | 'gravitational pull' | 'magnetic repulsion' | 'plasma burst' | 'fractal resonance' | 'ackermann stack' | 'sinusoidal wave' | 'cosmic singularity' | 'hyperdimensional shift' | 'quantum tunneling' | 'tachyon feedback' | 'dark matter collision' | 'chrono reverse' | 'neural backprop' | 'biological mutation' | 'game of life' | 'entropy decay' | 'matter inertia';
  mutationRate: number;
  hasHaltingState: boolean;
};

export function packRule(nextState: number, writeSymbol: number, dir1D: number, dir2D: number, dir3D: number): number {
  const dirs = ((dir1D === 1 ? 1 : 0)) | ((dir2D & 0x7) << 1) | ((dir3D & 0x7) << 4);
  return (nextState & 0xFFFF) + (writeSymbol * 65536) + (dirs * 1099511627776);
}

export function generateRules(config: Config): Float64Array {
  // Cap max rules memory to 5 million entries (~40MB) to support huge state limits
  const totalSlots = Math.min(config.states * config.symbols, 5000000);
  const rules = new Float64Array(totalSlots);
  let idx = 0;
  for (let i = 0; i < totalSlots; i++) {
      const isVoid = Math.random() < config.densityBias;
      let writeSym = 0;
      if (!isVoid && config.symbols > 1) {
        if (config.symbolLocality) {
          const currentSym = (i % config.symbols);
          const maxSymJump = Math.max(1, Math.floor(config.symbols * (1 - config.locality)));
          const symJump = Math.floor(Math.random() * (maxSymJump * 2 + 1)) - maxSymJump;
          writeSym = ((currentSym + symJump) % config.symbols + config.symbols) % config.symbols;
          if (writeSym === 0) writeSym = 1;
        } else {
          writeSym = Math.floor(Math.random() * (config.symbols - 1)) + 1;
        }
      }
      
      let nextState = 0;
      const currentState = (i % config.states);
      const maxJump = Math.max(1, Math.floor(config.states * (1 - config.locality)));
      const jump = Math.floor(Math.random() * (maxJump * 2 + 1)) - maxJump;
      nextState = ((currentState + jump) % config.states + config.states) % config.states;

      const dir1D = Math.random() > 0.5 ? 1 : -1;
      let dir2D = Math.floor(Math.random() * 6);
      let dir3D = Math.floor(Math.random() * 6);

      if (config.directionalLocality) {
          const currentDir2D = currentState % 6;
          const maxDirJump2D = Math.floor(6 * (1 - config.locality));
          const dirJump2D = Math.floor(Math.random() * (maxDirJump2D * 2 + 1)) - maxDirJump2D;
          dir2D = ((currentDir2D + dirJump2D) % 6 + 6) % 6;

          const currentDir3D = currentState % 6;
          const maxDirJump3D = Math.floor(6 * (1 - config.locality));
          const dirJump3D = Math.floor(Math.random() * (maxDirJump3D * 2 + 1)) - maxDirJump3D;
          dir3D = ((currentDir3D + dirJump3D) % 6 + 6) % 6;
      }

      rules[i] = packRule(nextState, writeSym, dir1D, dir2D, dir3D);
  }

  return rules;
}

export class TuringSimulator {
  public tape: Uint32Array;
  public stateTape: Uint32Array;
  public visitTape: Uint8Array;
  public head: number;
  public state: number;
  public stepCount: number;
  public headDir: number;
  public virtualX: number;
  public virtualY: number;
  public virtualZ: number;
  public virtualW: number;

  constructor(public config: Config, public rules: Float64Array, public initialHead: number = TAPE_SIZE / 2) {
    this.tape = new Uint32Array(TAPE_SIZE);
    this.stateTape = new Uint32Array(TAPE_SIZE);
    this.visitTape = new Uint8Array(TAPE_SIZE);
    this.stateTape.fill(4294967295);

    this.virtualX = TAPE_DIM / 2;
    this.virtualY = TAPE_DIM / 2;
    this.virtualZ = TAPE_DIM / 2;
    this.virtualW = TAPE_DIM / 2;

    if (config.topology.includes('2D') || config.topology.includes('3D') || config.topology.includes('4D')) {
      this.head = (TAPE_DIM / 2) * TAPE_DIM + (TAPE_DIM / 2);
    } else {
      this.head = initialHead;
    }
    
    this.headDir = 0;
    this.state = 0;
    this.stepCount = 0;
    this.tape[this.head] = 1;
    this.stateTape[this.head] = 0;
  }

  public reset() {
    this.tape.fill(0);
    this.stateTape.fill(4294967295);
    this.visitTape.fill(0);

    this.virtualX = TAPE_DIM / 2;
    this.virtualY = TAPE_DIM / 2;
    this.virtualZ = TAPE_DIM / 2;
    this.virtualW = TAPE_DIM / 2;

    if (this.config.topology.includes('2D') || this.config.topology.includes('3D') || this.config.topology.includes('4D')) {
      this.head = (TAPE_DIM / 2) * TAPE_DIM + (TAPE_DIM / 2);
    } else {
      this.head = Math.floor(TAPE_SIZE / 2);
    }

    this.headDir = 0;
    this.state = 0;
    this.stepCount = 0;
    this.tape[this.head] = 1;
    this.stateTape[this.head] = 0;
  }

  public play1D(steps: number) {
    let { tape, stateTape, visitTape, head, state, rules, config } = this;
    const isMirrored = config.topology === '1D mirrored boundary';
    const isFractal = config.topology === '1D fractal jump';
    const isRelativistic = config.topology === '1D relativistic jump';
    const symCount = config.symbols;
    const statesCount = config.states;
    const mutRate = config.mutationRate;
    const r = config.sensorRadius;
    const hasSensor = r > 0;

    let executedSteps = 0;
    const haltState = config.hasHaltingState ? config.states - 1 : -1;
    for (let i = 0; i < steps; i++) {
        if (state === haltState) break;
        executedSteps++;

        const sym = tape[head];
        let perceivedSym = sym;
        
        if (hasSensor) {
            let sum = 0;
            for (let j = -r; j <= r; j++) {
                let idx = head + j;
                if (idx < 0) idx += TAPE_SIZE;
                else if (idx >= TAPE_SIZE) idx -= TAPE_SIZE;
                sum += tape[idx];
            }
            perceivedSym = sum % symCount;
        }

        let ruleIndex = (state * symCount + perceivedSym) % rules.length;
        let packed = rules[ruleIndex];
        if (packed === undefined) packed = rules[(state * symCount) % rules.length];
        if (packed === undefined) { tape[head] = 0; state = 0; continue; }
        
        if (visitTape[head] < 255) visitTape[head]++;

        let ruleNextState = packed % 65536;
        let ruleWriteSymbol = Math.floor(packed / 65536) % 16777216;
        let dirs = Math.floor(packed / 1099511627776);
        let ruleDir1D = (dirs & 0x1) === 1 ? 1 : -1;

        let nextSym = ruleWriteSymbol;
        const mode = config.writeMode;
        if (mode === 'add') nextSym = (sym + nextSym) % symCount;
        else if (mode === 'xor') nextSym = (sym ^ nextSym) % symCount;
        else if (mode === 'multiply') nextSym = (sym * nextSym) % symCount;
        else if (mode === 'subtract') nextSym = (sym - nextSym + symCount * 10) % symCount;
        else if (mode === 'bitwise AND') nextSym = (sym & nextSym) % symCount;
        else if (mode === 'bitwise OR') nextSym = (sym | nextSym) % symCount;
        else if (mode === 'max') nextSym = Math.max(sym, nextSym) % symCount;
        else if (mode === 'min') nextSym = Math.min(sym, nextSym) % symCount;
        else if (mode === 'modulo') nextSym = nextSym === 0 ? sym : (sym % nextSym) % symCount;
        else if (mode === 'bitwise NAND') nextSym = (~(sym & nextSym) + symCount * 10) % symCount;
        else if (mode === 'bitwise NOR') nextSym = (~(sym | nextSym) + symCount * 10) % symCount;
        else if (mode === 'bitwise XNOR') nextSym = (~(sym ^ nextSym) + symCount * 10) % symCount;
        else if (mode === 'average') nextSym = Math.floor((sym + nextSym) / 2) % symCount;
        else if (mode === 'difference') nextSym = Math.abs(sym - nextSym) % symCount;
        else if (mode === 'power') nextSym = Math.floor(Math.pow(sym, (nextSym % 3) + 1)) % symCount;
        else if (mode === 'collatz step') nextSym = (sym % 2 === 0 ? Math.floor(sym / 2) : 3 * sym + 1) % symCount;
        else if (mode === 'rule 30') nextSym = (sym ^ (sym | nextSym)) % symCount;
        else if (mode === 'quantum cascade') nextSym = (sym + nextSym * Math.floor(Math.random() * 3)) % symCount;
        else if (mode === 'alien entropy') nextSym = (sym ^ (nextSym << (sym % 3)) ^ state) % symCount;
        else if (mode === 'prime sift') nextSym = ((sym * sym) + nextSym) % (symCount > 1 ? symCount : 2);
        else if (mode === 'fibonacci scatter') nextSym = (sym + nextSym + tape[(head > 0 ? head - 1 : TAPE_SIZE - 1)]) % symCount;
        else if (mode === 'schrodinger superposition') nextSym = Math.random() < 0.5 ? sym : nextSym;
        else if (mode === 'mandelbrot seed') nextSym = (sym * sym + nextSym) % symCount;
        else if (mode === 'langton ant hybrid') nextSym = (sym === 0 ? nextSym : 0) % symCount;
        else if (mode === 'gravitational pull') nextSym = Math.floor((sym + nextSym + state) / 3) % symCount;
        else if (mode === 'magnetic repulsion') nextSym = Math.abs(sym - nextSym + state) % symCount;
        else if (mode === 'plasma burst') nextSym = (sym ^ nextSym ^ (state << 1)) % symCount;
        else if (mode === 'fractal resonance') nextSym = (sym * Math.max(1, nextSym % 3)) % symCount;
        else if (mode === 'ackermann stack') nextSym = (sym + nextSym + tape[(head < TAPE_SIZE - 1 ? head + 1 : 0)]) % symCount;
        else if (mode === 'sinusoidal wave') nextSym = Math.floor(Math.sin((sym + nextSym) * Math.PI) * symCount + symCount) % symCount;
        else if (mode === 'cosmic singularity') nextSym = (sym === nextSym ? 0 : sym + nextSym) % symCount;
        else if (mode === 'hyperdimensional shift') nextSym = (sym ^ (nextSym << 2) ^ (state >> 1)) % symCount;
        else if (mode === 'quantum tunneling') nextSym = Math.random() < 0.1 ? Math.floor(Math.random() * symCount) : (sym + nextSym) % symCount;
        else if (mode === 'tachyon feedback') nextSym = (sym * nextSym - state + symCount * 10) % symCount;
        else if (mode === 'dark matter collision') nextSym = (~sym ^ nextSym + symCount * 10) % symCount;
        else if (mode === 'chrono reverse') nextSym = (symCount - sym + nextSym) % symCount;
        else if (mode === 'neural backprop') nextSym = Math.max(0, Math.min(symCount - 1, sym + Math.floor((nextSym - sym) * 0.5)));
        else if (mode === 'biological mutation') nextSym = (sym + (Math.random() < 0.2 ? nextSym : 0)) % symCount;
        else if (mode === 'game of life') nextSym = (visitTape[head] % 2 === 0 ? sym : nextSym) % symCount;
        else if (mode === 'entropy decay') nextSym = Math.max(0, sym - 1) % symCount;
        else if (mode === 'matter inertia') nextSym = Math.random() < 1.0 / (1 + visitTape[head]) ? nextSym : sym;
        
        tape[head] = nextSym;
        stateTape[head] = state;
        
        if (mutRate > 0 && Math.random() < mutRate) {
            if (config.localMutation) {
                const maxJump = Math.max(1, Math.floor(statesCount * (1 - config.locality)));
                const jump = Math.floor(Math.random() * (maxJump * 2 + 1)) - maxJump;
                state = ((state + jump) % statesCount + statesCount) % statesCount;
            } else {
                state = Math.floor(Math.random() * statesCount);
            }
        } else {
            state = ruleNextState;
        }

        if (isFractal) {
            head += ruleDir1D * Math.max(1, sym);
        } else if (isRelativistic) {
            head += ruleDir1D * Math.max(1, Math.floor(state / (statesCount * 0.1 + 1))); 
        } else {
            head += ruleDir1D; 
        }
        
        if (head < 0) {
            if (isMirrored) head = -head;
            else head = TAPE_SIZE - 1 - ((-head - 1) % TAPE_SIZE); 
        } else if (head >= TAPE_SIZE) {
            if (isMirrored) head = TAPE_SIZE - 2 - ((head - TAPE_SIZE) % TAPE_SIZE);
            else head = head % TAPE_SIZE;
        }
    }
    
    this.head = head;
    this.state = state;
    this.stepCount += executedSteps;
  }

  public play2D(steps: number) {
    let { tape, stateTape, visitTape, head, state, rules, headDir, config } = this;
    const DIM = TAPE_DIM;
    const topo = config.topology;
    const isHex = topo === '2D hex grid';
    const isRadial = topo === '2D radial';
    const isSpiral = topo === '2D spiral';
    const isQuantum = topo === '2D quantum walk';
    const isTriangular = topo === '2D triangular grid';
    const isMoore = topo === '2D moore (8-way)';
    const isRandomWalk = topo === '2D random walk';
    const is3DOrtho = topo === '3D ortho projection';
    const is3DIso = topo === '3D isometric projection';
    const is3DPersp = topo === '3D perspective projection';
    const is3DSpherical = topo === '3D spherical projection';
    const is3DRandomWalk = topo === '3D random walk';
    const isMobius = topo === '2D mobius strip';
    const isKlein = topo === '2D klein bottle';
    const isLorenz = topo === '3D lorenz attractor';
    const isTess = topo === '4D tesseract projection';
    const isWormhole = topo === '2D alien wormhole';

    const symCount = config.symbols;
    const statesCount = config.states;
    const mutRate = config.mutationRate;
    
    let vx = this.virtualX;
    let vy = this.virtualY;
    let vz = this.virtualZ;
    let vw = this.virtualW;
    const r = config.sensorRadius;
    const hasSensor = r > 0;

    let executedSteps = 0;
    const haltState = config.hasHaltingState ? config.states - 1 : -1;
    for (let i = 0; i < steps; i++) {
        if (state === haltState) break;
        executedSteps++;

        const sym = tape[head];
        let perceivedSym = sym;
        
        if (hasSensor) {
            let sum = 0;
            for (let j = -r; j <= r; j++) {
                let idx = head + j;
                if (idx < 0) idx += TAPE_SIZE;
                else if (idx >= TAPE_SIZE) idx -= TAPE_SIZE;
                sum += tape[idx];
            }
            perceivedSym = sum % symCount;
        }

        let ruleIndex = (state * symCount + perceivedSym) % rules.length;
        let packed = rules[ruleIndex];
        if (packed === undefined) packed = rules[(state * symCount) % rules.length];
        if (packed === undefined) { tape[head] = 0; state = 0; continue; }

        let ruleNextState = packed % 65536;
        let ruleWriteSymbol = Math.floor(packed / 65536) % 16777216;
        let dirs = Math.floor(packed / 1099511627776);
        let ruleDir2D = (dirs >> 1) & 0x7;
        let ruleDir3D = (dirs >> 4) & 0x7;

        if (visitTape[head] < 255) visitTape[head]++;

        let nextSym = ruleWriteSymbol;
        const mode = config.writeMode;
        if (mode === 'add') nextSym = (sym + nextSym) % symCount;
        else if (mode === 'xor') nextSym = (sym ^ nextSym) % symCount;
        else if (mode === 'multiply') nextSym = (sym * nextSym) % symCount;
        else if (mode === 'subtract') nextSym = (sym - nextSym + symCount * 10) % symCount;
        else if (mode === 'bitwise AND') nextSym = (sym & nextSym) % symCount;
        else if (mode === 'bitwise OR') nextSym = (sym | nextSym) % symCount;
        else if (mode === 'max') nextSym = Math.max(sym, nextSym) % symCount;
        else if (mode === 'min') nextSym = Math.min(sym, nextSym) % symCount;
        else if (mode === 'modulo') nextSym = nextSym === 0 ? sym : (sym % nextSym) % symCount;
        else if (mode === 'bitwise NAND') nextSym = (~(sym & nextSym) + symCount * 10) % symCount;
        else if (mode === 'bitwise NOR') nextSym = (~(sym | nextSym) + symCount * 10) % symCount;
        else if (mode === 'bitwise XNOR') nextSym = (~(sym ^ nextSym) + symCount * 10) % symCount;
        else if (mode === 'average') nextSym = Math.floor((sym + nextSym) / 2) % symCount;
        else if (mode === 'difference') nextSym = Math.abs(sym - nextSym) % symCount;
        else if (mode === 'power') nextSym = Math.floor(Math.pow(sym, (nextSym % 3) + 1)) % symCount;
        else if (mode === 'collatz step') nextSym = (sym % 2 === 0 ? Math.floor(sym / 2) : 3 * sym + 1) % symCount;
        else if (mode === 'rule 30') nextSym = (sym ^ (sym | nextSym)) % symCount;
        else if (mode === 'quantum cascade') nextSym = (sym + nextSym * Math.floor(Math.random() * 3)) % symCount;
        else if (mode === 'alien entropy') nextSym = (sym ^ (nextSym << (sym % 3)) ^ state) % symCount;
        else if (mode === 'prime sift') nextSym = ((sym * sym) + nextSym) % (symCount > 1 ? symCount : 2);
        else if (mode === 'fibonacci scatter') nextSym = (sym + nextSym + tape[(head > 0 ? head - 1 : TAPE_SIZE - 1)]) % symCount;
        else if (mode === 'schrodinger superposition') nextSym = Math.random() < 0.5 ? sym : nextSym;
        else if (mode === 'mandelbrot seed') nextSym = (sym * sym + nextSym) % symCount;
        else if (mode === 'langton ant hybrid') nextSym = (sym === 0 ? nextSym : 0) % symCount;
        else if (mode === 'gravitational pull') nextSym = Math.floor((sym + nextSym + state) / 3) % symCount;
        else if (mode === 'magnetic repulsion') nextSym = Math.abs(sym - nextSym + state) % symCount;
        else if (mode === 'plasma burst') nextSym = (sym ^ nextSym ^ (state << 1)) % symCount;
        else if (mode === 'fractal resonance') nextSym = (sym * Math.max(1, nextSym % 3)) % symCount;
        else if (mode === 'ackermann stack') nextSym = (sym + nextSym + tape[(head < TAPE_SIZE - 1 ? head + 1 : 0)]) % symCount;
        else if (mode === 'sinusoidal wave') nextSym = Math.floor(Math.sin((sym + nextSym) * Math.PI) * symCount + symCount) % symCount;
        else if (mode === 'cosmic singularity') nextSym = (sym === nextSym ? 0 : sym + nextSym) % symCount;
        else if (mode === 'hyperdimensional shift') nextSym = (sym ^ (nextSym << 2) ^ (state >> 1)) % symCount;
        else if (mode === 'quantum tunneling') nextSym = Math.random() < 0.1 ? Math.floor(Math.random() * symCount) : (sym + nextSym) % symCount;
        else if (mode === 'tachyon feedback') nextSym = (sym * nextSym - state + symCount * 10) % symCount;
        else if (mode === 'dark matter collision') nextSym = (~sym ^ nextSym + symCount * 10) % symCount;
        else if (mode === 'chrono reverse') nextSym = (symCount - sym + nextSym) % symCount;
        else if (mode === 'neural backprop') nextSym = Math.max(0, Math.min(symCount - 1, sym + Math.floor((nextSym - sym) * 0.5)));
        else if (mode === 'biological mutation') nextSym = (sym + (Math.random() < 0.2 ? nextSym : 0)) % symCount;
        else if (mode === 'game of life') nextSym = (visitTape[head] % 2 === 0 ? sym : nextSym) % symCount;
        else if (mode === 'entropy decay') nextSym = Math.max(0, sym - 1) % symCount;
        else if (mode === 'matter inertia') nextSym = Math.random() < 1.0 / (1 + visitTape[head]) ? nextSym : sym;

        tape[head] = nextSym;
        stateTape[head] = state;

        if (mutRate > 0 && Math.random() < mutRate) {
            if (config.localMutation) {
                const maxJump = Math.max(1, Math.floor(statesCount * (1 - config.locality)));
                const jump = Math.floor(Math.random() * (maxJump * 2 + 1)) - maxJump;
                state = ((state + jump) % statesCount + statesCount) % statesCount;
            } else {
                state = Math.floor(Math.random() * statesCount);
            }
        } else {
            state = ruleNextState;
        }

        let hx = 0;
        let hy = 0;

        if (isHex) {
           headDir = (headDir + ruleDir2D) % 6;
           if (headDir === 0) { vx++; }
           else if (headDir === 1) { vx++; vy--; }
           else if (headDir === 2) { vy--; }
           else if (headDir === 3) { vx--; }
           else if (headDir === 4) { vx--; vy++; }
           else if (headDir === 5) { vy++; }
           hx = vx; hy = vy;
        } else if (isRadial) {
            headDir = (headDir + ruleDir2D) % 8;
            const dist = (ruleDir3D % 3) + 1;
            const angle = headDir * (Math.PI / 4);
            vx += Math.cos(angle) * dist;
            vy += Math.sin(angle) * dist;
            hx = Math.round(vx); hy = Math.round(vy);
        } else if (isSpiral) {
            headDir += (ruleDir2D % 2 === 0 ? 0.1 : -0.1);
            vz += (ruleDir3D % 2 === 0 ? 0.5 : -0.5);
            vx += Math.cos(headDir) * Math.max(1, Math.abs(((packed >> 24) & 0x1) ? 1 : -1));
            vy += Math.sin(headDir) * Math.max(1, Math.abs(((packed >> 24) & 0x1) ? 1 : -1));
            hx = Math.round(vx); hy = Math.round(vy);
        } else if (isQuantum) {
            if (state % 2 === 0) {
               vx += (((packed >> 24) & 0x1) ? 1 : -1) * (sym + 1);
               vy += (ruleDir2D % 5) - 2;
            } else {
               vx += (ruleDir2D % 5) - 2;
               vy -= (((packed >> 24) & 0x1) ? 1 : -1) * (sym + 1);
            }
            hx = Math.round(vx); hy = Math.round(vy);
        } else if (isTriangular) {
            headDir = (headDir + ruleDir2D) % 3;
            if (headDir === 0) { vx++; vy++; }
            else if (headDir === 1) { vx--; vy++; }
            else { vy--; }
            hx = vx; hy = vy;
        } else if (isMoore) {
            headDir = (headDir + ruleDir2D) % 8;
            const hdx = [0, 1, 1, 1, 0, -1, -1, -1];
            const hdy = [-1, -1, 0, 1, 1, 1, 0, -1];
            vx += hdx[headDir]; vy += hdy[headDir];
            hx = vx; hy = vy;
        } else if (isRandomWalk) {
            const angle = Math.random() * Math.PI * 2;
            vx += Math.cos(angle) * ((((packed >> 24) & 0x1) ? 1 : -1) ? 1 : 2);
            vy += Math.sin(angle) * (ruleDir2D % 3);
            hx = Math.round(vx); hy = Math.round(vy);
        } else if (is3DOrtho) {
            const m = ruleDir3D;
            if (m === 0) vx++; else if (m === 1) vx--;
            else if (m === 2) vy++; else if (m === 3) vy--;
            else if (m === 4) vz++; else if (m === 5) vz--;
            hx = Math.round(vx + (vz - DIM/2) * 0.5);
            hy = Math.round(vy + (vz - DIM/2) * 0.5);
        } else if (is3DIso) {
            const m = ruleDir3D;
            if (m === 0) vx++; else if (m === 1) vx--;
            else if (m === 2) vy++; else if (m === 3) vy--;
            else if (m === 4) vz++; else if (m === 5) vz--;
            const cx = vx - DIM/2;
            const cy = vy - DIM/2;
            const cz = vz - DIM/2;
            hx = DIM/2 + Math.round(cx - cz);
            hy = DIM/2 + Math.round((cx + cz) / 2 - cy);
        } else if (is3DPersp) {
            const m = ruleDir3D;
            if (m === 0) vx++; else if (m === 1) vx--;
            else if (m === 2) vy++; else if (m === 3) vy--;
            else if (m === 4) vz++; else if (m === 5) vz--;
            const cx = vx - DIM/2;
            const cy = vy - DIM/2;
            const cz = vz - DIM/2;
            const zFactor = 500 / Math.max(1, 500 + cz);
            hx = DIM/2 + Math.round(cx * zFactor);
            hy = DIM/2 + Math.round(cy * zFactor);
        } else if (is3DSpherical) {
            const m = ruleDir3D;
            if (m === 0) vx++; else if (m === 1) vx--;
            else if (m === 2) vy++; else if (m === 3) vy--;
            else if (m === 4) vz++; else if (m === 5) vz--;
            const cx = vx - DIM/2;
            const cy = vy - DIM/2;
            const cz = vz - DIM/2;
            const r = Math.sqrt(cx*cx + cy*cy + cz*cz);
            const theta = Math.atan2(cy, cx);
            let phi = 0;
            if (r > 0) phi = Math.acos(cz / r);
            hx = DIM/2 + Math.round(r * Math.sin(phi) * Math.cos(theta + cz * 0.05));
            hy = DIM/2 + Math.round(r * Math.sin(phi) * Math.sin(theta + cz * 0.05));
        } else if (is3DRandomWalk) {
            vx += (Math.random() - 0.5) * 3;
            vy += (Math.random() - 0.5) * 3;
            vz += (Math.random() - 0.5) * 3;
            hx = Math.round(vx + (vz - DIM/2) * 0.5);
            hy = Math.round(vy + (vz - DIM/2) * 0.5);
        } else if (isMobius) {
            headDir = (headDir + ruleDir2D) & 3;
            if (headDir === 0) vy--; else if (headDir === 1) vx++; else if (headDir === 2) vy++; else vx--;
            if (vy < 0) { vy += DIM; vx = DIM - 1 - vx; }
            else if (vy >= DIM) { vy -= DIM; vx = DIM - 1 - vx; }
            hx = vx; hy = vy;
        } else if (isKlein) {
            headDir = (headDir + ruleDir2D) & 3;
            if (headDir === 0) vy--; else if (headDir === 1) vx++; else if (headDir === 2) vy++; else vx--;
            if (vy < 0) { vy += DIM; vx = DIM - 1 - vx; }
            else if (vy >= DIM) { vy -= DIM; vx = DIM - 1 - vx; }
            if (vx < 0) { vx += DIM; vy = DIM - 1 - vy; }
            else if (vx >= DIM) { vx -= DIM; vy = DIM - 1 - vy; }
            hx = vx; hy = vy;
        } else if (isLorenz) {
            const lx = (vx - DIM/2)*0.05, ly = (vy - DIM/2)*0.05, lz = (vz - DIM/2)*0.05;
            const dx = 10 * (ly - lx) * 0.05;
            const dy = (lx * (28 - lz) - ly) * 0.05;
            const dz = (lx * ly - 2.66 * lz) * 0.05;
            vx += dx + ((((packed >> 24) & 0x1) ? 1 : -1) === 1 ? 1 : -1); 
            vy += dy + (ruleDir2D%3 - 1);
            vz += dz + (ruleDir3D%3 - 1);
            hx = DIM/2 + vx * 2; hy = DIM/2 + vy * 2;
        } else if (isTess) {
            const m = (ruleDir3D + ruleDir2D) % 8;
            if (m===0) vx++; else if (m===1) vx--; else if (m===2) vy++; else if (m===3) vy--;
            else if (m===4) vz++; else if (m===5) vz--; else if (m===6) vw++; else vw--;
            hx = DIM/2 + (vx - DIM/2) + (vz - DIM/2)*0.707 + (vw - DIM/2)*0.318;
            hy = DIM/2 + (vy - DIM/2) + (vz - DIM/2)*0.707 - (vw - DIM/2)*0.318;
        } else if (isWormhole) {
            headDir = (headDir + ruleDir2D) & 3;
            if (headDir === 0) vy--; else if (headDir === 1) vx++; else if (headDir === 2) vy++; else vx--;
            if (visitTape[head] > 3 && Math.random() < 0.1) {
                vx = Math.random() * DIM; vy = Math.random() * DIM;
            }
            hx = vx; hy = vy;
        } else {
            headDir = (headDir + ruleDir2D) & 3;
            if (headDir === 0) vy--;
            else if (headDir === 1) vx++;
            else if (headDir === 2) vy++;
            else vx--;
            hx = vx; hy = vy;
        }
        
        hx = ((Math.round(hx) % DIM) + DIM) % DIM;
        hy = ((Math.round(hy) % DIM) + DIM) % DIM;
        
        head = hy * DIM + hx;
    }
    
    this.virtualX = vx;
    this.virtualY = vy;
    this.virtualZ = vz;
    this.virtualW = vw;
    this.head = head;
    this.state = state;
    this.headDir = headDir;
    this.stepCount += executedSteps;
  }
}
