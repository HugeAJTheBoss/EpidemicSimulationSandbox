from flask import Flask, send_file, jsonify, request
from flask_cors import CORS
import os
import sys
import threading
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
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

sim_lock = threading.Lock()
thread_lock = threading.Lock()


def _state_summary(sim_obj):
    return {
        'iteration': sim_obj.iter,
        'paused': sim_obj.paused,
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
    while running:
        try:
            with sim_lock:
                if sim and not sim.paused:
                    sim.run_tick()

                    # Save frame every 5 iterations for frontend polling.
                    if sim.iter % 5 == 0:
                        sim.save_frame(str(SIM_FRAME_PATH))
        except Exception as exc:
            print(f'Error in simulation loop: {exc}')

        time.sleep(0.001)


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


@app.route('/')
def index():
    return jsonify({
        'service': 'epidemic-simulation-backend',
        'status': 'ok',
        'message': 'Use /health, /sim_frame.png, and /api/run to control the simulation.',
    })


@app.route('/health')
def health():
    ensure_simulation_thread()
    with sim_lock:
        return jsonify({
            'status': 'ok',
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


if __name__ == '__main__':
    ensure_simulation_thread()
    port = int(os.getenv('PORT', '5001'))
    print('Starting Flask server...')
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)