
import React, { useState } from "react";
import PopulationSimButton from "./PopulationSimButton";
import LiveSim from "./LiveSim";

export default function SimulationContainer() {
  const [showSim, setShowSim] = useState(false);

  const handleButtonClick = () => {
    setShowSim(prev => !prev);
  };

  return (
    <div className="centered">
      <div onClick={handleButtonClick}>
        <PopulationSimButton label={showSim ? "Hide Simulation" : "Population Sim"} />
      </div>

      {showSim && (
        <div className="centered fade-in">
          <LiveSim />
        </div>
      )}
    </div>
  );
}
