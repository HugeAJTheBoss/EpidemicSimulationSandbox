import React, { useEffect, useRef, useState } from "react";
import { fromUrl } from "geotiff";
import ScreenControls from "./ScreenControls";
import VirusControls, { DEFAULTS as VIRUS_DEFAULTS } from "./VirusControls";
import EarthDataReceiver from "./EarthDataReceiver";
import "../CSS/index.css";

// LiveSim: main component!
// - Takes the population geotiff file and turns it into a visual (dots are multiplied by population to get size).
// - Polls a binary RGB frame (sim_frame.bin) and paints population-scaled circles
// - Handles zoom
//   Has a virus panel (values are lifted into this component so they stay there when panels toggle and don't reset)
export default function LiveSim() {
  const canvasRef = useRef(null);

  const simBufRef = useRef(null);
  const popResRef = useRef(null);
  const maxPopRef = useRef(1);

  const rafIdRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const pollAbortRef = useRef(null);

  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });

  const drawStepRef = useRef(2);
  const globalMultRef = useRef(1);
  const compressExpRef = useRef(0.7);
  const percentileCapRef = useRef(0.95);
  const minRadiusRef = useRef(0.1);
  const maxRadiusRef = useRef(0.9);

  const startedRef = useRef(false);
  const listenersAddedRef = useRef(false);

  const BASE_W = 1440;
  const BASE_H = 720;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [receiverActive, setReceiverActive] = useState(false);

  const [controls, setControls] = useState({
    drawStep: 2,
    globalMultiplier: 1,
    compressExp: 0.7,
    percentileCap: 0.95,
    minRadius: 0.1,
    maxRadius: 0.9,
  });

  const [virusValues, setVirusValues] = useState(() => VIRUS_DEFAULTS);

  const togglePanel = (p) => {
    setOpenPanel((v) => (v === p ? null : p));
  };

  // Load & resample population
  // I fetch a GeoTIFF and use it in it the fixed BASE_W x BASE_H grid used for rendering.
  // This simplifies mapping between population values and canvas pixels so sizing remains predictable.
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const tiff = await fromUrl("/population.tif");
        const img = await tiff.getImage();
        const w = img.getWidth();
        const h = img.getHeight();
        const ras = await img.readRasters({ interleave: true });

        // convert to single-band float array (assume first band is population)
        const spp = ras.length / (w * h);
        const raw = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) raw[i] = ras[i * spp] || 0;

        // simple nearest-neighbor downsample to our base sim grid
        const resized = new Float32Array(BASE_W * BASE_H);
        for (let y = 0; y < BASE_H; y++) {
          const sy = Math.floor((y / BASE_H) * h);
          for (let x = 0; x < BASE_W; x++) {
            const sx = Math.floor((x / BASE_W) * w);
            resized[y * BASE_W + x] = raw[sy * w + sx] || 0;
          }
        }

        popResRef.current = resized;

        // compute a percentile-based max for nicer radius scaling
        const sorted = Array.from(resized).sort((a, b) => a - b);
        const idx = Math.floor(sorted.length * percentileCapRef.current);
        maxPopRef.current = sorted[idx] || 1;

        if (alive) setLoading(false);
      } catch (e) {
        if (alive) {
          setError(e.message || String(e));
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, []);

  // Main render loop
  // Reads latest binary RGB frame  and paints circles
  // - Uses exponent used to compress circles so that they get larger with increased population but don't get too too big
  useEffect(() => {

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = BASE_W;
    canvas.height = BASE_H;

    const draw = () => {
      const sim = simBufRef.current;
      const pop = popResRef.current;

      if (sim && pop) {
        ctx.clearRect(0, 0, BASE_W, BASE_H);

        // apply zoom and offset so zoom is anchored to user interactions
        const z = zoomRef.current;
        const off = offsetRef.current;
        ctx.setTransform(z, 0, 0, z, off.x, off.y);

        const step = drawStepRef.current || 1;
        const maxPop = maxPopRef.current;
        const minR = minRadiusRef.current * globalMultRef.current;
        const maxR = maxRadiusRef.current * globalMultRef.current;
        const exp = compressExpRef.current;

        // iterate over the downsampled grid and draw a colored circle where population exists
        for (let y = 0; y < BASE_H; y += step) {
          for (let x = 0; x < BASE_W; x += step) {
            const idx = y * BASE_W + x;
            const p = pop[idx];
            if (!p) continue;

            // normalize with a log scale then apply compression exponent
            let n = Math.log(p + 1) / Math.log(maxPop + 1);
            if (n < 0 || !isFinite(n)) n = 0;

            const r = minR + Math.pow(n, exp) * (maxR - minR);

            const o = idx * 3;
            ctx.fillStyle = `rgb(${sim[o]},${sim[o + 1]},${sim[o + 2]})`;
            ctx.beginPath();
            ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(draw);
    };

    if (!startedRef.current) {
      startedRef.current = true;
      rafIdRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      startedRef.current = false;
    };
  }, []);

  // Poll the backend for the latest simulation frame (binary interleaved RGB)
  // Only poll when receiver is not active - otherwise we get data from WebRTC
  useEffect(() => {
    const poll = async () => {
      if (pollAbortRef.current) pollAbortRef.current.abort();
      const ac = new AbortController();
      pollAbortRef.current = ac;

      try {
        const r = await fetch("/sim_frame.bin?cb=" + Date.now(), {
          signal: ac.signal,
        });
        if (!r.ok) return;
        const buf = await r.arrayBuffer();
        const u8 = new Uint8Array(buf);
        // basic validation: expect width * height * 3 bytes
        if (u8.length === BASE_W * BASE_H * 3) simBufRef.current = u8;
      } catch { }
      pollAbortRef.current = null;
    };

    // Only start polling if receiver is not active
    if (!receiverActive) {
      poll();
      pollIntervalRef.current = setInterval(poll, 250);
    }

    return () => {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      if (pollAbortRef.current) pollAbortRef.current.abort();
    };
  }, [receiverActive]);

  // Add wheel zoom handler (cursor-anchored zoom)
  // Zoom calculation keeps the point under the cursor stationary in canvas coordinates.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || listenersAddedRef.current) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const prev = zoomRef.current;
      const next = Math.min(20, Math.max(1, prev * Math.exp(-e.deltaY * 0.001)));
      const s = next / prev;

      // adjust offset so zoom anchors on cursor position
      offsetRef.current.x = mx - (mx - offsetRef.current.x) * s;
      offsetRef.current.y = my - (my - offsetRef.current.y) * s;
      zoomRef.current = next;
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    listenersAddedRef.current = true;

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      listenersAddedRef.current = false;
    };
  }, []);

  // handleControlChange: central place to update React state. Refs are updated as well.
  const handleControlChange = (k, v) => {
    setControls((c) => ({ ...c, [k]: v }));

    // update the refs used in rendering to avoid re-wiring RAF loop
    if (k === "drawStep") drawStepRef.current = v;
    if (k === "globalMultiplier") globalMultRef.current = v;
    if (k === "compressExp") compressExpRef.current = v;
    if (k === "minRadius") minRadiusRef.current = v;
    if (k === "maxRadius") maxRadiusRef.current = v;

    // percentile cap affects the computed `maxPop` used for normalization
    if (k === "percentileCap") {
      percentileCapRef.current = v;
      if (popResRef.current) {
        const a = Array.from(popResRef.current).sort((x, y) => x - y);
        maxPopRef.current = a[Math.floor(a.length * v)] || 1;
      }
    }
  };

  // resetView_Controls: restore display-related parameters to sensible defaults (will be fine tuned in the future)
  // Note: we update both UI state and internal refs used by the renderer.
  const resetView_Controls = () => {
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };

    const d = {
      drawStep: 2,
      globalMultiplier: 1,
      compressExp: 0.7,
      percentileCap: 0.95,
      minRadius: 0.1,
      maxRadius: 0.9,
    };

    setControls(d);
    drawStepRef.current = d.drawStep;
    globalMultRef.current = d.globalMultiplier;
    compressExpRef.current = d.compressExp;
    percentileCapRef.current = d.percentileCap;
    minRadiusRef.current = d.minRadius;
    maxRadiusRef.current = d.maxRadius;
  };

  // virus handlers: simple setters lifted up so values persist across panel toggles
  const handleVirusChange = (k, v) => {
    setVirusValues((p) => ({ ...p, [k]: v }));
  };

  const resetVirusControls = () => {
    // restore defaults defined in `VirusControls` so both components agree
    setVirusValues(VIRUS_DEFAULTS);
  };

  // Handle data received from EarthDataReceiver via WebRTC
  const handleEarthDataReceived = (uint8Array, frameNum) => {
    // Validate size matches expected dimensions (1440 × 720 × 3)
    if (uint8Array.length === BASE_W * BASE_H * 3) {
      simBufRef.current = uint8Array;
    } else {
      console.warn(`Received frame ${frameNum} with unexpected size: ${uint8Array.length}`);
    }
  };

  // Start/Pause handlers for WebRTC receiver
  const handleStart = () => {
    setReceiverActive(true);
  };

  const handlePause = () => {
    setReceiverActive(false);
  };

  return (
    <div className="live-sim-container">
      <div className="live-sim-status">
        {loading && <p className="live-sim-loading">Loading population data…</p>}
        {error && <p className="live-sim-error">Error: {error}</p>}
      </div>

      <div className="live-sim-row">
        <div className={`live-sim-controls-wrapper left ${openPanel ? "expanded" : "collapsed"}`}>
          <div className="panel-header stacked">
            <button
              className="panel-toggle"
              aria-controls="virus-panel"
              aria-expanded={openPanel === "virus"}
              onClick={() => togglePanel("virus")}
            >
              Virus
            </button>

            <button
              className="panel-toggle"
              aria-controls="screen-panel"
              aria-expanded={openPanel === "screen"}
              onClick={() => togglePanel("screen")}
            >
              Screen
            </button>
          </div>

          {openPanel === "virus" && (
            <div id="virus-panel">
              <VirusControls
                values={virusValues}
                onChange={handleVirusChange}
                onVirusReset={resetVirusControls}
              />
            </div>
          )}

          {openPanel === "screen" && (
            <div id="screen-panel">
              <ScreenControls
                values={controls}
                onChange={handleControlChange}
                onStart={handleStart}
                onPause={handlePause}
                onScreenReset={resetView_Controls}
              />
            </div>
          )}
        </div>

        <div className="live-sim-canvas-wrapper center">
          <canvas
            ref={canvasRef}
            className={`live-sim-canvas ${loading || error ? "hidden" : ""}`}
          />
        </div>
      </div>

      {receiverActive && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          maxWidth: '400px',
          maxHeight: '500px',
          overflow: 'auto',
          background: 'white',
          borderRadius: '10px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <EarthDataReceiver onDataReceived={handleEarthDataReceived} />
        </div>
      )}
    </div>
  );
}