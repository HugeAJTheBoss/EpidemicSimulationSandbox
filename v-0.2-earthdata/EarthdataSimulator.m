% Virus Modifiers
SPREAD_RATE = 1;
SICKEN_RATE = 8; 
HEAL_RATE = 7;
IMMUNITY_LOSS_RATE = 300;
FATALITY_RATE = 892/1000000;
SPREAD_KERNEL = [0.2 0.5 0.2; 
          0.5 1.0 0.5; 
          0.2 0.5 0.2];

% Sim Variables
global sim;

% Store constants in sim structure immediately
sim.SPREAD_RATE = SPREAD_RATE;
sim.SICKEN_RATE = SICKEN_RATE;
sim.HEAL_RATE = HEAL_RATE;
sim.IMMUNITY_LOSS_RATE = IMMUNITY_LOSS_RATE;
sim.FATALITY_RATE = FATALITY_RATE;
sim.SPREAD_KERNEL = SPREAD_KERNEL;

[data, R] = readgeoraster('gpw_v4_population_density_rev11_2020_15_min.tif');

ROWS = size(data, 1);
COLS = size(data, 2);

% Interpolate to higher resolution
[X, Y] = meshgrid(1:size(data,2), 1:size(data,1));
[Xq, Yq] = meshgrid(1:0.5:size(data,2), 1:0.5:size(data,1));
data_interp = interp2(X, Y, data, Xq, Yq, 'linear');

% Now use scatter on interpolated data
[x, y] = meshgrid(1:0.5:size(data,2), 1:0.5:size(data,1));
x = x(:);
y = y(:);
pop = data_interp(:);

valid = ~isnan(pop) & pop > 0;
x = x(valid);
y = y(valid);
pop = pop(valid);

dotSizes = sqrt(pop) / max(sqrt(pop)) * 6;

% Create sizeGrid as 2D matrix for calculations
data(isnan(data)) = 0;
sim.sizeGrid = sqrt(data);
sim.sizeGrid = sim.sizeGrid / max(sim.sizeGrid(:));

sim.fig = figure;
sim.h = scatter(x, y, dotSizes, 'g', 'filled', 'MarkerEdgeColor', 'none');
axis tight off;
set(gca, 'YDir', 'reverse', 'Color', 'k');
set(gcf, 'Color', 'k');

% Control Buttons
btnPause = uibutton(sim.fig, 'push', ...
    'Text', 'Pause', ...
    'Position', [20, 20, 80, 30], ...
    'ButtonPushedFcn', @(src,event) pauseSim());

btnPlay = uibutton(sim.fig, 'push', ...
    'Text', 'Play', ...
    'Position', [120, 20, 80, 30], ...
    'ButtonPushedFcn', @(src,event) playSim());

btnVaccinate = uibutton(sim.fig, 'push', ...
    'Text', 'Vaccinate', ...
    'Position', [220, 20, 100, 30], ...
    'ButtonPushedFcn', @(src,event) vaccinate());

btnRestart = uibutton(sim.fig, 'push', ...
    'Text', 'Restart', ...
    'Position', [320, 20, 100, 30], ...
    'ButtonPushedFcn', @(src,event) restart());

sim.paused = false;

sim.r = zeros(ROWS, COLS, 'gpuArray');
sim.g = ones(ROWS, COLS, 'gpuArray');
sim.b = zeros(ROWS, COLS, 'gpuArray');
sim.d = zeros(ROWS, COLS, 'gpuArray');
sim.e = zeros(ROWS, COLS, 'gpuArray');
sim.r_history = zeros(ROWS, COLS, sim.HEAL_RATE, 'gpuArray');
sim.b_history = zeros(ROWS, COLS, sim.IMMUNITY_LOSS_RATE, 'gpuArray');
sim.e_history = zeros(ROWS, COLS, sim.SICKEN_RATE, 'gpuArray');

% Create mapping from interpolated points back to original grid
% Round interpolated coordinates to nearest grid cell
x_grid = round(x);
y_grid = round(y);
x_grid = max(1, min(x_grid, COLS));
y_grid = max(1, min(y_grid, ROWS));
sim.valid_idx = sub2ind([ROWS, COLS], y_grid, x_grid);

% Initialize data tools
rowsX = sim.h.DataTipTemplate.DataTipRows(1);
rowsY = sim.h.DataTipTemplate.DataTipRows(2);
susceptibleRow = dataTipTextRow('Susceptible', ones(length(x),1));
exposedRow = dataTipTextRow('Exposed', zeros(length(x),1));
infectedRow = dataTipTextRow('Infected', zeros(length(x),1));
recoveredRow = dataTipTextRow('Recovered', zeros(length(x),1));
deadRow = dataTipTextRow('Dead', zeros(length(x),1));

% Apply them all
sim.h.DataTipTemplate.DataTipRows = [rowsX, rowsY, susceptibleRow, exposedRow, infectedRow, recoveredRow, deadRow];

sim.sickened = zeros(ROWS, COLS, 'gpuArray');
sim.healed = zeros(ROWS, COLS, 'gpuArray');
sim.infected = zeros(ROWS, COLS, 'gpuArray');

randIdx = randi(numel(pop));                  % pick random valid index
linearIdx = sim.valid_idx(randIdx);               % map back to population grid
[randRow, randCol] = ind2sub(size(data), linearIdx);

% Infect a small local region around that cell
sim.r(max(randRow-1, 1):min(randRow+1, ROWS), max(randCol-1, 1):min(randCol+1, COLS)) = 0.1;

sim.numChunks = 6;
N = numel(sim.valid_idx);
sim.batchSize = ceil(N / sim.numChunks);
sim.updateBatches = arrayfun(@(k) ((k-1)*sim.batchSize+1):min(k*sim.batchSize, N), 1:sim.numChunks, 'UniformOutput', false);
sim.currentBatch = 1;

% Map to scatter colors
r_flat = sim.r(:);
g_flat = sim.g(:);
b_flat = sim.b(:);
sim.h.CData = gather([r_flat(sim.valid_idx), g_flat(sim.valid_idx), b_flat(sim.valid_idx)]);
sim.iter = 0;
sim.tStart = tic;
drawnow;

% Use GPU for heavy variables
sim.sizeGrid = gpuArray(sim.sizeGrid);

% Store ROWS and COLS in sim structure
sim.ROWS = ROWS;
sim.COLS = COLS;

function pauseSim()
    global sim;
    sim.paused = true;
end

function playSim()
    global sim;
    sim.paused = false;
end

function vaccinate()
    global sim;
    sim.b = max(0, min(sim.b + 0.9 * sim.g, 1));
    sim.g = max(0, min(sim.g - 0.9 * sim.g, 1));
    
    % Update b_history when vaccinating
    sim.b_history = cat(3, sim.b - sim.b_history(:,:,1), sim.b_history(:,:,1:sim.IMMUNITY_LOSS_RATE - 1));
    
    updateScatterColors();
end

function restart()
    global sim;
    % reset fields directly
    sim.r = zeros(sim.ROWS, sim.COLS, 'gpuArray');
    sim.g = ones(sim.ROWS, sim.COLS, 'gpuArray');
    sim.b = zeros(sim.ROWS, sim.COLS, 'gpuArray');
    sim.d = zeros(sim.ROWS, sim.COLS, 'gpuArray');
    sim.e = zeros(sim.ROWS, sim.COLS, 'gpuArray');
    sim.r_history = zeros(sim.ROWS, sim.COLS, sim.HEAL_RATE, 'gpuArray');
    sim.b_history = zeros(sim.ROWS, sim.COLS, sim.IMMUNITY_LOSS_RATE, 'gpuArray');
    sim.e_history = zeros(sim.ROWS, sim.COLS, sim.SICKEN_RATE, 'gpuArray');
    sim.sickened = zeros(sim.ROWS, sim.COLS, 'gpuArray');
    sim.healed = zeros(sim.ROWS, sim.COLS, 'gpuArray');
    sim.infected = zeros(sim.ROWS, sim.COLS, 'gpuArray');
    
    % Re-infect initial region
    randIdx = randi(numel(sim.valid_idx));
    linearIdx = sim.valid_idx(randIdx);
    [randRow, randCol] = ind2sub([sim.ROWS, sim.COLS], linearIdx);
    sim.r(max(randRow-1, 1):min(randRow+1, sim.ROWS), max(randCol-1, 1):min(randCol+1, sim.COLS)) = 0.1;
    
    sim.iter = 0;
    sim.paused = true;
    sim.tStart = tic;
    updateScatterColors();
end

function runTick()
    global sim;
    
    % Check if handle is still valid
    if ~isvalid(sim.h)
        return;
    end
    
    if sim.paused
        return;
    end

    sim.iter = sim.iter + 1;

    sim.r_history = cat(3, sim.sickened, sim.r_history(:,:,1:sim.HEAL_RATE - 1));
    sim.b_history = cat(3, sim.healed, sim.b_history(:,:,1:sim.IMMUNITY_LOSS_RATE - 1));
    sim.e_history = cat(3, sim.infected, sim.e_history(:,:,1:sim.SICKEN_RATE - 1));
    
    % Compute neighbor contributions
    neighborSum = conv2(sim.r .* sim.sizeGrid.^1.2, sim.SPREAD_KERNEL, 'same');

    sim.infected = sim.SPREAD_RATE * neighborSum ./ (1 + 3*neighborSum) .* sim.g;
    sim.sickened = sim.e_history(:, :, sim.SICKEN_RATE);
    sim.healed = sim.r_history(:,:, sim.HEAL_RATE);
    relapsed = sim.b_history(:,:,sim.IMMUNITY_LOSS_RATE);
    dead = sim.FATALITY_RATE .* sim.healed;
    
    % Update r and b
    sim.g = max(min(sim.g - sim.infected + relapsed, 1), 0);
    sim.e = max(min(sim.e + sim.infected - sim.sickened, 1), 0);
    sim.r = max(min(sim.r + sim.sickened - sim.healed, 1), 0);
    sim.b = max(min(sim.b + sim.healed - dead - relapsed, 1), 0);
    sim.d = max(min(sim.d + dead, 1), 0);

    total = sim.g + sim.r + sim.b + sim.d + sim.e;
    sim.g = sim.g ./ total;
    sim.r = sim.r ./ total;
    sim.b = sim.b ./ total;
    sim.d = sim.d ./ total;
    sim.e = sim.e ./ total;

    % Flatten arrays
    r_flat = gather(sim.r(:));
    g_flat = gather(sim.g(:));
    b_flat = gather(sim.b(:));
    e_flat = gather(sim.e(:));
    d_flat = gather(sim.d(:));
    
    % Update only a subset of points
    batch = sim.updateBatches{sim.currentBatch};
    sim.h.CData(batch, :) = [r_flat(sim.valid_idx(batch)), g_flat(sim.valid_idx(batch)), b_flat(sim.valid_idx(batch))];
    
    % Advance batch pointer
    sim.currentBatch = mod(sim.currentBatch, sim.numChunks) + 1;
    
    % Occasionally redraw for performance balance
    if mod(sim.iter, 4) == 0
        drawnow limitrate;
        imwrite(getframe(sim.fig).cdata, fullfile(sim.scriptDir, sprintf('my-react-app/public/frame.jpg')), 'jpg');
    end
    
    % Monitor ticks per second
    if mod(sim.iter,10)==0
        fprintf('Iter: %d | Iter/s: %.2f\n', sim.iter, 10/toc(sim.tStart));
        sim.tStart = tic;
    end

    % Update data tips for the current iteration
    sim.h.DataTipTemplate.DataTipRows(3).Value = g_flat(sim.valid_idx) * 100; 
    sim.h.DataTipTemplate.DataTipRows(4).Value = e_flat(sim.valid_idx) * 100; 
    sim.h.DataTipTemplate.DataTipRows(5).Value = r_flat(sim.valid_idx) * 100; 
    sim.h.DataTipTemplate.DataTipRows(6).Value = b_flat(sim.valid_idx) * 100;
    sim.h.DataTipTemplate.DataTipRows(7).Value = d_flat(sim.valid_idx) * 100; 

    totals = 100 * [sum(sim.r(:)), sum(sim.g(:)), sum(sim.b(:)), sum(sim.e(:)), sum(sim.d(:))];

    title(sprintf('R: %.1f   G: %.1f   B: %.1f   E: %.1f   D: %.1f', ...
    totals(1), totals(2), totals(3), totals(4), totals(5)), ...
    'FontSize', 12, 'FontWeight', 'bold');
end

function updateScatterColors()
    global sim;
    r_flat = gather(sim.r(:));
    g_flat = gather(sim.g(:));
    b_flat = gather(sim.b(:));
    sim.h.CData = [r_flat(sim.valid_idx), g_flat(sim.valid_idx), b_flat(sim.valid_idx)];
end

cd(fileparts(mfilename('fullpath')));
sim.scriptDir = fileparts(mfilename('fullpath'));

% Animation loop - use timer to call runTick repeatedly
tmr = timer('ExecutionMode', 'fixedRate', ...
            'Period', 0.001, ...
            'TimerFcn', @(~,~) runTick());
start(tmr);