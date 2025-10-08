% Grid size
ROWS = 50;
COLS = 50;
MU = 5;       % average log scale
SIGMA = 1;  % spread (higher = more extremes)
SPREAD_RATE = 0.2;
HEAL_RATE = 10;

population = round(lognrnd(MU, SIGMA, ROWS, COLS));

% Display population as heatmap
[x, y] = meshgrid(1:COLS, 1:ROWS);  % grid coordinates
x = x(:);  % flatten to vectors
y = y(:);
pop = population(:);  % flatten population matrix

sizeGrid = reshape(dotSizes, ROWS, COLS) / 100; % scale down

% Scale dot sizes
dotSizes = pop;           % size proportional to population
dotSizes = 1 + 300*dotSizes/max(dotSizes); % normalize for visibility

% Plot
figure;
h = scatter(x, y, dotSizes, ones(length(x),3), 'filled'); % start white
axis off;

r = zeros(ROWS, COLS);
r_history = zeros(ROWS, COLS, HEAL_RATE);

% Pick one random cell
randRow = randi(ROWS)
randCol = randi(COLS)

% Give it a small red value
r(randRow-1:randRow+1, randCol-1:randCol+1) = 0.01;   % Starting Intensity

b = zeros(ROWS, COLS);

iter = 0;

% Animation loop
while true
    r_history = cat(3, r, r_history(:,:,1:HEAL_RATE - 1));
    iter = iter + 1;  

    % Pad both red and size matrices for border handling
    r_p = padarray(r, [1, 1], 'replicate');
    s_p = padarray(sizeGrid, [1, 1], 'replicate');
    
    % Compute neighbor contributions
    neighborSum = ...
        0.5 * r_p(1:end-2, 1:end-2).*s_p(1:end-2, 1:end-2) + ...
        r_p(1:end-2, 2:end-1).*s_p(1:end-2, 2:end-1) + ...
        0.5 * r_p(1:end-2, 3:end).*s_p(1:end-2, 3:end) + ...
        r_p(2:end-1, 1:end-2).*s_p(2:end-1, 1:end-2) + ...
        2 * r_p(2:end-1, 2:end-1).*s_p(2:end-1, 2:end-1) + ...
        r_p(2:end-1, 3:end).*s_p(2:end-1, 3:end) + ...
        0.5 * r_p(3:end, 1:end-2).*s_p(3:end, 1:end-2) + ...
        r_p(3:end, 2:end-1).*s_p(3:end, 2:end-1) + ...
        0.5 * r_p(3:end, 3:end).*s_p(3:end, 3:end);

    r = r + spreadRate * neighborSum .* (1 - r) - 0.8 .* (r_history(:,:,HEAL_RATE).^2);
    
    % Clamp to [0,1]
    r = max(0, min(r, 1));
    b = min(0.8 .* r_history(:,:,HEAL_RATE).^2 + b, 1);

    g = 1 - r - b;

    r(randRow, randCol)

    r_history(randRow, randCol ,4)
    
    % Update scatter colors
    h.CData = [r(:), g(:), b(:)];
    drawnow;
    pause(1);
end