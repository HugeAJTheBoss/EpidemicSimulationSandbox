import React, { useCallback, useMemo, useState } from "react";
import VirusIcon from "./VirusIcon";

const DEFAULTS = {
  spread: 0.5,
  sicken: 0.5,
  recovery: 0.2,
  immunityLoss: 0.2,
  fatality: 0.1,
  contagiousness: 0.5,
};

export default function VirusControls({ onVirusReset }) {
  const [vals, setVals] = useState(DEFAULTS);

  const set = useCallback((k, v) => setVals((p) => ({ ...p, [k]: v })), []);

  const handleReset = () => {
    setVals(DEFAULTS);
    if (onVirusReset) onVirusReset();
  };

  const iconProps = useMemo(() => ({ ...vals }), [vals]);

  return (
    <div className="controls-panel virus-controls">
      <h3 className="controls-title">Virus Controls</h3>

      <div className="control-group">
        <label className="control-label">Spread Rate: {Math.round(vals.spread * 100)}%</label>
        <input className="control-slider" type="range" min={0} max={1} step={0.01} value={vals.spread}
          onChange={(e) => set('spread', Number(e.target.value))} />
      </div>

      <div className="control-group">
        <label className="control-label">Sicken Rate: {Math.round(vals.sicken * 100)}%</label>
        <input className="control-slider" type="range" min={0} max={1} step={0.01} value={vals.sicken}
          onChange={(e) => set('sicken', Number(e.target.value))} />
      </div>

      <div className="control-group">
        <label className="control-label">Recovery Rate: {Math.round(vals.recovery * 100)}%</label>
        <input className="control-slider" type="range" min={0} max={1} step={0.01} value={vals.recovery}
          onChange={(e) => set('recovery', Number(e.target.value))} />
      </div>

      <div className="control-group">
        <label className="control-label">Immunity Loss Rate: {Math.round(vals.immunityLoss * 100)}%</label>
        <input className="control-slider" type="range" min={0} max={1} step={0.01} value={vals.immunityLoss}
          onChange={(e) => set('immunityLoss', Number(e.target.value))} />
      </div>

      <div className="control-group">
        <label className="control-label">Fatality Rate: {Math.round(vals.fatality * 100)}%</label>
        <input className="control-slider" type="range" min={0} max={1} step={0.01} value={vals.fatality}
          onChange={(e) => set('fatality', Number(e.target.value))} />
      </div>

      <div className="control-group">
        <label className="control-label">Contagiousness: {Math.round(vals.contagiousness * 100)}%</label>
        <input className="control-slider" type="range" min={0} max={1} step={0.01} value={vals.contagiousness}
          onChange={(e) => set('contagiousness', Number(e.target.value))} />
      </div>

      <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}>
        <VirusIcon {...iconProps} size={220} />
      </div>

      <div className="controls-buttons">
        <button className="control-btn" onClick={handleReset}>Reset</button>
      </div>
    </div>
  );
}