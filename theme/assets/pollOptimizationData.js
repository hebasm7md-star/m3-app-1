// 04-OPTIMIZATION-SYSTEM.js - Handles AI antenna optimization polling and updates
// Depends on: global state, draw(), renderAPs(), renderApDetails(), NotificationSystem, logAntennaPositionChange

var OptimizationSystem = (function () {

  var optimizationPollingInterval = null;

  // Helper to generate a professional message for optimization actions
  function getFriendlyActionMessage(action) {
    if (!action) return "Analyzing network state...";

    const type = action.action_type;
    const id = action.antenna_id || "System";

    switch (type) {
      case 'Sectorization': return `${id}: Optimizing sector configuration...`;
      case 'CIO': return `${id}: Adjusting CIO handover parameters...`;
      case 'Turnning_ON_OFF': return `${id}: Toggle antenna status (ON/OFF)...`;
      case 'PCI': return `${id}: Reassigining PCI collision...`;
      case 'pattern_change': return `${id}: Changing antenna pattern...`;
      case 'power': return `${id}: Tuning transmission power levels ...`;
      case 'tilt': return `${id}: Adjusting Remote Electrical Tilt (RET)...`;
      case 'azimuth': return `${id}: Rotating horizontal orientation (Azimuth)...`;
      case 'location': return `${id}: Optimizing physical location coordinates...`;
      default:
        // Fallback for technical action descriptions
        if (action.action_desc) return `${id}: ${action.action_desc}`;
        return `${id}: Optimization parameter updated successfully.`;
    }
  }

  // Start polling for optimization updates
  function startOptimizationPolling() {
    if (optimizationPollingInterval) {
      clearInterval(optimizationPollingInterval);
    }

    // Poll every 500ms for new antennas
    optimizationPollingInterval = setInterval(function () {
      window.parent.postMessage(
        {
          type: "poll_optimization_update",
          lastIndex: window.optimizationLastIndex || 0,
        },
        "*"
      );
    }, 500);

    console.log("[startOptimizationPolling] Started optimization polling");
  }

  // Stop polling for optimization updates
  function stopOptimizationPolling() {
    if (optimizationPollingInterval) {
      clearInterval(optimizationPollingInterval);
      optimizationPollingInterval = null;
    }
    console.log("Stopped optimization polling");
  }

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
      console.warn("[BackendRSRP] Grid dimensions mismatch:", cols, "x", rows, "!=", totalBins);
      return;
    }

    var gridData = new Float32Array(totalBins);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        // -90 degree rotation (counter-clockwise)
        // Maps frontend (c, r) to backend (old_x, old_y)
        // old_width = rows, old_height = cols
        // old_x = (rows - 1) - r
        // old_y = c
        var backendX = (rows - 1) - r;
        var backendY = c;
        var i = backendY * rows + backendX; // using rows as old_width

        var frontendIndex = r * cols + c;
        gridData[frontendIndex] = Number(rsrpValues[i]);
      }
    }

    state.optimizationRsrpGrid = {
      data: gridData,
      cols: cols,
      rows: rows,
      dx: state.w / cols,
      dy: state.h / rows
    };
    console.log("[BackendRSRP] Grid built:", cols, "x", rows, "from", totalBins, "bins");
  }

  // Handle a single optimization update (one or more antennas)
  function handleOptimizationUpdate(data) {
    try {
      var newActions = data.new_action_configs || [];
      var newRsrp = data.new_bsrv_rsrp || [];
      var newCompliancePercent = data.new_compliance || [];
      var status = data.status;
      var message = data.message;

      // Store backend RSRP grid (use latest step)
      if (Array.isArray(newRsrp) && newRsrp.length > 0) {
        var latestRsrp = newRsrp[newRsrp.length - 1];
        if (latestRsrp && latestRsrp.length > 0) {
          buildBackendRsrpGrid(latestRsrp);
        }
      }

      // Store backend compliance (use latest step), skip frontend recalculation
      if (Array.isArray(newCompliancePercent) && newCompliancePercent.length > 0) {
        var latestCompliance = newCompliancePercent[newCompliancePercent.length - 1];
        if (latestCompliance !== undefined && latestCompliance !== null) {
          state.optimizationCompliancePercent = Math.round(Number(latestCompliance));
          var compliancePercentEl = document.getElementById("compliancePercent");
          if (compliancePercentEl) {
            compliancePercentEl.textContent = state.optimizationCompliancePercent;
          }
        }
      }

      // Update loading message if visible
      var overlay = document.getElementById('loadingOverlay');
      var loadingText = document.getElementById('loadingText');
      var loadingSubtext = document.getElementById('loadingSubtext');

      if (overlay && overlay.style.display !== 'none') {
        if (message) {
          if (loadingSubtext) loadingSubtext.textContent = message;
          if (loadingText) loadingText.textContent = status === 'error' ? 'Optimization Failed' : 'Finalizing Baseline Data...';
        }

        // Hide overlay when baseline is done and optimization is actually running or completed
        if (status !== 'starting' && status !== 'idle' || status === 'error') {
          overlay.style.opacity = '0';
          setTimeout(function () {
            overlay.style.display = 'none';
            overlay.style.opacity = '1';
          }, 400);
        }
      }

      // Standardize button management based on status
      var optimizeBtn = document.getElementById("optimizeBtn");
      var addAPBtn = document.getElementById("addAP");
      if (status === 'starting' || status === 'running') {
        if (optimizeBtn && !optimizeBtn.disabled) {
          optimizeBtn.disabled = true;
          optimizeBtn.style.opacity = '0.5';
          optimizeBtn.style.cursor = 'not-allowed';
          optimizeBtn.textContent = 'Running...';
        }
        if (addAPBtn && !addAPBtn.disabled) {
          addAPBtn.disabled = true;
          addAPBtn.style.opacity = '0.5';
          addAPBtn.style.pointerEvents = 'none';
        }
        state.isOptimizing = true;
      } else if (status === 'completed'|| status === 'finished' || status === 'error' || status === 'idle') {
        if (optimizeBtn && optimizeBtn.disabled) {
          optimizeBtn.disabled = false;
          optimizeBtn.style.opacity = '1';
          optimizeBtn.style.cursor = 'pointer';
          optimizeBtn.textContent = 'Optimize';
        }
        if (addAPBtn && addAPBtn.disabled) {
          addAPBtn.disabled = false;
          addAPBtn.style.opacity = '1';
          addAPBtn.style.pointerEvents = 'auto';
        }
        state.isOptimizing = false;
      }

      // Update footer status
      var footerBadge = document.getElementById('footerBadge');
      var footerMessage = document.getElementById('footerMessage');

      if (status === 'starting') {
        if (footerBadge) {
          footerBadge.textContent = 'STARTING';
          footerBadge.classList.add('active');
        }
        if (footerMessage && message) {
          footerMessage.textContent = message;
        }
      } else if (status === 'running') {
        if (footerBadge) {
          footerBadge.textContent = 'RUNNING';
          footerBadge.classList.add('active');
        }
        if (footerMessage) {
          footerMessage.textContent = message || 'Running...';
        }
      } else if (status === 'completed' || status === 'finished') {
        if (footerBadge) {
          footerBadge.textContent = 'COMPLETED';
          footerBadge.classList.remove('active');
        }
        if (footerMessage) {
          footerMessage.textContent = message || 'Completed';
        }
      } else if (status === 'error') {
        if (footerBadge) {
          footerBadge.textContent = 'ERROR';
          footerBadge.classList.remove('active');
        }
        if (footerMessage) {
          footerMessage.textContent = message || 'Error occurred';
        }
      } else {
        if (footerBadge) {
          footerBadge.textContent = 'READY';
          footerBadge.classList.remove('active');
        }
        if (footerMessage) {
          footerMessage.textContent = message || 'Ready';
        }
      }

      if (!Array.isArray(newActions) || newActions.length === 0) {
        // No new antennas yet
        if (status === "completed" || status === "error" || status === 'finished') {
          stopOptimizationPolling();
          if (footerBadge) {
            footerBadge.textContent = status === "completed" ? 'COMPLETED' : 'ERROR';
            footerBadge.classList.remove('active');
          }
          if (status === "completed" || status === 'finished') {
            if (footerMessage) footerMessage.textContent = "Optimization process successfully completed.";
            window.parent.postMessage(
              { type: "optimization_finished" },
              "*"
            );
          } else {
            if (footerMessage) footerMessage.textContent = "Error: " + (data.error || "Optimization failed.");
            window.parent.postMessage(
              {
                type: "optimization_error",
                error: data.error || "Unknown error",
              },
              "*"
            );
          }
        }
        return;
      }

      // Update footer with the latest action
      if (newActions.length > 0 && footerMessage) {
        const latestAction = newActions[newActions.length - 1];
        footerMessage.textContent = getFriendlyActionMessage(latestAction);
      }

      // Update last index - server always returns last_index (single source of truth)
      if (data.last_index !== undefined) {
        window.optimizationLastIndex = data.last_index;
      }

      var changesMade = false;

      // Update bounding box if provided
      if (data.optimization_bounds) {
        window.optimizationBounds = data.optimization_bounds;
        var p1 = window.optimizationBounds.p1;
        var p2 = window.optimizationBounds.p2;
        var centerX = (p1.x + p2.x) / 2;
        var centerY = (p1.y + p2.y) / 2;

        console.log("Optimization bounds updated:", window.optimizationBounds);

        // Map backend coordinate center to canvas coordinates
        // Assuming bounds are already in valid format, but need scaling
        // We'll trust the coordinates from backend and use our standard projection if needed
        // For now, we just rely on updateSingleAntennaFromAction mapping

        // Optionally zoom or pan to area (not implemented to avoid jarring UI)
      }

      // Process new actions sequentially
      for (var i = 0; i < newActions.length; i++) {
        var actionConfig = newActions[i];
        if (actionConfig) {
          updateSingleAntennaFromAction(actionConfig);
          changesMade = true;
        }
      }

      // If changes were made, refresh the view
      if (changesMade) {
        if (window.saveState) window.saveState();
        if (window.renderAPs) window.renderAPs();

        var canvas = document.getElementById("plot");
        if (canvas && typeof window.draw === 'function') {
          // Re-generate heatmap and redraw
          if (state.showVisualization) {
            state.cachedHeatmap = null;
            state.heatmapUpdatePending = false;
            if (typeof window.generateHeatmapAsync === 'function') window.generateHeatmapAsync(null, true);
          }
          window.draw();
        }
      }

      // If optimization is marked as completed by backend, stop polling
      if (status === "completed" || status === "error" || status === 'finished') {
        stopOptimizationPolling();

        if (status === "completed" || status === 'finished') {
          if (footerBadge) {
            footerBadge.textContent = 'COMPLETED';
            footerBadge.classList.remove('active');
          }
          if (footerMessage) {
            footerMessage.textContent = "Optimization process successfully completed.";
          }
          window.parent.postMessage(
            { type: "optimization_finished" },
            "*"
          );
        } else {
          if (footerBadge) {
            footerBadge.textContent = 'ERROR';
            footerBadge.classList.remove('active');
          }
          if (footerMessage) {
            footerMessage.textContent = "Error: " + (data.error || "Optimization failed.");
          }
          window.parent.postMessage(
            {
              type: "optimization_error",
              error: data.error || "Unknown error",
            },
            "*"
          );
        }
      }
    } catch (error) {
      console.error("Error handling optimization update:", error);
      stopOptimizationPolling();
    }
  }

  // Update a single antenna from an action config
  function updateSingleAntennaFromAction(action) {
    try {
      var antennaId = action.antenna_id || action.id;
      // Use backend field names robustly (supports 0 values)
      var rawX = (action.X_antenna !== undefined && action.X_antenna !== null) ? action.X_antenna :
        ((action.X !== undefined && action.X !== null) ? action.X : action.x);
      var rawY = (action.Y_antenna !== undefined && action.Y_antenna !== null) ? action.Y_antenna :
        ((action.Y !== undefined && action.Y !== null) ? action.Y : action.y);
      var backendX = Number(rawX);
      var backendY = Number(rawY);
      // Use backend field name: is_turnning_on (supports both string and boolean)
      var enabledRaw = (action.is_turnning_on !== undefined && action.is_turnning_on !== null) ? action.is_turnning_on :
        ((action.on !== undefined && action.on !== null) ? action.on : action.enabled);
      var enabled =
        enabledRaw === "True" ||
        enabledRaw === true ||
        enabledRaw === "true" ||
        enabledRaw === 1 ||
        enabledRaw === "1";

      if (!antennaId || !Number.isFinite(backendX) || !Number.isFinite(backendY)) {
        console.warn("Invalid action config:", action);
        return;
      }

      // Direct mapping (optimization coordinates are already in canvas/world coordinates)
      var canvasX = Math.max(0, Math.min(state.w, backendX));
      var canvasY = Math.max(0, Math.min(state.h, backendY));
      console.log("[HTML] ACTION->", antennaId, "raw:", rawX, rawY, "mapped:", canvasX, canvasY, "enabled:", enabled);

      // Find existing antenna by ID
      var existingAntenna = null;
      for (var j = 0; j < state.aps.length; j++) {
        if (state.aps[j].id === antennaId) {
          existingAntenna = state.aps[j];
          break;
        }
      }

      if (existingAntenna) {
        // Update existing antenna position and status
        var oldX = existingAntenna.x;
        var oldY = existingAntenna.y;

        existingAntenna.x = canvasX;
        existingAntenna.y = canvasY;
        // Z coordinate is preserved - do not update it
        existingAntenna.enabled = enabled;

        // Log position change
        // Skip logging for backend updates - only log user-initiated changes
        var threshold = 0.01;
        if (
          Math.abs(oldX - existingAntenna.x) > threshold ||
          Math.abs(oldY - existingAntenna.y) > threshold
        ) {
          // Pass false to indicate this is a backend update, not a user change
          if (typeof window.logAntennaPositionChange === 'function') {
            window.logAntennaPositionChange(
              antennaId,
              antennaId,
              oldX,
              oldY,
              existingAntenna.x,
              existingAntenna.y,
              false
            );
          }
        }

        console.log(
          "Updated antenna:",
          antennaId,
          "Backend:",
          backendX,
          backendY,
          "Canvas:",
          canvasX.toFixed(2),
          canvasY.toFixed(2),
          "Enabled:",
          enabled
        );
      } else {
        // Create new antenna if it doesn't exist
        var defaultPattern = typeof window.getDefaultAntennaPattern === 'function' ? window.getDefaultAntennaPattern() : null;
        var newAntenna = {
          id: antennaId,
          x: canvasX,
          y: canvasY,
          z: 0, // Z is set to 0 for new antennas
          tx: action.power !== undefined ? action.power : 15,
          gt: 5,
          ch: 1,
          azimuth: action.azimuth !== undefined ? action.azimuth : 0,
          tilt: action.tilt !== undefined ? action.tilt : 0,
          enabled: enabled,
          antennaPatternFile: null,
          antennaPatternFileName: null,
        };

        if (defaultPattern) {
          newAntenna.antennaPattern = defaultPattern;
        }

        state.aps.push(newAntenna);
        // Pass false to indicate this is a backend update, not a user change
        if (typeof window.logAntennaPositionChange === 'function') {
          window.logAntennaPositionChange(
            antennaId,
            antennaId,
            0,
            0,
            newAntenna.x,
            newAntenna.y,
            false
          );
        }
        console.log(
          "Created new antenna:",
          antennaId,
          "Backend:",
          backendX,
          backendY,
          "Canvas:",
          canvasX.toFixed(2),
          canvasY.toFixed(2),
          "Enabled:",
          enabled
        );
      }
    } catch (error) {
      console.error("Error updating single antenna:", error);
    }
  }

  // Expose public API
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
