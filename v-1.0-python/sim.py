import numpy as np
from scipy.signal import convolve2d
from PIL import Image
import rasterio
import time

class VirusSimulation:
    def __init__(self, geotiff_path='../gpw_v4_population_density_rev11_2020_15_min.tif'):
        # Virus Modifiers
        self.SPREAD_RATE = 1
        self.SICKEN_RATE = 8
        self.HEAL_RATE = 7
        self.IMMUNITY_LOSS_RATE = 300
        self.FATALITY_RATE = 892 / 1000000
        self.SPREAD_KERNEL = np.array([
            [0.2, 0.5, 0.2],
            [0.5, 1.0, 0.5],
            [0.2, 0.5, 0.2]
        ])
        
        # Load GeoTIFF data
        print("Loading GeoTIFF data...")
        with rasterio.open(geotiff_path) as dataset:
            data = dataset.read(1)  # Read first band
        
        self.ROWS, self.COLS = data.shape
        print(f"Data shape: {self.ROWS} x {self.COLS}")
        
        # Replace NaN with 0
        data_clean = np.nan_to_num(data, 0)
        
        # Create sizeGrid
        size_grid = np.sqrt(data_clean)
        size_grid = size_grid / np.max(size_grid)
        self.sizeGrid = size_grid
        
        # Initialize simulation state
        self.paused = False
        self.r = np.zeros((self.ROWS, self.COLS))  # Infected
        self.g = np.ones((self.ROWS, self.COLS))   # Susceptible
        self.b = np.zeros((self.ROWS, self.COLS))  # Recovered
        self.d = np.zeros((self.ROWS, self.COLS))  # Dead
        self.e = np.zeros((self.ROWS, self.COLS))  # Exposed
        
        # History arrays
        self.r_history = np.zeros((self.ROWS, self.COLS, self.HEAL_RATE))
        self.b_history = np.zeros((self.ROWS, self.COLS, self.IMMUNITY_LOSS_RATE))
        self.e_history = np.zeros((self.ROWS, self.COLS, self.SICKEN_RATE))
        
        # Temporary variables
        self.sickened = np.zeros((self.ROWS, self.COLS))
        self.healed = np.zeros((self.ROWS, self.COLS))
        self.infected = np.zeros((self.ROWS, self.COLS))
        
        # Initial infection at specified location
        rand_row = 226
        rand_col = 863
        r_min = max(rand_row - 1, 0)
        r_max = min(rand_row + 2, self.ROWS)
        c_min = max(rand_col - 1, 0)
        c_max = min(rand_col + 2, self.COLS)
        self.r[r_min:r_max, c_min:c_max] = 0.1
        
        self.iter = 0
        self.last_time = time.time()
        
        print("Simulation initialized!")
    
    def pause(self):
        self.paused = True
    
    def play(self):
        self.paused = False
    
    def vaccinate(self):
        """Vaccinate 90% of susceptible population"""
        self.b = np.maximum(0, np.minimum(self.b + 0.9 * self.g, 1))
        self.g = np.maximum(0, np.minimum(self.g - 0.9 * self.g, 1))
        
        # Update b_history
        self.b_history = np.concatenate([
            (self.b - self.b_history[:, :, 0:1]),
            self.b_history[:, :, 0:self.IMMUNITY_LOSS_RATE - 1]
        ], axis=2)
    
    def restart(self):
        """Reset simulation to initial state"""
        self.r = np.zeros((self.ROWS, self.COLS))
        self.g = np.ones((self.ROWS, self.COLS))
        self.b = np.zeros((self.ROWS, self.COLS))
        self.d = np.zeros((self.ROWS, self.COLS))
        self.e = np.zeros((self.ROWS, self.COLS))
        
        self.r_history = np.zeros((self.ROWS, self.COLS, self.HEAL_RATE))
        self.b_history = np.zeros((self.ROWS, self.COLS, self.IMMUNITY_LOSS_RATE))
        self.e_history = np.zeros((self.ROWS, self.COLS, self.SICKEN_RATE))
        
        self.sickened = np.zeros((self.ROWS, self.COLS))
        self.healed = np.zeros((self.ROWS, self.COLS))
        self.infected = np.zeros((self.ROWS, self.COLS))
        
        # Re-infect initial region
        rand_row = 226
        rand_col = 863
        r_min = max(rand_row - 1, 0)
        r_max = min(rand_row + 2, self.ROWS)
        c_min = max(rand_col - 1, 0)
        c_max = min(rand_col + 2, self.COLS)
        self.r[r_min:r_max, c_min:c_max] = 0.1
        
        self.iter = 0
        self.paused = True
        self.last_time = time.time()
    
    def run_tick(self):
        """Run one iteration of the simulation"""
        if self.paused:
            return
        
        self.iter += 1
        
        # Update histories
        self.r_history = np.concatenate([
            self.sickened[:, :, np.newaxis],
            self.r_history[:, :, 0:self.HEAL_RATE - 1]
        ], axis=2)
        
        self.b_history = np.concatenate([
            self.healed[:, :, np.newaxis],
            self.b_history[:, :, 0:self.IMMUNITY_LOSS_RATE - 1]
        ], axis=2)
        
        self.e_history = np.concatenate([
            self.infected[:, :, np.newaxis],
            self.e_history[:, :, 0:self.SICKEN_RATE - 1]
        ], axis=2)
        
        # Compute neighbor contributions
        neighbor_sum = convolve2d(
            self.r * np.power(self.sizeGrid, 1.2),
            self.SPREAD_KERNEL,
            mode='same',
            boundary='fill',
            fillvalue=0
        )
        
        # Calculate transitions
        self.infected = self.SPREAD_RATE * neighbor_sum / (1 + 3 * neighbor_sum) * self.g
        self.sickened = self.e_history[:, :, self.SICKEN_RATE - 1]
        self.healed = self.r_history[:, :, self.HEAL_RATE - 1]
        relapsed = self.b_history[:, :, self.IMMUNITY_LOSS_RATE - 1]
        dead = self.FATALITY_RATE * self.healed
        
        # Update compartments
        self.g = np.maximum(np.minimum(self.g - self.infected + relapsed, 1), 0)
        self.e = np.maximum(np.minimum(self.e + self.infected - self.sickened, 1), 0)
        self.r = np.maximum(np.minimum(self.r + self.sickened - self.healed, 1), 0)
        self.b = np.maximum(np.minimum(self.b + self.healed - dead - relapsed, 1), 0)
        self.d = np.maximum(np.minimum(self.d + dead, 1), 0)
        
        # Normalize to ensure sum = 1
        total = self.g + self.r + self.b + self.d + self.e
        self.g = self.g / total
        self.r = self.r / total
        self.b = self.b / total
        self.d = self.d / total
        self.e = self.e / total
        
        # Monitor iterations per second
        if self.iter % 10 == 0:
            current_time = time.time()
            elapsed = current_time - self.last_time
            if elapsed > 0:
                print(f"Iter: {self.iter} | Iter/s: {10 / elapsed:.2f}")
            self.last_time = current_time
            
            # Print totals
            totals = np.array([
                np.sum(self.r),
                np.sum(self.g),
                np.sum(self.b),
                np.sum(self.e),
                np.sum(self.d)
            ]) * 100
            print(f"R: {totals[0]:.1f}   G: {totals[1]:.1f}   B: {totals[2]:.1f}   E: {totals[3]:.1f}   D: {totals[4]:.1f}")
    
    def save_frame(self, output_path='sim_frame.png'):
        """Save current state as PNG"""
        # Combine RGB channels
        rgb_data = np.stack([self.r, self.g, self.b], axis=2)
        
        # Normalize to 0-255
        rgb_min = rgb_data.min()
        rgb_max = rgb_data.max()
        if rgb_max > rgb_min:
            rgb_normalized = (rgb_data - rgb_min) / (rgb_max - rgb_min)
        else:
            rgb_normalized = rgb_data
        
        rgb_uint8 = (rgb_normalized * 255).astype(np.uint8)
        
        # Create and save image
        img = Image.fromarray(rgb_uint8, 'RGB')
        img.save(output_path, 'PNG')
        
        return output_path
    
    def get_state_data(self):
        """Get current state as numpy arrays for API responses"""
        return {
            'susceptible': self.g.tolist(),
            'exposed': self.e.tolist(),
            'infected': self.r.tolist(),
            'recovered': self.b.tolist(),
            'dead': self.d.tolist(),
            'iteration': self.iter
        }