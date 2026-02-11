from flask import Flask, send_file, jsonify, request
from flask_cors import CORS
import threading
import time

import sys
sys.path.append('..')
from sim import VirusSimulation

app = Flask(__name__)
CORS(app)

# Global simulation instance
sim = None
sim_thread = None
running = False

def init_simulation():
    global sim
    print("Initializing simulation...")
    sim = VirusSimulation()
    sim.play()
    print("Simulation initialized!")

def simulation_loop():
    global sim, running
    
    while running:
        if sim and not sim.paused:
            sim.run_tick()
            
            # Save frame every 5 iterations
            if sim.iter % 5 == 0:
                try:
                    sim.save_frame('sim_frame.png')
                except Exception as e:
                    print(f"Error saving frame: {e}")
        
        time.sleep(0.001)

@app.route('/')
def index():
    return send_file('../../my-react-app/index.html')

@app.route('/sim_frame.png')
def get_frame():
    try:
        return send_file('sim_frame.png', 
                        mimetype='image/png',
                        cache_timeout=0,
                        max_age=0)
    except FileNotFoundError:
        return "Frame not yet generated", 404

@app.route('/pause', methods=['POST'])
def pause():
    if sim:
        sim.pause()
        return jsonify({'status': 'paused'})
    return jsonify({'error': 'Simulation not initialized'}), 500

@app.route('/play', methods=['POST'])
def play():
    if sim:
        sim.play()
        return jsonify({'status': 'playing'})
    return jsonify({'error': 'Simulation not initialized'}), 500

@app.route('/vaccinate', methods=['POST'])
def vaccinate():
    if sim:
        sim.vaccinate()
        return jsonify({'status': 'vaccinated'})
    return jsonify({'error': 'Simulation not initialized'}), 500

@app.route('/restart', methods=['POST'])
def restart_sim():
    if sim:
        sim.restart()
        return jsonify({'status': 'restarted'})
    return jsonify({'error': 'Simulation not initialized'}), 500

if __name__ == '__main__':
    init_simulation()
    
    running = True
    sim_thread = threading.Thread(target=simulation_loop, daemon=True)
    sim_thread.start()
    
    print("Starting Flask server...")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)