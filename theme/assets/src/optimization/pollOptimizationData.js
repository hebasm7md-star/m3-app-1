// OptimizationSystem — Handles AI antenna optimization polling and updates
// Depends on: global state, draw(), renderAPs(), NotificationSystem,
//             logAntennaPositionChange, generateHeatmapAsync, updateLegendBar,
//             DataExportSystem, AccurateEngineRsrp (buildOptimizationRsrpGrid,
//             clearBackendRsrpCache, mergeBackendRsrpFromCache)

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

  // Footer badge config: status -> [badgeText, cssClass]
  var FOOTER_STATUS = {
    starting: ['STARTING',   'optimizing'],
    running:  ['OPTIMIZING', 'optimizing'],
    finished: ['COMPLETED',  'completed'],
    error:    ['ERROR',       null],
    idle:     ['READY',       null]
  };

  // Shared helpers

  function nowTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  }

  function parseEnabled(raw) {
    return raw === true || raw === "True" || raw === "true" || raw === 1 || raw === "1";
  }

  function pickField(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null) return obj[keys[i]];
    }
    return undefined;
  }

  // Polling

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

  function setFooter(badge, msg, status, msgText) {
    var cfg = FOOTER_STATUS[status] || FOOTER_STATUS.idle;
    if (badge) {
      badge.textContent = cfg[0];
      badge.classList.remove('active', 'manual', 'optimizing', 'completed');
      if (cfg[1]) badge.classList.add(cfg[1]);
    }
    if (msg && msgText) msg.textContent = msgText;
  }

  function setButtonLocked(btn, locked) {
    if (!btn) return;
    btn.disabled = locked;
    btn.style.opacity = locked ? '0.5' : '1';
  }

  function setOptimizeButtons(running) {
    var optimizeBtn = document.getElementById("optimizeBtn");
    var addAPBtn    = document.getElementById("addAP");
    setButtonLocked(optimizeBtn, running);
    setButtonLocked(addAPBtn,    running);
    if (optimizeBtn) {
      optimizeBtn.style.cursor = running ? 'not-allowed' : 'pointer';
      optimizeBtn.textContent  = running ? 'Running...'  : 'Optimize';
    }
    if (addAPBtn) addAPBtn.style.pointerEvents = running ? 'none' : 'auto';
    state.isOptimizing = running;
  }

  function refreshHeatmap(onHeatmapShown) {
    if (!state.showVisualization) return;
    state.heatmapUpdatePending   = false;
    state.onHeatmapShownCallback = onHeatmapShown || null;
    if (typeof generateHeatmapAsync === 'function') generateHeatmapAsync(null, true);
  }

  function getFriendlyActionMessage(action) {
    if (!action) return "Analyzing network state...";
    var msg = ACTION_MESSAGES[action.action_type] || action.action_desc;
    return (action.antenna_id || "System") + ": " + (msg || "Optimization parameter updated successfully.");
  }

  // Compliance display

  function setComplianceDisplay(value) {
    var el = document.getElementById('compliancePercent');
    if (!el) return;
    el.textContent = value;
    el.classList.remove('compliance-low', 'compliance-mid', 'compliance-high');
    el.classList.add(value < 60 ? 'compliance-low' : value < 80 ? 'compliance-mid' : 'compliance-high');
    var label = document.getElementById('complianceLabelAI');
    if (label) label.style.display = 'inline';
  }

  function clearComplianceDisplay() {
    var el = document.getElementById('compliancePercent');
    if (el) el.classList.remove('compliance-low', 'compliance-mid', 'compliance-high');
    var label = document.getElementById('complianceLabelAI');
    if (label) label.style.display = 'none';
    state.compliancePercentFromBackend = null;
  }

  function applyComplianceUpdate(newCompliance) {
    if (!Array.isArray(newCompliance) || !newCompliance.length) return;
    var rounded = Math.round(+newCompliance[newCompliance.length - 1]);
    state.optimizationCompliancePercent = rounded;
    state.compliancePercentFromBackend  = rounded;
    setComplianceDisplay(rounded);
  }

  // RSRP grid update (delegates to AccurateEngineRsrp)
  function applyRsrpUpdate(newRsrp, serverSendSec, receiveAtSec) {
    if (!Array.isArray(newRsrp) || !newRsrp.length) return false;
    var latestRsrp = newRsrp[newRsrp.length - 1];
    if (!latestRsrp || !latestRsrp.length) return false;

    window.buildOptimizationRsrpGrid(latestRsrp);

    if (serverSendSec != null) {
      var toReadable = function (sec) {
        return new Date(sec * 1000).toISOString().replace('T', ' ').replace('Z', '');
      };
      rsrpTimingRows.push({
        index:               rsrpTimingRows.length + 1,
        serverSendTime:      toReadable(serverSendSec),
        clientReceiveTime:   toReadable(receiveAtSec),
        heatmapTime:         '',
        serverToClientSec:   (receiveAtSec - serverSendSec).toFixed(3),
        receiveToHeatmapSec: '',
        serverToHeatmapSec:  ''
      });
    }
    return true;
  }

  // Baseline RSRP update

  function handleBaselineRsrpUpdate(data) {
    if (data.new_bsrv_rsrp === null) {
      window.clearBackendRsrpCache();
      refreshHeatmap();
      return;
    }

    var newRsrp       = data.new_bsrv_rsrp || [];  // RSRP values from backend
    var newCompliance = data.new_compliance || [];

    if (Array.isArray(newRsrp) && newRsrp.length) {
      window.clearBackendRsrpCache();
      var latest = newRsrp[newRsrp.length - 1];
      if (latest && latest.length) window.buildOptimizationRsrpGrid(latest);
    } else if (Array.isArray(newCompliance) && newCompliance.length) {
      window.mergeBackendRsrpFromCache();
    }

    applyComplianceUpdate(newCompliance);
    refreshHeatmap();

    if (data.type === "baseline_rsrp" && Array.isArray(newRsrp) && newRsrp.length &&
        typeof DataExportSystem !== 'undefined' && DataExportSystem.exportDetailedCoverageData) {
      setTimeout(function () {
        DataExportSystem.exportDetailedCoverageData('accurate_bl_cm_' + nowTimestamp() + '.csv', 1.0, { silent: true });
      }, 1000);
    }
  }

  // Terminal status

  function handleTerminalStatus(status, data, footerBadge, footerMessage) {
    if (status !== 'finished' && status !== 'error') return;
    stopOptimizationPolling();

    if (status === 'finished') {
      setFooter(footerBadge, footerMessage, 'finished', "Optimization process successfully completed.");

      if (typeof DataExportSystem !== 'undefined' && DataExportSystem.exportDetailedCoverageData) {
        setTimeout(function () {
          DataExportSystem.exportDetailedCoverageData('after_opt_cm_' + nowTimestamp() + '.csv', 1.0, { silent: true });
        }, 1000);
      }

      if (rsrpTimingRows.length > 0) {
        var rowsSnapshot = rsrpTimingRows.slice();
        rsrpTimingRows = [];
        setTimeout(function () { exportTimingRowsAsXlsx(rowsSnapshot); }, 2000);
      }
    } else {
      setFooter(footerBadge, footerMessage, 'error', "Error: " + (data.error || "Optimization failed."));
      clearComplianceDisplay();
    }
  }

  // Main update handler

  function handleOptimizationUpdate(data) {
    try {
      var newActions    = data.new_action_configs || [];
      var newRsrp       = data.new_bsrv_rsrp      || [];
      var newCompliance  = data.new_compliance     || [];
      var status        = data.status;
      var message       = data.message;

      var receiveAtSec = (performance.timeOrigin + performance.now()) / 1000;
      var rsrpUpdated  = applyRsrpUpdate(newRsrp, data.rsrp_send_timestamp_sec, receiveAtSec);

      applyComplianceUpdate(newCompliance);

      var overlay = document.getElementById('loadingOverlay');
      if (overlay && overlay.style.display !== 'none') {
        if (message) {
          var sub = document.getElementById('loadingSubtext');
          var txt = document.getElementById('loadingText');
          if (sub) sub.textContent = message;
          if (txt) txt.textContent = status === 'error' ? 'Optimization Failed' : 'Finalizing Baseline Data...';
        }
        if (status === 'finished' || status === 'error') {
          overlay.style.opacity = '0';
          setTimeout(function () { overlay.style.display = 'none'; overlay.style.opacity = '1'; }, 400);
        }
      }

      if (status === 'starting' || status === 'running') {
        setOptimizeButtons(true);
      } else if (status === 'finished' || status === 'error' || status === 'idle') {
        setOptimizeButtons(false);
      }

      var footerBadge   = document.getElementById('footerBadge');
      var footerMessage = document.getElementById('footerMessage');
      setFooter(footerBadge, footerMessage, status, message || null);

      var changesMade = false;
      for (var i = 0; i < newActions.length; i++) {
        if (newActions[i]) { updateSingleAntennaFromAction(newActions[i]); changesMade = true; }
      }

      if (footerMessage && newActions.length) {
        footerMessage.textContent = getFriendlyActionMessage(newActions[newActions.length - 1]);
      }

      if (data.last_index !== undefined) window.optimizationLastIndex = data.last_index;
      if (data.optimization_bounds)      window.optimizationBounds    = data.optimization_bounds;

      if (changesMade || rsrpUpdated) {
        if (changesMade) {
          if (window.saveState) window.saveState();
          if (window.renderAPs) window.renderAPs();
        }
        var onHeatmapShown = (rsrpUpdated && rsrpTimingRows.length) ? function () {
          var heatmapSec = (performance.timeOrigin + performance.now()) / 1000;
          var last = rsrpTimingRows[rsrpTimingRows.length - 1];
          last.heatmapTime         = new Date(heatmapSec * 1000).toISOString().replace('T', ' ').replace('Z', '');
          last.receiveToHeatmapSec = (heatmapSec - receiveAtSec).toFixed(3);
          last.serverToHeatmapSec  = (heatmapSec - data.rsrp_send_timestamp_sec).toFixed(3);
        } : null;
        refreshHeatmap(onHeatmapShown);
      }

      handleTerminalStatus(status, data, footerBadge, footerMessage);
    } catch (err) {
      console.error("[OptimizationSystem] handleOptimizationUpdate error:", err);
      stopOptimizationPolling();
    }
  }

  // Antenna update from action

  function updateSingleAntennaFromAction(action) {
    try {
      var antennaId  = action.antenna_id || action.id;
      var backendX   = +pickField(action, ['X_antenna', 'X', 'x']);
      var backendY   = +pickField(action, ['Y_antenna', 'Y', 'y']);
      var enabledRaw = pickField(action, ['is_turnning_on', 'on', 'enabled']);

      if (!antennaId || !isFinite(backendX) || !isFinite(backendY)) {
        console.warn("[OptimizationSystem] Invalid action config:", action);
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
        if (enabledRaw !== undefined) existing.enabled = parseEnabled(enabledRaw);
        if ((Math.abs(oldX - canvasX) > 0.01 || Math.abs(oldY - canvasY) > 0.01) &&
            typeof window.logAntennaPositionChange === 'function') {
          window.logAntennaPositionChange(antennaId, antennaId, oldX, oldY, canvasX, canvasY, false);
        }
      } else {
        var defaultPattern = typeof window.getDefaultAntennaPattern === 'function'
          ? window.getDefaultAntennaPattern() : null;
        var ap = {
          id: antennaId, x: canvasX, y: canvasY, z: 0,
          tx:      action.power   != null ? action.power   : 15,
          gt: 5,   ch: 1,
          azimuth: action.azimuth != null ? action.azimuth : 0,
          tilt:    action.tilt    != null ? action.tilt    : 0,
          enabled: enabledRaw !== undefined ? parseEnabled(enabledRaw) : true,
          antennaPatternFile: null, antennaPatternFileName: null
        };
        if (defaultPattern) ap.antennaPattern = defaultPattern;
        state.aps.push(ap);
        if (typeof window.logAntennaPositionChange === 'function') {
          window.logAntennaPositionChange(antennaId, antennaId, 0, 0, canvasX, canvasY, false);
        }
      }
    } catch (err) {
      console.error("[OptimizationSystem] updateSingleAntennaFromAction error:", err);
    }
  }

  // Timing XLSX export

  function exportTimingRowsAsXlsx(rows) {
    if (!rows || !rows.length) return;

    var HEADERS = ['#', 'Server Send Time', 'Client Receive Time', 'Heatmap Render Time',
                   'Server->Client (s)', 'Receive->Heatmap (s)', 'Server->Heatmap (s)'];

    function rowToArray(r) {
      return [r.index, r.serverSendTime, r.clientReceiveTime, r.heatmapTime,
              r.serverToClientSec, r.receiveToHeatmapSec, r.serverToHeatmapSec];
    }

    function doExport(XLSX) {
      var wsData = [HEADERS].concat(rows.map(rowToArray));
      var ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = HEADERS.map(function (h) { return { wch: Math.max(h.length + 2, 18) }; });
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'RSRP Timing');
      var filename = 'rsrp_timing_' + nowTimestamp() + '.xlsx';
      XLSX.writeFile(wb, filename);
      console.log('[Timing] Exported', rows.length, 'row(s) ->', filename);
    }

    function csvFallback() {
      var lines = [HEADERS.join(',')].concat(rows.map(function (r) { return rowToArray(r).join(','); }));
      var a = document.createElement('a');
      a.href     = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
      a.download = 'rsrp_timing_' + nowTimestamp() + '.csv';
      a.click();
      console.warn('[Timing] SheetJS unavailable - exported as CSV fallback');
    }

    if (typeof XLSX !== 'undefined') {
      doExport(XLSX);
    } else {
      var s = document.createElement('script');
      s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload  = function () { doExport(window.XLSX); };
      s.onerror = csvFallback;
      document.head.appendChild(s);
    }
  }

  // Public API

  window.getFriendlyActionMessage      = getFriendlyActionMessage;
  window.startOptimizationPolling      = startOptimizationPolling;
  window.stopOptimizationPolling       = stopOptimizationPolling;
  window.handleOptimizationUpdate      = handleOptimizationUpdate;
  window.handleBaselineRsrpUpdate      = handleBaselineRsrpUpdate;
  window.updateSingleAntennaFromAction = updateSingleAntennaFromAction;

  return {
    startOptimizationPolling:      startOptimizationPolling,
    stopOptimizationPolling:       stopOptimizationPolling,
    handleOptimizationUpdate:      handleOptimizationUpdate,
    handleBaselineRsrpUpdate:      handleBaselineRsrpUpdate,
    updateSingleAntennaFromAction: updateSingleAntennaFromAction,
    getFriendlyActionMessage:      getFriendlyActionMessage
  };
})();
