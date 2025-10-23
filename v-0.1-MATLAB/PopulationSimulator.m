% Population modifier
ROWS = 50;
COLS = 50;
MU = 5;       % average log scale
SIGMA = 1;  % spread (higher = more extremes)

% Virus Modifiers
SPREAD_RATE = 0.33;
SICKEN_RATE = 8; 
HEAL_RATE = 7;
IMMUNITY_LOSS_RATE = 300;
FATALITY_RATE = 892/1000000;
SPREAD_KERNEL = [0.2 0.5 0.2; 
          0.5 1.0 0.5; 
          0.2 0.5 0.2];

function vaccinate()
    r = evalin('base','r');
    b = evalin('base','b');
    g = evalin('base','g');

    b_history = evalin('base', 'b_history');
    IMMUNITY_LOSS_RATE = evalin('base', 'IMMUNITY_LOSS_RATE');

    % Take 90% of susceptible (green) and turn them blue
    b = max(0, min(b + 0.9 * g, 1));
    g = max(0, min(g - 0.9 * g, 1));

    b_history = cat(3, b, b_history(:,:,1:IMMUNITY_LOSS_RATE - 1));

    assignin('base','b',b);
    assignin('base','g',g);
    assignin('base', 'b_history', b_history);

    % Update scatter colors
    h = evalin('base','h');
    h.CData = [r(:), g(:), b(:)];
end

function restart()
    ROWS = evalin('base', 'ROWS');
    COLS = evalin('base', 'COLS');
    HEAL_RATE = evalin('base', 'HEAL_RATE');
    IMMUNITY_LOSS_RATE = evalin('base', 'IMMUNITY_LOSS_RATE');
    SICKEN_RATE = evalin('base', 'SICKEN_RATE');

    h = evalin('base', 'h');

    r = zeros(ROWS, COLS);
    r_history = zeros(ROWS, COLS, HEAL_RATE);
    b = zeros(ROWS, COLS);
    b_history = zeros(ROWS, COLS, IMMUNITY_LOSS_RATE);
    g = 1-r;
    d = zeros(ROWS, COLS);
    e = zeros(ROWS, COLS);
    e_history = zeros(ROWS, COLS, SICKEN_RATE);

    sickened = zeros(ROWS, COLS);
    healed = zeros(ROWS, COLS);
    infected = zeros(ROWS, COLS);

    paused = true;

    randRow = randi(ROWS)
    randCol = randi(COLS)
    
    r(max(randRow-1, 1):min(randRow+1, ROWS), max(randCol-1, 1):min(randCol+1, COLS)) = 0.1; % Initial intensity
    
    h.CData = [r(:), g(:), b(:)];
    drawnow;
    iter = 0;

    h.DataTipTemplate.DataTipRows(3).Value = g(:) * 100; 
    h.DataTipTemplate.DataTipRows(4).Value = e(:) * 100; 
    h.DataTipTemplate.DataTipRows(5).Value = r(:) * 100; 
    h.DataTipTemplate.DataTipRows(6).Value = b(:) * 100;
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


population = round(lognrnd(MU, SIGMA, ROWS, COLS));

% Display population as heatmap
[x, y] = meshgrid(1:COLS, 1:ROWS);  % grid coordinates
x = x(:);  % flatten to vectors
y = y(:);
pop = population(:);  % flatten population matrix

% Scale dot sizes
dotSizes = pop;           % size proportional to population
dotSizes = 1 + 100*dotSizes/max(dotSizes); % normalize for visibility

sizeGrid = reshape(dotSizes, ROWS, COLS) / 67; % scale down

% Plot
fig = figure;
h = scatter(x, y, dotSizes, ones(length(x),3), 'filled'); % start white
axis off;

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
r_history = zeros(ROWS, COLS, HEAL_RATE);
b = zeros(ROWS, COLS);
b_history = zeros(ROWS, COLS, IMMUNITY_LOSS_RATE);
g = 1-r;
d = zeros(ROWS, COLS);
e = zeros(ROWS, COLS);
e_history = zeros(ROWS, COLS, SICKEN_RATE);

% Initialize data tools
rowsX = h.DataTipTemplate.DataTipRows(1);
rowsY = h.DataTipTemplate.DataTipRows(2);
susceptibleRow = dataTipTextRow('Susceptible', g(:));
exposedRow = dataTipTextRow('Exposed', e(:));
infectedRow = dataTipTextRow('Infected', r(:));
recoveredRow = dataTipTextRow('Recovered', b(:));
deadRow = dataTipTextRow('Dead', d(:));

sickened = zeros(ROWS, COLS);
healed = zeros(ROWS, COLS);
infected = zeros(ROWS, COLS);

% Apply them all
h.DataTipTemplate.DataTipRows = [rowsX, rowsY, susceptibleRow, exposedRow, infectedRow, recoveredRow, deadRow];

% Pick one random cell
randRow = randi(ROWS)
randCol = randi(COLS)

r(max(randRow-1, 1):min(randRow+1, ROWS), max(randCol-1, 1):min(randCol+1, COLS)) = 0.1; % Initial intensity

h.CData = [r(:), g(:), b(:)];
iter = 0;
drawnow;

% Animation loop
while true
    pause(0.02);

    if evalin('base','paused')
        continue;
    end

    iter = iter + 1  % Increment iteration counter

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
    r = max(min(r + infected - healed, 1), 0);
    b = max(min(b + healed - dead - relapsed, 1), 0);
    d = max(min(d + dead, 1), 0); % accumulate dead

    total = g + r + b + d + e;
    g = g ./ total;
    r = r ./ total;
    b = b ./ total;
    d = d ./ total;
    e = e ./ total;

    % Color: include d (e.g., make dead black)
    h.CData = [r(:), g(:), b(:)] .* (1 - d(:)); % darker if more dead
    drawnow;

    % Update data tips for the current iteration
    h.DataTipTemplate.DataTipRows(3).Value = g(:) * 100; 
    h.DataTipTemplate.DataTipRows(4).Value = e(:) * 100; 
    h.DataTipTemplate.DataTipRows(5).Value = r(:) * 100; 
    h.DataTipTemplate.DataTipRows(6).Value = b(:) * 100;
    h.DataTipTemplate.DataTipRows(7).Value = d(:) * 100; 

    totals = 100 * [sum(r(:)), sum(g(:)), sum(b(:)), sum(e(:)), sum(d(:))];

    title(sprintf('R: %.1f   G: %.1f   B: %.1f   E: %.1f   D: %.1f', ...
    totals(1), totals(2), totals(3), totals(4), totals(5)), ...
    'FontSize', 12, 'FontWeight', 'bold');
end