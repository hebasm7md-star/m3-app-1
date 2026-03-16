// OptimizationSystem — Handles AI antenna optimization polling and updates
// Depends on: global state, draw(), renderAPs(), NotificationSystem,
//             logAntennaPositionChange, generateHeatmapAsync, updateLegendBar, DataExportSystem

var OptimizationSystem = (function () {

  var optimizationPollingInterval = null;
  var rsrpTimingRows = [];

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
    rsrpTimingRows = [];  // Reset timing data for new optimization run
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

  function refreshHeatmap(onHeatmapShown) {
    if (!state.showVisualization) return;
    // state.cachedHeatmap = null;
    state.heatmapUpdatePending = false;
    state.onHeatmapShownCallback = onHeatmapShown || null;
    if (typeof generateHeatmapAsync === 'function') generateHeatmapAsync(null, true);
    // if (typeof draw === 'function') draw();
  }

  function hideLoadingOverlay() {
    var overlay = document.getElementById('loadingOverlay');
    if (overlay && overlay.style.display !== 'none') {
      overlay.style.opacity = '0';
      setTimeout(function () { overlay.style.display = 'none'; overlay.style.opacity = '1'; }, 400);
    }
  }

  // ── Compliance Display ─────────────────────────────────────────────────

  function setComplianceDisplay(value) {
    var el = document.getElementById('compliancePercent');
    if (!el) return;
    el.textContent = value;
    // Color-code: red < 60, orange 60–79, green ≥ 80
    el.classList.remove('compliance-low', 'compliance-mid', 'compliance-high');
    if (value < 60)       el.classList.add('compliance-low');
    else if (value < 80)  el.classList.add('compliance-mid');
    else                  el.classList.add('compliance-high');
    // Show AI source badge on the label
    var label = document.getElementById('complianceLabelAI');
    if (label) label.style.display = 'inline';
  }

  function clearComplianceDisplay() {
    var el = document.getElementById('compliancePercent');
    if (el) el.classList.remove('compliance-low', 'compliance-mid', 'compliance-high');
    var label = document.getElementById('complianceLabelAI');
    if (label) label.style.display = 'none';
    // Unblock UIRenderers so frontend calc resumes
    state.compliancePercentFromBackend = null;
  }

  /** Handle baseline RSRP update (place/move or get_accurate_baseline). 
    * When new_bsrv_rsrp null, clear backend grids (antenna turned off). */
  function handleBaselineRsrpUpdate(data) {
    if (data.new_bsrv_rsrp === null) {
      if (typeof window.clearBackendRsrpCache === 'function') window.clearBackendRsrpCache();
      refreshHeatmap();
      return;
    }
    var newRsrp = data.new_bsrv_rsrp || [];
    var newCompliance = data.new_compliance || [];
    if (Array.isArray(newRsrp) && newRsrp.length > 0) {
      if (typeof window.clearBackendRsrpCache === 'function') window.clearBackendRsrpCache();
      var latestRsrp = newRsrp[newRsrp.length - 1];
      if (latestRsrp && latestRsrp.length > 0) {
        var build = state.isOptimizing ? window.buildOptimizationRsrpGrid : window.buildAccurateEngineRsrpGrid;
        if (typeof build === 'function') build(latestRsrp);
        if (!state.isOptimizing && state.model !== 'accurateEngine') {
          state.model = 'accurateEngine';
          var mdl = document.getElementById('model');
          if (mdl) mdl.value = 'accurateEngine';
          if (typeof window.syncLiveRsrpFromModel === 'function') window.syncLiveRsrpFromModel();
        }
        hideLoadingOverlay();
      }
    } else if (Array.isArray(newCompliance) && newCompliance.length > 0 && typeof window.mergeBackendRsrpFromCache === 'function') {
      window.mergeBackendRsrpFromCache();
    }
    if (Array.isArray(newCompliance) && newCompliance.length > 0) {
      var latest = newCompliance[newCompliance.length - 1];
      if (latest !== undefined && latest !== null) {
        var rounded = Math.round(Number(latest));
        state.optimizationCompliancePercent = rounded;
        state.compliancePercentFromBackend = rounded;
        setComplianceDisplay(rounded);
      }
    }
    refreshHeatmap();
    if (data.type === "baseline_rsrp" && Array.isArray(newRsrp) && newRsrp.length > 0 && typeof DataExportSystem !== 'undefined' && DataExportSystem.exportDetailedCoverageData) {
      setTimeout(function () {
        var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        DataExportSystem.exportDetailedCoverageData('accurate_bl_cm_' + ts + '.csv', 1.0, { silent: true });
      }, 500);
    }
  }

  function handleTerminalStatus(status, data, footerBadge, footerMessage) {
    if (status !== 'finished' && status !== 'error') return;
    stopOptimizationPolling();
    if (typeof window.clearOptimizationRsrpGrid === 'function') {
      window.clearOptimizationRsrpGrid(status === 'finished');
    }
    if (status === 'finished') {
      setFooter(footerBadge, footerMessage, 'COMPLETED', "Optimization process successfully completed.", 'completed');
      if (typeof DataExportSystem !== 'undefined' && DataExportSystem.exportDetailedCoverageData) {
        setTimeout(function () {
          var ts2 = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          DataExportSystem.exportDetailedCoverageData('after_opt_cm_' + ts2 + '.csv', 1.0, { silent: true });
        }, 1000);
      }
      // Timing export only after optimization completes (snapshot & clear immediately to avoid re-export on re-entry)
      if (typeof DataExportSystem !== 'undefined' && DataExportSystem.exportTimingRowsAsXlsx && rsrpTimingRows.length > 0) {
        var rowsSnapshot = rsrpTimingRows.slice();
        rsrpTimingRows = [];
        setTimeout(function () {
          DataExportSystem.exportTimingRowsAsXlsx(rowsSnapshot);
        }, 2000);
      }
    } else {
      setFooter(footerBadge, footerMessage, 'ERROR', "Error: " + (data.error || "Optimization failed."));
      clearComplianceDisplay();  // reset to frontend calc on error
    }
  }

  // ── Main Update Handler ───────────────────────────────────────────────

  function handleOptimizationUpdate(data) {
    try {
      var toReadable = function (sec) { return new Date(sec * 1000).toISOString().replace('T', ' ').replace('Z', ''); };
      var newActions = data.new_action_configs || [];
      var newRsrp = data.new_bsrv_rsrp || [];
      var newCompliance = data.new_compliance || [];
      var status = data.status;
      var message = data.message;

      // RSRP grid
      var rsrpUpdated = false;
      var receiveAtSec = (performance.timeOrigin + performance.now()) / 1000;
      var serverSendSec = data.rsrp_send_timestamp_sec;
      if (Array.isArray(newRsrp) && newRsrp.length > 0) {
        var latestRsrp = newRsrp[newRsrp.length - 1];
        if (latestRsrp && latestRsrp.length > 0 && typeof window.buildOptimizationRsrpGrid === 'function') {
          window.buildOptimizationRsrpGrid(latestRsrp);
          rsrpUpdated = true;
          hideLoadingOverlay();
          // Record timing row when backend provides send timestamp (for latency profiling)
          if (serverSendSec != null) {
            rsrpTimingRows.push({
              index: rsrpTimingRows.length + 1,
              serverSendTime: toReadable(serverSendSec),
              clientReceiveTime: toReadable(receiveAtSec),
              heatmapTime: '',           // Filled when heatmap is rendered (onHeatmapShown)
              serverToClientSec: (receiveAtSec - serverSendSec).toFixed(3),
              receiveToHeatmapSec: '',  // Filled when heatmap is rendered
              serverToHeatmapSec: ''    // Filled when heatmap is rendered
            });
          }
        }
      }

      // Compliance — backend value owns the display during and after optimization
      if (Array.isArray(newCompliance) && newCompliance.length > 0) {
        var latest = newCompliance[newCompliance.length - 1];
        if (latest !== undefined && latest !== null) {
          var rounded = Math.round(Number(latest));
          state.optimizationCompliancePercent = rounded;
          state.compliancePercentFromBackend = rounded;  // blocks UIRenderers frontend calc
          setComplianceDisplay(rounded);
        }
      }

      // Loading overlay
      var overlay = document.getElementById('loadingOverlay');
      if (overlay && overlay.style.display !== 'none') {
        if (message) {
          var sub = document.getElementById('loadingSubtext');
          var txt = document.getElementById('loadingText');
          if (sub) sub.textContent = message;
          if (txt && !rsrpUpdated) txt.textContent = status === 'error' ? 'Optimization Failed' : 'Finalizing Baseline Data...';
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
        var onHeatmapShown = rsrpUpdated && rsrpTimingRows.length > 0 ? function () {
          var heatmapSec = (performance.timeOrigin + performance.now()) / 1000;
          var last = rsrpTimingRows[rsrpTimingRows.length - 1];
          last.heatmapTime = toReadable(heatmapSec);
          last.receiveToHeatmapSec = (heatmapSec - receiveAtSec).toFixed(3);  // Client receive → heatmap render
          last.serverToHeatmapSec = (heatmapSec - serverSendSec).toFixed(3); // End-to-end: server → heatmap
        } : null;
        refreshHeatmap(onHeatmapShown);
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
        
        if (enabledRaw !== undefined) {
          existing.enabled = enabledRaw === "True" || enabledRaw === true ||
                             enabledRaw === "true" || enabledRaw === 1 || enabledRaw === "1";
        }

        if (Math.abs(oldX - canvasX) > 0.01 || Math.abs(oldY - canvasY) > 0.01) {
          if (typeof window.logAntennaPositionChange === 'function') {
            window.logAntennaPositionChange(antennaId, antennaId, oldX, oldY, canvasX, canvasY, false);
          }
        }
      } else {
        var defaultPattern = typeof window.getDefaultAntennaPattern === 'function'
          ? window.getDefaultAntennaPattern() : null;
        var isNewEnabled = true;
        if (enabledRaw !== undefined) {
          isNewEnabled = enabledRaw === "True" || enabledRaw === true ||
                         enabledRaw === "true" || enabledRaw === 1 || enabledRaw === "1";
        }
        var ap = {
          id: antennaId, x: canvasX, y: canvasY, z: 0,
          tx: action.power !== undefined ? action.power : 15,
          gt: 5, ch: 1,
          azimuth: action.azimuth !== undefined ? action.azimuth : 0,
          tilt: action.tilt !== undefined ? action.tilt : 0,
          enabled: isNewEnabled,
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
  window.handleBaselineRsrpUpdate = handleBaselineRsrpUpdate;
  window.updateSingleAntennaFromAction = updateSingleAntennaFromAction;

  return {
    startOptimizationPolling: startOptimizationPolling,
    stopOptimizationPolling: stopOptimizationPolling,
    handleOptimizationUpdate: handleOptimizationUpdate,
    updateSingleAntennaFromAction: updateSingleAntennaFromAction,
    getFriendlyActionMessage: getFriendlyActionMessage
  };
})();