import React from 'react';
import './CSS/index.css';

export default function LiveSim() {
  return (
    <img
      src="http://localhost:5001/live_frame"
      alt="SimulationVisual"
      className="live-sim-image"
      onError={(e) => {
        e.target.onerror = null
        e.target.src = 'WakaWakaMeme.png'
      }}
    />
  );
}
