[data, R] = readgeoraster('gpw_v4_population_density_rev11_2020_15_min.tif');

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

dotSizes = sqrt(pop);
dotSizes = dotSizes / max(dotSizes) * 10;

figure;
scatter(x, y, dotSizes, 'g', 'filled', 'MarkerEdgeColor', 'none');
axis equal tight off;
set(gca, 'YDir', 'reverse', 'Color', 'k');
set(gcf, 'Color', 'k');