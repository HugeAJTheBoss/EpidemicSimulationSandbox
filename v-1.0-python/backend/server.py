from flask import Flask, send_file, jsonify, request
from flask_cors import CORS
import os
import sys
import threading
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
FRONTEND_DIST_DIR = PROJECT_DIR / 'my-react-app' / 'dist'
FRONTEND_INDEX_PATH = FRONTEND_DIST_DIR / 'index.html'
SIM_FRAME_PATH = BASE_DIR / 'sim_frame.png'
GEOTIFF_PATH = PROJECT_DIR / 'gpw_v4_population_density_rev11_2020_15_min.tif'

if str(PROJECT_DIR) not in sys.path:
    sys.path.append(str(PROJECT_DIR))

from sim import VirusSimulation

app = Flask(__name__)
CORS(app)

# Global simulation state
sim = None
sim_thread = None
running = False
sim_speed = 1.0
tick_budget = 0.0
last_loop_time = None
BASE_TPS = 30.0

sim_lock = threading.Lock()
thread_lock = threading.Lock()


def _state_summary(sim_obj):
    return {
        'iteration': sim_obj.iter,
        'paused': sim_obj.paused,
        'speed': sim_speed,
        'totals': {
            'susceptible': float(sim_obj.g.sum()),
            'exposed': float(sim_obj.e.sum()),
            'infected': float(sim_obj.r.sum()),
            'recovered': float(sim_obj.b.sum()),
            'dead': float(sim_obj.d.sum()),
        },
    }


def init_simulation(force=False):
    global sim
    with sim_lock:
        if sim is not None and not force:
            return sim

        geotiff_override = os.getenv('POPULATION_TIF_PATH')
        geotiff_path = Path(geotiff_override) if geotiff_override else GEOTIFF_PATH
        if not geotiff_path.exists():
            raise FileNotFoundError(f'GeoTIFF not found at {geotiff_path}')

        print(f'Initializing simulation with GeoTIFF: {geotiff_path}')
        sim = VirusSimulation(geotiff_path=str(geotiff_path))
        sim.play()

        try:
            sim.save_frame(str(SIM_FRAME_PATH))
        except Exception as exc:
            print(f'Unable to save initial frame: {exc}')

        print('Simulation initialized!')
        return sim


def simulation_loop():
    global tick_budget, last_loop_time
    while running:
        try:
            with sim_lock:
                if sim and not sim.paused:
                    now = time.time()
                    if last_loop_time is None:
                        last_loop_time = now

                    dt = now - last_loop_time
                    last_loop_time = now

                    # Avoid a huge catch-up burst after pauses or debugger stops.
                    dt = max(0.0, min(dt, 0.25))

                    speed_now = max(0.1, float(sim_speed))
                    tick_budget += dt * BASE_TPS * speed_now

                    # Cap work per loop to keep rendering responsive.
                    ticks_to_run = min(int(tick_budget), 10)
                    for _ in range(ticks_to_run):
                        sim.run_tick()
                    tick_budget -= ticks_to_run

                    # Save frame every 5 iterations for frontend polling.
                    if sim.iter % 5 == 0:
                        sim.save_frame(str(SIM_FRAME_PATH))
                else:
                    last_loop_time = time.time()
        except Exception as exc:
            print(f'Error in simulation loop: {exc}')

        time.sleep(0.005)


def ensure_simulation_thread():
    global running, sim_thread
    init_simulation()

    with thread_lock:
        if sim_thread is not None and sim_thread.is_alive():
            return

        running = True
        sim_thread = threading.Thread(target=simulation_loop, daemon=True)
        sim_thread.start()
        print('Simulation thread started.')


@app.route('/health')
def health():
    ensure_simulation_thread()
    with sim_lock:
        return jsonify({
            'status': 'ok',
            'service': 'epidemic-simulation-backend',
            'frontendBuilt': FRONTEND_INDEX_PATH.exists(),
            'simulation': _state_summary(sim),
            'frame_path': str(SIM_FRAME_PATH.name),
        })


@app.route('/sim_frame.png')
def get_frame():
    ensure_simulation_thread()

    with sim_lock:
        if not SIM_FRAME_PATH.exists() and sim:
            sim.save_frame(str(SIM_FRAME_PATH))

    if not SIM_FRAME_PATH.exists():
        return jsonify({'error': 'Frame not yet generated'}), 404

    return send_file(str(SIM_FRAME_PATH), mimetype='image/png', max_age=0)


@app.route('/api/state')
def state():
    ensure_simulation_thread()
    with sim_lock:
        return jsonify(_state_summary(sim))


@app.route('/api/run', methods=['POST'])
def run_steps():
    ensure_simulation_thread()

    payload = request.get_json(silent=True) or {}
    try:
        steps = int(payload.get('steps', 1))
    except (TypeError, ValueError):
        return jsonify({'error': 'steps must be an integer'}), 400

    steps = max(1, min(steps, 1000))

    with sim_lock:
        if sim.paused:
            sim.play()

        for _ in range(steps):
            sim.run_tick()

        sim.save_frame(str(SIM_FRAME_PATH))
        summary = _state_summary(sim)

    return jsonify({'status': 'ran', 'steps': steps, 'simulation': summary})


@app.route('/api/speed', methods=['POST'])
def set_speed():
    """Set simulation speed multiplier.
    1.0 is baseline speed, 2.0 is ~2x faster, 0.5 is ~half speed."""
    global sim_speed, tick_budget
    ensure_simulation_thread()

    payload = request.get_json(silent=True) or {}
    try:
        new_speed = float(payload.get('speed', 1.0))
    except (TypeError, ValueError):
        return jsonify({'error': 'speed must be a number'}), 400

    # Keep speed in a safe range to avoid runaway CPU load.
    new_speed = max(0.1, min(new_speed, 5.0))

    with sim_lock:
        sim_speed = new_speed
        tick_budget = 0.0
        summary = _state_summary(sim)

    return jsonify({'status': 'speed_updated', 'speed': new_speed, 'simulation': summary})


@app.route('/pause', methods=['POST'])
def pause():
    ensure_simulation_thread()
    with sim_lock:
        sim.pause()
    return jsonify({'status': 'paused'})


@app.route('/play', methods=['POST'])
def play():
    ensure_simulation_thread()
    with sim_lock:
        sim.play()
    return jsonify({'status': 'playing'})


@app.route('/vaccinate', methods=['POST'])
def vaccinate():
    ensure_simulation_thread()
    with sim_lock:
        sim.vaccinate()
        sim.save_frame(str(SIM_FRAME_PATH))
    return jsonify({'status': 'vaccinated'})


@app.route('/restart', methods=['POST'])
def restart_sim():
    ensure_simulation_thread()
    with sim_lock:
        sim.restart()
        sim.play()
        sim.save_frame(str(SIM_FRAME_PATH))
    return jsonify({'status': 'restarted'})


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404

    if path:
        requested_path = FRONTEND_DIST_DIR / path
        if requested_path.exists() and requested_path.is_file():
            return send_file(str(requested_path), max_age=0)

    if FRONTEND_INDEX_PATH.exists():
        return send_file(str(FRONTEND_INDEX_PATH), max_age=0)

    return jsonify({
        'service': 'epidemic-simulation-backend',
        'status': 'ok',
        'message': 'Frontend build not found. Build my-react-app so dist/index.html exists.',
    })


if __name__ == '__main__':
    ensure_simulation_thread()
    port = int(os.getenv('PORT', '5001'))
    print('Starting Flask server...')
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)