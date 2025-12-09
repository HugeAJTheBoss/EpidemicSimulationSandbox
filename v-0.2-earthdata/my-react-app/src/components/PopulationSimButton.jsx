
import React from "react";
import "../CSS/Index.css";

export default function PopulationSimButton({ label = "Population Sim" }) {
  return (
    <button className="population-sim-btn">
      {label}
      <span className="glow"></span>
    </button>
  );
}
