
/* ========= Core Functions ========= */
  /* AI COMMENT — Canvas 3D Utils extracted to ui/Canvas3DUtils.js */


  /* AI COMMENT — state, elementTypes, wallTypes moved to Config.js */


  var canvas = document.getElementById("plot"),
    ctx = canvas.getContext("2d");
  // Enable image smoothing for smoother rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Initialize after DOM and all scripts are loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (typeof initHeatmapWorker === "function") initHeatmapWorker();
      setTimeout(function() { if (typeof initThreeJS === "function") initThreeJS(); }, 100);
      if (typeof WallManager !== "undefined") WallManager.init();
      if (typeof FloorPlaneManager !== "undefined") FloorPlaneManager.init();
    });
  } else {
    // DOM already loaded
    if (typeof initHeatmapWorker === "function") initHeatmapWorker();
    setTimeout(function() { if (typeof initThreeJS === "function") initThreeJS(); }, 100);
    if (typeof WallManager !== "undefined") WallManager.init();
    if (typeof FloorPlaneManager !== "undefined") FloorPlaneManager.init();
  }

    var _propModel = new PropagationModel25D({
    frequency:      state.freq,
    N:              state.N,
    verticalFactor: 2.0,
    shapeFactor:    3.0,
    referenceOffset: 0.0
    });

    // Keep model config in sync with state changes
    function _syncPropModel() {
    _propModel.freq = state.freq;
    _propModel.N    = state.N;
    }

    // wallsLoss  kept inline (app-specific door/window/thickness logic below)




    function p525(ax, ay, x, y) {
    _syncPropModel();
    var d = Math.max(hypot(x - ax, y - ay), 0.5);
    return _propModel.fspl(state.freq, d) +
    _propModel.groundPlaneLoss({x:ax, y:ay}, {x:x, y:y}, state.groundPlane) +
    _propModel.floorPlanesLoss({x:ax, y:ay}, {x:x, y:y}, state.floorPlanes);
  }

    function modelLoss(ax, ay, x, y) {
    _syncPropModel();
    
    if (state.model === "p525") {
      return p525(ax, ay, x, y);
    }
    
    // Default: p25d
    return _propModel.p25dLoss(
      {x: ax, y: ay},
      {x: x, y: y},
      state.walls,
      state.floorPlanes,
      state.groundPlane,
      state.elementTypes
    );
  }




  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Initialize standalone modules with dependencies ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // ── Init RadioCalculations & expose its API on window ──

  window._propModel            = _propModel;
  window.modelLoss             = modelLoss;

  RadioCalculations.init({
    state:                  state,
    modelLoss:              modelLoss,
    propModel:              _propModel
  });

  window.rssiFrom                = RadioCalculations.rssiFrom;
  window.bestApAt                = RadioCalculations.bestApAt;
  window.cciAt                   = RadioCalculations.cciAt;
  window.countInterferingAntennas = RadioCalculations.countInterferingAntennas;
  window.snrAt                   = RadioCalculations.snrAt;
  window.sinrAt                  = RadioCalculations.sinrAt;
  window.throughputFromSinr      = RadioCalculations.throughputFromSinr;
  console.log('[Monolith] window.bestApAt set:', typeof window.bestApAt);

  DataExportSystem.init({ state: state });
  
  /* AI COMMENT - renderGroundPlane moved to ui/CanvasRenderers.js */

  function draw() {
    // Smooth transition between 2D and 3D
    var needsRedraw = false;
    if (state.viewMode !== state.viewModeTarget) {
      // Animate transition
      var transitionSpeed = 0.08; // Slower for smoother transition
      if (state.viewModeTarget === "3d") {
        state.viewModeTransition = Math.min(
          1,
          state.viewModeTransition + transitionSpeed
        );
        if (state.viewModeTransition >= 1) {
          state.viewMode = "3d";
          state.viewModeTransition = 1;
        }
        needsRedraw = true;
      } else {
        state.viewModeTransition = Math.max(
          0,
          state.viewModeTransition - transitionSpeed
        );
        if (state.viewModeTransition <= 0) {
          state.viewMode = "2d";
          state.viewModeTransition = 0;
        }
        needsRedraw = true;
      }
    }

    // Update Three.js camera if in 3D mode
    var transition = state.viewModeTransition;
    if (transition > 0 && state.useThreeJS && state.threeRenderer) {
      if (typeof updateThreeJSCamera === 'function') updateThreeJSCamera();
      if (typeof updateThreeCanvasPointerEvents === 'function') updateThreeCanvasPointerEvents();
    } else {
      if (typeof updateThreeCanvasPointerEvents === 'function') updateThreeCanvasPointerEvents();
    }

    // Continue animation if transitioning (will be called again at end of function)

    // Generate color map for best view mode to ensure distinct colors for each AP
    if (state.view === "best") {
      state.apColorMap = getAPColorMap(state.aps);
    } else {
      state.apColorMap = null; // Clear color map for other views
    }

    // Hard safety: while in antenna placement mode, always force the AP detail sidebar closed
    // so no other code path can leave it visible during placement.
    if (state.addingAP) {
      state.selectedApForDetail = null;
      var forcedSidebar = document.getElementById("apDetailSidebar");
      if (forcedSidebar) {
        forcedSidebar.classList.remove("visible");
      }
    }

    // Set cursor based on current action
    if (
      state.addingWall ||
      state.addingAP ||
      state.addingFloorPlane ||
      state.isCalibrating
    ) {
      canvas.style.cursor = "crosshair";
    } else if (state.viewMode === "3d" || state.viewModeTransition > 0) {
      if (state.isPanning3D) {
        canvas.style.cursor = "move";
      } else if (state.isRotating3D) {
        canvas.style.cursor = "grabbing";
      } else {
        canvas.style.cursor = "grab";
      }
    } else {
      canvas.style.cursor = "default";
    }

    var parent = canvas.parentNode;
    canvas.width = parent.clientWidth - 4;
    canvas.height = parent.clientHeight - 4;

    var unit = "dBm",
      modeName = "RSSI",
      numericLegend = true;
    if (state.view === "snr") {
      unit = "dB";
      modeName = "SNR";
    }
    if (state.view === "sinr") {
      unit = "dB";
      modeName = "SINR";
    }
    if (state.view === "cci") {
      unit = "";
      modeName = "CCI Count";
      // Use a categorical legend for discrete interference counts
      numericLegend = false;
    }
    if (state.view === "thr") {
      unit = "Mbps";
      modeName = "Throughput";
    }
    if (state.view === "best") {
      unit = "";
      modeName = "Best Server";
      numericLegend = false;
    }
    if (state.view === "servch") {
      unit = "";
      modeName = "Serving Channel";
      numericLegend = false;
    }

    document.getElementById("legendUnit").textContent = unit;
    document.getElementById("modeName").textContent = modeName;
    document.getElementById("legendBar").style.display = numericLegend ? "block" : "none";
    document.getElementById("legendMin").style.display = numericLegend ? "inline" : "none";
    document.getElementById("legendMax").style.display = numericLegend ? "inline" : "none";

    // Only generate and render heatmap if visualization is enabled
    var off = null;
    if (typeof window.generateHeatmapCanvas === 'function') {
      off = window.generateHeatmapCanvas(ctx);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // XD View Isolation: If in XD tab, we will force a 2D transition for ground plane rendering below.
    // (Early return removed to allow UI updates and animation cycle to continue)

    // Render ground plane (always present, with image as texture if uploaded)
    // The image is ONLY used as texture on the ground plane, not as a 2D background
    var transition = state.activeSection === "xd" ? 0 : state.viewModeTransition;
    var useThree3D =
      transition > 0 &&
      state.useThreeJS &&
      state.threeRenderer &&
      state.threeScene;

    // Use Three.js for 3D rendering if available and in 3D mode
    if (useThree3D) {
      // Clear Three.js canvas first
      if (state.threeCanvas) {
        var threeCtx = state.threeCanvas.getContext("2d");
        if (threeCtx) {
          threeCtx.clearRect(
            0,
            0,
            state.threeCanvas.width,
            state.threeCanvas.height
          );
        }
      }

      // Render 3D scene with Three.js
      renderThreeJSScene(transition, off);

      // Three.js renders directly to its canvas, which is overlaid on top
      // The canvas is already positioned and visible, so no need to composite

      // Hide legacy 3D model when Three.js is active; we only keep the Three.js scene visible.
      // (Ground plane / background can be migrated to Three.js later.)
    } else {
      // Pure 2D rendering or Three.js not available
      window.renderGroundPlane(ctx, transition);
    }

    if (typeof window.drawHeatmapOverlay === 'function') {
      window.drawHeatmapOverlay(ctx, off, transition);
    }

    // Legacy canvas rendering (2D + legacy 3D).
    // IMPORTANT: When Three.js is active in 3D mode, skip 3D elements (walls, antennas, floor planes)
    // but keep 2D elements (calibration lines, etc.)
    // XD Tab Isolation: skip wall/floor rendering in XD tab
    if (!useThree3D && state.activeSection !== 'xd') {
      // Floor planes - render with background image as texture in both 2D and 3D
    if (typeof window.renderFloorPlanesOnCanvas === 'function') {
      window.renderFloorPlanesOnCanvas(ctx, transition);
    }

      // walls - with smooth 2D/3D transition
      if (typeof window.renderWallsOnCanvas === 'function') {
        window.renderWallsOnCanvas(ctx, state.viewModeTransition);
      }

      // Draw temp calibration line while drawing (like temp walls)
      if (state.tempCalibration && state.tempCalibration.p1) {
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = "#0e7490"; // a distinct cyan color
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(
          mx(state.tempCalibration.p1.x),
          my(state.tempCalibration.p1.y)
        );
        ctx.lineTo(
          mx(state.tempCalibration.p2.x),
          my(state.tempCalibration.p2.y)
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } // end legacy canvas rendering block (skipped when Three.js is active)

    // Draw final calibration line
    if (state.calibrationLine && state.calibrationLine.p1) {
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = "#0e7490"; // a distinct cyan color
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(
        mx(state.calibrationLine.p1.x),
        my(state.calibrationLine.p1.y)
      );
      ctx.lineTo(
        mx(state.calibrationLine.p2.x),
        my(state.calibrationLine.p2.y)
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Zone mode is handled in colorNumeric function - no need to draw boundaries

    // APs - Skip rendering original antennas when Three.js is active in 3D mode
    if (typeof window.renderAntennasOnCanvas === 'function') {
      window.renderAntennasOnCanvas(ctx, transition);
    }

    // legends - only show if visualization is enabled
    if (typeof window.updateLegendUI === 'function') {
      window.updateLegendUI(numericLegend);
    }

    if (typeof window.updateEditorButtonsUI === 'function') {
      window.updateEditorButtonsUI();
    }

    // Update model badge
    var modelNames = {
      p25d: "2.5D",
      // p1238: "P.1238",
      // p1411: "P.1411",
      // frt: "FRT-Lite",
      p525: "P.525",
      // cost231: "COST-231",
      // logd: "Log-Distance",
    };
    // document.getElementById("modelBadge").textContent = "V2.7";

    // Continue smooth transition animation if needed
    if (state.viewMode !== state.viewModeTarget) {
      requestAnimationFrame(draw);
    }
  }

  /* AI COMMENT - UI event bindings (3200-4051) moved to ui/AppUIEvents.js */

  /* AI COMMENT - finishDoorWindow and finishWallPolyline moved to WallManager.js */

  /* AI COMMENT - AppOrchestrator moved to ui/AppOrchestrator.js */
