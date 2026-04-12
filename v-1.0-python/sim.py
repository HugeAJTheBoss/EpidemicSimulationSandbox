import numpy as np
from scipy.signal import convolve2d
from PIL import Image
import rasterio
import time
import os

class VirusSimulation:
    def __init__(self, geotiff_path='../gpw_v4_population_density_rev11_2020_15_min.tif'):
        # Virus Modifiers
        self.SPREAD_RATE = 1.0
        self.SICKEN_RATE = 8
        self.HEAL_RATE = 7
        self.IMMUNITY_LOSS_RATE = 300
        self.FATALITY_RATE = 892 / 1000000
        self.SPREAD_KERNEL = np.array([
            [0.2, 0.5, 0.2],
            [0.5, 1.0, 0.5],
            [0.2, 0.5, 0.2]
        ], dtype=np.float32)

        self.dtype = np.float32
        self.downsample_factor = max(1, int(os.getenv('SIM_DOWNSAMPLE_FACTOR', '4')))
        
        # Load GeoTIFF data
        print("Loading GeoTIFF data...")
        with rasterio.open(geotiff_path) as dataset:
            data = dataset.read(1).astype(self.dtype, copy=False)  # Read first band

        if self.downsample_factor > 1:
            data = data[::self.downsample_factor, ::self.downsample_factor]
            print(f"Downsample factor: {self.downsample_factor}")
        
        self.ROWS, self.COLS = data.shape
        print(f"Data shape: {self.ROWS} x {self.COLS}")
        
        # Replace NaN with 0
        data_clean = np.nan_to_num(data, nan=0.0).astype(self.dtype, copy=False)
        
        # Create sizeGrid
        size_grid = np.sqrt(data_clean).astype(self.dtype, copy=False)
        grid_max = float(np.max(size_grid))
        if grid_max > 0:
            size_grid = size_grid / grid_max
        self.sizeGrid = size_grid
        self.sizeGridPow = np.power(self.sizeGrid, 1.2).astype(self.dtype, copy=False)
        
        # Initialize simulation state
        self._init_state_arrays()
        self._seed_initial_infection()

        self.iter = 0
        self.last_time = time.time()
        
        print("Simulation initialized!")

    def _init_state_arrays(self):
        self.paused = False
        self.r = np.zeros((self.ROWS, self.COLS), dtype=self.dtype)  # Infected
        self.g = np.ones((self.ROWS, self.COLS), dtype=self.dtype)   # Susceptible
        self.b = np.zeros((self.ROWS, self.COLS), dtype=self.dtype)  # Recovered
        self.d = np.zeros((self.ROWS, self.COLS), dtype=self.dtype)  # Dead
        self.e = np.zeros((self.ROWS, self.COLS), dtype=self.dtype)  # Exposed

        # Ring buffers: shape is (delay, rows, cols)
        self.r_history = np.zeros((self.HEAL_RATE, self.ROWS, self.COLS), dtype=self.dtype)
        self.b_history = np.zeros((self.IMMUNITY_LOSS_RATE, self.ROWS, self.COLS), dtype=self.dtype)
        self.e_history = np.zeros((self.SICKEN_RATE, self.ROWS, self.COLS), dtype=self.dtype)
        self.r_hist_idx = 0
        self.b_hist_idx = 0
        self.e_hist_idx = 0

        # Temporary variables compatible with API/logic
        self.sickened = np.zeros((self.ROWS, self.COLS), dtype=self.dtype)
        self.healed = np.zeros((self.ROWS, self.COLS), dtype=self.dtype)
        self.infected = np.zeros((self.ROWS, self.COLS), dtype=self.dtype)

    def _seed_initial_infection(self):
        # Seed in approximately the same geographic region as the original grid.
        rand_row = int((226 / 720) * max(self.ROWS - 1, 1))
        rand_col = int((863 / 1440) * max(self.COLS - 1, 1))
        r_min = max(rand_row - 1, 0)
        r_max = min(rand_row + 2, self.ROWS)
        c_min = max(rand_col - 1, 0)
        c_max = min(rand_col + 2, self.COLS)
        self.r[r_min:r_max, c_min:c_max] = 0.1
    
    def pause(self):
        self.paused = True
    
    def play(self):
        self.paused = False
    
    def vaccinate(self):
        """Vaccinate 90% of susceptible population"""
        vaccinated = 0.9 * self.g
        self.b = np.maximum(0, np.minimum(self.b + vaccinated, 1))
        self.g = np.maximum(0, np.minimum(self.g - vaccinated, 1))

        # Add vaccinated cohort into immunity-loss queue.
        target_idx = (self.b_hist_idx - 1) % self.IMMUNITY_LOSS_RATE
        self.b_history[target_idx] += vaccinated
    
    def restart(self):
        """Reset simulation to initial state"""
        self._init_state_arrays()
        self._seed_initial_infection()

        self.iter = 0
        self.paused = True
        self.last_time = time.time()
    
    def run_tick(self):
        """Run one iteration of the simulation"""
        if self.paused:
            return
        
        self.iter += 1

        # Queue logic with ring buffers: pop delayed cohorts and push previous tick cohorts.
        sickened = self.e_history[self.e_hist_idx].copy()
        self.e_history[self.e_hist_idx] = self.infected
        self.e_hist_idx = (self.e_hist_idx + 1) % self.SICKEN_RATE

        healed = self.r_history[self.r_hist_idx].copy()
        self.r_history[self.r_hist_idx] = self.sickened
        self.r_hist_idx = (self.r_hist_idx + 1) % self.HEAL_RATE

        relapsed = self.b_history[self.b_hist_idx].copy()
        self.b_history[self.b_hist_idx] = self.healed
        self.b_hist_idx = (self.b_hist_idx + 1) % self.IMMUNITY_LOSS_RATE
        
        # Compute neighbor contributions
        neighbor_sum = convolve2d(
            self.r * self.sizeGridPow,
            self.SPREAD_KERNEL,
            mode='same',
            boundary='fill',
            fillvalue=0
        ).astype(self.dtype, copy=False)
        
        # Calculate transitions
        infected = self.SPREAD_RATE * neighbor_sum / (1 + 3 * neighbor_sum) * self.g
        dead = self.FATALITY_RATE * healed
        
        # Update compartments
        self.g = np.maximum(np.minimum(self.g - infected + relapsed, 1), 0)
        self.e = np.maximum(np.minimum(self.e + infected - sickened, 1), 0)
        self.r = np.maximum(np.minimum(self.r + sickened - healed, 1), 0)
        self.b = np.maximum(np.minimum(self.b + healed - dead - relapsed, 1), 0)
        self.d = np.maximum(np.minimum(self.d + dead, 1), 0)

        # Store transitions for next tick queue push.
        self.infected = infected
        self.sickened = sickened
        self.healed = healed
        
        # Normalize to ensure sum = 1
        total = self.g + self.r + self.b + self.d + self.e
        total = np.maximum(total, np.finfo(self.dtype).eps)
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