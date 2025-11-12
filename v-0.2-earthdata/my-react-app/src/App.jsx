import React from "react";
import SimulationContainer from "./components/SimulationContainer";
import "./CSS/index.css";

function App() {
  return (
    <div>
      <h1 className="title">Epidemic Sandbox Simulator</h1>
      <SimulationContainer />
    </div>
  );
}

export default App;
