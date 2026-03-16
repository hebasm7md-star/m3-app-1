// AccurateEngineRsrp.js — RSRP handling for accurate engine (Sionna backend)
// Grid building, per-antenna cache, best-server merge, lookup.
// Depends: global state, generateHeatmapAsync, updateLegendBar
// Used by: pollOptimizationData, AntennaBackendSync, HeatmapEngine, RadioCalculations, AppUIEvents, AntennaPlacement

(function () {

  function updateLegendFromRsrpRange(dataMin, dataMax) {
    if (dataMin === Infinity || dataMax === -Infinity) return;
    if (state.viewMinMax && state.viewMinMax["rssi"]) {
      state.viewMinMax["rssi"].min = Math.floor(dataMin);
      state.viewMinMax["rssi"].max = Math.ceil(dataMax);
    }
    if (state.view === "rssi") {
      state.minVal = Math.floor(dataMin);
      state.maxVal = Math.ceil(dataMax);
      var el;
      el = document.getElementById("legendMin"); if (el) el.textContent = state.minVal;
      el = document.getElementById("legendMax"); if (el) el.textContent = state.maxVal;
      el = document.getElementById("minVal"); if (el) el.value = state.minVal;
      el = document.getElementById("maxVal"); if (el) el.value = state.maxVal;
      if (typeof window.updateLegendBar === 'function') window.updateLegendBar();
    }
  }

  /** Return per-antenna RSRP grid for accurate engine when highlighting one antenna. Null if not available. */
  function getRsrpGridForAntenna(antId) {
    var cache = state.backendRsrpPerAntenna;
    if (!cache || !antId || !cache[antId] || !Array.isArray(cache[antId])) return null;
    var result = buildRsrpGridFromValues(cache[antId]);
    return result ? result.grid : null;
  }

  /** Return the active RSRP grid: optimizationRsrpGrid during opt, accurateEngineRsrpGrid for Sionna, p25RsrpGrid/ituRsrpGrid for p25d/ITU. */
  function getActiveRsrpGrid() {
    if (state.isOptimizing && state.optimizationRsrpGrid) return state.optimizationRsrpGrid;
    var model = state.model || "p25d";
    if (model === "accurateEngine" && state.accurateEngineRsrpGrid) return state.accurateEngineRsrpGrid;
    if (model === "p25d" && state.p25RsrpGrid) return state.p25RsrpGrid;
    if (model === "p525" && state.ituRsrpGrid) return state.ituRsrpGrid;
    return null;
  }

  /** Lookup RSRP at (x,y) from a grid. */
  function lookupRsrpInGrid(bgrid, x, y) {
    if (!bgrid) return null;
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
    return (!isNaN(bval) && bval !== 0) ? bval : null;
  }

  /** Lookup RSRP at (x,y) from the active grid (optimization/accurateEngine/fast). */
  function getBackendRsrpAt(x, y) {
    var bgrid = getActiveRsrpGrid();
    return lookupRsrpInGrid(bgrid, x, y);
  }

  /** Lookup RSRP at (x,y) for a specific antenna (accurate engine per-antenna cache). */
  function getBackendRsrpAtForAntenna(x, y, antId) {
    var bgrid = getRsrpGridForAntenna(antId);
    return lookupRsrpInGrid(bgrid, x, y);
  }

  /** Shared: build RSRP grid from flat array. Returns { grid, dataMin, dataMax } or null. */
  function buildRsrpGridFromValues(rsrpValues) {
    var totalBins = rsrpValues.length;
    if (totalBins === 0) return null;

    var cols = Math.round(state.w);
    var rows = Math.round(state.h);
    if (cols * rows !== totalBins) {
      var aspectRatio = state.w / state.h;
      cols = Math.round(Math.sqrt(totalBins * aspectRatio));
      rows = Math.round(totalBins / cols);
    }
    if (cols * rows !== totalBins) return null;

    var gridData = new Float32Array(totalBins);
    var dataMin = Infinity, dataMax = -Infinity;
    for (var i = 0; i < totalBins; i++) {
      var val = Number(rsrpValues[i]);
      gridData[i] = val;
      if (!isNaN(val) && val !== 0 && val >= -140 && val < 0) {
        if (val < dataMin) dataMin = val;
        if (val > dataMax) dataMax = val;
      }
    }

    return {
      grid: { data: gridData, cols: cols, rows: rows, dx: state.w / cols, dy: state.h / rows },
      dataMin: dataMin, dataMax: dataMax
    };
  }

  /** Build optimization RSRP grid (used only during optimization). */
  function buildOptimizationRsrpGrid(rsrpValues) {
    var result = buildRsrpGridFromValues(rsrpValues);
    if (!result) return;
    state.optimizationRsrpGrid = result.grid;
    updateLegendFromRsrpRange(result.dataMin, result.dataMax);
    console.log("[AccurateEngineRsrp] optimizationRsrpGrid:", result.grid.cols, "x", result.grid.rows,
      "| RSRP:", result.dataMin.toFixed(1), "to", result.dataMax.toFixed(1));
  }

  /** Build p25d RSRP grid from flat array. */
  function buildP25RsrpGrid(rsrpValues) {
    var result = buildRsrpGridFromValues(rsrpValues);
    if (!result) return;
    state.p25RsrpGrid = result.grid;
    updateLegendFromRsrpRange(result.dataMin, result.dataMax);
  }

  /** Build ITU (p525) RSRP grid from flat array. */
  function buildItuRsrpGrid(rsrpValues) {
    var result = buildRsrpGridFromValues(rsrpValues);
    if (!result) return;
    state.ituRsrpGrid = result.grid;
    updateLegendFromRsrpRange(result.dataMin, result.dataMax);
  }

  /** Cache per-antenna live RSRP and merge to best-server grid (accurateEngine only). */
  function cacheLiveRsrpAndMergeBestServer(ant_id, rsrpValues) {
    state.backendRsrpPerAntenna = state.backendRsrpPerAntenna || {};
    if (rsrpValues == null || !Array.isArray(rsrpValues) || rsrpValues.length === 0) {
      delete state.backendRsrpPerAntenna[ant_id];
    } else {
      state.backendRsrpPerAntenna[ant_id] = rsrpValues.slice();
    }
    mergeLiveRsrpToBestServerGrid();
  }

  /** Merge per-antenna cache into accurateEngineRsrpGrid (best-server per bin). */
  function mergeLiveRsrpToBestServerGrid() {
    var cache = state.backendRsrpPerAntenna;
    if (!cache || Object.keys(cache).length === 0) {
      state.accurateEngineRsrpGrid = null;
      return;
    }
    var apIds = {};
    for (var i = 0; i < state.aps.length; i++) {
      if (state.aps[i].enabled !== false) apIds[state.aps[i].id] = true;
    }
    for (var aid in cache) { if (!apIds[aid]) delete cache[aid]; }
    if (Object.keys(cache).length === 0) {
      state.accurateEngineRsrpGrid = null;
      return;
    }
    var totalBins = 0;
    for (var aid in cache) {
      var rsrp = cache[aid];
      if (rsrp && rsrp.length > 0) {
        totalBins = rsrp.length;
        break;
      }
    }
    if (totalBins === 0) return;

    var cols = Math.round(state.w);
    var rows = Math.round(state.h);
    if (cols * rows !== totalBins) {
      var aspectRatio = state.w / state.h;
      cols = Math.round(Math.sqrt(totalBins * aspectRatio));
      rows = Math.round(totalBins / cols);
    }
    if (cols * rows !== totalBins) return;

    var gridData = new Float32Array(totalBins);
    var dataMin = Infinity, dataMax = -Infinity;
    for (var i = 0; i < totalBins; i++) {
      var best = -Infinity;
      for (var aid in cache) {
        if (!apIds[aid]) continue;
        var val = Number(cache[aid][i]);
        if (!isNaN(val) && val !== 0 && val >= -140 && val < 0 && val > best) best = val;
      }
      gridData[i] = best === -Infinity ? 0 : best;
      if (best > -Infinity) {
        if (best < dataMin) dataMin = best;
        if (best > dataMax) dataMax = best;
      }
    }

    state.accurateEngineRsrpGrid = {
      data: gridData, cols: cols, rows: rows,
      dx: state.w / cols, dy: state.h / rows
    };

    updateLegendFromRsrpRange(dataMin, dataMax);
  }

  /** Clear backend RSRP caches (per-antenna and grids). */
  function clearBackendRsrpCache() {
    state.backendRsrpPerAntenna = {};
    state.optimizationRsrpGrid = null;
    state.accurateEngineRsrpGrid = null;
    state.p25RsrpGrid = null;
    state.ituRsrpGrid = null;
  }

  /** Clear optimization grid only (call when optimization ends). */
  function clearOptimizationRsrpGrid() {
    state.optimizationRsrpGrid = null;
  }

  /** Call when user selects 2.5D or IUT (local model). Clears backend caches and re-renders heatmap. */
  function resetHeatmapForLocalModel() {
    clearBackendRsrpCache();
    state.cachedHeatmap = null;
    if (typeof window.generateHeatmapAsync === "function") {
      window.generateHeatmapAsync(null, true);
    }
  }

  /** Call when antenna is deleted. Removes from cache and recalc merge heatmap. */
  function evictAntennaAndRefreshHeatmap(antId) {
    state.backendRsrpPerAntenna = state.backendRsrpPerAntenna || {};
    delete state.backendRsrpPerAntenna[antId];
    if (Object.keys(state.backendRsrpPerAntenna).length > 0) {
      mergeLiveRsrpToBestServerGrid();
    } else {
      state.accurateEngineRsrpGrid = null;
    }
    state.cachedHeatmap = null;
    if (typeof window.generateHeatmapAsync === "function") {
      window.generateHeatmapAsync(null, true);
    }
  }

  // Expose on window for global access
  window.getActiveRsrpGrid = getActiveRsrpGrid;
  window.getRsrpGridForAntenna = getRsrpGridForAntenna;
  window.getBackendRsrpAt = getBackendRsrpAt;
  window.getBackendRsrpAtForAntenna = getBackendRsrpAtForAntenna;
  window.buildOptimizationRsrpGrid = buildOptimizationRsrpGrid;
  window.buildP25RsrpGrid = buildP25RsrpGrid;
  window.buildItuRsrpGrid = buildItuRsrpGrid;
  window.cacheLiveRsrpAndMergeBestServer = cacheLiveRsrpAndMergeBestServer;
  window.mergeBackendRsrpFromCache = mergeLiveRsrpToBestServerGrid;
  window.clearBackendRsrpCache = clearBackendRsrpCache;
  window.clearOptimizationRsrpGrid = clearOptimizationRsrpGrid;
  window.resetHeatmapForLocalModel = resetHeatmapForLocalModel;
  window.evictAntennaAndRefreshHeatmap = evictAntennaAndRefreshHeatmap;

})();
