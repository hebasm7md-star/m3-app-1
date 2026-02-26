//
// HeatmapEngine.js
// Asynchronously generates the heatmap image (pixel-by-pixel signal
// computation) using chunked rendering or a web worker, and manages
// the heatmap cache invalidation.
//
// All functions are exposed on window for global access.
//
// Depends on: global state, canvas/ctx, draw(), getValueAt() (monolith),
//             colorNumeric/colorForAP/colorForChannel/colorForCount (ColorSystem),
//             rssiFrom/bestApAt/cciAt/sinrAt/countInterferingAntennas (SignalCalc),
//             modelLoss, _propModel (PropagationModel)
//
// Called by:
//   invalidateHeatmapCache — event handlers for model/view/AP/wall changes
//   generateHeatmapAsync   — invalidateHeatmapCache, drag handlers, AP operations
//   initHeatmapWorker      — startup initialization
//

(function () {

  function invalidateHeatmapCache() {
    if (state.heatmapUpdateRequestId !== null) {
      cancelAnimationFrame(state.heatmapUpdateRequestId);
      state.heatmapUpdateRequestId = null;
    }
    // state.cachedHeatmap = null;
    state.cachedHeatmapAntennaCount = 0;
    state.heatmapUpdatePending = true;
    state.heatmapWorkerCallback = null;
    /* TRIAL: keep backend RSRP grid alive during optimization */
    if (!state.isOptimizing) {
      state.optimizationRsrpGrid = null;
      state.compliancePercentFromBackend = null;
      state.cachedHeatmap = null; // Only clear cache when NOT optimizing

    }
    if (state.showVisualization) {
      generateHeatmapAsync(null, true); // low-res first for fast feedback
    }
  }

  // Initialize Web Worker for heatmap generation
  function initHeatmapWorker() {
    try {
      state.heatmapWorker = new Worker("heatmap-worker.js");
      state.heatmapWorker.onmessage = function (e) {
        var data = e.data;
        if (data.type === "complete") {
          // Heatmap generation complete
          var imgData = new ImageData(
            new Uint8ClampedArray(data.imageData),
            data.cols,
            data.rows
          );
          var off = document.createElement("canvas");
          off.width = data.cols;
          off.height = data.rows;
          var offCtx = off.getContext("2d");
          offCtx.imageSmoothingEnabled = true;
          offCtx.imageSmoothingQuality = "high";
          offCtx.putImageData(imgData, 0, 0);

          state.cachedHeatmap = off;
          state.cachedHeatmapAntennaCount = state.aps.length; // Store antenna count for validation
          state.heatmapUpdatePending = false;

          // Call stored callback if any
          if (state.heatmapWorkerCallback) {
            state.heatmapWorkerCallback(off);
            state.heatmapWorkerCallback = null;
          }

          // Redraw to show updated heatmap
          // Use requestAnimationFrame to ensure the update is rendered
          requestAnimationFrame(function () {
            draw();
          });
        }
      };
      state.heatmapWorker.onerror = function (error) {
        console.error("Heatmap worker error:", error);
        state.heatmapUpdatePending = false;
        state.heatmapWorker = null;
        generateHeatmapAsync(null, true);
      };
    } catch (error) {
      console.warn(
        "Web Workers not supported, falling back to synchronous generation:",
        error
      );
      state.heatmapWorker = null;
    }
  }

  // Asynchronous heatmap generation function for non-blocking updates
  // Uses progressive rendering: low-res first, then high-res
  function generateHeatmapAsync(callback, useLowRes) {
    // Cancel any pending update
    if (state.heatmapUpdateRequestId !== null) {
      cancelAnimationFrame(state.heatmapUpdateRequestId);
      state.heatmapUpdateRequestId = null;
    }

    // Try to use Web Worker first (if available and not dragging)
    // Skip worker when backend RSRP grid is active — worker has no access to it
    if (state.heatmapWorker && !state.isDraggingAntenna && !state.optimizationRsrpGrid) {
      state.heatmapUpdatePending = true;

      var resolutionMultiplier = useLowRes === true ? 1 : 1.5;
      var baseCols = Math.max(20, Math.floor(state.w / state.res));
      var baseRows = Math.max(14, Math.floor(state.h / state.res));
      var cols = Math.max(20, Math.floor(baseCols * resolutionMultiplier));
      var rows = Math.max(14, Math.floor(baseRows * resolutionMultiplier));
      var dx = state.w / cols;
      var dy = state.h / rows;

      // Prepare data for worker
      var workerData = {
        cols: cols,
        rows: rows,
        dx: dx,
        dy: dy,
        aps: state.aps.map(function (ap) {
          // Ensure pattern data is properly structured for the worker
          var patternData = null;
          if (ap.antennaPattern) {
            // Verify pattern has required data arrays
            var hasHorizontalData = ap.antennaPattern.horizontalData && 
                                    Array.isArray(ap.antennaPattern.horizontalData) && 
                                    ap.antennaPattern.horizontalData.length > 0;
            var hasVerticalData = ap.antennaPattern.verticalData && 
                                  Array.isArray(ap.antennaPattern.verticalData) && 
                                  ap.antennaPattern.verticalData.length > 0;
            
            // Only include pattern if it has valid data
            if (hasHorizontalData || hasVerticalData) {
              patternData = {
                horizontalData: hasHorizontalData ? ap.antennaPattern.horizontalData : [],
                verticalData: hasVerticalData ? ap.antennaPattern.verticalData : [],
                _maxValue: ap.antennaPattern._maxValue !== undefined ? ap.antennaPattern._maxValue : undefined,
              };
            }
          }
          
          return {
            id: ap.id,
            x: ap.x,
            y: ap.y,
            z: ap.z || 2.5,
            tx: ap.tx,
            gt: ap.gt,
            ch: ap.ch,
            enabled: ap.enabled !== false,
            azimuth: ap.azimuth || 0,
            tilt: ap.tilt || 0,
            antennaPattern: patternData,
          };
        }),
        model: state.model,
        view: state.view,
        noise: state.noise,
        minVal: state.minVal,
        maxVal: state.maxVal,
        weak: state.weak,
        mid: state.mid,
        strong: state.strong,
        selectedApId: state.selectedApId,
        highlight: state.highlight,
        defaultPattern:
          state.defaultAntennaPatternIndex >= 0 &&
            state.antennaPatterns[state.defaultAntennaPatternIndex]
            ? {
              horizontalData:
                state.antennaPatterns[state.defaultAntennaPatternIndex]
                  .horizontalData,
              verticalData:
                state.antennaPatterns[state.defaultAntennaPatternIndex]
                  .verticalData,
              _maxValue:
                state.antennaPatterns[state.defaultAntennaPatternIndex]
                  ._maxValue,
            }
            : null,
        apColorMap: state.apColorMap,
        freq: state.freq || 2400,
        N: state.N || 2.5,
        walls: state.walls || [],
        floorPlanes: state.floorPlanes || [],
        groundPlane: state.groundPlane || { enabled: false, attenuation: 3.0 },
        elementTypes: elementTypes || {},
        csvCoverageGrid: state.csvCoverageGrid || null,
        showContours: state.showContours || false,
      };

      // Store callback
      if (callback) {
        state.heatmapWorkerCallback = callback;
      }

      // Send to worker
      state.heatmapWorker.postMessage(workerData);
      return;
    }

    // Fallback to original chunked processing
    state.heatmapUpdatePending = true;

    // Use requestAnimationFrame to make it async and non-blocking
    state.heatmapUpdateRequestId = requestAnimationFrame(function () {
      try {
        var canvas = document.getElementById("plot");
        if (!canvas) {
          state.heatmapUpdatePending = false;
          if (callback) callback(null);
          return;
        }

        var ctx = canvas.getContext("2d");
        if (!state.showVisualization) {
          state.heatmapUpdatePending = false;
          if (callback) callback(null);
          return;
        }

        // Use lower resolution for initial fast update, then refine
        // useLowRes: true = use 1x (fast), false/undefined = use 1.5x (normal, high quality)
        var resolutionMultiplier = useLowRes === true ? 1 : 1.5;
        var baseCols = Math.max(20, Math.floor(state.w / state.res));
        var baseRows = Math.max(14, Math.floor(state.h / state.res));
        var cols = Math.max(
          20,
          Math.floor(baseCols * resolutionMultiplier)
        );
        var rows = Math.max(14, Math.floor(baseRows * resolutionMultiplier));
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

        // Process in chunks to avoid blocking - use smaller chunks for faster visual updates
        var chunkSize = 50; // Process 50 rows at a time for faster updates
        var currentRow = 0;

        function processChunk() {
          var endRow = Math.min(currentRow + chunkSize, rows);

          for (var r = currentRow; r < endRow; r++) {
            var y = (r + 0.5) * dy;
            for (var c = 0; c < cols; c++) {
              var x = (c + 0.5) * dx;
              var idx = 4 * (r * cols + c);

              // Use backend-computed RSRP when available (from optimization)
              // Backend data is row-major (y outer, x inner): data[y_idx * cols + x_idx]
              if (state.optimizationRsrpGrid && state.view === "rssi") {
                var bgrid = state.optimizationRsrpGrid;
                
                var bx = x / bgrid.dx;
                var by = y / bgrid.dy;
                
                var gx0 = Math.max(0, Math.min(bgrid.cols - 1, Math.floor(bx - 0.5)));
                var gx1 = Math.max(0, Math.min(bgrid.cols - 1, gx0 + 1));
                var gy0 = Math.max(0, Math.min(bgrid.rows - 1, Math.floor(by - 0.5)));
                var gy1 = Math.max(0, Math.min(bgrid.rows - 1, gy0 + 1));
                
                var tx = (bx - 0.5) - gx0;
                var ty = (by - 0.5) - gy0;
                
                var v00 = bgrid.data[gy0 * bgrid.cols + gx0];
                var v10 = bgrid.data[gy0 * bgrid.cols + gx1];
                var v01 = bgrid.data[gy1 * bgrid.cols + gx0];
                var v11 = bgrid.data[gy1 * bgrid.cols + gx1];
                
                var v0 = v00 * (1 - tx) + v10 * tx;
                var v1 = v01 * (1 - tx) + v11 * tx;
                var bval = v0 * (1 - ty) + v1 * ty;
                
                if (!isNaN(bval)) {
                  var bcolor = colorNumeric(bval);
                  img.data[idx] = bcolor[0];
                  img.data[idx + 1] = bcolor[1];
                  img.data[idx + 2] = bcolor[2];
                  img.data[idx + 3] = bcolor[3];
                  continue;
                }
              }

              /* TRIAL: during optimization, all RSRP comes from backend only —
                 skip frontend propagation calc entirely */
              if (state.isOptimizing) {
                img.data[idx] = 0;
                img.data[idx + 1] = 0;
                img.data[idx + 2] = 0;
                img.data[idx + 3] = 0;
                continue;
              }

              if (state.view === "best") {
                var best = (typeof bestApAt === 'function' ? bestApAt : RadioCalculations.bestApAt)(x, y);
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
                var best2 = (typeof bestApAt === 'function' ? bestApAt : RadioCalculations.bestApAt)(x, y);
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

              var bestN = (typeof bestApAt === 'function' ? bestApAt : RadioCalculations.bestApAt)(x, y);
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

          currentRow = endRow;

          if (currentRow < rows) {
            // Process next chunk asynchronously
            state.heatmapUpdateRequestId =
              requestAnimationFrame(processChunk);
          } else {
            // completed - create canvas and cache
            var off = document.createElement("canvas");
            off.width = cols;
            off.height = rows;
            var offCtx = off.getContext("2d");
            offCtx.imageSmoothingEnabled = true;
            offCtx.imageSmoothingQuality = "high";
            offCtx.putImageData(img, 0, 0);

            state.cachedHeatmap = off;
            state.cachedHeatmapAntennaCount = state.aps.length; // Store antenna count for validation

            // If this was a low-res update, immediately start high-res update
            if (useLowRes === true) {
              state.heatmapUpdatePending = false;
              state.heatmapUpdateRequestId = null;
              // Redraw to show updated heatmap immediately
              // Use requestAnimationFrame to ensure the update is rendered
              requestAnimationFrame(function () {
                draw();
              });
              // Start high-res update after a brief delay to let UI update
              setTimeout(function () {
                generateHeatmapAsync(callback, false);
              }, 50);
            } else {
              state.heatmapUpdatePending = false;
              state.heatmapUpdateRequestId = null;
              // Redraw to show updated heatmap immediately
              // Use requestAnimationFrame to ensure the update is rendered
              requestAnimationFrame(function () {
                draw();
              });
              if (callback) callback(off);
            }
          }
        }

        // Start processing
        processChunk();
      } catch (err) {
        console.error("Error generating heatmap:", err);
        state.heatmapUpdatePending = false;
        state.heatmapUpdateRequestId = null;
        if (callback) callback(null);
      }
    });
  }

  window.invalidateHeatmapCache = invalidateHeatmapCache;
  window.initHeatmapWorker = initHeatmapWorker;
  window.generateHeatmapAsync = generateHeatmapAsync;

})();
