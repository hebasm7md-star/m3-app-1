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
  var MAX_UNDO = 50;

  function saveState() {
    var stateSnapshot = {
      walls: JSON.parse(JSON.stringify(state.walls)),
      aps: JSON.parse(JSON.stringify(state.aps)),
      floorPlanes: JSON.parse(JSON.stringify(state.floorPlanes)),
      groundPlane: JSON.parse(JSON.stringify(state.groundPlane)),
    };

    undoStack.push(stateSnapshot);
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
    updateUndoButton();
  }

  function restoreState() {
    if (undoStack.length === 0) return;

    var prev = undoStack.pop();

    state.walls = prev.walls;
    state.aps = prev.aps;
    state.floorPlanes = prev.floorPlanes;
    state.groundPlane = prev.groundPlane;

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

  function _initUndoUI() {
    updateUndoButton();

    var btn = document.getElementById("undoBtn");
    if (btn) btn.addEventListener("click", restoreState, false);

    var restartBtn = document.getElementById("restartBtn");
    if (restartBtn) {
      restartBtn.addEventListener("click", function () {
        if (typeof NotificationSystem !== "undefined" && NotificationSystem.confirm) {
          NotificationSystem.confirm(
            "All unsaved progress will be lost. Are you sure you want to restart?",
            "Restart Application",
            function (confirmed) {
              if (confirmed) {
                location.reload();
              }
            },
            { danger: true, confirmLabel: "Restart", icon: "⟳" }
          );
        } else {
          if (confirm("All unsaved progress will be lost. Are you sure you want to restart?")) {
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
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _initUndoUI);
  } else {
    _initUndoUI();
  }

  window.saveState = saveState;
  window.restoreState = restoreState;
  window.updateUndoButton = updateUndoButton;
})();