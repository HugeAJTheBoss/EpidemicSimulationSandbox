# EpidemicSimulationSandbox
Passion Project for Advanced Computer Science at Mass Academy of Math and Science

# Instructions for Backend

The folder v-0.x-title/backend contains a minimal Flask backend that either calls MATLAB via matlab.engine (if installed) or returns mock data for frontend development.

Quick start (macOS zsh):

1. Create a Python virtual environment and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Run the server:

```bash
export FLASK_APP=app.py
flask run --host=0.0.0.0 --port=5001
```

Smoke test:

```bash
# (optional) install requests in the venv
pip install requests
python test_ping.py
```

MATLAB Engine for Python notes:
- To use the real MATLAB integration, install the MATLAB Engine API for Python that matches your MATLAB installation. Follow MathWorks instructions; typical steps:
  1. From your MATLAB installation folder, run: `cd "matlabroot/extern/engines/python"` then `python -m pip install .` (replace python with the venv python if using a virtualenv).
  2. Verify from the Python REPL `import matlab.engine; eng = matlab.engine.start_matlab(); eng.run_population_sim(10,10)` (you may need to add the `backend/matlab` folder to MATLAB path so it can find `run_population_sim.m`).

Notes:
- Current endpoints:
  - `GET /api/ping` — returns server status and whether MATLAB engine is available
  - `POST /api/run_population` — accepts JSON {rows, cols} and returns a mock population matrix when MATLAB is unavailable
  - `POST /api/run_person` — accepts JSON {steps} and returns a mock timeline when MATLAB is unavailable
