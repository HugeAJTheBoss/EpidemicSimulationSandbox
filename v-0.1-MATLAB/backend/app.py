"""
Backend Flask application for the Epidemic Simulator Sandbox.

Overview for new developers:
- This Flask app exposes REST endpoints that the React frontend calls.
- It attempts to call MATLAB simulation wrapper functions via the MATLAB
    Engine for Python (if installed). When the MATLAB engine is not available,
    the app falls back to lightweight mock data so the UI can be developed
    without MATLAB.

Important files:
- `matlab/` folder: contains MATLAB wrapper functions (e.g., run_population_sim.m)
- `requirements.txt`: lists Flask and flask-cors; the MATLAB engine must be
    installed from the MATLAB distribution (not pip).

How it works at runtime:
- The app lazily imports and starts the MATLAB engine only when a request
    that needs MATLAB arrives. This avoids starting MATLAB during unit tests
    or when it isn't available.

Run locally (zsh):
    source /path/to/backend/.venv/bin/activate
    export PORT=5001
    python3 app.py
"""

from flask import Flask, jsonify, request
import logging
import os
from pathlib import Path

# Optional CORS (dev-friendly). We try to import but don't make it a hard
# dependency — this keeps the app lightweight when CORS is not needed.
try:
    from flask_cors import CORS
except Exception:  # pragma: no cover - optional dependency
    CORS = None

app = Flask(__name__)
if CORS:
    # Enable CORS only if flask_cors is available
    CORS(app)

# Configure basic logging for the backend. New developers can increase
# verbosity by changing the level or hooking a file handler.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('backend')

# MATLAB engine availability (lazy start)
# Flags & handles for MATLAB engine integration. We do a runtime import here
# because the MATLAB Engine for Python is not always installed in dev venvs.
MATLAB_AVAILABLE = False
matlab = None
matlab_eng = None
try:
    # `matlab.engine` is provided by MATLAB's Python engine package (installed
    # from the MATLAB distribution under extern/engines/python). Import may
    # fail if MATLAB is not installed or the engine wasn't installed into the
    # active venv — that's expected in many development setups.
    import matlab.engine  # type: ignore[import]
    matlab = matlab.engine
    MATLAB_AVAILABLE = True
except Exception:  # pragma: no cover
    matlab = None
    MATLAB_AVAILABLE = False


# /api/ping removed: not necessary for end users. Use /api/status for diagnostics.


@app.route('/api/status')
def status():
        """
        /api/status
        - Lightweight diagnostics endpoint useful for developers and debugging.
        - Returns whether the MATLAB engine is available and lists wrapper files
            present in the `matlab/` folder so it's easy to verify the environment.
        - This endpoint is safe to expose (no sensitive data) but primarily
            intended for local development.
        """
        wrapper_dir = Path(__file__).resolve().parent / 'matlab'
        files = []
        if wrapper_dir.exists() and wrapper_dir.is_dir():
                files = [p.name for p in sorted(wrapper_dir.iterdir()) if p.is_file()]
        return jsonify({'matlab': MATLAB_AVAILABLE, 'wrapper_dir': str(wrapper_dir), 'files': files})


@app.route('/api/run_population', methods=['POST'])
def run_population():
    data = request.get_json() or {}
    # Accept optional params; fall back to defaults in MATLAB script
    rows = int(data.get('rows', 50))
    cols = int(data.get('cols', 50))

    def _normalize_and_return(rows, cols, population, mock=False, extra=None):
        """Ensure population is a 2D list and return standard JSON structure.

        Returns Flask JSON response: {'success': True, 'result': {rows, cols, population, mock, ...}}
        """
        # Defensive normalization:
        # - If 'population' is already a 2D list (list of lists) accept it.
        # - If it's a flat list, try to reshape using provided rows/cols.
        # - If anything goes wrong, fall back to a grid filled with None.
        try:
            if population and isinstance(population[0], list):
                grid = population
            else:
                flat = list(population) if population is not None else []
                grid = [flat[i * cols:(i + 1) * cols] for i in range(rows)]
        except Exception:
            grid = [[None for _ in range(cols)] for _ in range(rows)]

        result = {'rows': rows, 'cols': cols, 'population': grid, 'mock': bool(mock)}
        if extra:
            # Include any extra debugging fields from the MATLAB wrapper output
            # (e.g. runtime info) so the frontend can show them if needed.
            result.update(extra)
        return jsonify({'success': True, 'result': result})

    if MATLAB_AVAILABLE:
        try:
            global matlab_eng
            if matlab_eng is None:
                # Lazily start the MATLAB engine the first time we need it.
                logger.info('Starting MATLAB engine...')
                matlab_eng = matlab.start_matlab()
                # Add our matlab wrapper folder to MATLAB path so it can find the wrapper functions
                try:
                    wrapper_dir = Path(__file__).resolve().parent / 'matlab'
                    if wrapper_dir.exists():
                        matlab_eng.addpath(str(wrapper_dir), nargout=0)
                        logger.info('Added matlab wrapper dir to MATLAB path: %s', str(wrapper_dir))
                    else:
                        logger.warning('Matlab wrapper dir not found: %s', str(wrapper_dir))
                except Exception as e:
                    # Don't fail hard if addpath fails — record it for debugging.
                    logger.exception('Error adding wrapper dir to MATLAB path: %s', e)

            # Call the MATLAB wrapper which returns a JSON string
            if matlab_eng and hasattr(matlab_eng, 'run_population_sim'):
                # The wrapper is expected to return a JSON string. We parse it
                # and then extract the population payload.
                out_json = matlab_eng.run_population_sim(rows, cols, nargout=1)
                import json
                try:
                    parsed = json.loads(out_json)
                except Exception:
                    # If parsing fails, return the raw output under `raw` for debugging.
                    parsed = {'raw': out_json}

                # Extract population (support variants from MATLAB wrappers)
                pop = None
                r = rows
                c = cols
                extra = {}
                if isinstance(parsed, dict):
                    # Support keys 'population' or 'pop'
                    pop = parsed.get('population') or parsed.get('pop')
                    r = parsed.get('rows', rows)
                    c = parsed.get('cols', cols)
                    extra = {k: v for k, v in parsed.items() if k not in ('population', 'pop', 'rows', 'cols')}

                if pop is None:
                    # If no population found, return raw parsed payload for debugging
                    return jsonify({'success': True, 'result': {'rows': rows, 'cols': cols, 'population': [], 'raw': parsed}})

                return _normalize_and_return(r, c, pop, mock=False, extra=extra)
            else:
                return jsonify({'success': False, 'error': 'MATLAB function run_population_sim not found. Ensure backend/matlab/run_population_sim.m is on MATLAB path.'}), 400
        except Exception as e:
            # Fallback to mock but include matlab error for debugging
            import random
            sample = [[random.randint(0, 100) for _ in range(cols)] for _ in range(rows)]
            return _normalize_and_return(rows, cols, sample, mock=True, extra={'matlab_error': str(e)})
    else:
        # Return mock data for frontend development
        import random
        sample = [[random.randint(0, 100) for _ in range(cols)] for _ in range(rows)]
        return _normalize_and_return(rows, cols, sample, mock=True)


@app.route('/api/run_person', methods=['POST'])
def run_person():
    data = request.get_json() or {}
    steps = int(data.get('steps', 10))

    # Person-level simulation (time series) — similar pattern to run_population.
    # We attempt to call a MATLAB wrapper `run_person_sim` which should return
    # a JSON string representing the person's timeline. If MATLAB is unavailable
    # we return a mock timeline to allow frontend development.
    if MATLAB_AVAILABLE:
        try:
            global matlab_eng
            if matlab_eng is None:
                matlab_eng = matlab.start_matlab()

            if matlab_eng and hasattr(matlab_eng, 'run_person_sim'):
                out_json = matlab_eng.run_person_sim(steps, nargout=1)
                import json
                try:
                    parsed = json.loads(out_json)
                except Exception:
                    parsed = {'raw': out_json}
                return jsonify({'success': True, 'result': parsed})
            else:
                return jsonify({'success': False, 'error': 'MATLAB function run_person_sim not found. Ensure backend/matlab/run_person_sim.m is on MATLAB path.'}), 400
        except Exception as e:
            import random
            timeline = [random.random() for _ in range(steps)]
            return jsonify({'success': True, 'mock': True, 'steps': steps, 'timeline': timeline, 'matlab_error': str(e)})
    else:
        # Mock person-level time series
        import random
        timeline = [random.random() for _ in range(steps)]
        return jsonify({'success': True, 'mock': True, 'steps': steps, 'timeline': timeline})


if __name__ == '__main__':
    # When running locally this block starts the Flask development server.
    # For production use a WSGI server (gunicorn/uWSGI) and disable debug.
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
