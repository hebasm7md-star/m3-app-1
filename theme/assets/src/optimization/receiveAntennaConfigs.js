// receiveAntennaConfigs.js — Incoming messages from the backend (Anvil Integration)
//
// Depends on: global state, draw(), renderAPs(), renderApDetails(),
//             NotificationSystem, processCsvDataFromAnvil(),
//             handleOptimizationUpdate(), stopOptimizationPolling(),
//             logAntennaPositionChange(), getDefaultAntennaPattern()
//
// Must load AFTER 03a-BACKEND-SEND.js (uses logAntennaPositionChange).
//
// Exposes on window:
//   updateAntennasFromConfigs

var ReceiveAntennaConfigs = (function () {

    // ---------------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------------
    var DEFAULT_Z_HEIGHT    = 2.5;   // metres — default antenna height for new antennas
    var DEFAULT_TX_POWER    = 15;    // dBm   — default power for new antennas
    var DEFAULT_GAIN        = 5;     // dBi   — default gain for new antennas
    var DEFAULT_CHANNEL     = 1;     //       — default channel for new antennas
    var COORD_MOVE_THRESHOLD = 0.01; // metres — minimum move to log a position change
    var PARENT_ORIGIN       = "*";   // TODO: replace with your Anvil app origin e.g. "https://yourdomain.com"
  
    // ---------------------------------------------------------------------------
    // Antenna config updater
    // ---------------------------------------------------------------------------
  
    /**
     * Apply an array of antenna configs received from the backend.
     * Coordinates are transformed from backend space to canvas space using
     * a uniform scale that preserves aspect ratio.
     */
    function updateAntennasFromConfigs(antennaConfigs) {
      try {
        if (!Array.isArray(antennaConfigs) || antennaConfigs.length === 0) {
          NotificationSystem.warning("No antenna configs received or invalid format.");
          return;
        }
  
        // First pass — find bounds for coordinate transformation
        var minX = Infinity, maxX = -Infinity;
        var minY = Infinity, maxY = -Infinity;
        var validConfigs = [];
  
        for (var i = 0; i < antennaConfigs.length; i++) {
          var cfg = antennaConfigs[i];
          var x   = cfg.X || cfg.x;
          var y   = cfg.Y || cfg.y;
          if (x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
            validConfigs.push(cfg);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
  
        if (validConfigs.length === 0) {
          NotificationSystem.warning("No valid antenna coordinates found in configs.");
          return;
        }
  
        // Uniform scale — preserves aspect ratio, fits within canvas
        var scale = Math.min(
          state.w / (maxX - minX),
          state.h / (maxY - minY)
        );
  
        var defaultPattern = typeof window.getDefaultAntennaPattern === "function"
          ? window.getDefaultAntennaPattern()
          : null;
  
        var updatedCount = 0;
        var createdCount = 0;
  
        // Second pass — update or create each antenna
        for (var i = 0; i < validConfigs.length; i++) {
          var cfg     = validConfigs[i];
          var id      = cfg.id || cfg.antenna_id;
          var canvasX = ((cfg.X || cfg.x) - minX) * scale;
          var canvasY = ((cfg.Y || cfg.y) - minY) * scale;
          var enabled = cfg.on      !== undefined ? cfg.on
                      : cfg.enabled !== undefined ? cfg.enabled
                      : true;
  
          if (!id) { console.warn("Skipping config without ID:", cfg); continue; }
  
          var existing = null;
          for (var j = 0; j < state.aps.length; j++) {
            if (state.aps[j].id === id) { existing = state.aps[j]; break; }
          }
  
          if (existing) {
            var oldX = existing.x, oldY = existing.y;
            existing.x       = canvasX;
            existing.y       = canvasY;
            existing.enabled = enabled;
  
            if (Math.abs(oldX - canvasX) > COORD_MOVE_THRESHOLD ||
                Math.abs(oldY - canvasY) > COORD_MOVE_THRESHOLD) {
              logAntennaPositionChange(id, id, oldX, oldY, canvasX, canvasY, false);
            }
            updatedCount++;
  
          } else {
            // buildAntennaPayload is for *sending* to the backend —
            // the full shape is needed here for state.aps.
            var newAntenna = {
              id:                     id,
              x:                      canvasX,
              y:                      canvasY,
              z:                      DEFAULT_Z_HEIGHT,
              tx:                     cfg.power   !== undefined ? cfg.power   : DEFAULT_TX_POWER,
              gt:                     DEFAULT_GAIN,
              ch:                     DEFAULT_CHANNEL,
              azimuth:                cfg.azimuth !== undefined ? cfg.azimuth : 0,
              tilt:                   cfg.tilt    !== undefined ? cfg.tilt    : 0,
              enabled:                enabled,
              antennaPattern:         defaultPattern || null,
              antennaPatternFile:     null,
              antennaPatternFileName: defaultPattern ? (defaultPattern.name || null) : null
            };
  
            state.aps.push(newAntenna);
            logAntennaPositionChange(id, id, 0, 0, canvasX, canvasY, false);
            createdCount++;
          }
        }
  
        // Invalidate heatmap and refresh UI
        state.cachedHeatmap        = null;
        state.heatmapUpdatePending = false;
  
        if (window.saveState)       window.saveState();
        if (window.renderAPs)       window.renderAPs();
        if (window.renderApDetails) window.renderApDetails();
        if (window.draw)            window.draw();
  
        var msg = "Antenna optimization complete! ";
        if (updatedCount > 0) msg += "Updated: " + updatedCount + " antenna(s). ";
        if (createdCount > 0) msg += "Created: " + createdCount + " antenna(s). ";
        NotificationSystem.success(msg);
  
      } catch (err) {
        console.error("Error updating antennas from configs:", err);
        NotificationSystem.error("Failed to update antennas.\n" + err.message);
      }
    }
  
    // ---------------------------------------------------------------------------
    // Optimization UI helpers — keep buttons and footer in sync
    // ---------------------------------------------------------------------------
  
    function setOptimizeButtonIdle() {
      var btn = document.getElementById("optimizeBtn");
      if (btn) {
        btn.disabled      = false;
        btn.style.opacity = "1";
        btn.style.cursor  = "pointer";
        btn.textContent   = "Optimize";
      }
      var addAPBtn = document.getElementById("addAP");
      if (addAPBtn) {
        addAPBtn.disabled            = false;
        addAPBtn.style.opacity       = "1";
        addAPBtn.style.pointerEvents = "auto";
      }
      if (window.renderAPs)       window.renderAPs();
      if (window.renderApDetails) window.renderApDetails();
    }
  
    function setFooterStatus(text, cssClass) {
      var badge = document.getElementById("footerBadge");
      var msg   = document.getElementById("footerMessage");
      if (badge) {
        badge.textContent = text;
        badge.classList.remove("active", "manual", "optimizing", "completed");
        if (cssClass) badge.classList.add(cssClass);
      }
      if (msg) msg.textContent = text === "COMPLETED"
        ? "Optimization completed successfully"
        : "Optimization error occurred";
    }
  
    // ---------------------------------------------------------------------------
    // Main message router — handles all message types from the backend
    // ---------------------------------------------------------------------------
  
    window.addEventListener("message", function (event) {
      var d = event.data;
      if (!d) return;
  
      switch (d.type) {
  
        case "anvil_ready":
          console.log("Anvil parent ready");
          break;
  
        case "app_version":
          var badge = document.getElementById("modelBadge");
          if (badge && d.version) badge.textContent = "V" + d.version;
          break;
  
        case "csv_data":
          if (d.success && d.csv_data) {
            if (typeof window.processCsvDataFromAnvil === "function") {
              window.processCsvDataFromAnvil(d.csv_data);
            } else {
              console.warn("processCsvDataFromAnvil not found.");
            }
          } else {
            NotificationSystem.error("Failed to receive CSV data.\n" + (d.error || "Unknown error"));
          }
          break;
  
        case "antenna_configs":
          if (d.success && d.antennas) updateAntennasFromConfigs(d.antennas);
          else NotificationSystem.error("Failed to receive antenna configs.\n" + (d.error || "Unknown error"));
          break;
  
        case "optimization_update":
          if (typeof window.handleOptimizationUpdate === "function") window.handleOptimizationUpdate(d);
          break;
  
        case "optimization_started":
          console.log("Optimization started");
          window.optimizationLastIndex = 0;
          window.optimizationBounds    = null;
          break;
  
        case "optimization_finished":
          console.log("Optimization completed");
          if (typeof window.stopOptimizationPolling === "function") window.stopOptimizationPolling();
          state.isOptimizing = false;
          setOptimizeButtonIdle();
          setFooterStatus("COMPLETED", "completed");
          NotificationSystem.success("Optimization complete! All antennas have been updated.");
          break;
  
        case "optimization_error":
          console.log("Optimization error:", d.error);
          if (typeof window.stopOptimizationPolling === "function") window.stopOptimizationPolling();
          state.isOptimizing = false;
          setOptimizeButtonIdle();
          setFooterStatus("ERROR", null);
          NotificationSystem.error("Optimization failed.\n" + (d.error || "Unknown error"));
          break;
  
        case "baseline_completed":
        case "baseline_error": {
          var baselineBtn = document.getElementById("calculateBaselineBtn");
          if (baselineBtn) {
            var isSuccess             = d.type === "baseline_completed";
            baselineBtn.innerHTML     = "Calculate Accurate Baseline";
            baselineBtn.disabled      = isSuccess;
            baselineBtn.style.opacity = isSuccess ? "0.5" : "1";
            baselineBtn.style.cursor  = isSuccess ? "not-allowed" : "pointer";
          }
          if (d.type === "baseline_completed") {
            NotificationSystem.success(d.message || "Accurate baseline calculated successfully!");
          } else {
            NotificationSystem.warning(
              d.message || d.error ||
              "Add antennas to calculate accurate baseline using manual or automatic placement."
            );
          }
          break;
        }
  
        case "backend_message": {
          var reqId       = d.requestId;
          var messageType = d.messageType || "info";
          NotificationSystem.backend(d.message || "", messageType, messageType, [{
            label:    "OK",
            primary:  true,
            callback: function () {
              if (reqId && window.parent !== window) {
                window.parent.postMessage({
                  type:      "backend_message_response",
                  requestId: reqId,
                  response:  true
                }, PARENT_ORIGIN);
              }
            }
          }]);
          break;
        }
      }
    });
  
    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
    window.updateAntennasFromConfigs = updateAntennasFromConfigs;
  
    return {
      updateAntennasFromConfigs: updateAntennasFromConfigs
    };
  
  })();