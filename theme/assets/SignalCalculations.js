//
// UndoSystem.js
// Handles application state undo/redo functionality (currently undo only).
// Provides saveState, restoreState, and manages the undo button UI.
//
// All functions are exposed on window for global access.
//
// Depends on: global state, $, draw, renderAPs, renderWalls, updateStats,
//             updateWallList, updateApList, updateFloorPlaneList,
//             NotificationSystem, initHeatmapWorker, invalidateHeatmapCache
//
// Called by:
//   Every operation that changes geometry calls saveState()
//   Keyboard handler (Ctrl+Z) and undo button call restoreState()
//

(function () {
  "use strict";

  var undoStack = [];
  var redoStack = [];
  var MAX_UNDO = 50;

  function saveState() {
    var stateObj = {
      walls: state.walls,
      aps: state.aps,
      floorPlanes: state.floorPlanes,
      groundPlane: state.groundPlane,
    };

    var stateStr = JSON.stringify(stateObj);

    if (undoStack.length > 0) {
      var lastStr = JSON.stringify(undoStack[undoStack.length - 1]);
      if (stateStr === lastStr) {
        return; // Avoid saving identical states (fixes "requires two clicks" issue)
      }
    }

    var stateSnapshot = JSON.parse(stateStr);

    undoStack.push(stateSnapshot);
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }

    // Clear redo stack on new action
    redoStack = [];

    updateUndoButton();
    updateRedoButton();
  }

  function restoreState() {
    if (undoStack.length === 0) return;

    // Save current state to redo stack before undoing
    var currentState = {
      walls: JSON.parse(JSON.stringify(state.walls)),
      aps: JSON.parse(JSON.stringify(state.aps)),
      floorPlanes: JSON.parse(JSON.stringify(state.floorPlanes)),
      groundPlane: JSON.parse(JSON.stringify(state.groundPlane)),
    };

    // Duplicate check for redoStack
    var currentStr = JSON.stringify(currentState);
    var pushToRedo = true;
    if (redoStack.length > 0) {
      var lastRedoStr = JSON.stringify(redoStack[redoStack.length - 1]);
      if (currentStr === lastRedoStr) {
        pushToRedo = false;
      }
    }

    if (pushToRedo) {
      redoStack.push(currentState);
      if (redoStack.length > MAX_UNDO) {
        redoStack.shift();
      }
    }

    var prev = undoStack.pop();
    applyState(prev);
  }

  function redoState() {
    if (redoStack.length === 0) return;

    // Save current state to undo stack before redoing
    var currentState = {
      walls: JSON.parse(JSON.stringify(state.walls)),
      aps: JSON.parse(JSON.stringify(state.aps)),
      floorPlanes: JSON.parse(JSON.stringify(state.floorPlanes)),
      groundPlane: JSON.parse(JSON.stringify(state.groundPlane)),
    };

    // Duplicate check for undoStack
    var currentStr = JSON.stringify(currentState);
    var pushToUndo = true;
    if (undoStack.length > 0) {
      var lastUndoStr = JSON.stringify(undoStack[undoStack.length - 1]);
      if (currentStr === lastUndoStr) {
        pushToUndo = false;
      }
    }

    if (pushToUndo) {
      undoStack.push(currentState);
      if (undoStack.length > MAX_UNDO) {
        undoStack.shift();
      }
    }

    var next = redoStack.pop();
    applyState(next);
  }

  function applyState(newState) {
    state.walls = newState.walls;
    state.aps = newState.aps;
    state.floorPlanes = newState.floorPlanes;
    state.groundPlane = newState.groundPlane;

    if (state.heatmapWorker) {
      try {
        state.heatmapWorker.terminate();
      } catch (e) { }
      state.heatmapWorker = null;
      if (typeof initHeatmapWorker === "function") {
        initHeatmapWorker();
      }
    }

    if (typeof invalidateHeatmapCache === "function") {
      invalidateHeatmapCache();
    }

    state.selectedApId = null;
    state.highlight = false;
    state.selectedWallIds = [];
    state.selectedWallId = null;
    state.selectedApForDetail = null;

    var apDetailSidebar = document.getElementById("apDetailSidebar");
    if (apDetailSidebar) apDetailSidebar.classList.remove("visible");

    updateUndoButton();
    updateRedoButton();

    if (typeof renderAPs === "function") renderAPs();
    if (typeof renderWalls === "function") renderWalls();

    if (typeof draw === "function") draw();
    if (typeof updateStats === "function") updateStats();

    if (typeof updateWallList === "function") updateWallList();
    if (typeof updateApList === "function") updateApList();
    if (typeof updateFloorPlaneList === "function") updateFloorPlaneList();
  }

  function updateUndoButton() {
    var btn = document.getElementById("undoBtn");
    if (btn) {
      btn.disabled = undoStack.length === 0;
      btn.style.opacity = undoStack.length === 0 ? "0.5" : "1";
    }
  }

  function updateRedoButton() {
    var btn = document.getElementById("redoBtn");
    if (btn) {
      btn.disabled = redoStack.length === 0;
      btn.style.opacity = redoStack.length === 0 ? "0.5" : "1";
    }
  }

  function _initUndoUI() {
    updateUndoButton();
    updateRedoButton();

    var btn = document.getElementById("undoBtn");
    if (btn) btn.addEventListener("click", restoreState, false);

    var redoBtn = document.getElementById("redoBtn");
    if (redoBtn) redoBtn.addEventListener("click", redoState, false);

    var restartBtn = document.getElementById("restartBtn");
    if (restartBtn) {
      restartBtn.addEventListener("click", function () {
        if (typeof NotificationSystem !== "undefined" && NotificationSystem.confirm) {
          NotificationSystem.confirm(
            "All unsaved progress will be lost. <br/> Are you sure you want to restart?",
            "Restart Application",
            function (confirmed) {
              if (confirmed) {
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage({ type: "restart_backend_session" }, "*");
                }
                location.reload();
              }
            },
            { danger: true, confirmLabel: "Restart", icon: "refresh", isHtml: true }
          );
        } else {
          if (confirm("All unsaved progress will be lost. Are you sure you want to restart?")) {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: "restart_backend_session" }, "*");
            }
            location.reload();
          }
        }
      }, false);
    }

    var closeApBtn = document.getElementById("closeApDetailSidebar");
    if (closeApBtn) {
      closeApBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var sidebar = document.getElementById("apDetailSidebar");
        if (sidebar) sidebar.classList.remove("visible");
        state.selectedApForDetail = null;
      }, false);
    }

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        restoreState();
      }
      // Redo: Ctrl+Y OR Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        redoState();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _initUndoUI);
  } else {
    _initUndoUI();
  }

  window.saveState = saveState;
  window.restoreState = restoreState;
  window.redoState = redoState;
  window.updateUndoButton = updateUndoButton;
  window.updateRedoButton = updateRedoButton;
})();