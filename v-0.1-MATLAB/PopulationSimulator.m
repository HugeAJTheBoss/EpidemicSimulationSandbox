% Population modifier
ROWS = 50;
COLS = 50;
MU = 5;       % average log scale
SIGMA = 1;  % spread (higher = more extremes)

% Virus Modifiers
SPREAD_RATE = 0.2;
HEAL_RATE = 6;
IMMUNITY_LOSS_RATE = 400;

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
figure;
h = scatter(x, y, dotSizes, ones(length(x),3), 'filled'); % start white
axis off;

r = zeros(ROWS, COLS);
r_history = zeros(ROWS, COLS, HEAL_RATE);
b_history = zeros(ROWS, COLS, IMMUNITY_LOSS_RATE);

% Pick one random cell
randRow = randi(ROWS)
randCol = randi(COLS)

rmax = min(randRow+1, ROWS);
rmin = max(randRow-1, 1);
cmax = min(randCol+1, COLS);
cmin = max(randCol-1, 1);

r(rmin:rmax, cmin:cmax) = 0.15; % Initial intensity

b = zeros(ROWS, COLS);
g = 1-r;

iter = 0;
h.CData = [r(:), g(:), b(:)];
drawnow;

% Animation loop
while true
    r_history = cat(3, r, r_history(:,:,1:HEAL_RATE - 1));
    b_history = cat(3, b, b_history(:,:,1:IMMUNITY_LOSS_RATE - 1));
    iter = iter + 1;
    
    % Compute neighbor contributions
    kernel = [0.2 0.5 0.2; 
              0.5 3.0 0.5; 
              0.2 0.5 0.2];
    kernel = [0 0 0; 
              0 3.0 0; 
              0 0 0];

    neighborSum = conv2(r .* sizeGrid.^1.1, kernel, 'same');

    infected = SPREAD_RATE * neighborSum .* (1 - r - b);
    healed =  0.95 .* max(r_history(:,:,HEAL_RATE - 1) - r_history(:,:,HEAL_RATE), 0);
    
    % Update r and b
    r = r - healed;
    r = max(0, r);
    %b = b - r + r_history(:,:,1);
    b = min(b, 1);
    r = r + infected;
    r = min(r, 1);
    
    % ALWAYS recalculate g to maintain r + g + b = 1
    g = 1 - r - b;
    
    % Update scatter colors
    h.CData = [r(:), g(:), b(:)];
    drawnow;
    pause(1);
end