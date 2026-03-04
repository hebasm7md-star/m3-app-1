//
// AntennaPlacement.js
// Handles all antenna placement — manual one-by-one (user clicks canvas)
// and automatic batch placement (algorithm finds optimal positions).
//
// All functions are exposed on window for global access.
//
// Depends on: global state, draw(), renderAPs(), generateHeatmapAsync(),
//             getDefaultAntennaPattern(), getValueAt(), hypot(),
//             saveState(), logAntennaPositionChange(), NotificationSystem,
//             getAddButtonText(), iconSidebarData, constrainLegendPosition()
//
// Called by:
//   Add AP button         — toggles placement mode
//   Auto-Place confirm    — performAutoPlacement()
//   ESC key               — exitAntennaPlacementMode()
//   Canvas mousedown      — isPointFree() during manual placement
//

(function () {

  // ---------------------------------------------------------------------------
  // Constants — all magic numbers in one place, named for clarity
  // ---------------------------------------------------------------------------
  var CANVAS_EDGE_PADDING       = 1.0;   // metres — min distance from canvas border
  var DEFAULT_WALL_CLEARANCE    = 0.5;   // metres — min distance from any wall segment
  var DEFAULT_ANTENNA_CLEARANCE = 2.0;   // metres — min distance between antennas
  var DEFAULT_WALL_THICKNESS    = 0.15;  // metres — fallback wall thickness
  var THIN_ELEMENT_THICKNESS    = 0.05;  // metres — doors, windows
  var DEFAULT_TX_POWER          = 15;    // dBm
  var DEFAULT_GAIN              = 5;     // dBi
  var DEFAULT_CHANNEL           = 1;
  var PARENT_ORIGIN             = "*";   
  var dom = {};  // DOM cache — populated once in DOMContentLoaded, used everywhere else
  // ---------------------------------------------------------------------------
  // Footer status helper
  // ---------------------------------------------------------------------------
  /**
   * Update the footer badge and status message in one call.
   * @param {string}      badgeText   — label shown in the badge
   * @param {string|null} badgeClass  — CSS modifier to add (null = none)
   * @param {string}      messageText — text shown beside the badge
   */
  function setFooterStatus(badgeText, badgeClass, messageText) {
    if (dom.badge) {
      dom.badge.textContent = badgeText;
      dom.badge.classList.remove("manual", "optimizing", "completed", "active");
      if (badgeClass) dom.badge.classList.add(badgeClass);
    }
    if (dom.footerMsg) dom.footerMsg.textContent = messageText;
  }

  // ---------------------------------------------------------------------------
  // Placement mode — enter / exit
  // ---------------------------------------------------------------------------

  function exitAntennaPlacementMode() {
    state.addingAP = false;
    if (dom.addAPBtn) dom.addAPBtn.textContent = "Add Antenna";
    if (dom.canvas)   dom.canvas.style.cursor  = "default";
    setFooterStatus("READY", null, "Waiting for adding antenna ...");
    draw();
  }

  // ---------------------------------------------------------------------------
  // Geometry helpers — extracted so isPointFree stays readable
  // ---------------------------------------------------------------------------

  /**
   * Return the effective thickness for a wall element.
   * Doors and windows are always thin; regular walls look up their type.
   */
  function getWallThickness(wall) {
    var elementType = wall.elementType || "wall";
    if (elementType === "door" || elementType === "doubleDoor" || elementType === "window") {
      return THIN_ELEMENT_THICKNESS;
    }
    if (elementTypes.wall && wall.type && elementTypes.wall[wall.type]) {
      return elementTypes.wall[wall.type].thickness || DEFAULT_WALL_THICKNESS;
    }
    return DEFAULT_WALL_THICKNESS;
  }

  /**
   * Build the list of line segments for a wall, handling both
   * polyline walls (wall.points[]) and simple two-point walls (wall.p1/p2).
   * Returns [] if the wall has no usable geometry.
   */
  function getWallSegments(wall) {
    if (wall.points && wall.points.length >= 2) {
      var segs = [];
      for (var i = 0; i < wall.points.length - 1; i++) {
        segs.push({ p1: wall.points[i], p2: wall.points[i + 1] });
      }
      return segs;
    }
    if (wall.p1 && wall.p2) {
      return [{ p1: wall.p1, p2: wall.p2 }];
    }
    return [];
  }

  /**
   * Return the closest point on segment (p1→p2) to point (x, y).
   */
  function closestPointOnSegment(x, y, p1, p2) {
    var dx = p2.x - p1.x;
    var dy = p2.y - p1.y;
    if (dx === 0 && dy === 0) return p1;
    var t = ((x - p1.x) * dx + (y - p1.y) * dy) / (dx * dx + dy * dy);
    if (t < 0) return p1;
    if (t > 1) return p2;
    return { x: p1.x + t * dx, y: p1.y + t * dy };
  }

  // ---------------------------------------------------------------------------
  // Core placement check
  // ---------------------------------------------------------------------------

  /**
   * Return true if point (x, y) is usable for an antenna:
   *   - inside the canvas minus edge padding
   *   - not too close to any wall segment
   *   - not too close to any existing antenna
   */
  function isPointFree(x, y, minDistanceFromWalls, minDistanceFromAntennas) {
    minDistanceFromWalls    = minDistanceFromWalls    || DEFAULT_WALL_CLEARANCE;
    minDistanceFromAntennas = minDistanceFromAntennas || DEFAULT_ANTENNA_CLEARANCE;

    // Canvas boundary check
    if (
      x < CANVAS_EDGE_PADDING || x > state.w - CANVAS_EDGE_PADDING ||
      y < CANVAS_EDGE_PADDING || y > state.h - CANVAS_EDGE_PADDING
    ) {
      return false;
    }

    // Wall proximity check
    for (var i = 0; i < state.walls.length; i++) {
      var wall     = state.walls[i];
      var segments = getWallSegments(wall);
      if (segments.length === 0) continue;

      var requiredDist = minDistanceFromWalls + getWallThickness(wall) / 2;

      for (var s = 0; s < segments.length; s++) {
        var closest = closestPointOnSegment(x, y, segments[s].p1, segments[s].p2);
        if (hypot(x - closest.x, y - closest.y) < requiredDist) {
          return false;
        }
      }
    }

    // Antenna proximity check
    for (var k = 0; k < state.aps.length; k++) {
      if (hypot(x - state.aps[k].x, y - state.aps[k].y) < minDistanceFromAntennas) {
        return false;
      }
    }

    return true;
  }

  /**
   * Return all grid points (spaced by sampleSpacing) that pass isPointFree.
   * Used by external optimisers to know where antennas can be placed.
   */
  function sampleFreeAreas(sampleSpacing) {
    sampleSpacing = sampleSpacing || 1.0;
    var points = [];
    for (var x = 0; x <= state.w; x += sampleSpacing) {
      for (var y = 0; y <= state.h; y += sampleSpacing) {
        if (isPointFree(x, y, DEFAULT_WALL_CLEARANCE, 0.0)) {
          points.push({ x: x, y: y });
        }
      }
    }
    return points;
  }

  /**
   * Temporarily replace state.aps with testAntennas, sum getValueAt() across
   * all samplePoints, then restore. Uses try/finally so state.aps is ALWAYS
   * restored — even if getValueAt() throws.
   */
  function calculateTotalValue(samplePoints, testAntennas) {
    if (samplePoints.length === 0) return 0;

    var originalAps = state.aps.slice();
    state.aps = testAntennas.slice();

    var totalValue = 0;
    var count      = 0;

    try {
      for (var i = 0; i < samplePoints.length; i++) {
        var value = getValueAt(samplePoints[i].x, samplePoints[i].y);
        if (!isNaN(value) && isFinite(value)) {
          totalValue += value;
          count++;
        }
      }
    } finally {
      state.aps = originalAps;  // always restored, even on error
    }

    return count > 0 ? totalValue : -Infinity;
  }

  // ---------------------------------------------------------------------------
  // Grid layout math
  // ---------------------------------------------------------------------------

  /** Return true if n is a prime number. */
  function isPrimeNumber(n) {
    if (n < 2)       return false;
    if (n === 2)     return true;
    if (n % 2 === 0) return false;
    for (var i = 3; i * i <= n; i += 2) {
      if (n % i === 0) return false;
    }
    return true;
  }

  /**
   * Return { rows, cols } factorisation of n whose aspect ratio is closest
   * to the canvas aspect ratio (state.w / state.h).
   * Log-ratio comparison treats over- and under-shooting symmetrically.
   */
  function findBestGridFactors(n) {
    var logCanvas = Math.log(state.w / state.h);
    var bestRows = 1, bestCols = n, bestDiff = Infinity;

    for (var i = 1; i * i <= n; i++) {
      if (n % i !== 0) continue;
      var j    = n / i;
      var diff1 = Math.abs(Math.log(j / i) - logCanvas);  // cols=j, rows=i
      var diff2 = Math.abs(Math.log(i / j) - logCanvas);  // cols=i, rows=j

      if (diff1 < bestDiff) { bestDiff = diff1; bestCols = j; bestRows = i; }
      if (diff2 < bestDiff) { bestDiff = diff2; bestCols = i; bestRows = j; }
    }

    return { rows: bestRows, cols: bestCols };
  }

  /**
   * Build a rows×cols evenly-spaced grid of positions inside the rectangle
   * defined by (originX, originY, width, height).
   * Spacing is calculated so the outermost antennas sit one unit from each edge.
   */
  function placeAntennaGrid(rows, cols, originX, originY, width, height) {
    var spacingX  = width  / (cols + 1);
    var spacingY  = height / (rows + 1);
    var positions = [];

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        positions.push({
          x: originX + spacingX * (c + 1),
          y: originY + spacingY * (r + 1)
        });
      }
    }
    return positions;
  }

  /**
   * Among all pairs in positions[], return the midpoint of the two that are
   * farthest apart. Used for inserting the extra antenna when count is prime.
   */
  function midpointOfFarthestPair(positions) {
    var maxDist = 0, farI = 0, farJ = 1;
    for (var i = 0; i < positions.length; i++) {
      for (var j = i + 1; j < positions.length; j++) {
        var d = hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
        if (d > maxDist) { maxDist = d; farI = i; farJ = j; }
      }
    }
    return {
      x: (positions[farI].x + positions[farJ].x) / 2,
      y: (positions[farI].y + positions[farJ].y) / 2
    };
  }

  /**
   * Return count evenly-distributed antenna positions across the full canvas.
   *
   * Rules:
   *   count = 1           → canvas centre
   *   perfect square N²   → N×N square grid
   *   prime               → (count-1) rectangle grid + 1 at farthest-pair midpoint
   *   composite           → rows×cols rectangle matching canvas aspect ratio
   */
  function findOptimalAntennaPositions(count) {
    if (count <= 0) return [];
    if (count === 1) return [{ x: state.w / 2, y: state.h / 2 }];

    var sqrtN = Math.sqrt(count);

    // Perfect square → square grid
    if (sqrtN === Math.floor(sqrtN)) {
      return placeAntennaGrid(sqrtN, sqrtN, 0, 0, state.w, state.h);
    }

    // Prime → grid of (count-1) + one extra at the farthest gap
    if (isPrimeNumber(count)) {
      var gridCount = count - 1;
      var sqrtG     = Math.sqrt(gridCount);
      var gf        = (sqrtG === Math.floor(sqrtG))
                        ? { rows: sqrtG, cols: sqrtG }
                        : findBestGridFactors(gridCount);

      var positions = placeAntennaGrid(gf.rows, gf.cols, 0, 0, state.w, state.h);
      positions.push(midpointOfFarthestPair(positions));
      return positions;  // exactly count items
    }

    // Composite → rectangle matching canvas aspect ratio
    var grid = findBestGridFactors(count);
    return placeAntennaGrid(grid.rows, grid.cols, 0, 0, state.w, state.h);
  }

  // ---------------------------------------------------------------------------
  // Auto-placement flow:  performAutoPlacement → confirm → executeAutoPlacement
  // ---------------------------------------------------------------------------

  /** Validate input, show confirmation dialog, then hand off to executeAutoPlacement. */
  function performAutoPlacement() {
    var count = parseInt(dom.autoPlaceCount.value, 10);

    if (isNaN(count) || count < 1 || count > 100) {
      NotificationSystem.warning("Please enter a valid number between 1 and 100.");
      return;
    }
    if (!getDefaultAntennaPattern()) {
      NotificationSystem.warning('Please upload an antenna pattern file first using "UPLOAD ANTENNA\'S PATTERN" field.');
      return;
    }

    var warningLine = (state.aps && state.aps.length > 0)
      ? "<li><strong>Warning:</strong> All existing antennas will be removed!</li>"
      : "";

    var confirmMsg =
      "<p>You are about to automatically place <strong>" + count + " antenna(s)</strong> on the canvas.</p>" +
      "<ul><li>They will be distributed evenly in a grid pattern.</li>" + warningLine + "</ul>" +
      "<p>Do you want to proceed?</p>";

    NotificationSystem.confirm(confirmMsg, "Confirm Automatic Placement", function (confirmed) {
      if (confirmed) executeAutoPlacement(count);
      hideAutoPlaceInput();  // always hide — whether confirmed or cancelled
    }, { isHtml: true });
  }

  /** Compute positions, build AP objects, push to state, and refresh the canvas. */
  function executeAutoPlacement(count) {
    saveState();
    state.aps = [];

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
      var ap = createAntennaObject(positions[i], defaultPattern);
      state.aps.push(ap);
      logAntennaPositionChange(ap.id, ap.id, ap.x, ap.y, ap.x, ap.y);
    }

    notifyParentOfBatchUpdate();
    refreshCanvas();
  }

  // ---------------------------------------------------------------------------
  // Small focused helpers called by executeAutoPlacement
  // ---------------------------------------------------------------------------

  /** Construct a new antenna data object with default settings. */
  function createAntennaObject(pos, pattern) {
    var ap = {
      id:                    "ANT" + (state.aps.length + 1),
      x:                     pos.x,
      y:                     pos.y,
      tx:                    DEFAULT_TX_POWER,
      gt:                    DEFAULT_GAIN,
      ch:                    DEFAULT_CHANNEL,
      azimuth:               0,
      tilt:                  0,
      antennaPatternFile:    null,
      antennaPatternFileName: null
    };
    if (pattern) {
      ap.antennaPattern         = pattern;
      ap.antennaPatternFileName = pattern.name || null;
    }
    return ap;
  }

  /** Notify the parent frame that the antenna list has changed. */
  function notifyParentOfBatchUpdate() {
    var requestId = "antennas_batch_status_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    window.parent.postMessage({
      type:      "antennas_batch_status_update",
      requestId: requestId,
      antennas:  state.aps
    }, PARENT_ORIGIN);
  }

  /** Re-render APs, redraw the canvas, and queue a heatmap update. */
  function refreshCanvas() {
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
  }

  /** Hide the auto-place input panel and clear its field. */
  function hideAutoPlaceInput() {
    if (dom.autoPlaceInputContainer) dom.autoPlaceInputContainer.style.display = "none";
    if (dom.autoPlaceCount)          dom.autoPlaceCount.value = "";
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.exitAntennaPlacementMode            = exitAntennaPlacementMode;
  window.isPointFree                         = isPointFree;
  window.sampleFreeAreas                     = sampleFreeAreas;
  window.calculateTotalValue                 = calculateTotalValue;
  window.isPrimeNumber                       = isPrimeNumber;
  window.findBestGridFactors                 = findBestGridFactors;
  window.placeAntennaGrid                    = placeAntennaGrid;
  window.findOptimalAntennaPositions         = findOptimalAntennaPositions;
  window.findOptimalAntennaPositionsFallback = findOptimalAntennaPositions;
  window.findValidAntennaPositions           = findOptimalAntennaPositions;
  window.performAutoPlacement                = performAutoPlacement;

  // ---------------------------------------------------------------------------
  // Event wiring — runs once after DOM is ready
  // ---------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", function () {

    // Cache all DOM references used by this module
    dom.addAPBtn                = document.getElementById("addAP");
    dom.canvas                  = document.getElementById("plot");
    dom.badge                   = document.getElementById("footerBadge");
    dom.footerMsg               = document.getElementById("footerMessage");
    dom.autoPlaceBtn            = document.getElementById("autoPlaceAntennas");
    dom.autoPlaceInputContainer = document.getElementById("autoPlaceInputContainer");
    dom.autoPlaceCount          = document.getElementById("autoPlaceCount");
    dom.confirmAutoPlaceBtn     = document.getElementById("confirmAutoPlaceBtn");

    // --- Add AP button: toggle manual placement mode ---
    if (dom.addAPBtn) {
      dom.addAPBtn.addEventListener("click", function () {
        if (!getDefaultAntennaPattern() && !state.addingAP) {
          NotificationSystem.warning("Please upload an antenna pattern first before adding antennas.");
          return;
        }

        state.addingAP = !state.addingAP;

        if (state.addingAP) {
          // Deactivate any other active mode
          state.addingWall = state.addingFloorPlane = state.isCalibrating = false;

          // Update button label
          var label = dom.addAPBtn.querySelector("#addAPBtnLabel");
          if (label) label.textContent = "Placing...";
          else        dom.addAPBtn.textContent = "Placing...";

          if (dom.canvas) dom.canvas.style.cursor = "crosshair";
          setFooterStatus("PLACING", "manual", "Waiting for adding antenna ...");

          // Reset sibling toolbar buttons to their idle labels
          var addFloorPlaneBtn = document.getElementById("addFloorPlane");
          if (addFloorPlaneBtn) addFloorPlaneBtn.textContent = "Add Floor Plane";
          var addWallBtn = document.getElementById("addWall");
          if (addWallBtn) addWallBtn.textContent = getAddButtonText(false);

          // Collapse the sidebar if currently expanded
          var sidebar = document.getElementById("mainSidebar");
          if (sidebar && sidebar.classList.contains("expanded")) {
            sidebar.classList.remove("expanded");
            document.querySelectorAll(".icon-btn").forEach(function (btn) {
              btn.classList.remove("active");
            });
            if (iconSidebarData) iconSidebarData.currentSection = null;
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
    }

    // --- Auto-place button: toggle the count input panel ---
    if (dom.autoPlaceBtn) {
      dom.autoPlaceBtn.addEventListener("click", function () {
        if (!getDefaultAntennaPattern()) {
          NotificationSystem.warning("Please upload an antenna pattern first before using automatic placement.");
          return;
        }
        if (dom.autoPlaceInputContainer && dom.autoPlaceInputContainer.style.display === "none") {
          dom.autoPlaceInputContainer.style.display = "block";
          dom.autoPlaceCount.value = "";
          if (dom.autoPlaceCount) dom.autoPlaceCount.focus();
        } else {
          hideAutoPlaceInput();
        }
      });
    }

    // --- Count input keyboard shortcuts: Enter confirms, Escape cancels ---
    if (dom.autoPlaceCount) {
      dom.autoPlaceCount.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          performAutoPlacement();
        } else if (e.key === "Escape") {
          hideAutoPlaceInput();
        }
      });
    }

    // --- Confirm button ---
    if (dom.confirmAutoPlaceBtn) {
      dom.confirmAutoPlaceBtn.addEventListener("click", performAutoPlacement);
    }

  });

})();
