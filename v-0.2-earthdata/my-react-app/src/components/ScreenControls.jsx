import React from "react";

export default function ScreenControls({
  values,
  onChange,
  onStart,
  onPause,
  onScreenReset,
}) {
  return (
    <div className="controls-panel">
      <h3 className="controls-title">Visual Controls</h3>

      <div className="control-group">
        <label className="control-label">
          Draw Step: {values.drawStep}
        </label>
        <input
          className="control-slider"
          type="range"
          min={0.5}
          max={8}
          step={0.1}
          value={values.drawStep}
          onChange={(e) =>
            onChange("drawStep", Number(e.target.value))
          }
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Global Size: {values.globalMultiplier.toFixed(2)}
        </label>
        <input
          className="control-slider"
          type="range"
          min={0.2}
          max={2}
          step={0.01}
          value={values.globalMultiplier}
          onChange={(e) =>
            onChange("globalMultiplier", Number(e.target.value))
          }
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Compress Exp: {values.compressExp.toFixed(2)}
        </label>
        <input
          className="control-slider"
          type="range"
          min={0.4}
          max={1.5}
          step={0.01}
          value={values.compressExp}
          onChange={(e) =>
            onChange("compressExp", Number(e.target.value))
          }
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Min Radius: {values.minRadius.toFixed(2)}
        </label>
        <input
          className="control-slider"
          type="range"
          min={0.01}
          max={0.5}
          step={0.01}
          value={values.minRadius}
          onChange={(e) =>
            onChange("minRadius", Number(e.target.value))
          }
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Max Radius: {values.maxRadius.toFixed(2)}
        </label>
        <input
          className="control-slider"
          type="range"
          min={0.2}
          max={3}
          step={0.05}
          value={values.maxRadius}
          onChange={(e) =>
            onChange("maxRadius", Number(e.target.value))
          }
        />
      </div>

      <div className="controls-buttons">
        <button className="control-btn" onClick={onStart}>
          Start
        </button>
        <button className="control-btn" onClick={onPause}>
          Pause
        </button>
        <button className="control-btn" onClick={onScreenReset}>
          Reset
        </button>
      </div>
    </div>
  );
}