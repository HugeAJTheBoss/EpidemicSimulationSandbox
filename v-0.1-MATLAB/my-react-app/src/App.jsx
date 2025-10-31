import { useState } from "react";

/*
  App.jsx - Epidemic Simulator Sandbox (Frontend)

  Overview:
  - This file implements a single React component (App) that provides a
    lightweight UI for running the population-level MATLAB-backed simulation
    (via the Flask backend) and visualizing the results as a heatmap grid.

  Key responsibilities:
  - Provide UI controls to trigger the simulation (Run population sim).
  - Call the backend `/api/run_population` endpoint and parse its JSON response.
  - Normalize different response shapes (some payloads are nested under `result`).
  - Convert a flat 1D population array into a 2D grid when necessary.

  - Keep network calls async using fetch + await.
  - The UI stores a minimal state and derives the visual grid from `population.grid`.
  - Styling and sizes are controlled in `src/index.css` using CSS variables (e.g. --cell-size).
*/

/*
  reshapeFlat
  - Utility to take a flat 1D array `pop` and reshape it into a rows x cols 2D
    array. The backend sometimes returns a flattened population (e.g. [a,b,c,...])
    so we convert it to [[row0], [row1], ...] for the grid renderer.
  - Returns null if the input is not an array.
*/
function reshapeFlat(pop, rows, cols) {
  if (!Array.isArray(pop)) return null;
  const grid = [];
  for (let r = 0; r < rows; r++) {
    // slice produces a shallow copy of each row slice
    grid.push(pop.slice(r * cols, (r + 1) * cols));
  }
  return grid;
}

function App() {
  // population: null or object with keys:
  //  - raw: original parsed payload (object)
  //  - grid: 2D array [[cell,...], ...] ready for rendering
  //  - rows, cols: numeric shape hints
  const [population, setPopulation] = useState(null); // { raw, grid, rows, cols }
  // loading: whether a network operation is in progress (used to disable buttons)
  const [loading, setLoading] = useState(false);
  // error: last error message (string) to display to the user
  const [error, setError] = useState(null);

  /*
    runPopulation
    - Calls the backend POST /api/run_population to request a population simulation.
    - The backend may return different shapes so the function is defensive:
      * It looks for `result.population` (common) or `population` at the top-level.
      * It extracts `rows` and `cols` if present; otherwise it tries to infer shape.
    - The goal is to end with `population.grid` set to a 2D array for rendering.
    - Error handling: any network or parsing error sets `error` state so the UI can show a message.
  */
  async function runPopulation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:5001/api/run_population", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: 10, cols: 10 }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`status ${res.status}: ${txt}`);
      }
      const json = await res.json();

      // Normalize different shapes into a consistent { raw, grid, rows, cols }
      let raw = json;
      let pop = null;
      let rows = null;
      let cols = null;

      // Common backend shapes:
      // - { success:true, result: { rows, cols, population: ... } }
      // - { success:true, population: ..., rows, cols }
      if (json.result && json.result.population) {
        raw = json.result;
        pop = json.result.population;
        rows = json.result.rows || null;
        cols = json.result.cols || null;
      } else if (json.population) {
        raw = json;
        pop = json.population;
        rows = json.rows || null;
        cols = json.cols || null;
      } else if (json.result && json.result.rows && json.result.cols && json.result.population) {
        raw = json.result;
        pop = json.result.population;
        rows = json.result.rows;
        cols = json.result.cols;
      }

      let grid = null;
      if (Array.isArray(pop)) {
        // If it's already a 2D array (first element is array), accept it
        if (Array.isArray(pop[0])) {
          grid = pop;
          rows = rows || grid.length;
          cols = cols || (grid[0] && grid[0].length) || null;
        } else if (rows && cols) {
          // Convert flattened array to 2D using provided rows/cols
          grid = reshapeFlat(pop, rows, cols);
        } else {
          // Last resort: attempt to guess a square shape, or show the first 50 elements
          const n = Math.sqrt(pop.length);
          if (Number.isInteger(n)) grid = reshapeFlat(pop, n, n);
          else grid = [pop.slice(0, 50)];
        }
      }

      setPopulation({ raw, grid, rows, cols });
    } catch (e) {
      setPopulation(null);
      setError(String(e));
      console.error('runPopulation error', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-root">
      <div className="app-container">
        <header className="app-header">
          <h1 className="app-title">Epidemic Simulator Sandbox</h1>
          <p className="app-sub">Local MATLAB-powered simulations, fast iteration.</p>
        </header>

        <div className="controls">
          <button className="btn primary" onClick={runPopulation} disabled={loading}>
            {loading ? 'Working...' : 'Run population sim'}
          </button>
        </div>

  <main className="cards">
          <section className="card centered">
            <h3>Population (visual preview)</h3>
            {error && <div className="error">{error}</div>}

            {population && population.grid ? (
              <div>
                <div className="meta">Shape: {population.rows || population.grid.length} × {population.cols || (population.grid[0] && population.grid[0].length)}</div>
                <div
                  className="population-grid"
                  style={{ gridTemplateColumns: `repeat(${population.cols || (population.grid[0] && population.grid[0].length) || 50}, var(--cell-size))` }}
                >
                  {(() => {
                    const flat = [];
                    for (const row of population.grid) {
                      for (const cell of row) flat.push(cell);
                    }
                    // compute min/max for heatmap
                    const vals = flat.filter(v => typeof v === 'number');
                    const min = vals.length ? Math.min(...vals) : 0;
                    const max = vals.length ? Math.max(...vals) : 1;
                    return flat.map((val, i) => {
                      const normalized = (typeof val === 'number') ? ((val - min) / (max - min || 1)) : 0;
                      // interpolate hue between 200 (cool) and 10 (hot)
                      const hue = 200 - normalized * 190; // 200 -> 10
                      const lightness = 30 + normalized * 30; // 30% -> 60%
                      const bg = '#008000'
                      const color = '#061422'
                      return (
                        <div key={i} className="cell" title={String(val)} style={{ background: bg, color }}>
                          <div className="cell-val">{String(val)}</div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Raw preview removed — simplified UI for end users */}
              </div>
            ) : (
              <div className="empty">No data yet — run the sim to see a preview.</div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;

// for running, in .venv: export PORT=5001, python3 "/Users/hugeajtheboss/Documents/MAMS_CS_PASSION/EpidemicSimulationSandbox/v-0.1-MATLAB/backend/app.py"
//new terminal; npm run dev from myreactapp