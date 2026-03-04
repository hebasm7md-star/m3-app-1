// sendAntennaConfigs.js — Outgoing antenna data to the backend (Anvil Integration)
//
// Depends on: global state, worldToCanvasPixels(), NotificationSystem
//
// Must load BEFORE 03b-BACKEND-RECEIVE.js — the receive module calls
// scheduleAntennaEnqueue() which is defined here.
//
// Exposes on window:
//   buildAntennaPayload, logAntennaPositionChange,
//   sendAntennaStatusUpdate, sendAllAntennaConfigs,
//   scheduleAntennaEnqueue, scheduleInputChange,
//   applyInputChange, applyInputChangeImmediately

var SendAntennaConfigs = (function () {

    // ---------------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------------
    var DEFAULT_Z_HEIGHT         = 2.5;   // metres — default antenna height
    var DEFAULT_POWER_FALLBACK   = 10;    // dBm   — used in position history when antenna is missing
    var ENQUEUE_DEBOUNCE_MS      = 200;   // ms    — drag/typing debounce before sending
    var INPUT_CHANGE_DEBOUNCE_MS = 3000;  // ms    — input field debounce before applying
    var RESPONSE_TIMEOUT_MS      = 5000;  // ms    — max wait for a backend response
    var PARENT_ORIGIN            = "*";   // TODO: replace with your Anvil app origin e.g. "https://yourdomain.com"
  
    // ---------------------------------------------------------------------------
    // Internal state
    // ---------------------------------------------------------------------------
    var antennaPositionHistory     = [];
    var currentAntennaDataFileName = null;
    var enqueueDebounceTimers      = {};
    var inputChangeDebounceTimers  = {};
    var pendingInputChanges        = {};
  
    // ---------------------------------------------------------------------------
    // Shared response registry — one permanent listener instead of a new
    // addEventListener on every send call.
    // Keys are requestIds; values are one-shot callbacks.
    // ---------------------------------------------------------------------------
    var pendingResponses = {};
  
    window.addEventListener("message", function (event) {
      var d = event.data;
      if (!d || !d.requestId || !pendingResponses[d.requestId]) return;
      var cb = pendingResponses[d.requestId];
      delete pendingResponses[d.requestId]; // consume — one-shot
      cb(d);
    });
  
    // ---------------------------------------------------------------------------
    // Filename management
    // ---------------------------------------------------------------------------
  
    function getAntennaDataFileName() {
      if (currentAntennaDataFileName) return currentAntennaDataFileName;
  
      var baseName = "antenna_data";
      if (state.currentProjectFileName) {
        baseName = state.currentProjectFileName.replace(/\.(json|ipsproject)$/i, "");
      } else {
        if (!window.antennaDataSessionId) window.antennaDataSessionId = "session_" + Date.now();
        baseName = "antenna_data_" + window.antennaDataSessionId;
      }
  
      currentAntennaDataFileName = baseName + "_antenna_positions.json";
      console.log("Generated filename for this session:", currentAntennaDataFileName);
      return currentAntennaDataFileName;
    }
  
    // ---------------------------------------------------------------------------
    // Canonical antenna payload — single source of truth for what we send.
    // All send functions call this instead of hand-rolling the same object.
    // ---------------------------------------------------------------------------
    function buildAntennaPayload(ap) {
      return {
        id:                     ap.id,
        x:                      ap.x,
        y:                      ap.y,
        z:                      ap.z || DEFAULT_Z_HEIGHT,
        tx:                     ap.tx,
        gt:                     ap.gt,
        ch:                     ap.ch,
        azimuth:                ap.azimuth || 0,
        tilt:                   ap.tilt    || 0,
        enabled:                ap.enabled !== false,  // default true
        antennaPatternFileName: (ap.antennaPattern && ap.antennaPattern.name)
                                  ? ap.antennaPattern.name
                                  : null
      };
    }
  
    // ---------------------------------------------------------------------------
    // Position history logging
    // ---------------------------------------------------------------------------
  
    /**
     * Record a position change in the local history array.
     * Pass isUserChange = false to skip logging for backend-driven moves.
     */
    function logAntennaPositionChange(antennaId, antennaName, oldX, oldY, newX, newY, isUserChange) {
      if (isUserChange === false) return;
  
      var oldCanvas = window.worldToCanvasPixels(oldX, oldY);
      var newCanvas = window.worldToCanvasPixels(newX, newY);
  
      var antenna = null;
      for (var i = 0; i < state.aps.length; i++) {
        if (state.aps[i].id === antennaId) { antenna = state.aps[i]; break; }
      }
  
      antennaPositionHistory.push({
        timestamp:   new Date().toISOString(),
        antennaId:   antennaId,
        antennaName: antennaName,
        oldX:        oldX.toFixed(2),         oldY:        oldY.toFixed(2),
        oldCanvasX:  Math.round(oldCanvas.x), oldCanvasY:  Math.round(oldCanvas.y),
        newX:        newX.toFixed(2),         newY:        newY.toFixed(2),
        newCanvasX:  Math.round(newCanvas.x), newCanvasY:  Math.round(newCanvas.y),
        tilt:        antenna ? (antenna.tilt    || 0)                  : 0,
        azimuth:     antenna ? (antenna.azimuth || 0)                  : 0,
        power:       antenna ? (antenna.tx      || DEFAULT_POWER_FALLBACK) : DEFAULT_POWER_FALLBACK,
        enabled:     antenna ? (antenna.enabled !== false)             : true
      });
    }
  
    // ---------------------------------------------------------------------------
    // Send functions
    // ---------------------------------------------------------------------------
  
    /** Send a single antenna's current state to the backend immediately. */
    function sendAntennaStatusUpdate(antenna) {
      if (!antenna) { console.warn("sendAntennaStatusUpdate: No antenna provided"); return; }
  
      antenna.enabled = antenna.enabled !== false; // normalise to boolean
  
      var requestId = "antenna_status_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  
      pendingResponses[requestId] = function (response) {
        if (response.success) console.log("Antenna status confirmed by backend:", response);
        else                  console.error("Backend error for antenna status:", response.error);
      };
      setTimeout(function () { delete pendingResponses[requestId]; }, RESPONSE_TIMEOUT_MS);
  
      window.parent.postMessage({
        type:      "antenna_status_update",
        requestId: requestId,
        antenna:   buildAntennaPayload(antenna)
      }, PARENT_ORIGIN);
    }
  
    /** Send all current antenna configs to the backend in one batch. */
    function sendAllAntennaConfigs() {
      var requestId = "antenna_configs_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  
      window.parent.postMessage({
        type:      "antenna_configs_update",
        requestId: requestId,
        antennas:  state.aps.map(buildAntennaPayload),
        filename:  getAntennaDataFileName()
      }, PARENT_ORIGIN);
    }
  
    // ---------------------------------------------------------------------------
    // Debounce helpers — coalesce rapid edits before sending
    // ---------------------------------------------------------------------------
  
    /** Debounce backend sends while the user is dragging or typing. */
    function scheduleAntennaEnqueue(antenna) {
      if (!antenna || !antenna.id) return;
      var id = antenna.id;
      if (enqueueDebounceTimers[id]) clearTimeout(enqueueDebounceTimers[id]);
      enqueueDebounceTimers[id] = setTimeout(function () {
        try     { sendAntennaStatusUpdate(antenna); }
        finally { enqueueDebounceTimers[id] = null; }
      }, ENQUEUE_DEBOUNCE_MS);
    }
  
    function applyInputChange(antennaId) {
      if (!pendingInputChanges[antennaId]) return;
  
      var change  = pendingInputChanges[antennaId];
      var antenna = change.antenna;
  
      delete pendingInputChanges[antennaId];
      if (inputChangeDebounceTimers[antennaId]) {
        clearTimeout(inputChangeDebounceTimers[antennaId]);
        inputChangeDebounceTimers[antennaId] = null;
      }
  
      if (change.needsDraw && state.showVisualization) {
        if (state.heatmapUpdateRequestId !== null) {
          cancelAnimationFrame(state.heatmapUpdateRequestId);
          state.heatmapUpdateRequestId = null;
        }
        state.heatmapUpdatePending  = true;
        state.heatmapWorkerCallback = null;
        if (window.generateHeatmapAsync) window.generateHeatmapAsync(null, true);
      }
  
      if (change.needsRender && window.renderAPs) window.renderAPs();
      if (change.needsDraw   && window.draw)      window.draw();
      if (change.needsEnqueue)                    scheduleAntennaEnqueue(antenna);
    }
  
    /** Queue a UI + backend update, merging with any already-pending change. */
    function scheduleInputChange(antenna, needsRender, needsDraw, needsEnqueue) {
      if (!antenna || !antenna.id) return;
      var id      = antenna.id;
      var pending = pendingInputChanges[id];
  
      pendingInputChanges[id] = {
        antenna:      antenna,
        needsRender:  (pending ? pending.needsRender  : false) || needsRender  || false,
        needsDraw:    (pending ? pending.needsDraw    : false) || needsDraw    || false,
        needsEnqueue: (pending ? pending.needsEnqueue : false) || needsEnqueue || false
      };
  
      if (inputChangeDebounceTimers[id]) clearTimeout(inputChangeDebounceTimers[id]);
      inputChangeDebounceTimers[id] = setTimeout(function () {
        applyInputChange(id);
      }, INPUT_CHANGE_DEBOUNCE_MS);
    }
  
    function applyInputChangeImmediately(antennaId) {
      if (inputChangeDebounceTimers[antennaId]) {
        clearTimeout(inputChangeDebounceTimers[antennaId]);
        inputChangeDebounceTimers[antennaId] = null;
      }
      applyInputChange(antennaId);
    }
  
    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
    window.buildAntennaPayload         = buildAntennaPayload;
    window.logAntennaPositionChange    = logAntennaPositionChange;
    window.sendAntennaStatusUpdate     = sendAntennaStatusUpdate;
    window.sendAllAntennaConfigs       = sendAllAntennaConfigs;
    window.scheduleAntennaEnqueue      = scheduleAntennaEnqueue;
    window.applyInputChange            = applyInputChange;
    window.scheduleInputChange         = scheduleInputChange;
    window.applyInputChangeImmediately = applyInputChangeImmediately;
  
    return {
      buildAntennaPayload:         buildAntennaPayload,
      logAntennaPositionChange:    logAntennaPositionChange,
      sendAntennaStatusUpdate:     sendAntennaStatusUpdate,
      sendAllAntennaConfigs:       sendAllAntennaConfigs,
      scheduleAntennaEnqueue:      scheduleAntennaEnqueue,
      applyInputChange:            applyInputChange,
      scheduleInputChange:         scheduleInputChange,
      applyInputChangeImmediately: applyInputChangeImmediately
    };
  })();