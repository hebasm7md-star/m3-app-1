//
// AntennaPlacement.js
// Handles all antenna placement — manual one-by-one (user clicks canvas)
// and automatic batch placement (algorithm finds optimal positions).
//
// All functions are exposed on window for global access.
//
// Depends on: global state, document.getElementById() and add() helpers, draw(),
//             renderAPs(), generateHeatmapAsync(), getDefaultAntennaPattern(),
//             modelLoss(), GeometryUtils (hypot, findWallAt)
//
// Called by:
//   Add AP button — toggles placement mode
//   Auto-Place confirm — performAutoPlacement()
//   ESC key — exitAntennaPlacementMode()
//   Canvas mousedown — checks isPointFree() during manual placement
//

(function () {

  function exitAntennaPlacementMode() {
    state.addingAP = false;
    var addAPBtn = document.getElementById("addAP");
    var canvas = document.getElementById("plot");
    if (addAPBtn) {
      addAPBtn.textContent = "Add Antenna";
    }
    if (canvas) {
      canvas.style.cursor = "default";
    }
    draw();
  }

  function isPointFree(
    x,
    y,
    minDistanceFromWalls,
    minDistanceFromAntennas
  ) {
    minDistanceFromWalls = minDistanceFromWalls || 0.5;
    minDistanceFromAntennas = minDistanceFromAntennas || 2.0;

    var padding = 1.0;
    if (
      x < padding ||
      x > state.w - padding ||
      y < padding ||
      y > state.h - padding
    ) {
      return false;
    }

    var point = { x: x, y: y };
    for (var i = 0; i < state.walls.length; i++) {
      var wall = state.walls[i];

      var wallSegments = [];
      if (wall.points && wall.points.length >= 2) {
        for (var j = 0; j < wall.points.length - 1; j++) {
          wallSegments.push({ p1: wall.points[j], p2: wall.points[j + 1] });
        }
      } else if (wall.p1 && wall.p2) {
        wallSegments.push({ p1: wall.p1, p2: wall.p2 });
      } else {
        continue;
      }

      var elementType = wall.elementType || "wall";
      var thickness = 0.15;
      if (elementType === "door" || elementType === "doubleDoor") {
        thickness = 0.05;
      } else if (elementType === "window") {
        thickness = 0.05;
      } else if (
        elementTypes.wall &&
        wall.type &&
        elementTypes.wall[wall.type]
      ) {
        thickness = elementTypes.wall[wall.type].thickness || 0.15;
      }

      for (var j = 0; j < wallSegments.length; j++) {
        var seg = wallSegments[j];
        var p1 = seg.p1;
        var p2 = seg.p2;

        var dx = p2.x - p1.x;
        var dy = p2.y - p1.y;

        if (dx === 0 && dy === 0) continue;

        var t = ((x - p1.x) * dx + (y - p1.y) * dy) / (dx * dx + dy * dy);

        var closestPoint;
        if (t < 0) {
          closestPoint = p1;
        } else if (t > 1) {
          closestPoint = p2;
        } else {
          closestPoint = { x: p1.x + t * dx, y: p1.y + t * dy };
        }

        var dist = hypot(x - closestPoint.x, y - closestPoint.y);
        var requiredDist = minDistanceFromWalls + thickness / 2;

        if (dist < requiredDist) {
          return false;
        }
      }
    }

    for (var i = 0; i < state.aps.length; i++) {
      var ap = state.aps[i];
      var dist = hypot(x - ap.x, y - ap.y);
      if (dist < minDistanceFromAntennas) {
        return false;
      }
    }

    return true;
  }

  function sampleFreeAreas(sampleSpacing) {
    sampleSpacing = sampleSpacing || 1.0;
    var minDistanceFromWalls = 0.5;
    var minDistanceFromAntennas = 0.0;

    var samplePoints = [];

    for (var x = 0; x <= state.w; x += sampleSpacing) {
      for (var y = 0; y <= state.h; y += sampleSpacing) {
        if (
          isPointFree(x, y, minDistanceFromWalls, minDistanceFromAntennas)
        ) {
          samplePoints.push({ x: x, y: y });
        }
      }
    }

    return samplePoints;
  }

  function calculateTotalValue(samplePoints, testAntennas) {
    if (samplePoints.length === 0) return 0;

    var originalAps = state.aps.slice();
    state.aps = testAntennas.slice();

    var totalValue = 0;
    var count = 0;

    for (var i = 0; i < samplePoints.length; i++) {
      var point = samplePoints[i];
      var value = getValueAt(point.x, point.y);

      if (!isNaN(value) && isFinite(value)) {
        totalValue += value;
        count++;
      }
    }

    state.aps = originalAps;

    return count > 0 ? totalValue : -Infinity;
  }

  function findGridAntennaPositions(count) {
    var positions = [];
    var margin = 1.0;

    var minX = margin;
    var maxX = state.w - margin;
    var minY = margin;
    var maxY = state.h - margin;

    var availableWidth = maxX - minX;
    var availableHeight = maxY - minY;

    if (count === 1) {
      positions.push({
        x: state.w / 2,
        y: state.h / 2
      });
      return positions;
    }

    var cols = Math.ceil(Math.sqrt(count));
    var rows = Math.ceil(count / cols);

    while (cols * rows < count) {
      if (cols <= rows) {
        cols++;
      } else {
        rows++;
      }
    }

    if (count === 2) {
      cols = 2;
      rows = 1;
    } else if (count === 4) {
      cols = 2;
      rows = 2;
    } else if (count === 6) {
      cols = 3;
      rows = 2;
    } else if (count === 8) {
      cols = 4;
      rows = 2;
    }

    var spacingX = availableWidth / (cols + 1);
    var spacingY = availableHeight / (rows + 1);

    var isPerfectSquare = Math.sqrt(count) % 1 === 0;

    if (isPerfectSquare && count > 1) {
      var sideLength = Math.sqrt(count);
      cols = sideLength;
      rows = sideLength;
      spacingX = availableWidth / (cols + 1);
      spacingY = availableHeight / (rows + 1);
    }

    if (count % 2 === 0 && !isPerfectSquare) {
      var sqrtCount = Math.sqrt(count);
      var preferredCols = Math.round(sqrtCount);
      var preferredRows = Math.ceil(count / preferredCols);

      if (preferredCols * preferredRows >= count) {
        cols = preferredCols;
        rows = preferredRows;
        spacingX = availableWidth / (cols + 1);
        spacingY = availableHeight / (rows + 1);
      }
    }

    if (count % 2 === 1 && count > 1) {
      positions.push({
        x: state.w / 2,
        y: state.h / 2
      });

      var remaining = count - 1;

      var remainingCols = Math.ceil(Math.sqrt(remaining));
      var remainingRows = Math.ceil(remaining / remainingCols);

      if (remaining === 2) {
        remainingCols = 2;
        remainingRows = 1;
      }

      var remSpacingX = availableWidth / (remainingCols + 1);
      var remSpacingY = availableHeight / (remainingRows + 1);

      var antennaIndex = 0;
      for (var r = 0; r < remainingRows; r++) {
        for (var c = 0; c < remainingCols; c++) {
          if (antennaIndex >= remaining) break;

          var gridX = minX + remSpacingX * (c + 1);
          var gridY = minY + remSpacingY * (r + 1);

          var distFromCenter = hypot(gridX - state.w / 2, gridY - state.h / 2);
          if (distFromCenter < 2.0) {
            var offsets = [
              { x: -3, y: 0 }, { x: 3, y: 0 },
              { x: 0, y: -3 }, { x: 0, y: 3 },
              { x: -3, y: -3 }, { x: 3, y: 3 },
              { x: -3, y: 3 }, { x: 3, y: -3 }
            ];

            for (var o = 0; o < offsets.length; o++) {
              var testX = state.w / 2 + offsets[o].x;
              var testY = state.h / 2 + offsets[o].y;

              if (testX >= minX && testX <= maxX && testY >= minY && testY <= maxY) {
                var tooClose = false;
                for (var existingIdx = 0; existingIdx < positions.length; existingIdx++) {
                  var dist = hypot(testX - positions[existingIdx].x, testY - positions[existingIdx].y);
                  if (dist < 2.0) {
                    tooClose = true;
                    break;
                  }
                }

                if (!tooClose) {
                  positions.push({ x: testX, y: testY });
                  antennaIndex++;
                  break;
                }
              }
            }
          } else {
            positions.push({ x: gridX, y: gridY });
            antennaIndex++;
          }
        }
      }
    } else {
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (positions.length >= count) break;

          var x = minX + spacingX * (c + 1);
          var y = minY + spacingY * (r + 1);

          positions.push({ x: x, y: y });
        }
      }
    }

    while (positions.length < count) {
      var perimeterPoints = [
        { x: minX + 2, y: minY + 2 },
        { x: maxX - 2, y: minY + 2 },
        { x: minX + 2, y: maxY - 2 },
        { x: maxX - 2, y: maxY - 2 },
        { x: state.w / 2, y: minY + 2 },
        { x: state.w / 2, y: maxY - 2 },
        { x: minX + 2, y: state.h / 2 },
        { x: maxX - 2, y: state.h / 2 }
      ];

      for (var i = 0; i < perimeterPoints.length && positions.length < count; i++) {
        var point = perimeterPoints[i];

        var tooClose = false;
        for (var existingIdx = 0; existingIdx < positions.length; existingIdx++) {
          var dist = hypot(point.x - positions[existingIdx].x, point.y - positions[existingIdx].y);
          if (dist < 2.0) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose) {
          positions.push(point);
        }
      }

      if (positions.length < count) {
        var centerX = state.w / 2;
        var centerY = state.h / 2;

        var centerTaken = false;
        for (var existingIdx = 0; existingIdx < positions.length; existingIdx++) {
          if (positions[existingIdx].x === centerX && positions[existingIdx].y === centerY) {
            centerTaken = true;
            break;
          }
        }

        if (!centerTaken) {
          positions.push({ x: centerX, y: centerY });
        }
      }
    }

    return positions.slice(0, count);
  }

  function findOptimalAntennaPositions(count, gridSpacing) {
    gridSpacing = gridSpacing || 2.0;
    var minDistanceFromWalls = 0.5;

    var canvasDiagonal = hypot(state.w, state.h);
    var minDistanceFromAntennas = Math.max(
      (canvasDiagonal / (count + 1)) * 0.7,
      (Math.min(state.w, state.h) / Math.max(count, 2)) * 0.8,
      3.0
    );

    var samplePoints = sampleFreeAreas(1.0);

    if (samplePoints.length === 0) {
      return [];
    }

    var defaultPattern = getDefaultAntennaPattern();
    var defaultTx = 15;
    var defaultGt = 5;
    var defaultCh = 1;

    var cols = Math.ceil(Math.sqrt(count * (state.w / state.h)));
    var rows = Math.ceil(count / cols);
    var regionWidth = state.w / cols;
    var regionHeight = state.h / rows;

    var regionCandidates = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var regionMinX = c * regionWidth;
        var regionMaxX = (c + 1) * regionWidth;
        var regionMinY = r * regionHeight;
        var regionMaxY = (r + 1) * regionHeight;

        var candidates = [];
        for (
          var x = regionMinX + 1.0;
          x < regionMaxX - 1.0;
          x += gridSpacing
        ) {
          for (
            var y = regionMinY + 1.0;
            y < regionMaxY - 1.0;
            y += gridSpacing
          ) {
            if (isPointFree(x, y, minDistanceFromWalls, 0)) {
              candidates.push({ x: x, y: y, region: r * cols + c });
            }
          }
        }
        if (candidates.length > 0) {
          regionCandidates.push(candidates);
        }
      }
    }

    if (regionCandidates.length === 0) {
      return findOptimalAntennaPositionsFallback(count, gridSpacing);
    }

    var selectedPositions = [];
    var currentAps = state.aps.slice();
    var regionUsage = new Array(regionCandidates.length).fill(0);
    var usedRegions = new Set();

    var regionIndices = [];
    for (var i = 0; i < regionCandidates.length; i++) {
      regionIndices.push(i);
    }
    for (var i = regionIndices.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = regionIndices[i];
      regionIndices[i] = regionIndices[j];
      regionIndices[j] = temp;
    }

    for (var antennaIndex = 0; antennaIndex < count; antennaIndex++) {
      var bestPosition = null;
      var bestValue = -Infinity;
      var bestRegionIndex = -1;

      var foundInUnusedRegion = false;
      for (var idx = 0; idx < regionIndices.length; idx++) {
        var regionIdx = regionIndices[idx];
        if (usedRegions.has(regionIdx)) continue;

        var candidates = regionCandidates[regionIdx];
        if (candidates.length === 0) continue;

        for (var i = 0; i < candidates.length; i++) {
          var candidate = candidates[i];

          var tooClose = false;
          for (var j = 0; j < selectedPositions.length; j++) {
            var dist = hypot(
              candidate.x - selectedPositions[j].x,
              candidate.y - selectedPositions[j].y
            );
            if (dist < minDistanceFromAntennas) {
              tooClose = true;
              break;
            }
          }
          if (tooClose) continue;

          var testAp = {
            id: "TEST",
            x: candidate.x,
            y: candidate.y,
            tx: defaultTx,
            gt: 5,
            ch: defaultCh,
            azimuth: 0,
            tilt: 0,
            enabled: true,
          };

          if (defaultPattern) {
            testAp.antennaPattern = defaultPattern;
          }

          var testAntennas = currentAps.concat([testAp]);
          var totalValue = calculateTotalValue(samplePoints, testAntennas);

          if (totalValue > bestValue) {
            bestValue = totalValue;
            bestPosition = candidate;
            bestRegionIndex = regionIdx;
            foundInUnusedRegion = true;
          }
        }

        if (foundInUnusedRegion) break;
      }

      if (!foundInUnusedRegion) {
        for (
          var regionIdx = 0;
          regionIdx < regionCandidates.length;
          regionIdx++
        ) {
          var candidates = regionCandidates[regionIdx];
          if (candidates.length === 0) continue;

          for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i];

            var tooClose = false;
            for (var j = 0; j < selectedPositions.length; j++) {
              var dist = hypot(
                candidate.x - selectedPositions[j].x,
                candidate.y - selectedPositions[j].y
              );
              if (dist < minDistanceFromAntennas) {
                tooClose = true;
                break;
              }
            }
            if (tooClose) continue;

            var testAp = {
              id: "TEST",
              x: candidate.x,
              y: candidate.y,
              tx: defaultTx,
              gt: 5,
              ch: defaultCh,
              azimuth: 0,
              tilt: 0,
              enabled: true,
            };

            if (defaultPattern) {
              testAp.antennaPattern = defaultPattern;
            }

            var testAntennas = currentAps.concat([testAp]);
            var totalValue = calculateTotalValue(
              samplePoints,
              testAntennas
            );

            var penalty = usedRegions.has(regionIdx) ? 0.8 : 1.0;
            var adjustedValue = totalValue * penalty;

            if (adjustedValue > bestValue) {
              bestValue = adjustedValue;
              bestPosition = candidate;
              bestRegionIndex = regionIdx;
            }
          }
        }
      }

      if (bestPosition && bestRegionIndex >= 0) {
        selectedPositions.push(bestPosition);
        usedRegions.add(bestRegionIndex);
        regionUsage[bestRegionIndex]++;

        var newAp = {
          id: "TEMP",
          x: bestPosition.x,
          y: bestPosition.y,
          tx: defaultTx,
          gt: 5,
          ch: defaultCh,
          azimuth: 0,
          tilt: 0,
          enabled: true,
        };
        if (defaultPattern) {
          newAp.antennaPattern = defaultPattern;
        }
        currentAps.push(newAp);
      } else {
        if (selectedPositions.length === 0) {
          return findOptimalAntennaPositionsFallback(count, gridSpacing);
        }
        break;
      }
    }

    return selectedPositions;
  }

  function findOptimalAntennaPositionsFallback(count, gridSpacing) {
    gridSpacing = gridSpacing || 2.0;
    var minDistanceFromWalls = 0.5;
    var minDistanceFromAntennas = 2.0;

    var samplePoints = sampleFreeAreas(1.0);

    if (samplePoints.length === 0) {
      return [];
    }

    var candidatePositions = [];
    for (var x = 1.0; x < state.w - 1.0; x += gridSpacing) {
      for (var y = 1.0; y < state.h - 1.0; y += gridSpacing) {
        if (
          isPointFree(x, y, minDistanceFromWalls, minDistanceFromAntennas)
        ) {
          candidatePositions.push({ x: x, y: y });
        }
      }
    }

    if (candidatePositions.length === 0) {
      if (gridSpacing > 1.0) {
        return findOptimalAntennaPositionsFallback(
          count,
          gridSpacing * 0.7
        );
      }
      return [];
    }

    var defaultPattern = getDefaultAntennaPattern();
    var defaultTx = 15;
    var defaultGt = 5;
    var defaultCh = 1;

    var selectedPositions = [];
    var currentAps = state.aps.slice();

    var canvasDiagonal = hypot(state.w, state.h);
    var minSpacing = Math.max(
      (canvasDiagonal / (count + 1)) * 0.7,
      (Math.min(state.w, state.h) / Math.max(count, 2)) * 0.8,
      3.0
    );

    for (var antennaIndex = 0; antennaIndex < count; antennaIndex++) {
      var bestPosition = null;
      var bestValue = -Infinity;

      for (var i = 0; i < candidatePositions.length; i++) {
        var candidate = candidatePositions[i];

        var tooClose = false;
        for (var j = 0; j < selectedPositions.length; j++) {
          var dist = hypot(
            candidate.x - selectedPositions[j].x,
            candidate.y - selectedPositions[j].y
          );
          if (dist < minSpacing) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        var testAp = {
          id: "TEST",
          x: candidate.x,
          y: candidate.y,
          tx: defaultTx,
          gt: 5,
          ch: defaultCh,
          azimuth: 0,
          tilt: 0,
          enabled: true,
        };

        if (defaultPattern) {
          testAp.antennaPattern = defaultPattern;
        }

        var testAntennas = currentAps.concat([testAp]);
        var totalValue = calculateTotalValue(samplePoints, testAntennas);

        if (totalValue > bestValue) {
          bestValue = totalValue;
          bestPosition = candidate;
        }
      }

      if (bestPosition) {
        selectedPositions.push(bestPosition);

        var newAp = {
          id: "TEMP",
          x: bestPosition.x,
          y: bestPosition.y,
          tx: defaultTx,
          gt: 5,
          ch: defaultCh,
          azimuth: 0,
          tilt: 0,
          enabled: true,
        };
        if (defaultPattern) {
          newAp.antennaPattern = defaultPattern;
        }
        currentAps.push(newAp);
      } else {
        break;
      }
    }

    return selectedPositions;
  }

  function findValidAntennaPositions(count, gridSpacing) {
    gridSpacing = gridSpacing || 3.0;
    var minDistanceFromWalls = 0.5;
    var minDistanceFromAntennas = 2.0;

    var validPositions = [];
    var gridPoints = [];

    for (var x = 1.0; x < state.w - 1.0; x += gridSpacing) {
      for (var y = 1.0; y < state.h - 1.0; y += gridSpacing) {
        gridPoints.push({ x: x, y: y });
      }
    }

    for (var i = gridPoints.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = gridPoints[i];
      gridPoints[i] = gridPoints[j];
      gridPoints[j] = temp;
    }

    for (
      var i = 0;
      i < gridPoints.length && validPositions.length < count;
      i++
    ) {
      var point = gridPoints[i];
      if (
        isPointFree(
          point.x,
          point.y,
          minDistanceFromWalls,
          minDistanceFromAntennas
        )
      ) {
        validPositions.push(point);
      }
    }

    if (validPositions.length < count && gridSpacing > 1.0) {
      var additionalPositions = findValidAntennaPositions(
        count - validPositions.length,
        gridSpacing * 0.7
      );
      validPositions = validPositions.concat(additionalPositions);
    }

    return validPositions.slice(0, count);
  }

  function performAutoPlacement() {
    var countInput = document.getElementById("autoPlaceCount");
    var count = parseInt(countInput.value);

    if (isNaN(count) || count < 1 || count > 100) {
      alert("Please enter a valid number between 1 and 100.");
      return;
    }

    if (!getDefaultAntennaPattern()) {
      alert(
        'Please upload an antenna pattern file first using "UPLOAD ANTENNA\'S PATTERN" field.'
      );
      return;
    }

    var confirmMsg = 
      "<p>You are about to automatically place <strong>" + count + " antenna(s)</strong> on the canvas.</p>" +
      "<ul>" +
      "<li>They will be distributed evenly in a grid pattern.</li>";

    if (state.aps && state.aps.length > 0) {
      confirmMsg += "<li><strong>Warning:</strong> All existing antennas will be removed!</li>";
    }

    confirmMsg += "</ul><p>Do you want to proceed?</p>";

    NotificationSystem.confirm(confirmMsg, "Confirm Automatic Placement", function(confirmed) {
      if (confirmed) {
        executeAutoPlacement(count);
      } else {
        document.getElementById("autoPlaceInputContainer").style.display = "none";
        countInput.value = "";
      }
    }, { isHtml: true });
  }

  function executeAutoPlacement(count) {
    var countInput = document.getElementById("autoPlaceCount");
    var viewModeName =
      state.view === "rssi"
      ? "RSSI"
      : state.view === "snr"
      ? "SNR"
      : state.view === "cci"
      ? "CCI Count"
      : state.view === "thr"
      ? "Throughput"
      : "Signal";
    console.log("Placing " + count + " antenna(s) in grid pattern...");

    saveState(); // Save state BEFORE mutating state.aps (fixes auto-placement undo issue)

    state.aps = [];

    var positions = findGridAntennaPositions(count);

    if (positions.length === 0) {
      NotificationSystem.warning("Could not find any free areas to place antennas.\nPlease check your canvas layout.");
      return;
    }

    if (positions.length < count) {
      NotificationSystem.warning("Only found " + positions.length + " valid positions out of " + count + " requested.");

    }

    console.log("Placed " + positions.length + " antenna(s) in grid pattern.");

    var defaultPattern = getDefaultAntennaPattern();
    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      var id = "ANT" + (state.aps.length + 1);
      var ap = {
        id: id,
        x: pos.x,
        y: pos.y,
        tx: 15,
        gt: 5,//(defaultPattern ? defaultPattern.gain : defaultGt),
        ch: 1,
        azimuth: 0,
        tilt: 0,
        antennaPatternFile: null,
        antennaPatternFileName: null,
      };

      if (defaultPattern) {
        ap.antennaPattern = defaultPattern;
        ap.antennaPatternFileName = (defaultPattern && defaultPattern.name) ? defaultPattern.name : null
        //ap.antennaPatternFileName = defaultPattern.fileName || (defaultPattern.name ? defaultPattern.name : null);
      }

      state.aps.push(ap);
      logAntennaPositionChange(ap.id, ap.id, ap.x, ap.y, ap.x, ap.y);
    }
    var requestId = "antennas_batch_status_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    console.log("Sending antennas batch status update to backend:", state.aps);

    window.parent.postMessage(
      {
        type: "antennas_batch_status_update",
        requestId: requestId,
        antennas: state.aps,
      },
      "*"
    );

    renderAPs();
    state.heatmapUpdatePending = true;
    draw();
    requestAnimationFrame(function () {
      if (state.showVisualization) {
        generateHeatmapAsync(null, true);
      } else {
        state.heatmapUpdatePending = false;
      }
    });

    document.getElementById("autoPlaceInputContainer").style.display = "none";
    countInput.value = "";

    //showAnvilNotification("Successfully placed " + positions.length + " antenna(s)!", "Success", "success");

    setTimeout(function () {

      // Auto-download RSRP for each placed antenna (staggered to avoid browser blocking)
      // state.aps.forEach(function (ap, idx) {
      //   setTimeout(function () {
      //     DataExportSystem.exportAntennaRsrp(ap, ap.id + "_rsrp.csv", 1.0);
      //   }, (idx + 1) * 500);
      // });
    }, 300);
  }

  window.exitAntennaPlacementMode = exitAntennaPlacementMode;
  window.isPointFree = isPointFree;
  window.sampleFreeAreas = sampleFreeAreas;
  window.calculateTotalValue = calculateTotalValue;
  window.findGridAntennaPositions = findGridAntennaPositions;
  window.findOptimalAntennaPositions = findOptimalAntennaPositions;
  window.findOptimalAntennaPositionsFallback = findOptimalAntennaPositionsFallback;
  window.findValidAntennaPositions = findValidAntennaPositions;
  window.performAutoPlacement = performAutoPlacement;

  document.addEventListener("DOMContentLoaded", function () {

    var addAPBtn = document.getElementById("addAP");
    if (addAPBtn) if (addAPBtn) addAPBtn.addEventListener("click", function () {
      //if (state.isOptimizing) {
      //  alert("Cannot add antennas while optimization is in progress. Please wait for optimization to complete.");
      //  return;
      //}
      if (!getDefaultAntennaPattern() && !state.addingAP) {
        NotificationSystem.warning("Please upload an antenna pattern first before adding antennas.");
        return;
      }

      state.addingAP = !state.addingAP;
      var addAPBtn = document.getElementById("addAP");
      var canvas = document.getElementById("plot");
      if (state.addingAP) {
        state.addingWall = false;
        state.addingFloorPlane = false;
        state.isCalibrating = false;
        addAPBtn.textContent = "Placing...";
        if (canvas) {
          canvas.style.cursor = "crosshair";
        }
        var addFloorPlaneBtn = document.getElementById("addFloorPlane");
        if (addFloorPlaneBtn) {
          addFloorPlaneBtn.textContent = "Add Floor Plane";
        }
        var addWallBtn = document.getElementById("addWall");
        if (addWallBtn) {
          addWallBtn.textContent = getAddButtonText(false);
        }

        var sidebar = document.getElementById("mainSidebar");
        if (sidebar && sidebar.classList.contains("expanded")) {
          sidebar.classList.remove("expanded");
          var iconButtons = document.querySelectorAll(".icon-btn");
          iconButtons.forEach(function (b) {
            b.classList.remove("active");
          });
          if (iconSidebarData) {
            iconSidebarData.currentSection = null;
          }
          setTimeout(function () {
            if (typeof constrainLegendPosition === "function") {
              constrainLegendPosition(true);
            }
          }, 350);
        }
      } else {
        exitAntennaPlacementMode();
      }
      draw();
    });

    var autoPlaceBtn = document.getElementById("autoPlaceAntennas");
    if (autoPlaceBtn) if (autoPlaceBtn) autoPlaceBtn.addEventListener("click", function () {
      //if (state.isOptimizing) {
      //  alert("Cannot place antennas automatically while optimization is in progress. Please wait for optimization to complete.");
      //  return;
      //}

      if (!getDefaultAntennaPattern()) {
        NotificationSystem.warning("Please upload an antenna pattern first before using automatic placement.");

        return;
      }

      var inputContainer = document.getElementById("autoPlaceInputContainer");
      if (inputContainer.style.display === "none") {
        inputContainer.style.display = "block";
        document.getElementById("autoPlaceCount").focus();
        document.getElementById("autoPlaceCount").value = "";
      } else {
        inputContainer.style.display = "none";
      }
    });

    var countInput = document.getElementById("autoPlaceCount");
    if (countInput) countInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        performAutoPlacement();
      } else if (e.key === "Escape") {
        document.getElementById("autoPlaceInputContainer").style.display = "none";
        countInput.value = "";
      }
    });

    var confirmAutoPlaceBtn = document.getElementById("confirmAutoPlaceBtn");
    if (confirmAutoPlaceBtn) confirmAutoPlaceBtn.addEventListener("click", performAutoPlacement);

  });

})();
