import React, { useEffect, useRef, useMemo } from 'react';
import { Config, TAPE_SIZE, TAPE_DIM, TuringSimulator } from '../lib/turing';

const PALETTES: Record<string, number[][]> = {
  'Standard': [
    [12, 12, 12, 255], [244, 63, 94, 255], [14, 165, 233, 255], [34, 197, 94, 255],
    [234, 179, 8, 255], [168, 85, 247, 255], [249, 115, 22, 255], [20, 184, 166, 255],
    [236, 72, 153, 255], [248, 250, 252, 255]
  ],
  'Cyberpunk': [
    [10, 10, 26, 255], [255, 0, 85, 255], [0, 255, 255, 255], [255, 0, 255, 255],
    [170, 0, 255, 255], [255, 255, 0, 255], [0, 255, 170, 255], [255, 50, 50, 255],
    [120, 0, 200, 255], [220, 220, 255, 255]
  ],
  'Inferno': [
    [5, 0, 15, 255], [40, 5, 60, 255], [100, 15, 80, 255], [170, 30, 80, 255],
    [210, 70, 50, 255], [245, 120, 10, 255], [250, 190, 20, 255], [255, 240, 100, 255],
    [255, 255, 210, 255], [255, 255, 255, 255]
  ],
  'Monochrome': [
    [10, 10, 10, 255], [40, 40, 40, 255], [70, 70, 70, 255], [100, 100, 100, 255],
    [130, 130, 130, 255], [160, 160, 160, 255], [190, 190, 190, 255], [220, 220, 220, 255],
    [245, 245, 245, 255], [255, 255, 255, 255]
  ],
  'Neon': [
    [5, 5, 5, 255], [57, 255, 20, 255], [255, 20, 147, 255], [0, 255, 255, 255],
    [255, 255, 0, 255], [255, 0, 255, 255], [0, 250, 154, 255], [255, 69, 0, 255],
    [138, 43, 226, 255], [255, 255, 255, 255]
  ],
  'Matrix': [
    [0, 15, 0, 255], [0, 40, 0, 255], [0, 80, 0, 255], [0, 120, 0, 255],
    [0, 160, 0, 255], [0, 200, 0, 255], [30, 230, 30, 255], [70, 255, 70, 255],
    [130, 255, 130, 255], [200, 255, 200, 255]
  ],
  'Psycho': [
    [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 255],
    [255, 0, 255, 255], [0, 255, 255, 255], [255, 128, 0, 255], [128, 0, 255, 255],
    [0, 255, 128, 255], [255, 255, 255, 255]
  ],
  'Alien Flesh': [
    [30, 10, 20, 255], [60, 20, 30, 255], [90, 40, 50, 255], [120, 50, 80, 255],
    [150, 70, 110, 255], [180, 100, 130, 255], [210, 130, 150, 255], [230, 170, 180, 255],
    [245, 210, 220, 255], [255, 250, 240, 255]
  ]
};

interface Props {
  config: Config;
  rules: Float64Array;
  params: {
    stepsPerRow: number;
    maxSteps: number;
  };
  liveMode: boolean;
  liveSpeed: number;
  liveSessionId: number;
  randomizeTrigger: number;
  isThumbnail?: boolean;
}

export default function TuringVisualization({ config, rules, params, liveMode, liveSpeed, liveSessionId, randomizeTrigger, isThumbnail }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getIs2D = () => config.topology.includes('2D') || config.topology.includes('3D') || config.topology.includes('4D');

  const cameraRef = useRef({
    x: getIs2D() ? TAPE_DIM / 2 : TAPE_SIZE / 2, 
    y: getIs2D() ? TAPE_DIM / 2 : 0,
    zoom: 2, 
  });

  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const liveSimRef = useRef<TuringSimulator | null>(null);
  const liveConfigKeyRef = useRef('');
  const staticSimRef = useRef<TuringSimulator | null>(null);
  const staticConfigKeyRef = useRef('');

  useEffect(() => {
    cameraRef.current = {
      x: getIs2D() ? TAPE_DIM / 2 : TAPE_SIZE / 2,
      y: getIs2D() ? TAPE_DIM / 2 : 0,
      zoom: getIs2D() ? 2 : 1,
    };
  }, [randomizeTrigger, config.topology]);

  const stateColors = useMemo(() => {
    const pal = PALETTES[config.palette] || PALETTES['Standard'];
    const colors = new Uint8Array(200000); // 50k states * 4
    colors[0] = pal[0][0]; colors[1] = pal[0][1]; colors[2] = pal[0][2]; colors[3] = 255;
    for (let i = 1; i < 50000; i++) {
      const pIdx = i % (pal.length - 1) + 1;
      const c = pal[pIdx];
      colors[i*4] = Math.min(255, Math.max(0, c[0] + (Math.random()*20-10)));
      colors[i*4+1] = Math.min(255, Math.max(0, c[1] + (Math.random()*20-10)));
      colors[i*4+2] = Math.min(255, Math.max(0, c[2] + (Math.random()*20-10)));
      colors[i*4+3] = 255;
    }
    // Halting state color (Red)
    if (config.hasHaltingState) {
        const haltState = config.states - 1;
        colors[haltState*4] = 255; 
        colors[haltState*4+1] = 0; 
        colors[haltState*4+2] = 0; 
        colors[haltState*4+3] = 255;
    }
    return colors;
  }, [config.palette, config.hasHaltingState, config.states]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animationFrameId: number;
    let isRendering = true;
    let lastRenderKey = '';

    const handleWheel = (e: WheelEvent) => {
      if (isThumbnail) return;
      e.preventDefault();
      const cam = cameraRef.current;
      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = Math.pow(0.99, e.deltaY);
        cam.zoom = Math.max(0.0001, Math.min(1000, cam.zoom * zoomFactor));
      } else {
        cam.x += e.deltaX / cam.zoom;
        cam.y += e.deltaY / cam.zoom;
      }
    };

    if (!isThumbnail) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    const render = () => {
      if (!isRendering) return;
      
      const width = Math.floor(container.clientWidth);
      const height = Math.floor(container.clientHeight);
      
      if (width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        lastRenderKey = '';
      }

      const is2D = config.topology.includes('2D') || config.topology.includes('3D') || config.topology.includes('4D');
      const cam = cameraRef.current;
      
      cam.zoom = Math.max(0.0001, Math.min(1000, cam.zoom));
      
      if (!is2D && !liveMode && !isThumbnail) {
        cam.y = Math.max(0, Math.min(cam.y, (params.maxSteps / params.stepsPerRow) - 5));
      }

      const renderKey = `${cam.x.toFixed(2)},${cam.y.toFixed(2)},${cam.zoom.toFixed(5)},${width},${height},${params.stepsPerRow},${params.maxSteps},${randomizeTrigger},${config.topology},${config.colorMap},${config.palette},${config.writeMode},${config.mutationRate},${config.locality},${config.densityBias},${config.states},${config.symbols},${liveMode},${liveSpeed}`;
      
      if (!liveMode) {
        liveSimRef.current = null;
        liveConfigKeyRef.current = '';
        if (lastRenderKey === renderKey) {
          animationFrameId = requestAnimationFrame(render);
          return;
        }
        lastRenderKey = renderKey;
      } else {
        lastRenderKey = '';
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      let activeSim: TuringSimulator;
      const currentLiveKey = `${randomizeTrigger},${config.topology},${config.writeMode},${config.mutationRate},${config.locality},${config.directionalLocality},${config.symbolLocality},${config.localMutation},${config.states},${config.symbols},${config.densityBias},${liveSessionId}`;

      if (liveMode) {
        let justCreated = false;
        if (!liveSimRef.current || liveConfigKeyRef.current !== currentLiveKey) {
            liveSimRef.current = new TuringSimulator(config, rules);
            liveConfigKeyRef.current = currentLiveKey;
            justCreated = true;
        }
        activeSim = liveSimRef.current;
        
        if (!justCreated) {
            if (is2D) {
                activeSim.play2D(liveSpeed);
            } else {
                if (liveSpeed > 0) activeSim.play1D(liveSpeed);
            }
        }
        
        if (justCreated) {
            if (is2D) {
                cam.x = activeSim.head % TAPE_DIM;
                cam.y = Math.floor(activeSim.head / TAPE_DIM);
            } else {
                cam.x = activeSim.head;
                cam.y = 0;
            }
        } else {
            if (is2D) {
                let targetX = activeSim.head % TAPE_DIM;
                let targetY = Math.floor(activeSim.head / TAPE_DIM);
                
                let dx = targetX - ((cam.x % TAPE_DIM) + TAPE_DIM) % TAPE_DIM;
                if (dx > TAPE_DIM / 2) dx -= TAPE_DIM;
                if (dx < -TAPE_DIM / 2) dx += TAPE_DIM;
                
                let dy = targetY - ((cam.y % TAPE_DIM) + TAPE_DIM) % TAPE_DIM;
                if (dy > TAPE_DIM / 2) dy -= TAPE_DIM;
                if (dy < -TAPE_DIM / 2) dy += TAPE_DIM;

                cam.x += dx * 0.05;
                cam.y += dy * 0.05;
            } else {
                let targetX = activeSim.head;
                let dx = targetX - ((cam.x % TAPE_SIZE) + TAPE_SIZE) % TAPE_SIZE;
                if (dx > TAPE_SIZE / 2) dx -= TAPE_SIZE;
                if (dx < -TAPE_SIZE / 2) dx += TAPE_SIZE;

                cam.x += dx * 0.05;
                cam.y = 0;
            }
        }
      } else {
        const staticKey = `${randomizeTrigger},${config.topology},${config.writeMode},${config.mutationRate},${config.locality},${config.directionalLocality},${config.symbolLocality},${config.localMutation},${config.states},${config.symbols},${config.densityBias},${config.sensorRadius},${params.maxSteps}`;
        if (!staticSimRef.current || staticConfigKeyRef.current !== staticKey) {
            staticSimRef.current = new TuringSimulator(config, rules);
            staticConfigKeyRef.current = staticKey;
            if (is2D) {
                staticSimRef.current.play2D(params.maxSteps);
            }
        }
        activeSim = staticSimRef.current;
      }

      const zoom = cam.zoom;
      const cellsX = width / zoom;
      const cellsY = height / zoom;
      
      const startX = Math.floor(cam.x - cellsX / 2);
      let startY = 0;
      let endY = 0;
      
      if (is2D) {
        startY = Math.floor(cam.y - cellsY / 2);
        endY = startY + Math.ceil(cellsY);
      } else {
        startY = Math.max(0, Math.floor(cam.y));
        if (liveMode) {
            endY = startY + Math.ceil(cellsY);
        } else {
            endY = Math.min(params.maxSteps / params.stepsPerRow, startY + Math.ceil(cellsY));
        }
      }
      
      const activePalette = PALETTES[config.palette] || PALETTES['Standard'];
      ctx.fillStyle = `rgba(${activePalette[0].join(',')})`;
      ctx.fillRect(0, 0, width, height);

      if (!liveMode) {
        if (!is2D) {
          activeSim.reset();
          if (startY > 0) activeSim.play1D(startY * params.stepsPerRow);
        }
      }

      const MAX_TEXTURE_SIZE = 3000;
      const imgW = Math.min(MAX_TEXTURE_SIZE, Math.ceil(cellsX) + 1);
      const imgH = Math.min(MAX_TEXTURE_SIZE, Math.max(0, Math.ceil(endY - startY)) + 1);
      
      if (imgW > 0 && imgH > 0) {
        const imgData = new ImageData(imgW, imgH);
        
        for (let r = 0; r < imgH; r++) {
          if (!liveMode && !is2D && (startY + r > params.maxSteps / params.stepsPerRow)) break;
          
          for (let c = 0; c < imgW; c++) {
            let r_col = activePalette[0][0];
            let g_col = activePalette[0][1];
            let b_col = activePalette[0][2];
            
            let idx = 0;
            if (is2D) {
                let hx = ((startX + c) % TAPE_DIM + TAPE_DIM) % TAPE_DIM;
                let hy = ((startY + r) % TAPE_DIM + TAPE_DIM) % TAPE_DIM;
                idx = hy * TAPE_DIM + hx;
            } else {
                idx = ((startX + c) % TAPE_SIZE + TAPE_SIZE) % TAPE_SIZE;
            }

            if (config.colorMap === 'symbol') {
                const sym = activeSim.tape[idx];
                const pColor = activePalette[sym % activePalette.length];
                r_col = pColor[0]; g_col = pColor[1]; b_col = pColor[2];
            } else if (config.colorMap === 'state') {
                const st = activeSim.stateTape[idx];
                if (st !== 4294967295) {
                    const sIdx = st * 4;
                    r_col = stateColors[sIdx];
                    g_col = stateColors[sIdx+1];
                    b_col = stateColors[sIdx+2];
                }
            } else if (config.colorMap === 'visits') {
                const v = activeSim.visitTape[idx];
                if (v > 0) {
                    const heat = Math.floor((v / 20) * (activePalette.length - 1));
                    const safeHeat = Math.max(1, Math.min(activePalette.length - 1, heat));
                    const pColor = activePalette[safeHeat];
                    r_col = pColor[0]; g_col = pColor[1]; b_col = pColor[2];
                }
            }

            const ptr = (r * imgW + c) * 4;
            imgData.data[ptr] = r_col;
            imgData.data[ptr + 1] = g_col;
            imgData.data[ptr + 2] = b_col;
            imgData.data[ptr + 3] = 255;
          }
          if (!liveMode && !is2D) activeSim.play1D(params.stepsPerRow);
        }
        
        const offCtx = document.createElement('canvas').getContext('2d');
        if (offCtx) {
          offCtx.canvas.width = imgW;
          offCtx.canvas.height = imgH;
          offCtx.putImageData(imgData, 0, 0);
          
          ctx.imageSmoothingEnabled = false;
          const offsetX = (cam.x - cellsX / 2 - startX) * zoom;
          const offsetY = (cam.y - (is2D ? cellsY / 2 : 0) - startY) * zoom;
          ctx.drawImage(offCtx.canvas, -offsetX, -offsetY, imgW * zoom, imgH * zoom);

          if (liveMode) {
             const time = Date.now() * 0.005;
             ctx.save();
             ctx.translate(width / 2, height / 2);
             
             // Subtle pulse for the machine head
             const pulse = 1 + Math.sin(time) * 0.05;
             ctx.scale(pulse, pulse);
             
             // Scientific/Technical Machine Head
             const s = Math.max(14, zoom * 1.2); 
             const l = s / 2;
             const cl = l * 0.3; // corner bracket length
             
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
             ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
             ctx.lineWidth = 1.5;
             ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
             ctx.shadowBlur = 4;
             
             // Sub-square framing brackets
             ctx.beginPath();
             // Top Left
             ctx.moveTo(-l, -l + cl); ctx.lineTo(-l, -l); ctx.lineTo(-l + cl, -l);
             // Top Right
             ctx.moveTo(l - cl, -l); ctx.lineTo(l, -l); ctx.lineTo(l, -l + cl);
             // Bottom Right
             ctx.moveTo(l, l - cl); ctx.lineTo(l, l); ctx.lineTo(l - cl, l);
             // Bottom Left
             ctx.moveTo(-l + cl, l); ctx.lineTo(-l, l); ctx.lineTo(-l, l - cl);
             ctx.stroke();

             ctx.fillRect(-l, -l, s, s);

             // Center reticle
             ctx.beginPath();
             ctx.arc(0, 0, Math.max(1.5, zoom * 0.1), 0, Math.PI * 2);
             ctx.fill();
             ctx.stroke();

             ctx.restore();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRendering = false;
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [config, rules, params, randomizeTrigger, stateColors, liveMode, liveSpeed, liveSessionId]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isThumbnail) return;
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || isThumbnail) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    
    cameraRef.current.x -= dx / cameraRef.current.zoom;
    cameraRef.current.y -= dy / cameraRef.current.zoom;
    
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isThumbnail) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      ref={containerRef} 
      className={`absolute inset-0 overflow-hidden bg-neutral-950 touch-none ${isThumbnail ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
