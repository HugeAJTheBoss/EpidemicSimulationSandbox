function outJson = run_person_sim(steps)
%RUN_PERSON_SIM Generate a simple per-person timeline and return JSON
%
% USAGE
%   outJson = run_person_sim(steps)
%
% PURPOSE
%   This wrapper returns a small time series (timeline) for a single person.
%   The data is encoded as a JSON string so the Python backend (or any other
%   caller) can parse it. This is useful both as a small test endpoint and as
%   a starting point for more complex person-level simulations.
%
% OUTPUT SCHEMA (JSON)
%   {
%     "steps": <number>,
%     "timeline": [v0, v1, v2, ...]
%   }

if nargin < 1 || isempty(steps)
    steps = 10;
end

% Generate a simple random timeline in [0,1). Replace this with a real
% per-person model if required (infection state, mobility, etc.).
timeline = rand(1, steps);

res.steps = steps;
res.timeline = timeline;
outJson = jsonencode(res);
end
