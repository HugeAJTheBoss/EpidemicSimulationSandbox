import React from "react";

export default function VirusControls({
  values,
  onChange,
  onStart,
  onPause,
  onReset,
}) {
  return (
    <div className="controls-panel virus-controls">
      <h3 className="controls-title">Virus Controls</h3>

      <div className="control-group">
        <label className="control-label">
          Placeholder: {}
        </label>
        <input
          className="control-slider"
          type="range"
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Placeholder: {}
        </label>
        <input
          className="control-slider"
          type="range"
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Placeholder: {}
        </label>
        <input
          className="control-slider"
          type="range"
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Placeholder: {}
        </label>
        <input
          className="control-slider"
          type="range"
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Placeholder: {}
        </label>
        <input
          className="control-slider"
          type="range"
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Placeholder: {}
        </label>
        <input
          className="control-slider"
          type="range"
        />
      </div>

      <div className="controls-buttons">
        <button className="control-btn" disabled>
          Reset
        </button>
      </div>
    </div>
  );
}