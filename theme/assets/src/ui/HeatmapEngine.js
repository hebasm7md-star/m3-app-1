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
      var model = (state.model || "p25d");
      var hasBackendCache = state.backendRsrpPerAntenna && Object.keys(state.backendRsrpPerAntenna).length > 0;
      if (model === "accurateEngine" && hasBackendCache && typeof window.mergeBackendRsrpFromCache === "function") {
        window.mergeBackendRsrpFromCache();
      }
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
      // state.heatmapWorker = new Worker("heatmap-worker.js");
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
            if (state.onHeatmapShownCallback) {
              var cb = state.onHeatmapShownCallback;
              state.onHeatmapShownCallback = null;
              try { cb(); } catch (e) { console.error("[HeatmapEngine] onHeatmapShown error:", e); }
            }
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

    // Skip worker when backend RSRP grid is active — worker has no access to it
    // Also skip when highlighting one antenna in accurate engine (per-antenna grid)
    var activeGrid = typeof window.getActiveRsrpGrid === 'function' ? window.getActiveRsrpGrid() : null;
    var usePerAntennaGrid = false;
    if (state.highlight && state.selectedApId && (state.model || "p25d") === "accurateEngine" && typeof window.getRsrpGridForAntenna === "function") {
      usePerAntennaGrid = !!window.getRsrpGridForAntenna(state.selectedApId);
    }
    if (state.heatmapWorker && !state.isDraggingAntenna && !activeGrid && !usePerAntennaGrid) {
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

              // Use active RSRP grid when available (optimization/accurateEngine/fast)
              // When highlighting one antenna in accurate engine, use per-antenna grid if available
              var bgrid = null;
              if (state.view === "rssi") {
                var model = state.model || "p25d";
                if (useOnlySelected && selectedAP && model === "accurateEngine" && typeof window.getRsrpGridForAntenna === "function") {
                  bgrid = window.getRsrpGridForAntenna(selectedAP.id);
                }
                if (!bgrid && typeof window.getActiveRsrpGrid === "function") bgrid = window.getActiveRsrpGrid();
              }
              if (bgrid && state.view === "rssi") {
                
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
                if (state.onHeatmapShownCallback) {
                  var cb = state.onHeatmapShownCallback;
                  state.onHeatmapShownCallback = null;
                  try { cb(); } catch (e) { console.error("[HeatmapEngine] onHeatmapShown error:", e); }
                }
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
                if (state.onHeatmapShownCallback) {
                  var cb = state.onHeatmapShownCallback;
                  state.onHeatmapShownCallback = null;
                  try { cb(); } catch (e) { console.error("[HeatmapEngine] onHeatmapShown error:", e); }
                }
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

  function generateHeatmapCanvas(ctx) {
    var state = window.state;
    var bestApAt = window.bestApAt;
    var _propModel = window._propModel;
    var modelLoss = window.modelLoss;
    var dbmToLin = window.dbmToLin;
    var linToDbm = window.linToDbm;
    var colorForAP = window.colorForAP;
    var colorForChannel = window.colorForChannel;
    var sinrAt = window.sinrAt;
    var cciAt = window.cciAt;
    var countInterferingAntennas = window.countInterferingAntennas;
    var throughputFromSinr = window.throughputFromSinr;
    var colorForCount = window.colorForCount;
    var colorNumeric = window.colorNumeric;
    var generateHeatmapAsync = window.generateHeatmapAsync;

    var off = null;
    if (state.showVisualization) {
      // During antenna dragging: hold last accurate engine heatmap when in accurate engine mode
      // When not dragging: use cache if available, or generate at full resolution
      if (state.isDraggingAntenna) {
        var model = (state.model || "p25d");
        var hasAccurateGrid = model === "accurateEngine" && state.accurateEngineRsrpGrid;
        if (hasAccurateGrid && state.cachedHeatmap && state.cachedHeatmapAntennaCount === state.aps.length) {
          off = state.cachedHeatmap;
        } else if (state.aps.length > 0) {
        // OPTIMIZATION: Balanced resolution + simplified calculations during drag for speed (2.5D/ITU)
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
        // Generate if we have antennas OR active RSRP grid
        var hasGrid = typeof window.getActiveRsrpGrid === 'function' ? window.getActiveRsrpGrid() : null;
        if (state.aps.length > 0 || hasGrid) {
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

              // Use active RSRP grid when available
              // When highlighting one antenna in accurate engine, use per-antenna grid if available
              var bgrid = null;
              if (state.view === "rssi") {
                var model = state.model || "p25d";
                if (useOnlySelected && selectedAP && model === "accurateEngine" && typeof window.getRsrpGridForAntenna === "function") {
                  bgrid = window.getRsrpGridForAntenna(selectedAP.id);
                }
                if (!bgrid && typeof window.getActiveRsrpGrid === "function") bgrid = window.getActiveRsrpGrid();
              }
              if (bgrid && state.view === "rssi") {
                
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
          var hasActiveGrid = typeof window.getActiveRsrpGrid === 'function' ? window.getActiveRsrpGrid() : null;
          if (!state.isDraggingAntenna && (state.aps.length > 0 || hasActiveGrid)) {
            // No cache and no update pending - fallback: trigger async generation
            // This handles cases where sync generation didn't run (e.g., no antennas yet, or edge cases)
            if (typeof generateHeatmapAsync === 'function') {
              generateHeatmapAsync(null, true); // Start with low-res for fast initial display
            }
          }
        }
      }
    }
    return off;
  }

  function drawHeatmapOverlay(ctx, off, transition) {
    var state = window.state;
    var canvas = window.canvas;
    var padFn = window.pad;
    var pad = typeof padFn === 'function' ? padFn() : padFn;
    var renderCoveragePlane3D = window.renderCoveragePlane3D;

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
        var heatmapX = pad;
        var heatmapY = pad;
        var heatmapWidth = canvas.width - 2 * pad;
        var heatmapHeight = canvas.height - 2 * pad;
        
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
        if (typeof renderCoveragePlane3D === 'function') {
          renderCoveragePlane3D(ctx, off, transition);
        }
      }
      // If Three.js is active, heatmap is rendered as texture in renderThreeJSScene
    } else if (!state.showVisualization) {
      // Draw border even when visualization is off
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        pad,
        pad,
        canvas.width - 2 * pad,
        canvas.height - 2 * pad
      );
    }
  }

  window.invalidateHeatmapCache = invalidateHeatmapCache;
  window.initHeatmapWorker = initHeatmapWorker;
  window.generateHeatmapAsync = generateHeatmapAsync;

  window.generateHeatmapCanvas = generateHeatmapCanvas;
  window.drawHeatmapOverlay = drawHeatmapOverlay;

})();
