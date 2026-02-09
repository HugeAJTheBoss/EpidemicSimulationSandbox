import React, { useCallback, useMemo } from "react";
import VirusIcon from "./VirusIcon";
//This is all of the sliders for controlling the virus!
export const DEFAULTS = {
  spread: 0.5,
  sicken: 0.5,
  recovery: 0.2,
  immunityLoss: 0.2,
  fatality: 0.1,
  contagiousness: 0.5,
  // these are the variables for controlling the virus. Arbitrary values right now that will be fine tuned.
  //These have to be sent back to the back end when updated but that's gonna be done in the future
  //For now, these change how the virus looks
};

export default function VirusControls(props) {
  const { values = DEFAULTS, onChange, onVirusReset } = props;

  const setVal = useCallback(
    (k, v) => {
      onChange && onChange(k, v);
    },
    [onChange]
  );
//reset button!
  const resetAll = () => {
    onVirusReset && onVirusReset();
  };

  const iconProps = useMemo(() => {
    return {
      spread: values.spread,
      sicken: values.sicken,
      recovery: values.recovery,
      immunityLoss: values.immunityLoss,
      fatality: values.fatality,
      contagiousness: values.contagiousness,
    };
  }, [
    values.spread,
    values.sicken,
    values.recovery,
    values.immunityLoss,
    values.fatality,
    values.contagiousness,
  ]);

  const pct = (v) => Math.round(v * 100);


//all of the sliders. we had repetitive structure to make the code more readable
  return (
    <div className="controls-panel virus-controls">
      <h3 className="controls-title">Virus Controls</h3>
      
      <div className="control-group">
        <label className="control-label">
          Spread Rate: {pct(values.spread)}%
        </label>
        <input
          className="control-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={values.spread}
          onChange={(e) => setVal("spread", +e.target.value)}
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Sicken Rate: {pct(values.sicken)}%
        </label>
        <input
          className="control-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={values.sicken}
          onChange={(e) => setVal("sicken", +e.target.value)}
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Recovery Rate: {pct(values.recovery)}%
        </label>
        <input
          className="control-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={values.recovery}
          onChange={(e) => setVal("recovery", +e.target.value)}
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Immunity Loss Rate: {pct(values.immunityLoss)}%
        </label>
        <input
          className="control-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={values.immunityLoss}
          onChange={(e) => setVal("immunityLoss", +e.target.value)}
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Fatality Rate: {pct(values.fatality)}%
        </label>
        <input
          className="control-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={values.fatality}
          onChange={(e) => setVal("fatality", +e.target.value)}
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          Contagiousness: {pct(values.contagiousness)}%
        </label>
        <input
          className="control-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={values.contagiousness}
          onChange={(e) =>
            setVal("contagiousness", +e.target.value)
          }
        />
      </div>

      <div
        style={{
          padding: 12,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <VirusIcon size={220} {...iconProps} />
      </div>
      
      <div className="controls-buttons">
        <button className="control-btn" onClick={resetAll}>
          Reset
        </button>
      </div>
    </div>
  );
}