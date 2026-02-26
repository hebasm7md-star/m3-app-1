// 05-CSV-COVERAGE-SYSTEM.js - Handles parsing, interpolating, and mapping uploaded CSV coverage data
// Depends on: global state, bestApAt, _propModel, modelLoss, sinrAt, cciAt, countInterferingAntennas, throughputFromSinr

var CSVCoverageSystem = (function () {

  // Contour line drawing using marching squares
  // Pre-compute a grid of interpolated values from CSV data for fast lookup
  function buildCsvCoverageGrid() {
    if (
      !state.csvCoverageData ||
      !state.csvCoverageData.points ||
      state.csvCoverageData.points.length === 0
    ) {
      state.csvCoverageGrid = null;
      return;
    }

    var points = state.csvCoverageData.points;
    var power = 2;
    var minDistance = 0.01;
    var k = Math.min(8, Math.max(3, Math.floor(points.length / 10)));

    // Use a reasonable grid resolution (coarser than final render for performance)
    // But make it fine enough to capture variation
    var gridRes = Math.max(state.res * 1.5, 0.3); // At least 0.3m resolution for better detail
    var cols = Math.max(30, Math.floor(state.w / gridRes));
    var rows = Math.max(20, Math.floor(state.h / gridRes));
    var cellWidth = state.w / cols; // Renamed to avoid conflict
    var cellHeight = state.h / rows; // Renamed to avoid conflict

    var gridData = new Float32Array(cols * rows);

    // Pre-compute interpolated values for each grid cell
    for (var r = 0; r < rows; r++) {
      var y = (r + 0.5) * cellHeight;
      for (var c = 0; c < cols; c++) {
        var x = (c + 0.5) * cellWidth;
        var idx = r * cols + c;

        // Skip exact match check - always interpolate for smoother results

        // Use k-nearest neighbors with adaptive search radius
        var k = Math.min(12, Math.max(4, Math.floor(points.length / 1000))); // Use 4-12 nearest points
        var nearest = [];
        var maxDistSq = Infinity;

        // First pass: find k nearest neighbors
        for (var i = 0; i < points.length; i++) {
          var p = points[i];
          var deltaX = p.x - x;
          var deltaY = p.y - y;
          var distSq = deltaX * deltaX + deltaY * deltaY;

          if (nearest.length < k) {
            nearest.push({ distSq: distSq, rsrp: p.rsrp });
            if (nearest.length === k) {
              // Sort by distance and keep k nearest
              nearest.sort(function (a, b) {
                return b.distSq - a.distSq;
              });
              maxDistSq = nearest[0].distSq;
            }
          } else if (distSq < maxDistSq) {
            // Replace farthest with this closer point
            nearest[0] = { distSq: distSq, rsrp: p.rsrp };
            nearest.sort(function (a, b) {
              return b.distSq - a.distSq;
            });
            maxDistSq = nearest[0].distSq;
          }
        }

        if (nearest.length === 0) {
          gridData[idx] = NaN;
          continue;
        }

        // Use inverse distance weighting on k nearest neighbors
        var numerator = 0;
        var denominator = 0;
        var power = 2;

        // Sort by distance (closest first) for weighting
        nearest.sort(function (a, b) {
          return a.distSq - b.distSq;
        });

        for (var i = 0; i < nearest.length; i++) {
          var dist = Math.sqrt(nearest[i].distSq);
          var weight = 1 / Math.pow(dist + 0.001, power);
          numerator += weight * nearest[i].rsrp;
          denominator += weight;
        }

        if (denominator > 0) {
          gridData[idx] = numerator / denominator;
        } else {
          gridData[idx] = nearest[0].rsrp; // Use closest point (now first after sort)
        }

        // Debug: log first few grid cells to see variation
        if (r < 3 && c < 3) {
          var rsrpValues = nearest.map(function (n) {
            return n.rsrp.toFixed(2);
          });
          console.log(
            "Grid cell [" +
            r +
            "," +
            c +
            "] at (" +
            x.toFixed(2) +
            "," +
            y.toFixed(2) +
            "): " +
            nearest.length +
            " neighbors, RSRPs: " +
            rsrpValues.join(", ") +
            ", interpolated: " +
            gridData[idx].toFixed(2)
          );
        }
      }
    }

    state.csvCoverageGrid = {
      data: gridData,
      cols: cols,
      rows: rows,
      dx: cellWidth,
      dy: cellHeight,
    };
  }

  // Fast lookup from pre-computed grid with bilinear interpolation for smooth rendering
  function interpolateRsrpFromCsv(x, y) {
    if (!state.csvCoverageGrid) {
      return null;
    }

    var grid = state.csvCoverageGrid;

    // Calculate exact grid position (not just cell index)
    var col = x / grid.dx;
    var row = y / grid.dy;

    // Get the four surrounding grid cells for bilinear interpolation
    var col0 = Math.floor(col);
    var row0 = Math.floor(row);
    var col1 = Math.min(col0 + 1, grid.cols - 1);
    var row1 = Math.min(row0 + 1, grid.rows - 1);

    // Clamp to grid bounds
    col0 = Math.max(0, Math.min(grid.cols - 1, col0));
    row0 = Math.max(0, Math.min(grid.rows - 1, row0));

    // Get the four corner values
    var idx00 = row0 * grid.cols + col0;
    var idx01 = row0 * grid.cols + col1;
    var idx10 = row1 * grid.cols + col0;
    var idx11 = row1 * grid.cols + col1;

    var v00 = grid.data[idx00];
    var v01 = grid.data[idx01];
    var v10 = grid.data[idx10];
    var v11 = grid.data[idx11];

    // Check if any values are NaN
    var hasNaN = isNaN(v00) || isNaN(v01) || isNaN(v10) || isNaN(v11);
    if (hasNaN) {
      // If some values are NaN, use nearest neighbor instead
      var nearestCol = Math.round(col);
      var nearestRow = Math.round(row);
      nearestCol = Math.max(0, Math.min(grid.cols - 1, nearestCol));
      nearestRow = Math.max(0, Math.min(grid.rows - 1, nearestRow));
      var nearestIdx = nearestRow * grid.cols + nearestCol;
      var nearestValue = grid.data[nearestIdx];
      if (isNaN(nearestValue)) {
        return null;
      }
      return nearestValue;
    }

    // Calculate fractional parts for interpolation
    var fx = col - col0;
    var fy = row - row0;

    // Clamp fractional parts to [0, 1]
    fx = Math.max(0, Math.min(1, fx));
    fy = Math.max(0, Math.min(1, fy));

    // Bilinear interpolation
    var v0 = v00 * (1 - fx) + v01 * fx; // Interpolate along top edge
    var v1 = v10 * (1 - fx) + v11 * fx; // Interpolate along bottom edge
    var value = v0 * (1 - fy) + v1 * fy; // Interpolate vertically

    return value;
  }

  function getValueAt(x, y) {
    // If CSV coverage data is available and view is RSSI, use CSV data
    if (state.csvCoverageData && state.view === "rssi") {
      var csvValue = interpolateRsrpFromCsv(x, y);
      if (csvValue !== null) {
        return csvValue;
      }
    }

    // Call global functions safely
    var bestN = typeof window.bestApAt === 'function' ? window.bestApAt(x, y) : {ap: null, rssiDbm: -100};
    var selectedAP = null;
    var viewedAP = null;

    // Check for selected antenna (from sidebar selection)
    for (var i = 0; i < state.aps.length; i++) {
      if (state.aps[i].id === state.selectedApId) {
        selectedAP = state.aps[i];
        break;
      }
    }

    // Check for viewed antenna (from canvas click, temporary)
    if (state.viewedApId) {
      for (var i = 0; i < state.aps.length; i++) {
        if (state.aps[i].id === state.viewedApId) {
          viewedAP = state.aps[i];
          break;
        }
      }
    }

    // Use selected AP if highlight is enabled and antenna is enabled, otherwise use viewed AP
    var useOnlySelected = state.highlight && selectedAP && selectedAP.enabled !== false;
    var useViewed = viewedAP && !useOnlySelected && viewedAP.enabled !== false;
    var apToUse = useOnlySelected
      ? selectedAP
      : useViewed
        ? viewedAP
        : null;

    if (apToUse && window._propModel && typeof window.modelLoss === 'function') {
      bestN.ap = apToUse;
      bestN.rssiDbm = window._propModel.rssi(
        apToUse.tx,
        window._propModel.getAngleDependentGain(apToUse, {x: x, y: y}),
        window.modelLoss(apToUse.x, apToUse.y, x, y)
      );
    }

    var value;
    if (state.view === "rssi") {
      value = bestN.rssiDbm;
    } else if (state.view === "snr") {
      value = bestN.rssiDbm - state.noise;
    } else if (state.view === "sinr") {
      // SINR = S / (I + N) in dB, using same interference model as throughput view
      var IdbmSinr = typeof window.cciAt === 'function' ? window.cciAt(x, y, bestN.ap) : -100;
      value = typeof window.sinrAt === 'function' ? window.sinrAt(bestN.rssiDbm, IdbmSinr) : bestN.rssiDbm - state.noise;
    } else if (state.view === "cci") {
      // Count interfering antennas (power > -85, same channel as best server)
      value = typeof window.countInterferingAntennas === 'function' ? window.countInterferingAntennas(x, y, bestN.ap) : 0;
    } else if (state.view === "thr") {
      var Idbm2 = typeof window.cciAt === 'function' ? window.cciAt(x, y, bestN.ap) : -100;
      var sinr = typeof window.sinrAt === 'function' ? window.sinrAt(bestN.rssiDbm, Idbm2) : bestN.rssiDbm - state.noise;
      value = typeof window.throughputFromSinr === 'function' ? window.throughputFromSinr(sinr) : 0;
    } else {
      value = bestN.rssiDbm;
    }
    return value;
  }

  // Expose public API
  window.buildCsvCoverageGrid = buildCsvCoverageGrid;
  window.interpolateRsrpFromCsv = interpolateRsrpFromCsv;
  window.getValueAt = getValueAt;

  return {
    buildCsvCoverageGrid: buildCsvCoverageGrid,
    interpolateRsrpFromCsv: interpolateRsrpFromCsv,
    getValueAt: getValueAt
  };
})();
