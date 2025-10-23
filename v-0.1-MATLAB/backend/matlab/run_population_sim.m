function outJson = run_population_sim(rows, cols)
%RUN_POPULATION_SIM Create a population matrix and return JSON
%   outJson = run_population_sim(rows, cols)

if nargin < 1 || isempty(rows)
    rows = 50;
end
if nargin < 2 || isempty(cols)
    cols = 50;
end

MU = 5;
SIGMA = 1;

population = round(lognrnd(MU, SIGMA, rows, cols));

% Prepare a simple struct to return
res.rows = rows;
res.cols = cols;
res.population = population;

% Use matlab's jsonencode; convert numeric matrix to cell to keep JSON arrays
res.population = mat2cell(population, ones(1,rows), ones(1,cols));
outJson = jsonencode(res);
end
