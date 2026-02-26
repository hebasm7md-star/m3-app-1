// 03-BACKEND-SYNC.js - Handles communication with the Python backend (Anvil Integration)
// Depends on: global state, draw(), renderAPs(), renderApDetails(), NotificationSystem, CoordinateSystem (worldToCanvasPixels)

var BackendSync = (function () {

  // Store antenna position history
  var antennaPositionHistory = [];
  var currentAntennaDataFileName = null; // Track the JSON filename for the current project
  var enqueueDebounceTimers = {};
  var inputChangeDebounceTimers = {};
  var pendingInputChanges = {};

  // Function to generate a consistent JSON filename for the current project
  function getAntennaDataFileName() {
    // If we already have a filename for this project, ALWAYS use it (never change)
    if (currentAntennaDataFileName) {
      console.log("Using existing filename:", currentAntennaDataFileName);
      return currentAntennaDataFileName;
    }

    // Generate filename based on project filename or create a new one
    // This filename will be used for ALL updates in this project session
    var baseName = "antenna_data";
    if (state.currentProjectFileName) {
      // Extract base name from project file (remove extension)
      baseName = state.currentProjectFileName.replace(
        /\.(json|ipsproject)$/i,
        ""
      );
    } else {
      // Use a session-based identifier for new projects (generated once per page load)
      // This ensures the same file is used throughout the session
      if (!window.antennaDataSessionId) {
        window.antennaDataSessionId = "session_" + Date.now();
      }
      baseName = "antenna_data_" + window.antennaDataSessionId;
    }

    // Store the filename for this project session - this will NEVER change during the session
    currentAntennaDataFileName = baseName + "_antenna_positions.json";
    console.log(
      "Generated new filename for this project session:",
      currentAntennaDataFileName
    );
    return currentAntennaDataFileName;
  }

  // Log antenna position change
  // isUserChange: true for user-initiated changes (default), false for backend updates
  function logAntennaPositionChange(
    antennaId,
    antennaName,
    oldX,
    oldY,
    newX,
    newY,
    isUserChange
  ) {
    // Only log and send JSON for user-initiated changes, not backend updates
    if (isUserChange === false) {
      return; // Skip logging for backend updates
    }

    // Default to true if not specified (backward compatibility - assume user change)
    if (isUserChange === undefined) {
      isUserChange = true;
    }

    var timestamp = new Date().toISOString();
    var oldCanvas = window.worldToCanvasPixels(oldX, oldY);
    var newCanvas = window.worldToCanvasPixels(newX, newY);

    // Find the antenna to get its current properties
    var antenna = null;
    for (var i = 0; i < state.aps.length; i++) {
      if (state.aps[i].id === antennaId) {
        antenna = state.aps[i];
        break;
      }
    }

    var entry = {
      timestamp: timestamp,
      antennaId: antennaId,
      antennaName: antennaName,
      oldX: oldX.toFixed(2),
      oldY: oldY.toFixed(2),
      oldCanvasX: Math.round(oldCanvas.x),
      oldCanvasY: Math.round(oldCanvas.y),
      newX: newX.toFixed(2),
      newY: newY.toFixed(2),
      newCanvasX: Math.round(newCanvas.x),
      newCanvasY: Math.round(newCanvas.y),
      // Include antenna properties (current values at time of change)
      tilt: antenna ? (antenna.tilt || 0) : 0,
      azimuth: antenna ? (antenna.azimuth || 0) : 0,
      power: antenna ? (antenna.tx || 10) : 10,
      enabled: antenna ? Boolean(antenna.enabled !== undefined ? antenna.enabled : true) : true
    };

    antennaPositionHistory.push(entry);
  }

  // Function to send antenna status update (enabled/disabled) to backend immediately
  function sendAntennaStatusUpdate(antenna) {
    if (!antenna) {
      console.warn("sendAntennaStatusUpdate: No antenna provided");
      return;
    }

    // Ensure enabled is always a boolean
    antenna.enabled = Boolean(antenna.enabled !== undefined ? antenna.enabled : true);

    // Prepare antenna details for backend
    var antennaDetails = {
      id: antenna.id,
      x: antenna.x,
      y: antenna.y,
      z: antenna.z || 2.5,
      tx: antenna.tx,
      gt: antenna.gt,
      ch: antenna.ch,
      azimuth: antenna.azimuth || 0,
      tilt: antenna.tilt || 0,
      enabled: antenna.enabled,
      antennaPatternFileName: (antenna.antennaPattern && antenna.antennaPattern.name) ? antenna.antennaPattern.name : null
    };

    // Generate a unique request ID
    var requestId = "antenna_status_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    console.log("Sending antenna status update to backend:", antennaDetails);

    // Send message to parent window (Anvil app)
    window.parent.postMessage(
      {
        type: "antenna_status_update",
        requestId: requestId,
        antenna: antennaDetails,
      },
      "*"
    ); // '*' allows any origin - in production, specify your Anvil app origin

    // Optional: Set up message listener for response (if backend sends confirmation)
    var messageHandler = function (event) {
      if (
        event.data &&
        event.data.type === "antenna_status_response" &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", messageHandler);

        if (event.data.success) {
          console.log("Antenna status update confirmed by backend:", event.data);
        } else {
          console.error("Backend error updating antenna status:", event.data.error);
        }
      }
    };

    window.addEventListener("message", messageHandler);

    // Set timeout to clean up listener if no response
    setTimeout(function () {
      window.removeEventListener("message", messageHandler);
    }, 5000); // 5 second timeout
  }

  // Coalesces rapid edits (dragging / typing) into a single backend call per antenna.
  function scheduleAntennaEnqueue(antenna) {
    if (!antenna || !antenna.id) return;
    var id = antenna.id;
    if (enqueueDebounceTimers[id]) {
      clearTimeout(enqueueDebounceTimers[id]);
    }
    enqueueDebounceTimers[id] = setTimeout(function () {
      try {
        sendAntennaStatusUpdate(antenna);
      } finally {
        enqueueDebounceTimers[id] = null;
      }
    }, 200);
  }

  function applyInputChange(antennaId) {
    if (!pendingInputChanges[antennaId]) return;

    var change = pendingInputChanges[antennaId];
    var antenna = change.antenna;

    // Clear the pending change
    delete pendingInputChanges[antennaId];
    if (inputChangeDebounceTimers[antennaId]) {
      clearTimeout(inputChangeDebounceTimers[antennaId]);
      inputChangeDebounceTimers[antennaId] = null;
    }

    // Handle heatmap regeneration for property changes (antenna count hasn't changed)
    // Cancel any pending updates and set pending flag, but don't clear cache (it's still valid)
    if (change.needsDraw && state.showVisualization) {
      if (state.heatmapUpdateRequestId !== null) {
        cancelAnimationFrame(state.heatmapUpdateRequestId);
        state.heatmapUpdateRequestId = null;
      }
      state.heatmapUpdatePending = true; // Set to true to trigger regeneration
      state.heatmapWorkerCallback = null; // Clear any pending worker callback
      // Don't clear cache - antenna count hasn't changed, so cache is still valid
      // This prevents deformed pattern flash while allowing smooth transition
      if (window.generateHeatmapAsync) window.generateHeatmapAsync(null, true); // Start with low-res for fast update
    }

    // Apply the changes: update UI and redraw
    if (change.needsRender && window.renderAPs) {
      window.renderAPs();
    }
    if (change.needsDraw && window.draw) {
      window.draw();
    }
    if (change.needsEnqueue) {
      scheduleAntennaEnqueue(antenna);
    }
  }

  function scheduleInputChange(antenna, needsRender, needsDraw, needsEnqueue) {
    if (!antenna || !antenna.id) return;
    var id = antenna.id;

    // Merge with existing pending change if any
    if (pendingInputChanges[id]) {
      pendingInputChanges[id] = {
        antenna: antenna,
        needsRender: pendingInputChanges[id].needsRender || needsRender || false,
        needsDraw: pendingInputChanges[id].needsDraw || needsDraw || false,
        needsEnqueue: pendingInputChanges[id].needsEnqueue || needsEnqueue || false
      };
    } else {
      // Store new pending change
      pendingInputChanges[id] = {
        antenna: antenna,
        needsRender: needsRender || false,
        needsDraw: needsDraw || false,
        needsEnqueue: needsEnqueue || false
      };
    }

    // Clear existing timer
    if (inputChangeDebounceTimers[id]) {
      clearTimeout(inputChangeDebounceTimers[id]);
    }

    // Schedule application after 3 seconds
    inputChangeDebounceTimers[id] = setTimeout(function () {
      applyInputChange(id);
    }, 3000);
  }

  function applyInputChangeImmediately(antennaId) {
    if (inputChangeDebounceTimers[antennaId]) {
      clearTimeout(inputChangeDebounceTimers[antennaId]);
      inputChangeDebounceTimers[antennaId] = null;
    }
    applyInputChange(antennaId);
  }

  // Function to send all antenna configs to backend (including enabled status)
  function sendAllAntennaConfigs() {
    var fileName = getAntennaDataFileName();
    var allAntennaConfigs = state.aps.map(function (ap) {
      return {
        id: ap.id,
        x: ap.x,
        y: ap.y,
        z: ap.z || 2.5,
        tx: ap.tx,
        gt: ap.gt,
        ch: ap.ch,
        azimuth: ap.azimuth || 0,
        tilt: ap.tilt || 0,
        enabled: Boolean(ap.enabled !== undefined ? ap.enabled : true),
        antennaPatternFileName: (ap.antennaPattern && ap.antennaPattern.name) ? ap.antennaPattern.name : null
      };
    });

    var requestId = "antenna_configs_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

    console.log("Sending all antenna configs to backend:", allAntennaConfigs);

    window.parent.postMessage(
      {
        type: "antenna_configs_update",
        requestId: requestId,
        antennas: allAntennaConfigs,
        filename: fileName
      },
      "*"
    );
  }

  // Update antennas from configs received from Anvil backend
  function updateAntennasFromConfigs(antennaConfigs) {
    try {
      console.log("Updating antennas from configs:", antennaConfigs);

      if (!Array.isArray(antennaConfigs) || antennaConfigs.length === 0) {
        NotificationSystem.warning("No antenna configs received or invalid format.");
        return;
      }

      // First pass: find min/max bounds of backend coordinates to calculate transformation
      var minX = Infinity,
        maxX = -Infinity;
      var minY = Infinity,
        maxY = -Infinity;
      var validConfigs = [];

      for (var i = 0; i < antennaConfigs.length; i++) {
        var config = antennaConfigs[i];
        var x = config.X || config.x;
        var y = config.Y || config.y;

        if (x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
          validConfigs.push(config);
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

      // Calculate coordinate transformation to fit canvas (same logic as CSV transformation)
      // HTML canvas uses origin at upper-left: (0,0) to (state.w, state.h)
      var backendWidth = maxX - minX;
      var backendHeight = maxY - minY;
      var scaleX = state.w / backendWidth;
      var scaleY = state.h / backendHeight;
      var scale = Math.min(scaleX, scaleY); // Use uniform scaling to maintain aspect ratio

      console.log("Coordinate transformation:", {
        backendBounds: { minX: minX, maxX: maxX, minY: minY, maxY: maxY },
        backendSize: { width: backendWidth, height: backendHeight },
        canvasSize: { width: state.w, height: state.h },
        scale: scale,
      });

      var updatedCount = 0;
      var createdCount = 0;

      // Process each antenna config
      for (var i = 0; i < validConfigs.length; i++) {
        var config = validConfigs[i];
        var antennaId = config.id || config.antenna_id;
        var backendX = config.X || config.x;
        var backendY = config.Y || config.y;
        var enabled =
          config.on !== undefined
          ? config.on
          : config.enabled !== undefined
          ? config.enabled
          : true;

        if (!antennaId) {
          console.warn("Skipping config without ID:", config);
          continue;
        }

        // Transform backend coordinates to canvas coordinates
        var canvasX = (backendX - minX) * scale;
        var canvasY = (backendY - minY) * scale;

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
          existingAntenna.enabled = enabled;

          var threshold = 0.01;
          if (
            Math.abs(oldX - existingAntenna.x) > threshold ||
            Math.abs(oldY - existingAntenna.y) > threshold
          ) {
            logAntennaPositionChange(
              antennaId,
              antennaId,
              oldX,
              oldY,
              existingAntenna.x,
              existingAntenna.y,
              false
            );
          }

          updatedCount++;
        } else {
          // Create new antenna if it doesn't exist
          var defaultPattern = typeof window.getDefaultAntennaPattern === 'function' ? window.getDefaultAntennaPattern() : null;
          var newAntenna = {
            id: antennaId,
            x: canvasX,
            y: canvasY,
            z: 0,
            tx: config.power !== undefined ? config.power : 15,
            gt: 5,
            ch: 1,
            azimuth: config.azimuth !== undefined ? config.azimuth : 0,
            tilt: config.tilt !== undefined ? config.tilt : 0,
            enabled: enabled,
            antennaPatternFile: null,
            antennaPatternFileName: null,
          };

          if (defaultPattern) {
            newAntenna.antennaPattern = defaultPattern;
            newAntenna.antennaPatternFileName = defaultPattern.fileName || (defaultPattern.name ? defaultPattern.name : null);
          }

          state.aps.push(newAntenna);
          logAntennaPositionChange(
            antennaId,
            antennaId,
            0,
            0,
            newAntenna.x,
            newAntenna.y,
            false
          );
          createdCount++;
        }
      }

      // Invalidate heatmap cache to force regeneration
      state.cachedHeatmap = null;
      state.heatmapUpdatePending = false;

      // Update UI
      if (window.saveState) window.saveState();
      if (window.renderAPs) window.renderAPs();
      if (window.renderApDetails) window.renderApDetails(); // Update right sidebar if an antenna is selected
      if (window.draw) window.draw();

      var message = "Antenna optimization complete! ";
      if (updatedCount > 0) {
        message += "Updated: " + updatedCount + " antenna(s). ";
      }
      if (createdCount > 0) {
        message += "Created: " + createdCount + " antenna(s). ";
      }
      NotificationSystem.success(message);
    } catch (error) {
      console.error("Error updating antennas from configs:", error);
      NotificationSystem.error("Failed to update antennas.\n" + error.message);
    }
  }

  // Set up message listener for Anvil events
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "anvil_ready") {
      console.log("Anvil parent ready");
    }

    // Handle CSV data from Anvil backend
    if (event.data && event.data.type === "csv_data") {
      console.log("Received CSV data from Anvil");
      if (event.data.success && event.data.csv_data) {
        if (typeof window.processCsvDataFromAnvil === 'function') {
          window.processCsvDataFromAnvil(event.data.csv_data);
        } else {
          console.warn("processCsvDataFromAnvil function not found.");
        }
      } else {
        NotificationSystem.error("Failed to receive CSV data.\n" + (event.data.error || "Unknown error"));
      }
    }

    // Handle antenna configs from Anvil backend
    if (event.data && event.data.type === "antenna_configs") {
      console.log("Received antenna configs from Anvil");
      if (event.data.success && event.data.antennas) {
        updateAntennasFromConfigs(event.data.antennas);
      } else {
        NotificationSystem.error("Failed to receive antenna configs.\n" + (event.data.error || "Unknown error"));
      }
    }

    // Handle optimization status updates (for streaming mode)
    if (event.data && event.data.type === "optimization_update") {
      // console.log("[HTML] Received optimization_update:", {
        actionCount: (event.data.new_action_configs || []).length,
        state: event.data.state,
        lastIndex: event.data.last_index
      });
      if (typeof window.handleOptimizationUpdate === 'function') {
        window.handleOptimizationUpdate(event.data);
      }
    }

    // Handle optimization started (polling is driven by Anvil timer, not JS interval)
    if (event.data && event.data.type === "optimization_started") {
      console.log("Optimization started");
      window.optimizationLastIndex = 0;
      window.optimizationBounds = null;
    }

    // Handle optimization completed
    if (event.data && event.data.type === "optimization_finished") {
      console.log("Optimization completed");
      if (typeof window.stopOptimizationPolling === 'function') window.stopOptimizationPolling();
      state.isOptimizing = false;
      var optimizeBtn = document.getElementById("optimizeBtn");
      var addAPBtn = document.getElementById("addAP");
      if (optimizeBtn) {
        optimizeBtn.disabled = false;
        optimizeBtn.style.opacity = '1';
        optimizeBtn.style.cursor = 'pointer';
        optimizeBtn.textContent = 'Optimize';
      }

      if (window.renderAPs) window.renderAPs();
      if (window.renderApDetails) window.renderApDetails();

      if (addAPBtn) {
        addAPBtn.disabled = false;
        addAPBtn.style.opacity = '1';
        addAPBtn.style.pointerEvents = 'auto';
      }

      var footerBadge = document.getElementById('footerBadge');
      var footerMessage = document.getElementById('footerMessage');
      if (footerBadge) {
        footerBadge.textContent = 'COMPLETED';
        footerBadge.classList.remove('active');
      }
      if (footerMessage) {
        footerMessage.textContent = 'Optimization completed successfully';
      }
      NotificationSystem.success("Optimization complete! All antennas have been updated.");
    }

    // Handle optimization error
    if (event.data && event.data.type === "optimization_error") {
      console.log("Optimization error:", event.data.error);
      if (typeof window.stopOptimizationPolling === 'function') window.stopOptimizationPolling();
      state.isOptimizing = false;
      var optimizeBtn = document.getElementById("optimizeBtn");
      var addAPBtn = document.getElementById("addAP");
      if (optimizeBtn) {
        optimizeBtn.disabled = false;
        optimizeBtn.style.opacity = '1';
        optimizeBtn.style.cursor = 'pointer';
        optimizeBtn.textContent = 'Optimize';
      }
      if (window.renderAPs) window.renderAPs();
      if (window.renderApDetails) window.renderApDetails();

      if (addAPBtn) {
        addAPBtn.disabled = false;
        addAPBtn.style.opacity = '1';
        addAPBtn.style.pointerEvents = 'auto';
      }

      var footerBadge = document.getElementById('footerBadge');
      var footerMessage = document.getElementById('footerMessage');
      if (footerBadge) {
        footerBadge.textContent = 'ERROR';
        footerBadge.classList.remove('active');
      }
      if (footerMessage) {
        footerMessage.textContent = 'Optimization error occurred';
      }
      NotificationSystem.error("Optimization failed.\n" + (event.data.error || "Unknown error"));
    }

    // Handle backend messages with different button types
    if (event.data && event.data.type === "backend_message") {
      console.log("Backend message:", event.data);
      var message = event.data.message || "";
      var messageType = event.data.messageType || "info";
      var requestId = event.data.requestId;

      NotificationSystem.backend(message, messageType, messageType, [{label:"OK", primary:true, callback:function() {
        if (requestId && window.parent !== window) {
          window.parent.postMessage({
            type: "backend_message_response",
            requestId: requestId,
            response: true
          }, "*");
        }
      }}]);
    }
  });

  // Expose public API
  window.logAntennaPositionChange = logAntennaPositionChange;
  window.sendAntennaStatusUpdate = sendAntennaStatusUpdate;
  window.scheduleAntennaEnqueue = scheduleAntennaEnqueue;
  window.applyInputChange = applyInputChange;
  window.scheduleInputChange = scheduleInputChange;
  window.applyInputChangeImmediately = applyInputChangeImmediately;
  window.sendAllAntennaConfigs = sendAllAntennaConfigs;
  window.updateAntennasFromConfigs = updateAntennasFromConfigs;

  return {
    logAntennaPositionChange: logAntennaPositionChange,
    sendAntennaStatusUpdate: sendAntennaStatusUpdate,
    scheduleAntennaEnqueue: scheduleAntennaEnqueue,
    applyInputChange: applyInputChange,
    scheduleInputChange: scheduleInputChange,
    applyInputChangeImmediately: applyInputChangeImmediately,
    sendAllAntennaConfigs: sendAllAntennaConfigs,
    updateAntennasFromConfigs: updateAntennasFromConfigs
  };
})();
