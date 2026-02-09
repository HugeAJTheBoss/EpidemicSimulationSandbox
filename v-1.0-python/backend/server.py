from flask import Flask, send_file, jsonify, request
from flask_cors import CORS
import threading
import time
from virus_sim_cpu import VirusSimulation

app = Flask(__name__)
CORS(app)

# Global simulation instance
sim = None
sim_thread = None
running = False

def init_simulation():
    """Initialize the simulation"""
    global sim
    print("Initializing simulation...")
    sim = VirusSimulation()
    sim.play()
    print("Simulation initialized!")

def simulation_loop():
    """Background thread that runs the simulation continuously"""
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
    """Serve the main page"""
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Virus Simulation</title>
        <style>
            body {
                margin: 0;
                padding: 20px;
                background-color: #000;
                color: #fff;
                font-family: Arial, sans-serif;
            }
            #simulation {
                border: 1px solid #333;
                cursor: crosshair;
                max-width: 100%;
                height: auto;
            }
            #pixel-info {
                margin-top: 10px;
                font-size: 14px;
                padding: 10px;
                background-color: #222;
                border-radius: 4px;
            }
            #controls {
                margin-top: 10px;
            }
            button {
                margin: 5px;
                padding: 10px 20px;
                font-size: 14px;
                cursor: pointer;
                background-color: #444;
                color: #fff;
                border: none;
                border-radius: 4px;
            }
            button:hover {
                background-color: #666;
            }
        </style>
    </head>
    <body>
        <h1>Virus Simulation</h1>
        <canvas id="simulation"></canvas>
        <div id="pixel-info">Hover over the simulation to see pixel data</div>
        <div id="controls">
            <button onclick="pauseSim()">Pause</button>
            <button onclick="playSim()">Play</button>
            <button onclick="vaccinate()">Vaccinate</button>
            <button onclick="restart()">Restart</button>
        </div>
        
        <script>
            async function fetchFrame() {
                try {
                    const response = await fetch('/sim_frame.png?t=' + Date.now());
                    const blob = await response.blob();
                    
                    const canvas = document.getElementById('simulation');
                    const ctx = canvas.getContext('2d');
                    
                    const img = new Image();
                    const imageUrl = URL.createObjectURL(blob);
                    
                    img.onload = () => {
                        if (canvas.width === 0) {
                            canvas.width = img.width;
                            canvas.height = img.height;
                        }
                        
                        ctx.drawImage(img, 0, 0);
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        
                        canvas.onmousemove = (e) => {
                            const rect = canvas.getBoundingClientRect();
                            const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
                            const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
                            const index = (y * canvas.width + x) * 4;
                            
                            const r = imageData.data[index];
                            const g = imageData.data[index + 1];
                            const b = imageData.data[index + 2];
                            
                            document.getElementById('pixel-info').textContent = 
                                `Pixel (${x}, ${y}): Infected=${r}, Susceptible=${g}, Recovered=${b}`;
                        };
                        
                        URL.revokeObjectURL(imageUrl);
                    };
                    
                    img.src = imageUrl;
                } catch (error) {
                    console.error('Error fetching frame:', error);
                }
            }
            
            async function pauseSim() {
                await fetch('/pause', { method: 'POST' });
            }
            
            async function playSim() {
                await fetch('/play', { method: 'POST' });
            }
            
            async function vaccinate() {
                await fetch('/vaccinate', { method: 'POST' });
            }
            
            async function restart() {
                await fetch('/restart', { method: 'POST' });
            }
            
            setInterval(fetchFrame, 500);
            fetchFrame();
        </script>
    </body>
    </html>
    '''

@app.route('/sim_frame.png')
def get_frame():
    """Serve the current simulation frame"""
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