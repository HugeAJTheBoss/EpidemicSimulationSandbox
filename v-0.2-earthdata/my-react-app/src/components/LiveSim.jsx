import React, { useEffect, useRef, useState } from "react";
import { fromUrl } from "geotiff";
import ScreenControls from "./ScreenControls";
import VirusControls from "./VirusControls";
import "../CSS/index.css";

export default function LiveSim() {
  const canvasRef = useRef(null);

  const simBufRef = useRef(null);
  const popResRef = useRef(null);
  const maxPopRef = useRef(1);

  const startedRef = useRef(false);
  const rafIdRef = useRef(null);
  const listenersAddedRef = useRef(false);

  // WebRTC refs
  const signalingWsRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const myIdRef = useRef(null);
  const peerIdRef = useRef(null);
  
  // Frame reassembly state
  const currentFrameRef = useRef(null);
  const receivedChunksRef = useRef([]);
  const expectedChunksRef = useRef(0);
  const expectingHeaderRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  const BASE_W = 1440;
  const BASE_H = 720;

  const [controls, setControls] = useState({
    drawStep: 2,
    globalMultiplier: 0.9,
    compressExp: 0.7,
    percentileCap: 0.95,
    minRadius: 0.1,
    maxRadius: 0.9,
  });

  // which panel is open: 'virus' | 'screen' | null — only one at a time
  const [openPanel, setOpenPanel] = useState(null);

  const togglePanel = (panel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  const drawStepRef = useRef(controls.drawStep);
  const globalMultRef = useRef(controls.globalMultiplier);
  const compressExpRef = useRef(controls.compressExp);
  const percentileCapRef = useRef(controls.percentileCap);
  const minRadiusRef = useRef(controls.minRadius);
  const maxRadiusRef = useRef(controls.maxRadius);

  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let mounted = true;

    const cleanupAll = () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      
      // Clean up WebRTC
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (signalingWsRef.current) {
        signalingWsRef.current.close();
        signalingWsRef.current = null;
      }
      
      const canvas = canvasRef.current;
      if (canvas && listenersAddedRef.current) {
        canvas.removeEventListener("wheel", onWheel);
        listenersAddedRef.current = false;
      }
    };

    const loadPopulation = async () => {
      try {
        const tiff = await fromUrl("/population.tif");
        const img = await tiff.getImage();
        const w = img.getWidth();
        const h = img.getHeight();
        const ras = await img.readRasters({ interleave: true });

        const spp = ras.length / (w * h);
        const full = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          full[i] = ras[i * spp] ?? 0;
        }

        const out = new Float32Array(BASE_W * BASE_H);
        for (let y = 0; y < BASE_H; y++) {
          const sy = Math.floor((y / BASE_H) * h);
          const rowBase = sy * w;
          const outRow = y * BASE_W;
          for (let x = 0; x < BASE_W; x++) {
            const sx = Math.floor((x / BASE_W) * w);
            out[outRow + x] = full[rowBase + sx] ?? 0;
          }
        }

        popResRef.current = out;

        const tmp = Array.from(out).sort((a, b) => a - b);
        const capIndex = Math.floor(tmp.length * percentileCapRef.current);
        let cap = tmp[capIndex] || 1;
        if (!isFinite(cap) || cap <= 0) cap = 1;
        maxPopRef.current = cap;

        if (mounted) setLoading(false);
      } catch (err) {
        if (mounted) {
          setError(err.message || String(err));
          setLoading(false);
        }
      }
    };

    const reassembleFrame = () => {
      const totalSize = receivedChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
      const completeData = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of receivedChunksRef.current) {
        completeData.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Update simBufRef with the complete frame
      if (completeData.length === BASE_W * BASE_H * 3) {
        simBufRef.current = completeData;
      }
      
      receivedChunksRef.current = [];
    };

    const handleOffer = async (senderId, offer) => {
      peerConnectionRef.current = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          {
            urls: 'turn:a.relay.metered.ca:80',
            username: 'e15c82c8b0e19f31acf2ae9a',
            credential: 'Bwp0MQdJDGMl1Yct',
          },
          {
            urls: 'turn:a.relay.metered.ca:443',
            username: 'e15c82c8b0e19f31acf2ae9a',
            credential: 'Bwp0MQdJDGMl1Yct',
          }
        ],
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 10
      });

      peerConnectionRef.current.oniceconnectionstatechange = () => {
        console.log('ICE State:', peerConnectionRef.current.iceConnectionState);
        if (peerConnectionRef.current.iceConnectionState === 'connected') {
          setConnectionStatus('Connected');
        } else if (peerConnectionRef.current.iceConnectionState === 'failed') {
          setConnectionStatus('Connection failed');
          peerConnectionRef.current.restartIce();
        }
      };

      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log('Connection State:', peerConnectionRef.current.connectionState);
        if (peerConnectionRef.current.connectionState === 'failed') {
          setConnectionStatus('Connection failed');
        }
      };
      
      peerConnectionRef.current.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
        dataChannelRef.current.binaryType = 'arraybuffer';
        
        dataChannelRef.current.onopen = () => {
          console.log('Data channel opened - receiving frames');
          setConnectionStatus('Receiving data');
        };
        
        dataChannelRef.current.onmessage = (event) => {
          const data = event.data;
          
          if (expectingHeaderRef.current) {
            const header = new Uint32Array(data);
            const frameNum = header[0];
            const chunkIndex = header[1];
            const totalChunks = header[2];
            
            if (currentFrameRef.current !== frameNum) {
              if (receivedChunksRef.current.length > 0) {
                reassembleFrame();
              }
              currentFrameRef.current = frameNum;
              receivedChunksRef.current = [];
              expectedChunksRef.current = totalChunks;
            }
            
            expectingHeaderRef.current = false;
          } else {
            receivedChunksRef.current.push(new Uint8Array(data));
            
            if (receivedChunksRef.current.length === expectedChunksRef.current) {
              reassembleFrame();
            }
            
            expectingHeaderRef.current = true;
          }
        };
        
        dataChannelRef.current.onclose = () => {
          console.log('Data channel closed');
          setConnectionStatus('Connection closed');
        };
      };
      
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && signalingWsRef.current) {
          signalingWsRef.current.send(JSON.stringify({
            type: 'ice-candidate',
            target: senderId,
            payload: event.candidate
          }));
        }
      };
      
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      if (signalingWsRef.current) {
        signalingWsRef.current.send(JSON.stringify({
          type: 'answer',
          target: senderId,
          payload: answer
        }));
      }
    };

    const connectWebRTC = () => {
      const serverUrl = 'wss://epidemicsimulationsandbox-7fj1.onrender.com/';
      
      console.log('Connecting to signaling server...');
      setConnectionStatus('Connecting...');
      
      signalingWsRef.current = new WebSocket(serverUrl);
      
      signalingWsRef.current.onopen = () => {
        console.log('Connected to signaling server');
        setConnectionStatus('Waiting for sender...');
      };
      
      signalingWsRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'id') {
          myIdRef.current = data.id;
          console.log('My ID:', myIdRef.current);
          
          signalingWsRef.current.send(JSON.stringify({
            type: 'register',
            role: 'receiver'
          }));
          console.log('Registered as receiver');
        } else if (data.type === 'waiting') {
          console.log('Waiting for sender...');
          setConnectionStatus('Waiting for sender...');
        } else if (data.type === 'paired') {
          peerIdRef.current = data.peerId;
          console.log('Paired with sender:', peerIdRef.current);
          setConnectionStatus('Paired - establishing connection...');
        } else if (data.type === 'offer') {
          console.log('Received offer from sender');
          await handleOffer(data.from, data.payload);
        } else if (data.type === 'ice-candidate') {
          if (peerConnectionRef.current && data.payload) {
            await peerConnectionRef.current.addIceCandidate(data.payload);
          }
        }
      };
      
      signalingWsRef.current.onerror = (err) => {
        console.error('Signaling error:', err);
        setConnectionStatus('Connection error');
      };
      
      signalingWsRef.current.onclose = () => {
        console.log('Disconnected from signaling server');
        setConnectionStatus('Disconnected - reconnecting...');
        
        setTimeout(() => {
          if (mounted) {
            console.log('Attempting to reconnect...');
            connectWebRTC();
          }
        }, 3000);
      };
    };

    const startDrawLoop = () => {
      if (startedRef.current) return;
      startedRef.current = true;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      canvas.width = BASE_W;
      canvas.height = BASE_H;

      const drawFrame = () => {
        const simBuf = simBufRef.current;
        const popArr = popResRef.current;

        if (simBuf && popArr) {
          ctx.save();
          ctx.clearRect(0, 0, BASE_W, BASE_H);

          const z = zoomRef.current;
          const off = offsetRef.current;
          ctx.setTransform(z, 0, 0, z, off.x, off.y);

          const maxPop = maxPopRef.current;
          const minR = minRadiusRef.current * globalMultRef.current;
          const maxR = maxRadiusRef.current * globalMultRef.current;
          const compExp = compressExpRef.current;
          const step = drawStepRef.current || 1;

          for (let y = 0; y < BASE_H; y += step) {
            for (let x = 0; x < BASE_W; x += step) {
              const ix = Math.floor(x);
              const iy = Math.floor(y);
              const idx = iy * BASE_W + ix;

              const p = popArr[idx];
              if (!p) continue;

              let norm = Math.log(p + 1) / Math.log(maxPop + 1);
              if (!isFinite(norm) || norm <= 0) norm = 0;

              const comp = Math.pow(norm, compExp);
              const r = minR + comp * (maxR - minR);

              const R = simBuf[idx * 3];
              const G = simBuf[idx * 3 + 1];
              const B = simBuf[idx * 3 + 2];

              ctx.fillStyle = `rgb(${R},${G},${B})`;
              ctx.beginPath();
              ctx.arc(ix + 0.5, iy + 0.5, r, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          ctx.restore();
        }

        rafIdRef.current = requestAnimationFrame(drawFrame);
      };

      rafIdRef.current = requestAnimationFrame(drawFrame);
    };

    const MIN_ZOOM = 1;
    const MAX_ZOOM = 20;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const prevZoom = zoomRef.current;
      const factor = Math.exp(-e.deltaY * 0.001);
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * factor));
      const scale = newZoom / prevZoom;

      offsetRef.current.x = mx - (mx - offsetRef.current.x) * scale;
      offsetRef.current.y = my - (my - offsetRef.current.y) * scale;
      zoomRef.current = newZoom;
    };

    (async function init() {
      await loadPopulation();
      if (!mounted) return;

      startDrawLoop();
      connectWebRTC(); // Start WebRTC connection

      const canvas = canvasRef.current;
      if (!listenersAddedRef.current) {
        canvas.addEventListener("wheel", onWheel, { passive: false });
        listenersAddedRef.current = true;
      }
    })();

    return () => {
      mounted = false;
      cleanupAll();
    };
  }, []);

  const handleControlChange = (key, value) => {
    setControls((prev) => ({ ...prev, [key]: value }));
    switch (key) {
      case "drawStep":
        drawStepRef.current = value;
        break;
      case "globalMultiplier":
        globalMultRef.current = value;
        break;
      case "compressExp":
        compressExpRef.current = value;
        break;
      case "percentileCap":
        percentileCapRef.current = value;
        if (popResRef.current) {
          const arr = Array.from(popResRef.current).sort((a, b) => a - b);
          const capIndex = Math.floor(arr.length * value);
          let cap = arr[capIndex] || 1;
          if (!isFinite(cap) || cap <= 0) cap = 1;
          maxPopRef.current = cap;
        }
        break;
      case "minRadius":
        minRadiusRef.current = value;
        break;
      case "maxRadius":
        maxRadiusRef.current = value;
        break;
      default:
        break;
    }
  };

  const start = () => {
    if (!startedRef.current) startDrawLoop();
  };

  const pause = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      startedRef.current = false;
    }
  };

  const resetView = () => {
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
  };

  return (
    <div className="live-sim-container">
      <div className="live-sim-status">
        {loading && (
          <p className="live-sim-loading">Loading population data…</p>
        )}
        {error && <p className="live-sim-error">Error: {error}</p>}
        <p className="live-sim-connection-status">
          WebRTC Status: {connectionStatus}
        </p>
      </div>

      <div className="live-sim-row">
        <div className={`live-sim-controls-wrapper left ${openPanel ? 'expanded' : 'collapsed'}`}>
          <div className="panel-header stacked">
            <button
              className="panel-toggle"
              onClick={() => togglePanel('virus')}
              aria-expanded={openPanel === 'virus'}
              aria-controls="virus-panel"
            >
              Virus
            </button>

            <button
              className="panel-toggle"
              onClick={() => togglePanel('screen')}
              aria-expanded={openPanel === 'screen'}
              aria-controls="screen-panel"
            >
              Screen
            </button>
          </div>

          {openPanel === 'virus' && (
            <div id="virus-panel">
              <VirusControls values={controls} />
            </div>
          )}

          {openPanel === 'screen' && (
            <div id="screen-panel">
              <ScreenControls
                values={controls}
                onChange={handleControlChange}
                onStart={start}
                onPause={pause}
                onReset={resetView}
              />
            </div>
          )}
        </div>

        <div className="live-sim-canvas-wrapper center">
          <canvas
            ref={canvasRef}
            className={`live-sim-canvas ${loading || error ? 'hidden' : ''}`}
          />
        </div>
      </div>
    </div>
  );
}