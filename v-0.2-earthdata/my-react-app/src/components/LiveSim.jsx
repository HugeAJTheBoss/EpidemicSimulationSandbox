import React from 'react';
import '../CSS/index.css';

export default function LiveSim() {
  return (
    <img
      src="http://localhost:5000/frame"
      alt="SimulationVisual"
      className="rounded-corners"
      onError={(e) => {
        e.target.onerror = null;
        e.target.src = 'tanayrequest.jpg';
      }}
    />
  );
}
