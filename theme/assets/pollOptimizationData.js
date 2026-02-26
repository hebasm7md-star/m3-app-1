// OptimizationSystem — Handles AI antenna optimization polling and updates
// Depends on: global state, draw(), renderAPs(), NotificationSystem,
//             logAntennaPositionChange, generateHeatmapAsync, updateLegendBar, DataExportSystem

var OptimizationSystem = (function () {

  var optimizationPollingInterval = null;

  var ACTION_MESSAGES = {
    Sectorization:  'Optimizing sector configuration...',
    CIO:            'Adjusting CIO handover parameters...',
    Turnning_ON_OFF:'Toggle antenna status (ON/OFF)...',
    PCI:            'Reassigning PCI collision...',
    pattern_change: 'Changing antenna pattern...',
    power:          'Tuning transmission power levels...',
    tilt:           'Adjusting Remote Electrical Tilt (RET)...',
    azimuth:        'Rotating horizontal orientation (Azimuth)...',
    location:       'Optimizing physical location coordinates...'
  };

  function getFriendlyActionMessage(action) {
    if (!action) return "Analyzing network state...";
    var id = action.antenna_id || "System";
    var msg = ACTION_MESSAGES[action.action_type] || action.action_desc;
    return id + ": " + (msg || "Optimization parameter updated successfully.");
  }

  // ── Polling ────────────────────────────────────────────────────────────

  function startOptimizationPolling() {
    if (optimizationPollingInterval) clearInterval(optimizationPollingInterval);
    optimizationPollingInterval = setInterval(function () {
      window.parent.postMessage({
        type: "poll_optimization_update",
        lastIndex: window.optimizationLastIndex || 0
      }, "*");
    }, 500);
    console.log("[OptimizationSystem] Polling started");
  }

  function stopOptimizationPolling() {
    if (optimizationPollingInterval) {
      clearInterval(optimizationPollingInterval);
      optimizationPollingInterval = null;
    }
    console.log("[OptimizationSystem] Polling stopped");
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  function setFooter(badge, msg, badgeText, msgText, addClass) {
    if (badge) {
      badge.textContent = badgeText;
      badge.classList.remove('active', 'manual', 'optimizing', 'completed');
      if (addClass) badge.classList.add(addClass);
    }
    if (msg && msgText) msg.textContent = msgText;
  }

  function setButtonLocked(btn, locked) {
    if (!btn) return;
    btn.disabled = locked;
    btn.style.opacity = locked ? '0.5' : '1';
  }

  function refreshHeatmap() {
    if (!state.showVisualization) return;
    // state.cachedHeatmap = null;
    state.heatmapUpdatePending = false;
    if (typeof generateHeatmapAsync === 'function') generateHeatmapAsync(null, true);
    // if (typeof draw === 'function') draw();
  }

  function handleTerminalStatus(status, data, footerBadge, footerMessage) {
    if (status !== 'finished' && status !== 'error') return;
    stopOptimizationPolling();
    if (status === 'finished') {
      setFooter(footerBadge, footerMessage, 'COMPLETED', "Optimization process successfully completed.", 'completed');
      if (typeof DataExportSystem !== 'undefined' && DataExportSystem.exportBackendRsrpGrid) {
        DataExportSystem.exportBackendRsrpGrid();
      }
    } else {
      setFooter(footerBadge, footerMessage, 'ERROR', "Error: " + (data.error || "Optimization failed."));
    }
  }

  // ── Backend RSRP Grid ─────────────────────────────────────────────────

  function buildBackendRsrpGrid(rsrpValues) {
    var totalBins = rsrpValues.length;
    if (totalBins === 0) return;

    var cols = Math.round(state.w);
    var rows = Math.round(state.h);

    if (cols * rows !== totalBins) {
      var aspectRatio = state.w / state.h;
      cols = Math.round(Math.sqrt(totalBins * aspectRatio));
      rows = Math.round(totalBins / cols);
    }
    if (cols * rows !== totalBins) {
      console.warn("[BackendRSRP] Grid mismatch:", cols, "x", rows, "!=", totalBins);
      return;
    }

    var gridData = new Float32Array(totalBins);
    var dataMin = Infinity, dataMax = -Infinity;
    for (var i = 0; i < totalBins; i++) {
      gridData[i] = Number(rsrpValues[i]);
      if (!isNaN(gridData[i])) {
        if (gridData[i] < dataMin) dataMin = gridData[i];
        if (gridData[i] > dataMax) dataMax = gridData[i];
      }
    }

    state.optimizationRsrpGrid = {
      data: gridData, cols: cols, rows: rows,
      dx: state.w / cols, dy: state.h / rows
    };

    if (dataMin !== Infinity && dataMax !== -Infinity) {
      state.minVal = Math.floor(dataMin);
      state.maxVal = Math.ceil(dataMax);

      var el;
      el = document.getElementById("legendMin"); if (el) el.textContent = state.minVal;
      el = document.getElementById("legendMax"); if (el) el.textContent = state.maxVal;
      el = document.getElementById("minVal");    if (el) el.value = state.minVal;
      el = document.getElementById("maxVal");    if (el) el.value = state.maxVal;

      if (typeof updateLegendBar === 'function') updateLegendBar();
    }

    console.log("[BackendRSRP] Grid:", cols, "x", rows,
      "| dx:", (state.w / cols).toFixed(3), "dy:", (state.h / rows).toFixed(3),
      "| RSRP:", dataMin.toFixed(1), "to", dataMax.toFixed(1));
  }

  // ── Main Update Handler ───────────────────────────────────────────────

  function handleOptimizationUpdate(data) {
    try {
      var newActions = data.new_action_configs || [];
      var newRsrp = data.new_bsrv_rsrp || [];
      var newCompliance = data.new_compliance || [];
      var status = data.status;
      var message = data.message;

      // RSRP grid
      var rsrpUpdated = false;
      if (Array.isArray(newRsrp) && newRsrp.length > 0) {
        var latestRsrp = newRsrp[newRsrp.length - 1];
        if (latestRsrp && latestRsrp.length > 0) {
          buildBackendRsrpGrid(latestRsrp);
          rsrpUpdated = true;
        }
      }

      // Compliance
      if (Array.isArray(newCompliance) && newCompliance.length > 0) {
        var latest = newCompliance[newCompliance.length - 1];
        if (latest !== undefined && latest !== null) {
          state.optimizationCompliancePercent = Math.round(Number(latest));
          var el = document.getElementById("compliancePercent");
          if (el) el.textContent = state.optimizationCompliancePercent;
        }
      }

      // Loading overlay
      var overlay = document.getElementById('loadingOverlay');
      if (overlay && overlay.style.display !== 'none') {
        if (message) {
          var sub = document.getElementById('loadingSubtext');
          var txt = document.getElementById('loadingText');
          if (sub) sub.textContent = message;
          if (txt) txt.textContent = status === 'error' ? 'Optimization Failed' : 'Finalizing Baseline Data...';
        }
        if (status !== 'starting' && status !== 'idle' || status === 'error') {
          overlay.style.opacity = '0';
          setTimeout(function () { overlay.style.display = 'none'; overlay.style.opacity = '1'; }, 400);
        }
      }

      // Button states
      var optimizeBtn = document.getElementById("optimizeBtn");
      var addAPBtn = document.getElementById("addAP");
      if (status === 'starting' || status === 'running') {
        setButtonLocked(optimizeBtn, true);
        if (optimizeBtn) { optimizeBtn.style.cursor = 'not-allowed'; optimizeBtn.textContent = 'Running...'; }
        setButtonLocked(addAPBtn, true);
        if (addAPBtn) addAPBtn.style.pointerEvents = 'none';
        state.isOptimizing = true;
      } else if (status === 'finished' || status === 'error' || status === 'idle') {
        setButtonLocked(optimizeBtn, false);
        if (optimizeBtn) { optimizeBtn.style.cursor = 'pointer'; optimizeBtn.textContent = 'Optimize'; }
        setButtonLocked(addAPBtn, false);
        if (addAPBtn) addAPBtn.style.pointerEvents = 'auto';
        state.isOptimizing = false;
      }

      // Footer status
      var footerBadge = document.getElementById('footerBadge');
      var footerMessage = document.getElementById('footerMessage');

      if (status === 'starting') {
        setFooter(footerBadge, footerMessage, 'STARTING', message, 'optimizing');
      } else if (status === 'running') {
        setFooter(footerBadge, footerMessage, 'OPTIMIZING', message || 'Running...', 'optimizing');
      } else if (status === 'finished') {
        setFooter(footerBadge, footerMessage, 'COMPLETED', message || 'Completed', 'completed');
      } else if (status === 'error') {
        setFooter(footerBadge, footerMessage, 'ERROR', message || 'Error occurred');
      } else {
        setFooter(footerBadge, footerMessage, 'READY', message || 'Ready');
      }

      // No actions — refresh heatmap if RSRP arrived, handle terminal status, exit
      // if (!Array.isArray(newActions) || newActions.length === 0) {
      //   if (rsrpUpdated) refreshHeatmap();
      //   handleTerminalStatus(status, data, footerBadge, footerMessage);
      //   return;
      // }

      // Show latest action in footer
      if (footerMessage) {
        footerMessage.textContent = getFriendlyActionMessage(newActions[newActions.length - 1]);
      }

      if (data.last_index !== undefined) {
        window.optimizationLastIndex = data.last_index;
      }

      if (data.optimization_bounds) {
        window.optimizationBounds = data.optimization_bounds;
      }

      // Apply antenna updates
      var changesMade = false;
      for (var i = 0; i < newActions.length; i++) {
        if (newActions[i]) {
          updateSingleAntennaFromAction(newActions[i]);
          changesMade = true;
        }
      }

      if (changesMade || rsrpUpdated) {
        if (changesMade) {
          if (window.saveState) window.saveState();
          if (window.renderAPs) window.renderAPs();
        }
        refreshHeatmap();
      }

      handleTerminalStatus(status, data, footerBadge, footerMessage);
    } catch (error) {
      console.error("Error handling optimization update:", error);
      stopOptimizationPolling();
    }
  }

  // ── Antenna Update ────────────────────────────────────────────────────

  function pickField(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] !== undefined && obj[keys[i]] !== null) return obj[keys[i]];
    }
    return undefined;
  }

  function updateSingleAntennaFromAction(action) {
    try {
      var antennaId = action.antenna_id || action.id;
      var backendX = Number(pickField(action, ['X_antenna', 'X', 'x']));
      var backendY = Number(pickField(action, ['Y_antenna', 'Y', 'y']));

      var enabledRaw = pickField(action, ['is_turnning_on', 'on', 'enabled']);
      var enabled = enabledRaw === "True" || enabledRaw === true ||
                    enabledRaw === "true" || enabledRaw === 1 || enabledRaw === "1";

      if (!antennaId || !Number.isFinite(backendX) || !Number.isFinite(backendY)) {
        console.warn("Invalid action config:", action);
        return;
      }

      var canvasX = Math.max(0, Math.min(state.w, backendX));
      var canvasY = Math.max(0, Math.min(state.h, backendY));

      var existing = null;
      for (var j = 0; j < state.aps.length; j++) {
        if (state.aps[j].id === antennaId) { existing = state.aps[j]; break; }
      }

      if (existing) {
        var oldX = existing.x, oldY = existing.y;
        existing.x = canvasX;
        existing.y = canvasY;
        existing.enabled = enabled;

        if (Math.abs(oldX - canvasX) > 0.01 || Math.abs(oldY - canvasY) > 0.01) {
          if (typeof window.logAntennaPositionChange === 'function') {
            window.logAntennaPositionChange(antennaId, antennaId, oldX, oldY, canvasX, canvasY, false);
          }
        }
      } else {
        var defaultPattern = typeof window.getDefaultAntennaPattern === 'function'
          ? window.getDefaultAntennaPattern() : null;
        var ap = {
          id: antennaId, x: canvasX, y: canvasY, z: 0,
          tx: action.power !== undefined ? action.power : 15,
          gt: 5, ch: 1,
          azimuth: action.azimuth !== undefined ? action.azimuth : 0,
          tilt: action.tilt !== undefined ? action.tilt : 0,
          enabled: enabled,
          antennaPatternFile: null, antennaPatternFileName: null
        };
        if (defaultPattern) ap.antennaPattern = defaultPattern;
        state.aps.push(ap);

        if (typeof window.logAntennaPositionChange === 'function') {
          window.logAntennaPositionChange(antennaId, antennaId, 0, 0, canvasX, canvasY, false);
        }
      }
    } catch (error) {
      console.error("Error updating single antenna:", error);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.getFriendlyActionMessage = getFriendlyActionMessage;
  window.startOptimizationPolling = startOptimizationPolling;
  window.stopOptimizationPolling = stopOptimizationPolling;
  window.handleOptimizationUpdate = handleOptimizationUpdate;
  window.updateSingleAntennaFromAction = updateSingleAntennaFromAction;

  return {
    startOptimizationPolling: startOptimizationPolling,
    stopOptimizationPolling: stopOptimizationPolling,
    handleOptimizationUpdate: handleOptimizationUpdate,
    updateSingleAntennaFromAction: updateSingleAntennaFromAction,
    getFriendlyActionMessage: getFriendlyActionMessage
  };
})();
