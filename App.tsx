import React, { useState, useEffect, useRef } from 'react';
import { Shuffle, RefreshCw, Settings2, X, Download, Play, Pause, Upload, ArrowLeft } from 'lucide-react';
import { Config, generateRules } from './lib/turing';
import TuringVisualization from './components/TuringVisualization';

const initialAutoSave = localStorage.getItem('turing_autosave_pref') === 'true';

let initialConfig: Config = {
    states: 20,
    symbols: 10,
    densityBias: 0.1, 
    locality: 0,
    directionalLocality: false,
    symbolLocality: false,
    localMutation: false,
    sensorRadius: 0,
    topology: '2D surface',
    colorMap: 'state',
    palette: 'Cyberpunk',
    writeMode: 'overwrite',
    mutationRate: 0,
    hasHaltingState: false,
};

let initialParams = {
    stepsPerRow: 20,
    maxSteps: 2000000,
};

let initialRules: Float64Array | null = null;
let hasSavedRules = false;

if (initialAutoSave) {
  try {
    const dataStr = localStorage.getItem('turing_autosave_data');
    if (dataStr) {
       const data = JSON.parse(dataStr);
       if (data.config) initialConfig = { ...initialConfig, ...data.config };
       if (data.params) initialParams = { ...initialParams, ...data.params };
       if (data.rules && Array.isArray(data.rules)) {
           initialRules = new Float64Array(data.rules);
           hasSavedRules = true;
       }
    }
  } catch (e) {}
}

export default function App() {
  const [randomizeTrigger, setRandomizeTrigger] = useState(0);
  const [isHudOpen, setIsHudOpen] = useState(false);
  
  const [liveMode, setLiveMode] = useState(false);
  const [liveSpeed, setLiveSpeed] = useState(30);
  const [liveSessionId, setLiveSessionId] = useState(0);

  const [autoSave, setAutoSave] = useState(initialAutoSave);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!hasSavedRules);

  const [history, setHistory] = useState<Array<{config: Config, rules: Float64Array}>>([]);
  const isImporting = useRef(hasSavedRules);

  useEffect(() => {
    isImporting.current = false;
    if (window.innerWidth >= 768) setIsHudOpen(true);
  }, []);
  
  const [config, setConfig] = useState<Config>(initialConfig);
  
  const [stateInput, setStateInput] = useState(config.states.toString());
  const [symbolInput, setSymbolInput] = useState(config.symbols.toString());

  useEffect(() => {
    setStateInput(config.states.toString());
  }, [config.states]);

  useEffect(() => {
    setSymbolInput(config.symbols.toString());
  }, [config.symbols]);

  const [rules, setRules] = useState<Float64Array>(() => {
    if (initialRules) return initialRules;
    return generateRules(initialConfig);
  });

  const [params, setParams] = useState(initialParams);

  const currentRules = useRef(rules);
  const currentConfig = useRef(config);
  useEffect(() => {
    currentRules.current = rules;
    currentConfig.current = config;
  }, [rules, config]);

  const safeSaveData = (data: { config: Config, params: any, rules: number[] | Float64Array }) => {
    try {
      localStorage.setItem('turing_autosave_data', JSON.stringify({
        config: data.config,
        params: data.params,
        rules: Array.isArray(data.rules) ? data.rules : Array.from(data.rules)
      }));
    } catch (e) {
      console.warn('Auto-save to localStorage failed (quota or disabled):', e);
    }
  };

  useEffect(() => {
    if (isImporting.current) {
      isImporting.current = false;
      return;
    }
    const timeoutId = setTimeout(() => {
      const newRules = generateRules(config);
      setHistory(prev => {
        const next = [...prev, { config: currentConfig.current, rules: currentRules.current }];
        if (next.length > 10) return next.slice(next.length - 10);
        return next;
      });
      setRules(newRules);
      setRandomizeTrigger(t => t + 1);
      
      if (autoSave) {
          safeSaveData({ config, params, rules: newRules });
          setHasUnsavedChanges(false);
      } else {
          setHasUnsavedChanges(true);
      }
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [config.states, config.symbols, config.densityBias, config.locality, config.directionalLocality, config.symbolLocality, config.localMutation]);

  // Handle autoSave pref changes
  useEffect(() => {
    try {
      localStorage.setItem('turing_autosave_pref', autoSave.toString());
      if (autoSave) {
         safeSaveData({ config, params, rules });
         setHasUnsavedChanges(false);
      }
    } catch (e) {}
  }, [autoSave]);

  const handleGenerate = () => {
    const newRules = generateRules(config);
    setHistory(prev => {
      const next = [...prev, { config: currentConfig.current, rules: currentRules.current }];
      if (next.length > 10) return next.slice(next.length - 10);
      return next;
    });

    setRules(newRules);
    setRandomizeTrigger(t => t + 1);
    
    if (autoSave) {
        safeSaveData({ config, params, rules: newRules });
        setHasUnsavedChanges(false);
    } else {
        setHasUnsavedChanges(true);
    }
  };
  
  const handleReset = () => {
    setRandomizeTrigger(t => t + 1);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, prev.length - 1));
    isImporting.current = true;
    setConfig(previous.config);
    setRules(previous.rules);
    setRandomizeTrigger(t => t + 1);
    
    if (autoSave) {
       safeSaveData({ config: previous.config, params, rules: previous.rules });
       setHasUnsavedChanges(false);
    } else {
       setHasUnsavedChanges(true);
    }
  };

  const handleExportRules = () => {
    const dataStr = JSON.stringify({ config, params, rules: Array.from(rules) }); // Do not format, it would be gigantic
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `turing-rules-${config.states}states-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setHasUnsavedChanges(false);
  };

  const packLegacyRule = (rule: any) => {
      const nextState = rule.nextState || 0;
      const writeSymbol = rule.writeSymbol || 0;
      const dir1D = rule.dir1D || 0;
      const dir2D = rule.dir2D || 0;
      const dir3D = rule.dir3D || 0;
      const dirs = ((dir1D === 1 ? 1 : 0)) | ((dir2D & 0x7) << 1) | ((dir3D & 0x7) << 4);
      return (nextState & 0xFFFF) + (writeSymbol * 65536) + (dirs * 1099511627776);
  };

  const migrateOldRule = (packed32: number) => {
      let nextState = packed32 & 0xFFFF;
      let writeSymbol = (packed32 >> 16) & 0xFF;
      let dir1D = ((packed32 >> 24) & 0x1) === 1 ? 1 : -1;
      let dir2D = (packed32 >> 25) & 0x7;
      let dir3D = (packed32 >> 28) & 0x7;
      return packLegacyRule({ nextState, writeSymbol, dir1D, dir2D, dir3D });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRulesFromJSON = (contents: string) => {
    try {
      const data = JSON.parse(contents);
      if (data && data.config && data.rules) {
        isImporting.current = true;
        const newConfig: Config = { 
          ...config, 
          ...data.config,
          sensorRadius: data.config.sensorRadius || 0,
          mutationRate: data.config.mutationRate || 0,
          locality: data.config.locality || 0,
          directionalLocality: data.config.directionalLocality || false,
          symbolLocality: data.config.symbolLocality || false,
          localMutation: data.config.localMutation || false,
          densityBias: data.config.densityBias || 0.1
        };
        setConfig(newConfig);
        
        let loadedRules: Float64Array;
        if (Array.isArray(data.rules) && Array.isArray(data.rules[0])) {
           // Legacy format (rules matrix)
           loadedRules = new Float64Array(newConfig.states * newConfig.symbols);
           let idx = 0;
           for (let i = 0; i < newConfig.states; i++) {
             for (let j = 0; j < newConfig.symbols; j++) {
               const r = data.rules[i]?.[j] || { nextState: 0, writeSymbol: 0, dir1D: 1, dir2D: 0, dir3D: 0 };
               loadedRules[idx++] = packLegacyRule(r);
             }
           }
        } else {
           const ruleList: number[] = Array.isArray(data.rules) ? data.rules : (Object.values(data.rules) as number[]);
           // Only run legacy migration if ALL numbers fit in 32 bits (<= 0xFFFFFFFF) and none have high-bit dir flags
           const isAll32Bit = ruleList.every(v => v <= 0xFFFFFFFF);
           loadedRules = new Float64Array(ruleList.length);
           for (let i = 0; i < ruleList.length; i++) {
             const v = ruleList[i];
             if (isAll32Bit) loadedRules[i] = migrateOldRule(v);
             else loadedRules[i] = v;
           }
        }
        
        let newParams = params;
        if (data.params) {
          newParams = { ...params, ...data.params };
          setParams(newParams);
        }
        
        setRules(loadedRules);
        setRandomizeTrigger(t => t + 1);
        setHasUnsavedChanges(false);
        if (autoSave) {
          safeSaveData({ config: newConfig, params: newParams, rules: loadedRules });
        }
      }
    } catch (err) {
      console.error("Failed to parse rules file", err);
      alert("Failed to parse the exported JSON file.");
    }
  };

  const handleImportRules = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const contents = event.target?.result as string;
      if (contents) loadRulesFromJSON(contents);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const contents = event.target?.result as string;
          if (contents) loadRulesFromJSON(contents);
        };
        reader.readAsText(file);
      }
    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const updateConfig = (key: keyof Config, value: any) => {
    setConfig(c => ({ ...c, [key]: value }));
  };

  return (
    <div className="relative w-full h-screen font-sans overflow-hidden bg-neutral-950 text-neutral-100 select-none">
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".json" 
        onChange={handleFileInputChange} 
        className="hidden" 
      />
      <TuringVisualization 
        config={config}
        rules={rules}
        params={params}
        liveMode={liveMode}
        liveSpeed={liveSpeed}
        liveSessionId={liveSessionId}
        randomizeTrigger={randomizeTrigger} 
      />
      
      {/* Floating Randomize Button - always visible */}
      <button 
        onClick={handleGenerate}
        className={`absolute bottom-6 left-6 z-50 p-4 bg-white hover:bg-neutral-200 text-neutral-950 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 ${isHudOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        title="Quick Randomize Rules"
      >
        <Shuffle className="w-5 h-5" />
      </button>

      {/* Floating Live Mode Button */}
      <button 
        onClick={() => {
          const newMode = !liveMode;
          setLiveMode(newMode);
          if (newMode) setLiveSessionId(id => id + 1);
        }}
        className={`absolute bottom-6 left-24 z-50 p-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 ${
          liveMode ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-white text-neutral-950 hover:bg-neutral-200'
        } ${isHudOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        title="Toggle High-Speed Live View"
      >
        {liveMode ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5" fill="currentColor" />}
      </button>

      {/* Floating Download Button */}
      <button 
        onClick={handleExportRules}
        className={`absolute bottom-6 left-[10.5rem] z-50 p-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 ${
          hasUnsavedChanges ? 'bg-orange-500 text-white hover:bg-orange-400' : 'bg-white text-neutral-950 hover:bg-neutral-200'
        } ${isHudOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        title={hasUnsavedChanges ? "Export JSON (Unsaved Changes)" : "Export JSON"}
      >
        <Download className="w-5 h-5" />
        {hasUnsavedChanges && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-neutral-900 animate-pulse"></span>
        )}
      </button>

      {/* Mobile Toggle Button */}
      <button 
        onClick={() => setIsHudOpen(!isHudOpen)}
        className="md:hidden absolute bottom-6 right-6 z-50 p-4 bg-neutral-900/90 backdrop-blur-xl rounded-full border border-white/10 text-white shadow-2xl transition-transform hover:scale-105 active:scale-95"
      >
        {isHudOpen ? <X className="w-5 h-5" /> : <Settings2 className="w-5 h-5" />}
      </button>

      {/* HUD Panel Overlay */}
      <div className={`
        absolute z-40 flex flex-col p-6 rounded-t-3xl md:rounded-2xl bg-neutral-900/80 backdrop-blur-3xl border border-white/10 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
        ${isHudOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 md:translate-y-0 md:translate-x-8 md:opacity-0 pointer-events-none'}
        w-full max-h-[85vh] overflow-y-auto bottom-0 left-0 right-0 
        md:bottom-auto md:left-auto md:w-80 md:right-6 md:top-6 custom-scrollbar
      `}>
        
        <div className="space-y-1 mb-6">
          <h1 className="text-xl font-display font-medium tracking-tight text-white mb-1">
            Turing Explorer Pro
          </h1>
          <p className="text-xs font-mono text-neutral-400">
            {config.states.toLocaleString()}-State, {config.symbols}-Symbol
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <button 
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Undo Generation"
            className={`w-12 flex items-center justify-center rounded-lg transition-colors ${history.length === 0 ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={handleGenerate}
            title="Randomize Rules"
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-neutral-100 hover:bg-white text-neutral-950 rounded-lg text-sm font-medium transition-colors"
          >
            <Shuffle className="w-4 h-4" />
            Gen
          </button>
          <button 
            onClick={handleImportRules}
            title="Import Rules (JSON)"
            className="w-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button 
            onClick={handleExportRules}
            title="Export Rules (JSON)"
            className="w-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <button 
            onClick={handleReset}
            title="Reset Camera"
            className="w-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-6">
          
          {/* Section: Architecture */}
          <div className="space-y-4">
             <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Architecture</h2>
             <div className="space-y-2">
                <label className="text-xs text-neutral-400 font-mono">States (Max 50k)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={stateInput}
                  onChange={(e) => {
                    setStateInput(e.target.value);
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) updateConfig('states', Math.min(50000, Math.max(1, val)));
                  }}
                  onBlur={() => {
                    let val = parseInt(stateInput, 10);
                    if (isNaN(val) || val < 1) val = 1;
                    if (val > 50000) val = 50000;
                    setStateInput(val.toString());
                    updateConfig('states', val);
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-white/30"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs text-neutral-400 font-mono">Symbols</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={symbolInput}
                  onChange={(e) => {
                    setSymbolInput(e.target.value);
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) updateConfig('symbols', Math.max(2, val));
                  }}
                  onBlur={() => {
                    let val = parseInt(symbolInput, 10);
                    if (isNaN(val) || val < 2) val = 2;
                    setSymbolInput(val.toString());
                    updateConfig('symbols', val);
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-white/30"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs text-neutral-400 font-mono">Topology</label>
                <select value={config.topology} onChange={(e) => updateConfig('topology', e.target.value as any)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                  <optgroup label="1D Spatial">
                    <option value="1D space-time">1D Space-Time</option>
                    <option value="1D mirrored boundary">1D Mirrored Boundary</option>
                    <option value="1D fractal jump">1D Fractal Jump</option>
                    <option value="1D relativistic jump">1D Relativistic Jump</option>
                  </optgroup>
                  <optgroup label="2D Spatial">
                    <option value="2D surface">2D Surface (Turmite)</option>
                    <option value="2D hex grid">2D Hexagonal Grid</option>
                    <option value="2D triangular grid">2D Triangular Grid</option>
                    <option value="2D moore (8-way)">2D Moore (8-way)</option>
                    <option value="2D radial">2D Radial Jump</option>
                    <option value="2D spiral">2D Spiral Walk</option>
                    <option value="2D quantum walk">2D Quantum Walk</option>
                    <option value="2D random walk">2D Random Walk</option>
                  </optgroup>
                  <optgroup label="3D Projections">
                    <option value="3D ortho projection">3D Orthographic Projection</option>
                    <option value="3D isometric projection">3D Isometric Projection</option>
                    <option value="3D perspective projection">3D Perspective Projection</option>
                    <option value="3D spherical projection">3D Spherical Projection</option>
                    <option value="3D random walk">3D Random Walk</option>
                  </optgroup>
                  <optgroup label="Psycho & Alien (Chaos)">
                    <option value="2D mobius strip">2D Möbius Strip</option>
                    <option value="2D klein bottle">2D Klein Bottle</option>
                    <option value="3D lorenz attractor">3D Lorenz Attractor</option>
                    <option value="4D tesseract projection">4D Tesseract Projection</option>
                    <option value="2D alien wormhole">2D Alien Wormhole</option>
                  </optgroup>
                  <optgroup label="Ultra-Dimensional (Beyond)">
                    <option value="1D cellular automaton">1D Cellular Automaton</option>
                    <option value="2D hyperbolic grid">2D Hyperbolic Grid</option>
                    <option value="2D penrose tiling">2D Penrose Tiling</option>
                    <option value="3D torus">3D Torus</option>
                    <option value="4D hypersphere">4D Hypersphere</option>
                    <option value="5D hypercube shadow">5D Hypercube Shadow</option>
                    <option value="neural synapse network">Neural Synapse Network</option>
                    <option value="fractal mandelbrot seed">Fractal Mandelbrot Seed</option>
                    <option value="schrodinger wave">Schrödinger Wave</option>
                    <option value="hyper-dimensional string">Hyper-Dimensional String</option>
                    <option value="quantum entanglement network">Quantum Entanglement Network</option>
                    <option value="fluid dynamics matrix">Fluid Dynamics Matrix</option>
                    <option value="event horizon">Event Horizon</option>
                    <option value="tachyon field">Tachyon Field</option>
                  </optgroup>
                </select>
             </div>
          </div>

          <div className="h-px bg-white/5 w-full" />

          {/* Section: Physics & Logic */}
          <div className="space-y-4">
             <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Physics Engine</h2>
             <div className="space-y-2">
                <label className="text-xs text-neutral-400 font-mono">Write Mode</label>
                <select value={config.writeMode} onChange={(e) => updateConfig('writeMode', e.target.value as any)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                  <optgroup label="Standard Math">
                    <option value="overwrite">Overwrite</option>
                    <option value="add">Add (Accumulate)</option>
                    <option value="subtract">Subtract</option>
                    <option value="multiply">Multiply (Fractal)</option>
                    <option value="modulo">Modulo</option>
                    <option value="average">Average</option>
                    <option value="difference">Absolute Difference</option>
                    <option value="power">Power</option>
                  </optgroup>
                  <optgroup label="Bitwise Logic">
                    <option value="xor">XOR (Bitwise)</option>
                    <option value="bitwise AND">Bitwise AND</option>
                    <option value="bitwise OR">Bitwise OR</option>
                    <option value="bitwise NAND">Bitwise NAND</option>
                    <option value="bitwise NOR">Bitwise NOR</option>
                    <option value="bitwise XNOR">Bitwise XNOR</option>
                  </optgroup>
                  <optgroup label="Alien Chaos">
                    <option value="max">Max</option>
                    <option value="min">Min</option>
                    <option value="collatz step">Collatz Step</option>
                    <option value="rule 30">Rule 30 (CA Chaos)</option>
                    <option value="quantum cascade">Quantum Cascade</option>
                    <option value="alien entropy">Alien Entropy</option>
                    <option value="prime sift">Prime Sift</option>
                  </optgroup>
                  <optgroup label="Physics & Subatomic">
                    <option value="fibonacci scatter">Fibonacci Scatter</option>
                    <option value="schrodinger superposition">Schrödinger Superposition</option>
                    <option value="mandelbrot seed">Mandelbrot Seed</option>
                    <option value="langton ant hybrid">Langton Ant Hybrid</option>
                    <option value="gravitational pull">Gravitational Pull</option>
                    <option value="magnetic repulsion">Magnetic Repulsion</option>
                    <option value="plasma burst">Plasma Burst</option>
                    <option value="fractal resonance">Fractal Resonance</option>
                    <option value="ackermann stack">Ackermann Stack</option>
                    <option value="sinusoidal wave">Sinusoidal Wave</option>
                    <option value="cosmic singularity">Cosmic Singularity</option>
                    <option value="hyperdimensional shift">Hyperdimensional Shift</option>
                    <option value="quantum tunneling">Quantum Tunneling</option>
                    <option value="tachyon feedback">Tachyon Feedback</option>
                    <option value="dark matter collision">Dark Matter Collision</option>
                    <option value="matter inertia">Matter Inertia</option>
                    <option value="chrono reverse">Chrono Reverse</option>
                  </optgroup>
                  <optgroup label="Biological & Neural">
                    <option value="neural backprop">Neural Backprop</option>
                    <option value="biological mutation">Biological Mutation</option>
                    <option value="game of life">Game of Life</option>
                    <option value="entropy decay">Entropy Decay</option>
                  </optgroup>
                </select>
             </div>
             <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-neutral-400 font-mono">
                  <span>Entropy Mutator</span>
                  <span className="text-white">{(config.mutationRate * 100).toFixed(1)}%</span>
                </div>
                <input type="range" min="0" max="0.1" step="0.001" value={config.mutationRate}
                  onChange={(e) => updateConfig('mutationRate', parseFloat(e.target.value))}
                  className="w-full accent-neutral-300"
                />
             </div>
             <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-neutral-400 font-mono">
                  <span>State Locality</span>
                  <span className="text-white">{(config.locality * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.01" value={config.locality}
                  onChange={(e) => updateConfig('locality', parseFloat(e.target.value))}
                  className="w-full accent-neutral-300"
                />
             </div>
             <div className="space-y-2 flex items-center justify-between">
                <label className="text-xs text-neutral-400 font-mono">Directional Locality Mode</label>
                <input type="checkbox" checked={config.directionalLocality}
                  onChange={(e) => updateConfig('directionalLocality', e.target.checked)}
                  className="w-4 h-4 accent-neutral-300"
                />
             </div>
             <div className="space-y-2 flex items-center justify-between">
                <label className="text-xs text-neutral-400 font-mono">Symbol Locality Mode</label>
                <input type="checkbox" checked={config.symbolLocality}
                  onChange={(e) => updateConfig('symbolLocality', e.target.checked)}
                  className="w-4 h-4 accent-neutral-300"
                />
             </div>
             <div className="space-y-2 flex items-center justify-between">
                <label className="text-xs text-neutral-400 font-mono">Local Mutation Mode</label>
                <input type="checkbox" checked={config.localMutation}
                  onChange={(e) => updateConfig('localMutation', e.target.checked)}
                  className="w-4 h-4 accent-neutral-300"
                />
             </div>
             <div className="space-y-2 flex items-center justify-between">
                <label className="text-xs text-neutral-400 font-mono">Halting State</label>
                <input type="checkbox" checked={config.hasHaltingState || false}
                  onChange={(e) => updateConfig('hasHaltingState', e.target.checked)}
                  className="w-4 h-4 accent-neutral-300"
                />
             </div>
             <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-neutral-400 font-mono">
                  <span>Sensor Radius</span>
                  <span className="text-white">{config.sensorRadius}</span>
                </div>
                <input type="range" min="0" max="10" step="1" value={config.sensorRadius || 0}
                  onChange={(e) => updateConfig('sensorRadius', parseFloat(e.target.value))}
                  className="w-full accent-neutral-300"
                />
             </div>
          </div>

          <div className="h-px bg-white/5 w-full" />

          {/* Section: Aesthetics */}
          <div className="space-y-4">
             <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Aesthetics</h2>
             <div className="space-y-2">
                <label className="text-xs text-neutral-400 font-mono">Palette</label>
                <select value={config.palette} onChange={(e) => updateConfig('palette', e.target.value as any)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                  {['Standard', 'Cyberpunk', 'Inferno', 'Monochrome', 'Neon', 'Matrix', 'Psycho', 'Alien Flesh'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-xs text-neutral-400 font-mono">Color Mapping</label>
                <select value={config.colorMap} onChange={(e) => updateConfig('colorMap', e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                  <option value="state">By Machine State</option>
                  <option value="symbol">By Tape Symbol</option>
                  <option value="visits">By Heatmap (Visits)</option>
                </select>
             </div>
          </div>

          <div className="h-px bg-white/5 w-full" />

          {/* Section: Rendering */}
          <div className="space-y-4">
             <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Live & Rendering</h2>
             <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-neutral-400 font-mono">
                  <span>Live Speed (Steps/Frame)</span>
                  <input 
                    type="number"
                    value={liveSpeed === 0 ? '' : liveSpeed}
                    onChange={(e) => {
                      if (e.target.value === '') {
                        setLiveSpeed(0);
                      } else {
                        setLiveSpeed(parseInt(e.target.value) || 0);
                      }
                    }}
                    className="w-24 bg-black/40 border border-white/10 rounded px-2 py-1 text-right text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <input 
                  type="range" min="1" max="50000" step="1"
                  value={liveSpeed}
                  onChange={(e) => setLiveSpeed(parseInt(e.target.value) || 0)}
                  className="w-full accent-red-500"
                />
             </div>
             <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-neutral-400 font-mono">
                  <span className={liveMode ? 'opacity-30' : ''}>Static Simulation Horizon</span>
                  <span className={`text-white ${liveMode ? 'opacity-30' : ''}`}>{(params.maxSteps).toLocaleString()}</span>
                </div>
                <input 
                  type="range" min="10000" max="25000000" step="50000"
                  value={params.maxSteps}
                  onChange={(e) => setParams(p => ({ ...p, maxSteps: parseInt(e.target.value) }))}
                  className={`w-full accent-neutral-300 ${liveMode ? 'opacity-30 pointer-events-none' : ''}`}
                />
             </div>
             {!(config.topology.includes('2D') || config.topology.includes('3D') || config.topology.includes('4D')) && (
               <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-neutral-400 font-mono">
                    <span>1D Time Scale (Steps/Row)</span>
                    <span className="text-white">{params.stepsPerRow}</span>
                  </div>
                  <input 
                    type="range" min="1" max="1000" step="1"
                    value={params.stepsPerRow}
                    onChange={(e) => setParams(p => ({ ...p, stepsPerRow: parseInt(e.target.value) }))}
                    className="w-full accent-neutral-300"
                  />
               </div>
             )}
             <div className="pt-4 border-t border-white/10 space-y-2 flex items-center justify-between">
                <label className="text-xs text-neutral-400 font-mono">Auto-Save State to Browser</label>
                <input type="checkbox" checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="w-4 h-4 accent-neutral-300"
                />
             </div>
          </div>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>
    </div>
  );
}
