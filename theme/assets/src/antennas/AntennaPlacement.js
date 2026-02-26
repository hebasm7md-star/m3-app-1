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

    var badge = document.getElementById("footerBadge");
    var msg = document.getElementById("footerMessage");
    if (badge) {
      badge.textContent = "READY";
      badge.classList.remove("manual", "optimizing", "completed");
    }
    if (msg) msg.textContent = "Waiting for adding antenna ...";

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

  // --- Helper: check if a number is prime ---
  function isPrimeNumber(n) {
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    for (var i = 3; i <= Math.sqrt(n); i += 2) {
      if (n % i === 0) return false;
    }
    return true;
  }

  // --- Helper: find (rows, cols) factorization of n closest to canvas aspect ratio ---
  // Uses log-ratio comparison so overshooting and undershooting are treated symmetrically
  function findBestGridFactors(n) {
    var canvasRatio = state.w / state.h;
    var logCanvas = Math.log(canvasRatio);
    var bestCols = n, bestRows = 1;
    var bestDiff = Infinity;

    for (var i = 1; i <= Math.sqrt(n); i++) {
      if (n % i !== 0) continue;
      var j = n / i;

      // Try orientation 1: cols = j, rows = i  (grid ratio = j/i)
      var diff1 = Math.abs(Math.log(j / i) - logCanvas);
      if (diff1 < bestDiff) {
        bestDiff = diff1;
        bestCols = j;
        bestRows = i;
      }

      // Try orientation 2: cols = i, rows = j  (grid ratio = i/j)
      var diff2 = Math.abs(Math.log(i / j) - logCanvas);
      if (diff2 < bestDiff) {
        bestDiff = diff2;
        bestCols = i;
        bestRows = j;
      }
    }

    return { rows: bestRows, cols: bestCols };
  }

  // --- Helper: place antennas in an evenly-spaced rows×cols grid ---
  function placeAntennaGrid(rows, cols, minX, minY, availableWidth, availableHeight) {
    var positions = [];
    var spacingX = availableWidth / (cols + 1);
    var spacingY = availableHeight / (rows + 1);

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        positions.push({
          x: minX + spacingX * (c + 1),
          y: minY + spacingY * (r + 1)
        });
      }
    }
    return positions;
  }

  // Find optimal positions for automatic antenna placement
  // - Perfect square count  → square grid  (√N × √N)
  // - Composite count       → rectangle grid mimicking canvas aspect ratio
  // - Prime count           → place (count-1) in a grid, add extra between the two farthest antennas
  function findOptimalAntennaPositions(count, gridSpacing) {
    if (count <= 0) return [];

    // Use full canvas — edge gap equals inter-antenna spacing
    var minX = 0;
    var minY = 0;
    var availableWidth = state.w;
    var availableHeight = state.h;

    // Single antenna → center of canvas
    if (count === 1) {
      return [{ x: state.w / 2, y: state.h / 2 }];
    }

    // Two antennas → 1×2 or 2×1 rectangle matching canvas shape
    if (count === 2) {
      var grid2 = findBestGridFactors(2);
      return placeAntennaGrid(grid2.rows, grid2.cols, minX, minY, availableWidth, availableHeight);
    }

    var sqrt = Math.sqrt(count);
    var isPerfectSquare = sqrt === Math.floor(sqrt);
    var prime = isPrimeNumber(count);

    // --- Perfect square: square grid ---
    if (isPerfectSquare) {
      var side = Math.floor(sqrt);
      return placeAntennaGrid(side, side, minX, minY, availableWidth, availableHeight);
    }

    // --- Prime: place (count-1) in a grid, then insert extra antenna ---
    if (prime) {
      var gridCount = count - 1; // always even (≥2) for primes ≥3
      var sqrtG = Math.sqrt(gridCount);
      var positions;

      if (sqrtG === Math.floor(sqrtG)) {
        // gridCount is a perfect square
        positions = placeAntennaGrid(Math.floor(sqrtG), Math.floor(sqrtG), minX, minY, availableWidth, availableHeight);
      } else {
        // gridCount is composite → rectangle matching canvas ratio
        var gf = findBestGridFactors(gridCount);
        positions = placeAntennaGrid(gf.rows, gf.cols, minX, minY, availableWidth, availableHeight);
      }

      // Find the two farthest-apart antennas and place extra at their midpoint
      var maxDist = 0, farI = 0, farJ = 1;
      for (var i = 0; i < positions.length; i++) {
        for (var j = i + 1; j < positions.length; j++) {
          var d = hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
          if (d > maxDist) {
            maxDist = d;
            farI = i;
            farJ = j;
          }
        }
      }
      positions.push({
        x: (positions[farI].x + positions[farJ].x) / 2,
        y: (positions[farI].y + positions[farJ].y) / 2
      });

      return positions.slice(0, count);
    }

    // --- Composite (not perfect square): rectangle mimicking canvas aspect ratio ---
    var grid = findBestGridFactors(count);
    return placeAntennaGrid(grid.rows, grid.cols, minX, minY, availableWidth, availableHeight);
  }

  // Fallback — delegates to the main optimal placement function
  function findOptimalAntennaPositionsFallback(count, gridSpacing) {
    return findOptimalAntennaPositions(count, gridSpacing);
  }

  // Simple grid fallback — delegates to the main optimal placement function
  function findValidAntennaPositions(count, gridSpacing) {
    return findOptimalAntennaPositions(count, gridSpacing);
  }

  function performAutoPlacement() {
    var countInput = document.getElementById("autoPlaceCount");
    var count = parseInt(countInput.value);

    if (isNaN(count) || count < 1 || count > 100) {
      NotificationSystem.warning("Please enter a valid number between 1 and 100.");
      return;
    }

    if (!getDefaultAntennaPattern()) {
      NotificationSystem.warning('Please upload an antenna pattern file first using "UPLOAD ANTENNA\'S PATTERN" field.');
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
    // console.log("Placing " + count + " antenna(s) in grid pattern...");

    saveState(); // Save state BEFORE mutating state.aps (fixes auto-placement undo issue)

    state.aps = [];

    // Find optimal positions for antenna placement (square/rectangle/prime logic)
    var positions = findOptimalAntennaPositions(count);

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
  window.isPrimeNumber = isPrimeNumber;
  window.findBestGridFactors = findBestGridFactors;
  window.placeAntennaGrid = placeAntennaGrid;
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
        var label = addAPBtn.querySelector("#addAPBtnLabel");
        if (label) label.textContent = "Placing..."; else addAPBtn.textContent = "Placing...";
        if (canvas) {
          canvas.style.cursor = "crosshair";
        }

        var badge = document.getElementById("footerBadge");
        var msg = document.getElementById("footerMessage");
        if (badge) {
          badge.textContent = "PLACING";
          badge.classList.remove("active", "optimizing", "completed");
          badge.classList.add("manual");
        }
        if (msg) msg.textContent = "Waiting for adding antenna ...";
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
