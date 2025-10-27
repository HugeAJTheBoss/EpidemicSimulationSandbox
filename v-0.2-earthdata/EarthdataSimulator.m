% Virus Modifiers
SPREAD_RATE = 10;
SICKEN_RATE = 8; 
HEAL_RATE = 7;
IMMUNITY_LOSS_RATE = 300;
FATALITY_RATE = 892/1000000;
SPREAD_KERNEL = [1.2 1.5 1.2; 
          1.5 1.0 1.5; 
          1.2 1.5 1.2];

function vaccinate()
    r = evalin('base','r');
    b = evalin('base','b');
    g = evalin('base','g');
    valid_idx = evalin('base','valid_idx');

    b_history = evalin('base', 'b_history');
    IMMUNITY_LOSS_RATE = evalin('base', 'IMMUNITY_LOSS_RATE');

    % Take 90% of susceptible (green) and turn them blue
    b = max(0, min(b + 0.9 * g, 1));
    g = max(0, min(g - 0.9 * g, 1));

    b_history = cat(3, b, b_history(:,:,1:IMMUNITY_LOSS_RATE - 1));

    assignin('base','b',b);
    assignin('base','g',g);
    assignin('base', 'b_history', b_history);

    % Update scatter colors - use only valid points
    h = evalin('base','h');
    r_flat = r(:);
    g_flat = g(:);
    b_flat = b(:);
    h.CData = [r_flat(valid_idx), g_flat(valid_idx), b_flat(valid_idx)];
end

function restart()
    ROWS = evalin('base', 'ROWS');
    COLS = evalin('base', 'COLS');
    HEAL_RATE = evalin('base', 'HEAL_RATE');
    IMMUNITY_LOSS_RATE = evalin('base', 'IMMUNITY_LOSS_RATE');
    SICKEN_RATE = evalin('base', 'SICKEN_RATE');
    valid_idx = evalin('base','valid_idx');

    h = evalin('base', 'h');

    r = zeros(ROWS, COLS);
    r_history = zeros(ROWS, COLS, HEAL_RATE);
    b = zeros(ROWS, COLS);
    b_history = zeros(ROWS, COLS, IMMUNITY_LOSS_RATE);
    g = ones(ROWS, COLS);
    d = zeros(ROWS, COLS);
    e = zeros(ROWS, COLS);
    e_history = zeros(ROWS, COLS, SICKEN_RATE);

    sickened = zeros(ROWS, COLS);
    healed = zeros(ROWS, COLS);
    infected = zeros(ROWS, COLS);

    paused = true;

    randRow = randi(ROWS);
    randCol = randi(COLS);
    
    r(max(randRow-1, 1):min(randRow+1, ROWS), max(randCol-1, 1):min(randCol+1, COLS)) = 0.1;
    
    r_flat = r(:);
    g_flat = g(:);
    b_flat = b(:);
    h.CData = [r_flat(valid_idx), g_flat(valid_idx), b_flat(valid_idx)];
    drawnow;
    iter = 0;

    h.DataTipTemplate.DataTipRows(3).Value = g_flat(valid_idx) * 100; 
    h.DataTipTemplate.DataTipRows(4).Value = e(:) * 100; 
    h.DataTipTemplate.DataTipRows(5).Value = r_flat(valid_idx) * 100; 
    h.DataTipTemplate.DataTipRows(6).Value = b_flat(valid_idx) * 100;
    h.DataTipTemplate.DataTipRows(7).Value = d(:) * 100; 

    assignin('base', 'r', r);
    assignin('base', 'r_history', r_history);
    assignin('base', 'b', b);
    assignin('base', 'b_history', b_history);
    assignin('base', 'g', g);
    assignin('base', 'd', d);
    assignin('base', 'e', e);
    assignin('base', 'e_history', e_history);
    assignin('base', 'sickened', sickened);
    assignin('base', 'healed', healed);
    assignin('base', 'infected', infected);
    assignin('base', 'paused', paused);
    assignin('base', 'iter', iter);
end

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
sizeGrid = sqrt(data);
sizeGrid = sizeGrid / max(sizeGrid(:));

fig = figure;
h = scatter(x, y, dotSizes, 'g', 'filled', 'MarkerEdgeColor', 'none');
axis tight off;
set(gca, 'YDir', 'reverse', 'Color', 'k');
set(gcf, 'Color', 'k');

% Split indices into 10 roughly equal chunks
numChunks = 6;
N = numel(valid_idx);
batchSize = ceil(N / numChunks);
updateBatches = arrayfun(@(k) ((k-1)*batchSize+1):min(k*batchSize, N), 1:numChunks, 'UniformOutput', false);

currentBatch = 1;  % start at batch 1

% Control Buttons
btnPause = uibutton(fig, 'push', ...
    'Text', 'Pause', ...
    'Position', [20, 20, 80, 30], ...
    'ButtonPushedFcn', @(src,event) assignin('base','paused',true));

btnPlay = uibutton(fig, 'push', ...
    'Text', 'Play', ...
    'Position', [120, 20, 80, 30], ...
    'ButtonPushedFcn', @(src,event) assignin('base','paused',false));

btnVaccinate = uibutton(fig, 'push', ...
    'Text', 'Vaccinate', ...
    'Position', [220, 20, 100, 30], ...
    'ButtonPushedFcn', @(src,event) vaccinate());

btnRestart = uibutton(fig, 'push', ...
    'Text', 'Restart', ...
    'Position', [320, 20, 100, 30], ...
    'ButtonPushedFcn', @(src,event) restart());

paused = false;

r = zeros(ROWS, COLS);
r_history = zeros(ROWS, COLS, HEAL_RATE, 'like', r);
b = zeros(ROWS, COLS);
b_history = zeros(ROWS, COLS, IMMUNITY_LOSS_RATE, 'like', b);
g = ones(ROWS, COLS);
d = zeros(ROWS, COLS);
e = zeros(ROWS, COLS);
e_history = zeros(ROWS, COLS, SICKEN_RATE, 'like', e);

% Create mapping from interpolated points back to original grid
% Round interpolated coordinates to nearest grid cell
x_grid = round(x);
y_grid = round(y);
x_grid = max(1, min(x_grid, COLS));
y_grid = max(1, min(y_grid, ROWS));
valid_idx = sub2ind([ROWS, COLS], y_grid, x_grid);

% Initialize data tools
rowsX = h.DataTipTemplate.DataTipRows(1);
rowsY = h.DataTipTemplate.DataTipRows(2);
susceptibleRow = dataTipTextRow('Susceptible', ones(length(x),1));
exposedRow = dataTipTextRow('Exposed', zeros(length(x),1));
infectedRow = dataTipTextRow('Infected', zeros(length(x),1));
recoveredRow = dataTipTextRow('Recovered', zeros(length(x),1));
deadRow = dataTipTextRow('Dead', zeros(length(x),1));

sickened = zeros(ROWS, COLS);
healed = zeros(ROWS, COLS);
infected = zeros(ROWS, COLS);

% Apply them all
h.DataTipTemplate.DataTipRows = [rowsX, rowsY, susceptibleRow, exposedRow, infectedRow, recoveredRow, deadRow];

randIdx = randi(numel(pop));                  % pick random valid index
linearIdx = valid_idx(randIdx);               % map back to population grid
[randRow, randCol] = ind2sub(size(data), linearIdx);

% Infect a small local region around that cell
r(max(randRow-1, 1):min(randRow+1, ROWS), max(randCol-1, 1):min(randCol+1, COLS)) = 0.1;

% Map to scatter colors
r_flat = r(:);
g_flat = g(:);
b_flat = b(:);
h.CData = [r_flat(valid_idx), g_flat(valid_idx), b_flat(valid_idx)];
iter = 0;
tStart = tic;
drawnow;

% Use GPU for heavy variables
sizeGrid = gpuArray(sizeGrid);
r = gpuArray(r);
g = gpuArray(g);
b = gpuArray(b);
d = gpuArray(d);
e = gpuArray(e);
r_history = gpuArray(r_history);
r_ptr = 1;
b_history = gpuArray(b_history);
b_ptr = 1;
e_history = gpuArray(e_history);
e_ptr = 1;

% Animation loop
while true
    if evalin('base','paused')
        continue;
    end

    iter = iter + 1;

    r_history = cat(3, sickened, r_history(:,:,1:HEAL_RATE - 1));
    b_history = cat(3, healed, b_history(:,:,1:IMMUNITY_LOSS_RATE - 1));
    e_history = cat(3, infected, e_history(:,:,1:SICKEN_RATE - 1));
    
    % Compute neighbor contributions
    neighborSum = conv2(r .* sizeGrid.^1.2, SPREAD_KERNEL, 'same');

    infected = SPREAD_RATE * neighborSum ./ (1 + 3*neighborSum) .* g;
    sickened = e_history(:, :, SICKEN_RATE);
    healed =  r_history(:,:, HEAL_RATE);
    relapsed = b_history(:,:,IMMUNITY_LOSS_RATE);
    dead = FATALITY_RATE .* healed;
    
    % Update r and b
    g = max(min(g - infected + relapsed, 1), 0);
    e = max(min(e + infected - sickened, 1), 0);
    r = max(min(r + sickened - healed, 1), 0);
    b = max(min(b + healed - dead - relapsed, 1), 0);
    d = max(min(d + dead, 1), 0);

    total = g + r + b + d + e;
    g = g ./ total;
    r = r ./ total;
    b = b ./ total;
    d = d ./ total;
    e = e ./ total;

    % Flatten arrays
    r_flat = gather(r(:));
    g_flat = gather(g(:));
    b_flat = gather(b(:));
    e_flat = gather(e(:));
    d_flat = gather(d(:));
    
    % Update only a subset of points
    batch = updateBatches{currentBatch};
    h.CData(batch, :) = [r_flat(valid_idx(batch)), g_flat(valid_idx(batch)), b_flat(valid_idx(batch))];
    
    % Advance batch pointer
    currentBatch = mod(currentBatch, numChunks) + 1;
    
    % Occasionally redraw for performance balance
    if mod(iter, 2) == 0
        drawnow limitrate;
    end
    
    % Monitor ticks per second
    if mod(iter,10)==0
        fprintf('Iter: %d | Iter/s: %.2f\n', iter, 10/toc(tStart));
        tStart = tic;
    end

    % Update data tips for the current iteration
    h.DataTipTemplate.DataTipRows(3).Value = g_flat(valid_idx) * 100; 
    h.DataTipTemplate.DataTipRows(4).Value = e_flat(valid_idx) * 100; 
    h.DataTipTemplate.DataTipRows(5).Value = r_flat(valid_idx) * 100; 
    h.DataTipTemplate.DataTipRows(6).Value = b_flat(valid_idx) * 100;
    h.DataTipTemplate.DataTipRows(7).Value = d_flat(valid_idx) * 100; 

    totals = 100 * [sum(r(:)), sum(g(:)), sum(b(:)), sum(e(:)), sum(d(:))];

    title(sprintf('R: %.1f   G: %.1f   B: %.1f   E: %.1f   D: %.1f', ...
    totals(1), totals(2), totals(3), totals(4), totals(5)), ...
    'FontSize', 12, 'FontWeight', 'bold');
end