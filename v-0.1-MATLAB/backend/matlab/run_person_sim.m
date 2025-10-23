function outJson = run_person_sim(steps)
%RUN_PERSON_SIM Return a mock per-person timeline as JSON
if nargin < 1 || isempty(steps)
    steps = 10;
end

timeline = rand(1, steps);
res.steps = steps;
res.timeline = timeline;
outJson = jsonencode(res);
end
