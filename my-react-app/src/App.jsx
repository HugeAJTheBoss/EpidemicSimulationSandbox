import { useState } from "react";

function App() {
  const [ping, setPing] = useState(null);
  const [population, setPopulation] = useState(null);
  const [loading, setLoading] = useState(false);

  async function doPing() {
    setLoading(true);
    try {
  const res = await fetch("http://localhost:5001/api/ping");
      const json = await res.json();
      setPing(json);
    } catch (e) {
      setPing({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  async function runPopulation() {
    setLoading(true);
    try {
  const res = await fetch("http://localhost:5001/api/run_population", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: 10, cols: 10 }),
      });
      const json = await res.json();
      setPopulation(json);
    } catch (e) {
      setPopulation({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto" }}>
      <h1 style={{ textAlign: "center", color: "dodgerblue" }}>Epidemic Simulator Sandbox</h1>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
        <button onClick={doPing} disabled={loading}>
          Ping backend
        </button>
        <button onClick={runPopulation} disabled={loading}>
          Run population sim (mock)
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <section>
          <h3>Ping result</h3>
          <pre style={{ background: "#f6f8fa", padding: 12 }}>{JSON.stringify(ping, null, 2)}</pre>
        </section>

        <section>
          <h3>Population result (first 5 rows)</h3>
          <pre style={{ background: "#f6f8fa", padding: 12, overflowX: "auto" }}>
            {population ? JSON.stringify(population, null, 2) : "No data yet"}
          </pre>
        </section>
      </div>
    </div>
  );
}

export default App;
