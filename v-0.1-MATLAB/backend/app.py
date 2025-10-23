from flask import Flask, jsonify, request
import logging
import os
from pathlib import Path

# Try to import flask_cors; if missing, continue without CORS (dev env)
try:
    from flask_cors import CORS
except Exception:
    CORS = None

app = Flask(__name__)
if CORS:
    CORS(app)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('backend')

# Try to import MATLAB Engine for Python if available
MATLAB_AVAILABLE = False
matlab = None
matlab_eng = None
try:
    import matlab.engine  # type: ignore[import]
    matlab = matlab.engine
    # Try to start MATLAB engine lazily when first needed
    MATLAB_AVAILABLE = True
except Exception:
    matlab = None
    MATLAB_AVAILABLE = False


@app.route('/api/ping')
def ping():
    return jsonify({'status': 'ok', 'matlab': MATLAB_AVAILABLE})


@app.route('/api/status')
def status():
    """Return diagnostics: whether wrapper directory exists and which wrapper files are present."""
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

    if MATLAB_AVAILABLE:
        try:
            global matlab_eng
            if matlab_eng is None:
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
                    logger.exception('Error adding wrapper dir to MATLAB path: %s', e)

            # Call the MATLAB wrapper which returns a JSON string
            if matlab_eng and hasattr(matlab_eng, 'run_population_sim'):
                out_json = matlab_eng.run_population_sim(rows, cols, nargout=1)
                # out_json is a MATLAB string -> Python str
                import json
                try:
                    parsed = json.loads(out_json)
                except Exception:
                    parsed = {'raw': out_json}
                return jsonify({'success': True, 'result': parsed})
            else:
                return jsonify({'success': False, 'error': 'MATLAB function run_population_sim not found. Ensure backend/matlab/run_population_sim.m is on MATLAB path.'}), 400
        except Exception as e:
            # Fallback to mock but include matlab error for debugging
            import random
            sample = [[random.randint(0, 100) for _ in range(cols)] for _ in range(rows)]
            return jsonify({'success': True, 'mock': True, 'rows': rows, 'cols': cols, 'population': sample, 'matlab_error': str(e)})
    else:
        # Return mock data for frontend development
        import random
        sample = [[random.randint(0, 100) for _ in range(cols)] for _ in range(rows)]
        return jsonify({'success': True, 'mock': True, 'rows': rows, 'cols': cols, 'population': sample})


@app.route('/api/run_person', methods=['POST'])
def run_person():
    data = request.get_json() or {}
    steps = int(data.get('steps', 10))

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
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
