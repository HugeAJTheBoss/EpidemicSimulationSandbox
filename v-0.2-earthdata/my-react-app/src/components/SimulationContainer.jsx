
import React from "react";
import LiveSim from "./LiveSim";

// Simple wrapper component to center the `LiveSim` canvas and related controls.
// Kept intentionally thin so layout concerns stay separate from simulation logic.
// Kind of redundant but oh well
// We might remove this in the future for simplifying things
export default function SimulationContainer() {
  return (
    <div className="centered fade-in">
      <LiveSim />
    </div>
  );
}
