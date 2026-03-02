
/* ========= Core Functions ========= */
  /* AI COMMENT — Canvas 3D Utils extracted to ui/Canvas3DUtils.js */


  /* AI COMMENT — state, elementTypes, wallTypes moved to Config.js */

  // Get button text based on selected element type
  function getAddButtonText(isDrawing) {
    if (isDrawing) {
      return "Drawing...";
    }
    var elementNames = {
      wall: "Add Wall",
      door: "Add Door",
      doubleDoor: "Add Double Door",
      window: "Add Window",
      floorPlane: "Add Floor Plane",
    };
    return elementNames[state.selectedElementType] || "";
  }

  function setAddAPBtnText(text) {
    var addAPBtn = document.getElementById("addAP");
    if (!addAPBtn) return;
    var label = addAPBtn.querySelector("#addAPBtnLabel");
    if (label) label.textContent = text; else addAPBtn.textContent = text;
  }


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
    if (state.showVisualization) {
      // During antenna dragging: recalculate heatmap in real-time at optimized resolution for smooth movement
      // When not dragging: use cache if available, or generate at full resolution
      if (state.isDraggingAntenna) {
        // OPTIMIZATION: Balanced resolution + simplified calculations during drag for speed
        if (state.aps.length > 0) {
          // Use 0.75x resolution multiplier for good balance between speed and quality
          var resolutionMultiplier = 1.6;
          // Use normal grid step size for maximum detail during drag
          var dragRes = state.res * 8; // Use normal grid cells for better detail
          var baseCols = Math.max(20, Math.floor(state.w / dragRes));
          var baseRows = Math.max(14, Math.floor(state.h / dragRes));
          var cols = Math.floor(baseCols * resolutionMultiplier);
          var rows = Math.floor(baseRows * resolutionMultiplier);
          var dx = state.w / cols,
            dy = state.h / rows;
          var img = ctx.createImageData(cols, rows);

          // Cache selectedAP lookup (only once, not per pixel)
          var selectedAP = null,
            i;
          for (i = 0; i < state.aps.length; i++) {
            if (state.aps[i].id === state.selectedApId) {
              selectedAP = state.aps[i];
              break;
            }
          }
          var useOnlySelected = state.highlight && selectedAP && selectedAP.enabled !== false;

          // Cache noise value
          var noiseVal = state.noise;

          // Simplified gain function for drag (use static gain, skip complex pattern calculations)
          function getSimpleGain(ap) {
            return ap.gt || 0; // Just use static gain during drag for speed
          }

          // Optimized loop - skip CSV, skip complex views during drag
          var isRSSI = state.view === "rssi";
          var isSNR = state.view === "snr";
          var isSINR = state.view === "sinr";
          var isBest = state.view === "best";
          var isServCh = state.view === "servch";
          var isCCI = state.view === "cci";
          var isThr = state.view === "thr";

          // Support RSSI, SNR, SINR, Best Server, Serving Channel, CCI, and Throughput during drag (with simplified calculations)
          if (!isRSSI && !isSNR && !isSINR && !isBest && !isServCh && !isCCI && !isThr) {
            // Fallback: don't use cached heatmap during drag (it has old positions) - set to null to prevent deformed pattern flash
            // The heatmap will be regenerated when drag ends
            off = null;
          } else {
            // Simplified best AP calculation function for dragging (uses getSimpleGain)
            function bestApAtSimple(x, y) {
              var i, best = -1e9, ap = null;
              for (i = 0; i < state.aps.length; i++) {
                var a = state.aps[i];
                if (a.enabled === false) continue;
                var pr = _propModel.rssi(
                  a.tx,
                  getSimpleGain(a),
                  modelLoss(a.x, a.y, x, y)
                );
                if (pr > best) {
                  best = pr;
                  ap = a;
                }
              }
              return { ap: ap, rssiDbm: best };
            }

            // CCI calculation function for dragging (uses getAngleDependentGain for accuracy)
            function cciAtSimple(x, y, servingAp) {
              if (!servingAp) return -200;
              var i, sumLin = 0;
              for (i = 0; i < state.aps.length; i++) {
                var ap = state.aps[i];
                if (ap.enabled === false) continue;
                if (ap === servingAp) continue;
                if (ap.ch !== servingAp.ch) continue;
                var p = _propModel.rssi(
                  ap.tx,
                  _propModel.getAngleDependentGain(ap, {x: x, y: y}),
                  modelLoss(ap.x, ap.y, x, y)
                );
                sumLin += dbmToLin(p);
              }
              if (sumLin <= 0) return -200;
              return linToDbm(sumLin);
            }

            for (var r = 0; r < rows; r++) {
              var y = (r + 0.5) * dy;
              for (var c = 0; c < cols; c++) {
                var x = (c + 0.5) * dx;
                var idx = 4 * (r * cols + c);

                // SKIP CSV interpolation during drag - too expensive
                // Use simplified calculations for CCI/Throughput during drag

                if (isBest || isServCh) {
                  // Best Server and Serving Channel use full bestApAt with angle-dependent gain
                  var best = useOnlySelected ? { ap: selectedAP, rssiDbm: 0 } : bestApAt(x, y);
                  if (useOnlySelected && selectedAP) {
                    // Use angle-dependent gain calculation for accuracy
                    best.rssiDbm = _propModel.rssi(
                      selectedAP.tx,
                      _propModel.getAngleDependentGain(selectedAP, {x: x, y: y}),
                      modelLoss(selectedAP.x, selectedAP.y, x, y)
                    );
                  }

                  var col;
                  if (isBest) {
                    col = best.ap ? colorForAP(best.ap.id) : [200, 200, 200, 230];
                  } else {
                    var ch = best.ap ? best.ap.ch : 0;
                    col = colorForChannel(ch);
                  }
                  img.data[idx] = col[0];
                  img.data[idx + 1] = col[1];
                  img.data[idx + 2] = col[2];
                  img.data[idx + 3] = col[3];
                } else {
                  // RSSI, SNR, CCI, or Throughput view
                  // All views use bestApAt with angle-dependent gain for accuracy
                  var bestN = useOnlySelected ? { ap: selectedAP, rssiDbm: 0 } : bestApAt(x, y);
                  if (useOnlySelected && selectedAP) {
                    bestN.rssiDbm = _propModel.rssi(
                      selectedAP.tx,
                      _propModel.getAngleDependentGain(selectedAP, {x: x, y: y}),
                      modelLoss(selectedAP.x, selectedAP.y, x, y)
                    );
                  }

                  var value;
                  if (isSNR) {
                    value = bestN.rssiDbm - noiseVal;
                  } else if (isSINR) {
                    if (!bestN.ap) {
                      value = -Infinity;
                    } else {
                      var IdbmDrag = cciAtSimple(x, y, bestN.ap);
                      value = sinrAt(bestN.rssiDbm, IdbmDrag);
                    }
                  } else if (isCCI) {
                    // Count interfering antennas (power > -85, same channel as best server)
                    value = bestN.ap ? countInterferingAntennas(x, y, bestN.ap) : 0;
                  } else if (isThr) {
                    if (!bestN.ap) {
                      value = 0; // No AP, no throughput
                    } else {
                      var Idbm2 = cciAtSimple(x, y, bestN.ap);
                      var sinr = sinrAt(bestN.rssiDbm, Idbm2);
                      value = throughputFromSinr(sinr);
                    }
                  } else {
                    value = bestN.rssiDbm;
                  }

                  var col;
                  if (isCCI) {
                    // Use discrete color map for count values
                    col = colorForCount(value);
                  } else {
                    col = colorNumeric(value);
                  }
                  img.data[idx] = col[0];
                  img.data[idx + 1] = col[1];
                  img.data[idx + 2] = col[2];
                  img.data[idx + 3] = col[3];
                }
              }
            }

            // Create canvas and render - use medium quality smoothing for good balance
            off = document.createElement("canvas");
            off.width = cols;
            off.height = rows;
            var offCtx = off.getContext("2d");
            offCtx.imageSmoothingEnabled = true;
            offCtx.imageSmoothingQuality = "medium"; // Medium quality for good balance
            offCtx.putImageData(img, 0, 0);

            // Don't cache during drag - we want real-time updates
            // Cache will be updated when drag ends
          }
        } else {
          // No antennas yet, no need to generate heatmap
          off = null;
        }
      } else if (state.cachedHeatmap) {
        // Use cached heatmap if available (when not dragging)
        off = state.cachedHeatmap;
        // If update is pending, it will replace the cache when done
      } else if (!state.heatmapUpdatePending) {
        // No cache exists and no update pending - generate synchronously for initial display
        // This ensures the heatmap shows immediately on first load
        // Generate if we have antennas OR CSV coverage data
        if (
          state.aps.length > 0 ||
          (state.csvCoverageData && state.csvCoverageGrid)
        ) {
          var resolutionMultiplier = 1.5; // High quality rendering
          var baseCols = Math.max(20, Math.floor(state.w / state.res));
          var baseRows = Math.max(14, Math.floor(state.h / state.res));
          var cols = baseCols * resolutionMultiplier;
          var rows = baseRows * resolutionMultiplier;
          var dx = state.w / cols,
            dy = state.h / rows;
          var img = ctx.createImageData(cols, rows);

          var selectedAP = null,
            i;
          for (i = 0; i < state.aps.length; i++) {
            if (state.aps[i].id === state.selectedApId) {
              selectedAP = state.aps[i];
              break;
            }
          }
          var useOnlySelected = state.highlight && selectedAP && selectedAP.enabled !== false;

          for (var r = 0; r < rows; r++) {
            var y = (r + 0.5) * dy;
            for (var c = 0; c < cols; c++) {
              var x = (c + 0.5) * dx;
              var idx = 4 * (r * cols + c);

              // YOUSEF COMMENT CSV
              // // Check if CSV coverage data is available and view is RSSI
              // if (
              //   state.csvCoverageData &&
              //   state.csvCoverageGrid &&
              //   state.view === "rssi"
              // ) {
              //   var csvValue = interpolateRsrpFromCsv(x, y);
              //   if (csvValue !== null && !isNaN(csvValue)) {
              //     var col = colorNumeric(csvValue);
              //     img.data[idx] = col[0];
              //     img.data[idx + 1] = col[1];
              //     img.data[idx + 2] = col[2];
              //     img.data[idx + 3] = col[3];
              //     continue;
              //   } else {
              //     img.data[idx] = 0;
              //     img.data[idx + 1] = 0;
              //     img.data[idx + 2] = 0;
              //     img.data[idx + 3] = 0;
              //     continue;
              //   }
              // }

              if (state.view === "best") {
                var best = bestApAt(x, y);
                if (useOnlySelected) {
                  best.ap = selectedAP;
                  best.rssiDbm = _propModel.rssi(
                    selectedAP.tx,
                    _propModel.getAngleDependentGain(selectedAP, {x: x, y: y}),
                    modelLoss(selectedAP.x, selectedAP.y, x, y)
                  );
                }
                var colAP = best.ap
                  ? colorForAP(best.ap.id)
                  : [200, 200, 200, 230];
                img.data[idx] = colAP[0];
                img.data[idx + 1] = colAP[1];
                img.data[idx + 2] = colAP[2];
                img.data[idx + 3] = colAP[3];
                continue;
              }
              if (state.view === "servch") {
                var best2 = bestApAt(x, y);
                if (useOnlySelected) {
                  best2.ap = selectedAP;
                  best2.rssiDbm = _propModel.rssi(
                    selectedAP.tx,
                    _propModel.getAngleDependentGain(selectedAP, {x: x, y: y}),
                    modelLoss(selectedAP.x, selectedAP.y, x, y)
                  );
                }
                var ch = best2.ap ? best2.ap.ch : 0;
                var colCH = colorForChannel(ch);
                img.data[idx] = colCH[0];
                img.data[idx + 1] = colCH[1];
                img.data[idx + 2] = colCH[2];
                img.data[idx + 3] = colCH[3];
                continue;
              }

              var bestN = bestApAt(x, y);
              if (useOnlySelected) {
                bestN.ap = selectedAP;
                bestN.rssiDbm = _propModel.rssi(
                  selectedAP.tx,
                  _propModel.getAngleDependentGain(selectedAP, {x: x, y: y}),
                  modelLoss(selectedAP.x, selectedAP.y, x, y)
                );
              }

              var value;
              if (state.view === "rssi") {
                value = bestN.rssiDbm;
              } else if (state.view === "snr") {
                value = bestN.rssiDbm - state.noise;
              } else if (state.view === "sinr") {
                var IdbmSinr = cciAt(x, y, bestN.ap);
                value = sinrAt(bestN.rssiDbm, IdbmSinr);
              } else if (state.view === "cci") {
                // Count interfering antennas (power > -85, same channel as best server)
                value = countInterferingAntennas(x, y, bestN.ap);
              } else if (state.view === "thr") {
                var Idbm2 = cciAt(x, y, bestN.ap);
                var sinr = sinrAt(bestN.rssiDbm, Idbm2);
                value = throughputFromSinr(sinr);
              } else {
                value = bestN.rssiDbm;
              }

              var col;
              if (state.view === "cci") {
                // Use discrete color map for count values
                col = colorForCount(value);
              } else {
                col = colorNumeric(value);
              }
              img.data[idx] = col[0];
              img.data[idx + 1] = col[1];
              img.data[idx + 2] = col[2];
              img.data[idx + 3] = col[3];
            }
          }

          off = document.createElement("canvas");
          off.width = cols;
          off.height = rows;
          var offCtx = off.getContext("2d");
          offCtx.imageSmoothingEnabled = true;
          offCtx.imageSmoothingQuality = "high";
          offCtx.putImageData(img, 0, 0);

          state.cachedHeatmap = off;
          state.cachedHeatmapAntennaCount = state.aps.length; // Store antenna count for validation
        } else {
          // No antennas yet, no need to generate heatmap
          off = null;
        }
      } else if (state.heatmapUpdatePending) {
        // Update is pending - use cached heatmap ONLY if it's still valid (same antenna count)
        // This prevents disappearing while keeping the display smooth during updates
        // If antenna count changed (e.g., deletion), cache is invalid and we show nothing
        if (state.cachedHeatmap && state.cachedHeatmapAntennaCount === state.aps.length) {
          // Cache is still valid - use it to prevent disappearing
          off = state.cachedHeatmap;
        } else {
          // Cache is invalid or doesn't exist - clear it and show nothing
          if (state.cachedHeatmap && state.cachedHeatmapAntennaCount !== state.aps.length) {
            state.cachedHeatmap = null;
            state.cachedHeatmapAntennaCount = 0;
          }
          off = null;
        }
      } else {
        // No update pending - use cached heatmap ONLY if it's valid
        // Validate cached heatmap matches current antenna count
        if (state.cachedHeatmap && state.cachedHeatmapAntennaCount === state.aps.length) {
          off = state.cachedHeatmap;
        } else {
          // Cached heatmap is invalid - clear it immediately
          if (state.cachedHeatmap && state.cachedHeatmapAntennaCount !== state.aps.length) {
            state.cachedHeatmap = null;
            state.cachedHeatmapAntennaCount = 0;
          }
          off = null;
          
          // If no valid cache and we have antennas, trigger async generation
          if (
            !state.isDraggingAntenna &&
            (state.aps.length > 0 ||
              (state.csvCoverageData && state.csvCoverageGrid))
          ) {
            // No cache and no update pending - fallback: trigger async generation
            // This handles cases where sync generation didn't run (e.g., no antennas yet, or edge cases)
            generateHeatmapAsync(null, true); // Start with low-res for fast initial display
          }
        }
      }
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

    // Draw heatmap only if visualization is enabled
    // XD Tab Isolation: skip heatmap rendering in XD tab
    if (state.showVisualization && off && state.activeSection !== 'xd') {
      // Draw 2D heatmap only when in 2D view (transition = 0)
      if (transition <= 0) {
        // Ensure smoothing is enabled when drawing the heatmap
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        
        // Draw the heatmap with proper scaling
        var heatmapX = pad();
        var heatmapY = pad();
        var heatmapWidth = canvas.width - 2 * pad();
        var heatmapHeight = canvas.height - 2 * pad();
        
        ctx.drawImage(
          off,
          heatmapX,
          heatmapY,
          heatmapWidth,
          heatmapHeight
        );
        
        // Draw border around heatmap
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          heatmapX,
          heatmapY,
          heatmapWidth,
          heatmapHeight
        );
        ctx.restore();
      } else if (!state.useThreeJS || !state.threeRenderer) {
        // In 3D view without Three.js, render coverage pattern as a flat plane at ground level (0m)
        renderCoveragePlane3D(ctx, off, transition);
      }
      // If Three.js is active, heatmap is rendered as texture in renderThreeJSScene
    } else if (!state.showVisualization) {
      // Draw border even when visualization is off
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        pad(),
        pad(),
        canvas.width - 2 * pad(),
        canvas.height - 2 * pad()
      );
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
    if (state.showVisualization) {
      if (numericLegend) {
        updateLegendBar();
        var legendMinEl = document.getElementById("legendMin");
        if (legendMinEl) legendMinEl.textContent = state.minVal;
        var legendMaxEl = document.getElementById("legendMax");
        if (legendMaxEl) legendMaxEl.textContent = state.maxVal;
        document.getElementById("catLegend").style.display = "none";
      } else {
        var cat = document.getElementById("catLegend");
        cat.innerHTML = "";
        cat.style.display = "block";
        if (state.view === "best") {
          // Best server: one color per AP
          for (i = 0; i < state.aps.length; i++) {
            var a = state.aps[i],
              c = colorForAP(a.id);
            var item = document.createElement("div");
            item.className = "legend-item";
            var swatch = document.createElement("div");
            swatch.className = "legend-swatch";
            swatch.style.background =
              "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
            item.appendChild(swatch);
            item.appendChild(
              document.createTextNode(a.id + " (ch " + a.ch + ")")
            );
            cat.appendChild(item);
          }
        } else if (state.view === "servch") {
          // Serving channel: one color per unique channel
          var seen = [],
            j,
            exists;
          for (i = 0; i < state.aps.length; i++) {
            exists = false;
            for (j = 0; j < seen.length; j++) {
              if (seen[j] === state.aps[i].ch) {
                exists = true;
                break;
              }
            }
            if (!exists) seen.push(state.aps[i].ch);
          }
          for (i = 0; i < seen.length; i++) {
            var ch = seen[i],
              c2 = colorForChannel(ch);
            var item2 = document.createElement("div");
            item2.className = "legend-item";
            var swatch2 = document.createElement("div");
            swatch2.className = "legend-swatch";
            swatch2.style.background =
              "rgb(" + c2[0] + "," + c2[1] + "," + c2[2] + ")";
            item2.appendChild(swatch2);
            item2.appendChild(document.createTextNode("Channel " + ch));
            cat.appendChild(item2);
          }
        } else if (state.view === "cci") {
          // CCI: show discrete count buckets with their random-assigned colors
          // Use the current maxVal (which for CCI is the max count) to know how many to show,
          // but cap at a reasonable upper bound for readability.
          var maxCount = Math.max(0, Math.round(state.maxVal || 0));
          var maxLegendCount = Math.min(maxCount, 12); // don't spam the legend too much

          for (i = 0; i <= maxLegendCount; i++) {
            var cnt = i;
            var col = colorForCount(cnt);
            var item3 = document.createElement("div");
            item3.className = "legend-item";
            var swatch3 = document.createElement("div");
            swatch3.className = "legend-swatch";
            swatch3.style.background =
              "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";

            var label;
            if (cnt === 0) {
              label = "0 interferers";
            } else if (cnt === 1) {
              label = "1 interferer";
            } else {
              label = cnt + " interferers";
            }

            item3.appendChild(swatch3);
            item3.appendChild(document.createTextNode(label));
            cat.appendChild(item3);
          }

          // If there are counts above the cap, show a final "N+ interferers" entry
          if (maxCount > maxLegendCount) {
            var extraCnt = maxLegendCount + 1;
            var extraCol = colorForCount(extraCnt);
            var extraItem = document.createElement("div");
            extraItem.className = "legend-item";
            var extraSwatch = document.createElement("div");
            extraSwatch.className = "legend-swatch";
            extraSwatch.style.background =
              "rgb(" + extraCol[0] + "," + extraCol[1] + "," + extraCol[2] + ")";
            extraItem.appendChild(extraSwatch);
            extraItem.appendChild(
              document.createTextNode(extraCnt + "+ interferers")
            );
            cat.appendChild(extraItem);
          }
        }
      }
    } else {
      // Hide legend when visualization is off
      document.getElementById("legendBar").style.display = "none";
      document.getElementById("legendMin").style.display = "none";
      document.getElementById("legendMax").style.display = "none";
      document.getElementById("catLegend").style.display = "none";
    }

    var addBtn = document.getElementById("addWall");
    if (!state.selectedElementType) {
      addBtn.style.display = "none";
    } else {
      addBtn.style.display = "";
      if (state.addingWall || state.addingFloorPlane) {
        if (addBtn.className.indexOf("toggled") === -1)
          addBtn.className += " toggled";
        var drawingText = getAddButtonText(true);
        if (addBtn.textContent !== drawingText)
          addBtn.textContent = drawingText;
      } else {
        addBtn.className = addBtn.className.replace(" toggled", "");
        var normalText = getAddButtonText(false);
        if (addBtn.textContent !== normalText)
          addBtn.textContent = normalText;
      }
    }

    var addAPBtn = document.getElementById("addAP");
    if (state.addingAP) {
      if (addAPBtn.className.indexOf("toggled") === -1)
        addAPBtn.className += " toggled";
      setAddAPBtnText("Placing...");
    } else {
      addAPBtn.className = addAPBtn.className.replace(" toggled", "");
      setAddAPBtnText("Place Antenna Manually");
    }

    var addFloorPlaneBtn = document.getElementById("addFloorPlane");
    if (addFloorPlaneBtn) {
      if (state.addingFloorPlane) {
        if (addFloorPlaneBtn.className.indexOf("toggled") === -1)
          addFloorPlaneBtn.className += " toggled";
        if (addFloorPlaneBtn.textContent !== "Drawing...")
          addFloorPlaneBtn.textContent = "Drawing...";
      } else {
        addFloorPlaneBtn.className = addFloorPlaneBtn.className.replace(
          " toggled",
          ""
        );
        if (addFloorPlaneBtn.textContent !== "Add Floor Plane")
          addFloorPlaneBtn.textContent = "Add Floor Plane";
      }
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
