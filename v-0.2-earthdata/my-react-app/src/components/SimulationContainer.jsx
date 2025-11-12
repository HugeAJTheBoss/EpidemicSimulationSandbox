import React, { useState } from "react";
import PopulationSimButton from "./PopulationSimButton";
import LiveSim from "./LiveSim";

export default function SimulationContainer() {
  const [showSim, setShowSim] = useState(false);

  const handleClick = () => {
    setShowSim((prev) => !prev);
  };

  return (
    <div className="centered">
      <PopulationSimButton
        label={showSim ? "Hide Simulation" : "Run Population Sim"}
        onClick={handleClick}
      />
      {showSim && <LiveSim />}
    </div>
  );
}
