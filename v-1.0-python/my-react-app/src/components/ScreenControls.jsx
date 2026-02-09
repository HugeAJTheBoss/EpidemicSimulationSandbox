import React from "react";

export default function ScreenControls(props) {
  const {
    values,
    onChange,
    onStart,
    onPause,
    onScreenReset,
  } = props;

  const num = (v) => Number(v);
  //all of the sliders. we had repetitive structure to make the code more readable
  //The slider values initially are just what we thought looked the best, but the good thing is that the user can change everything to suit their needs
  //controls how the sim looks (dot size, pixelation, etc.)
  //completely finished part of the project! This doesn't need to connect to the backend.
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
          min="1"
          max="8"
          step="1"
          value={values.drawStep}
          onChange={(e) => onChange("drawStep", num(e.target.value))}
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Global Size: {values.globalMultiplier.toFixed(2)}
        </label>
        <input
          className="control-slider"
          type="range"
          min="0.2"
          max="2"
          step="0.01"
          value={values.globalMultiplier}
          onChange={(e) =>
            onChange("globalMultiplier", num(e.target.value))
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
          min="0.4"
          max="1.5"
          step="0.01"
          value={values.compressExp}
          onChange={(e) => onChange("compressExp", +e.target.value)}
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Min Radius: {values.minRadius.toFixed(2)}
        </label>
        <input
          className="control-slider"
          type="range"
          min="0.01"
          max="0.4"
          step="0.01"
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
          min="0.5"
          max="3"
          step="0.05"
          value={values.maxRadius}
          onChange={(e) => onChange("maxRadius", +e.target.value)}
        />
      </div>

      <div className="controls-buttons">
        <button className="control-btn" onClick={onStart}>
          Start
        </button>
        <button className="control-btn" onClick={onPause}>
          Pause
        </button>
        <button className="control-btn" onClick={() => onScreenReset()}>
          Reset
        </button>
      </div>
    </div>
    // Start/Pause buttons now control the WebRTC EarthData receiver. Reset button resets visual controls.
  );
}