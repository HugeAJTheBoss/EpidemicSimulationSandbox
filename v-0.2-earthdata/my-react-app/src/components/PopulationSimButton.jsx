import React from "react";
import "../CSS/index.css";

export default function PopulationSimButton({ label = "Population Sim", onClick }) {
  return (
    <button className="population-sim-btn" onClick={onClick}>
      {label}
      <span className="glow"></span>
    </button>
  );
}
