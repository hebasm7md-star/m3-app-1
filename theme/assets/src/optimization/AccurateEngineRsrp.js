// AccurateEngineRsrp.js — RSRP handling for accurate engine (Sionna backend)
// Grid building, per-antenna cache, best-server merge, lookup.
// Depends: global state, generateHeatmapAsync, updateLegendBar
// Used by: pollOptimizationData, AntennaBackendSync, HeatmapEngine,
//          RadioCalculations, AppUIEvents, AntennaPlacement

(function () {

  // ─── Legend ──────────────────────────────────────────────────────────────────

  // function updateLegendFromRsrpRange(dataMin, dataMax) {
    // dynamic updates disabled to keep the scale consistent regardless of grid data.
    
    // if (dataMin === Infinity || dataMax === -Infinity) return;
    // if (state.viewMinMax && state.viewMinMax["rssi"]) {
    //   state.viewMinMax["rssi"].min = Math.floor(dataMin);
    //   state.viewMinMax["rssi"].max = Math.ceil(dataMax);
    // }
    // if (state.view !== "rssi") return;
    // state.minVal = Math.floor(dataMin);
    // state.maxVal = Math.ceil(dataMax);
    // var el;
    // el = document.getElementById("legendMin"); if (el) el.textContent = state.minVal;
    // el = document.getElementById("legendMax"); if (el) el.textContent = state.maxVal;
    // el = document.getElementById("minVal");    if (el) el.value = state.minVal;
    // el = document.getElementById("maxVal");    if (el) el.value = state.maxVal;
    // if (typeof window.updateLegendBar === "function") window.updateLegendBar();
  // }

  // ─── Grid dimensions ─────────────────────────────────────────────────────────

  /** Resolve cols/rows from bin count. Returns {cols, rows} or null on mismatch. */
  function computeGridDimensions(totalBins) {
    var cols = Math.round(state.w);
    var rows = Math.round(state.h);
    if (cols * rows === totalBins) return { cols: cols, rows: rows };
    var ar = state.w / state.h;
    cols = Math.round(Math.sqrt(totalBins * ar));
    rows = Math.round(totalBins / cols);
    return (cols * rows === totalBins) ? { cols: cols, rows: rows } : null;
  }

  // ─── Grid building ───────────────────────────────────────────────────────────

  /**
   * Build a typed-array grid from a flat RSRP value array.
   * Returns { grid, dataMin, dataMax } or null on dimension mismatch.
   */
  function buildRsrpGridFromValues(rsrpValues) {
    var totalBins = rsrpValues.length;
    if (totalBins === 0) return null;
    var dims = computeGridDimensions(totalBins);
    if (!dims) return null;

    var gridData = new Float32Array(totalBins);
    var dataMin = Infinity, dataMax = -Infinity;
    for (var i = 0; i < totalBins; i++) {
      var val = +rsrpValues[i];       // unary + is faster than Number()
      gridData[i] = val;
      if (val !== 0 && val >= -140 && val < 0) {
        if (val < dataMin) dataMin = val;
        if (val > dataMax) dataMax = val;
      }
    }
    return {
      grid: { data: gridData, cols: dims.cols, rows: dims.rows,
              dx: state.w / dims.cols, dy: state.h / dims.rows },
      dataMin: dataMin,
      dataMax: dataMax
    };
  }

  /** Build a grid, assign to the correct state key, and refresh the legend. */
  function buildRsrpGrid(rsrpValues, gridKey) {
    var result = buildRsrpGridFromValues(rsrpValues);
    if (!result) return;
    state[gridKey] = result.grid;
    // updateLegendFromRsrpRange(result.dataMin, result.dataMax);
  }

  // Named wrappers keep call sites readable and decouple them from state key names.
  function buildOptimizationRsrpGrid(rsrpValues)   { buildRsrpGrid(rsrpValues, "optimizationRsrpGrid"); }
  function buildAccurateEngineRsrpGrid(rsrpValues) { buildRsrpGrid(rsrpValues, "accurateEngineRsrpGrid"); }
  function buildP25RsrpGrid(rsrpValues)           { buildRsrpGrid(rsrpValues, "p25RsrpGrid"); }
  function buildItuRsrpGrid(rsrpValues)            { buildRsrpGrid(rsrpValues, "ituRsrpGrid"); }

  // ─── Active grid lookup ───────────────────────────────────────────────────────

  /** Return the RSRP grid that is currently driving the heatmap.
   *  Optimization result takes precedence: after optimize, always show it until cleared. */
  function getActiveRsrpGrid() {
    if (state.optimizationRsrpGrid) return state.optimizationRsrpGrid;
    var model = state.model || "p25d";
    if (model === "accurateEngine") return state.accurateEngineRsrpGrid || null;
    if (model === "p25d")           return state.p25RsrpGrid            || null;
    if (model === "p525")           return state.ituRsrpGrid             || null;
    return null;
  }

  /** Bilinear sample at canvas coordinate (x, y) from a grid. */
  function lookupRsrpInGrid(bgrid, x, y) {
    if (!bgrid) return null;
    var bx = x / bgrid.dx - 0.5;
    var by = y / bgrid.dy - 0.5;
    var gx0 = Math.max(0, Math.min(bgrid.cols - 1, Math.floor(bx)));
    var gx1 = Math.min(bgrid.cols - 1, gx0 + 1);
    var gy0 = Math.max(0, Math.min(bgrid.rows - 1, Math.floor(by)));
    var gy1 = Math.min(bgrid.rows - 1, gy0 + 1);
    var tx = bx - gx0, ty = by - gy0;
    var row0 = gy0 * bgrid.cols, row1 = gy1 * bgrid.cols;
    var bval = (bgrid.data[row0 + gx0] * (1 - tx) + bgrid.data[row0 + gx1] * tx) * (1 - ty)
             + (bgrid.data[row1 + gx0] * (1 - tx) + bgrid.data[row1 + gx1] * tx) * ty;
    return (bval !== 0) ? bval : null;
  }

  /** RSRP at (x, y) from the active grid. */
  function getBackendRsrpAt(x, y) {
    return lookupRsrpInGrid(getActiveRsrpGrid(), x, y);
  }

  /** RSRP at (x, y) from a specific antenna's per-antenna cache grid. */
  function getBackendRsrpAtForAntenna(x, y, antId) {
    var cache = state.backendRsrpPerAntenna;
    if (!cache || !antId || !cache[antId]) return null;
    var result = buildRsrpGridFromValues(cache[antId]);
    return result ? lookupRsrpInGrid(result.grid, x, y) : null;
  }

  /** Return the pre-built grid for a single antenna (used by single-antenna heatmap highlight). */
  function getRsrpGridForAntenna(antId) {
    var cache = state.backendRsrpPerAntenna;
    if (!cache || !antId || !cache[antId]) return null;
    var result = buildRsrpGridFromValues(cache[antId]);
    return result ? result.grid : null;
  }

  // ─── Per-antenna cache + best-server merge ────────────────────────────────────

  /** Cache RSRP for one antenna and rebuild the merged best-server grid. */
  function cacheLiveRsrpAndMergeBestServer(ant_id, rsrpValues) {
    state.backendRsrpPerAntenna = state.backendRsrpPerAntenna || {};
    if (!rsrpValues || !rsrpValues.length) {
      delete state.backendRsrpPerAntenna[ant_id];
    } else {
      state.backendRsrpPerAntenna[ant_id] = rsrpValues.slice();
    }
    mergeRsrpToBestServerGrid();
  }

  function mergeRsrpToBestServerGrid() {
    var cache = state.backendRsrpPerAntenna;
    if (!cache) { state.accurateEngineRsrpGrid = null; return; }

    // Build set of enabled antenna IDs for fast membership check
    var apIds = Object.create(null);
    for (var i = 0; i < state.aps.length; i++) {
      if (state.aps[i].enabled !== false) apIds[state.aps[i].id] = true;
    }

    // Pre-build array of active RSRP arrays — avoids for..in inside the hot bin loop
    var activeCaches = [];
    var totalBins = 0;
    for (var aid in cache) {
      if (!apIds[aid]) { delete cache[aid]; continue; }
      var arr = cache[aid];
      if (arr && arr.length) {
        activeCaches.push(arr);
        if (!totalBins) totalBins = arr.length;
      }
    }

    if (!activeCaches.length) { state.accurateEngineRsrpGrid = null; return; }

    var dims = computeGridDimensions(totalBins);
    if (!dims) return;

    var gridData = new Float32Array(totalBins);
    var dataMin = Infinity, dataMax = -Infinity;
    var n = activeCaches.length;

    for (var i = 0; i < totalBins; i++) {
      var best = -Infinity;
      for (var j = 0; j < n; j++) {
        var val = +activeCaches[j][i];
        if (val !== 0 && val >= -140 && val < 0 && val > best) best = val;
      }
      if (best > -Infinity) {
        gridData[i] = best;
        if (best < dataMin) dataMin = best;
        if (best > dataMax) dataMax = best;
      }
      // else gridData[i] stays 0 (Float32Array default)
    }

    state.accurateEngineRsrpGrid = {
      data: gridData, cols: dims.cols, rows: dims.rows,
      dx: state.w / dims.cols, dy: state.h / dims.rows
    };

    // updateLegendFromRsrpRange(dataMin, dataMax);
  }

  // ─── Cache / heatmap helpers ──────────────────────────────────────────────────

  /** Wipe all backend RSRP grids and per-antenna cache.
   *  @param {boolean} preserveOptimization - if true, keep optimizationRsrpGrid (e.g. when switching to accurate). */
  function clearBackendRsrpCache(preserveOptimization) {
    state.backendRsrpPerAntenna  = {};
    if (!preserveOptimization) state.optimizationRsrpGrid = null;
    state.accurateEngineRsrpGrid = null;
    state.p25RsrpGrid            = null;
    state.ituRsrpGrid            = null;
  }

  /** Finalize optimization: keep optimization grid on success (heatmap stays); clear on error.
   *  @param {boolean} transferOnSuccess - true when optimization finished; false on error (just clear). */
  function clearOptimizationRsrpGrid(transferOnSuccess) {
    if (!transferOnSuccess) state.optimizationRsrpGrid = null;
    state.cachedHeatmap = null;
    state.cachedHeatmapModel = null;
    if (typeof window.generateHeatmapAsync === "function") window.generateHeatmapAsync(null, true);
  }

  function refreshHeatmap() {
    state.cachedHeatmap = null;
    state.cachedHeatmapModel = null;
    if (typeof window.generateHeatmapAsync === "function") window.generateHeatmapAsync(null, true);
  }

  /** Switch to a local model (2.5D / IUT): clear all backend grids and re-render. */
  function resetHeatmapForLocalModel() {
    clearBackendRsrpCache();
    refreshHeatmap();
  }

  /**
   * Remove one antenna from cache after deletion.
   * Re-merges if other antennas remain, otherwise clears the grid.
   */
  function evictAntennaAndRefreshHeatmap(antId) {
    state.backendRsrpPerAntenna = state.backendRsrpPerAntenna || {};
    delete state.backendRsrpPerAntenna[antId];
    if (Object.keys(state.backendRsrpPerAntenna).length > 0) {
      mergeRsrpToBestServerGrid();
    } else {
      state.accurateEngineRsrpGrid = null;
    }
    refreshHeatmap();
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  window.getActiveRsrpGrid              = getActiveRsrpGrid;
  window.getRsrpGridForAntenna          = getRsrpGridForAntenna;
  window.getBackendRsrpAt               = getBackendRsrpAt;
  window.getBackendRsrpAtForAntenna     = getBackendRsrpAtForAntenna;
  window.buildOptimizationRsrpGrid      = buildOptimizationRsrpGrid;
  window.buildAccurateEngineRsrpGrid    = buildAccurateEngineRsrpGrid;
  window.buildP25RsrpGrid               = buildP25RsrpGrid;
  window.buildItuRsrpGrid               = buildItuRsrpGrid;
  window.cacheLiveRsrpAndMergeBestServer = cacheLiveRsrpAndMergeBestServer;
  window.mergeBackendRsrpFromCache      = mergeRsrpToBestServerGrid;
  window.clearBackendRsrpCache          = clearBackendRsrpCache;
  window.clearOptimizationRsrpGrid      = clearOptimizationRsrpGrid;
  window.resetHeatmapForLocalModel      = resetHeatmapForLocalModel;
  window.evictAntennaAndRefreshHeatmap  = evictAntennaAndRefreshHeatmap;

})();