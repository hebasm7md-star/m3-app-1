/*
+-----------------------+       +--------------------------+
|      User Input       |       |      Global State        |
| (Mouse, Keyboard,     |       | (state.aps, state.walls, |
|  Wheel, Touch)        |       |  state.temp, etc.)       |
+-----------+-----------+       +------------+-------------+
            |                                ^
            | Events (click, move, key)      | Read/Write
            v                                |
+-----------+--------------------------------------------------+
|                  CanvasInteraction.js                        |
|  (Immediately Invoked Function Expression (IIFE) Scope)      |
|                                                              |
|  +----------------+  +----------------+  +----------------+  |
|  | Event Listeners|  | Logic Handlers |  | Exposed APIs   |  |
|  | (mousedown,    |  | (snapWallPoint,|  | window.finish..|  |
|  |  mousemove,    |  |  projectTo3D,  |  | window.pointer.|  |
|  |  keydown)      |  |  calcIntersection)|                |  |
|  +-------+--------+  +-------+--------+  +-------+--------+  |
|          |                   |                   |           |
|          +-------------------+-------------------+           |
|                              |                               |
+------------------------------+-------------------------------+
                               | Calls
                               v
+------------------+   +------------------+   +---------------+
| Helper Modules   |   | Rendering Engine |   | Notifications |
| (GeometryUtils,  |-->| (draw(),         |-->| (Warning/Info)|
|  AntennaPlacement)|   |  renderWalls()) |   +---------------+
+------------------+   +------------------+
                               |
                               v
                       +---------------+
                       | HTML5 Canvas  |
                       | (Visual Output)|
                       +---------------+
*/
//
// CanvasInteraction.js
// Handles all canvas mouse/pointer events: wall drawing (polyline), door/window placement, 
// floor plane drawing, calibration, antenna dragging, wall dragging, selection boxes, 
// zoom, pan, and keyboard shortcuts.
// All functions are exposed on window for **global access**.
//
// Depends on: global state, canvas, ctx, document.getElementById() and add() helpers,
//             draw(), saveState(), renderAPs(), renderWalls(),
//             renderApDetails(), renderFloorPlanes(),
//             generateHeatmapAsync(), invalidateHeatmapCache(),
//             snapWallPoint(), findWallAt() (GeometryUtils),
//             exitAntennaPlacementMode() (AntennaPlacement),
//             NotificationSystem
//
// Called by: Browser events only (mouse/keyboard interactions)
//

(function () {
  function pointerPos(ev) {
    var rect = canvas.getBoundingClientRect();
    var x = ev.clientX - rect.left;
    var y = ev.clientY - rect.top;
    return { x: invx(x), y: invy(y) };
  }

  function finishDoorWindow() {
    if (!state.temp || !state.temp.p1 || !state.temp.p2) {
      state.temp = null;
      state.wallSnapPoints = [];
      return;
    }

    saveState();
    var elementType = state.selectedElementType;
    var elementDef = elementTypes[elementType];
    var elementCount = 0;
    for (var i = 0; i < state.walls.length; i++) {
      if (state.walls[i].elementType === elementType) elementCount++;
    }
    var wallName = elementDef.name + "_" + (elementCount + 1);
    var wallType = {
      loss: elementDef.loss,
      color: elementDef.color,
      thickness: 3,
      name: elementDef.name,
    };

    // Validate door/window is on existing wall
    if (!isLineOnWall(state.temp.p1, state.temp.p2)) {
      NotificationSystem.warning("Please draw the " + elementDef.name + " on an existing wall.\nIt must be aligned with a wall.");

      state.temp = null;
      state.wallSnapPoints = [];
      renderWalls();
      draw();
      return;
    }

    // Create single segment wall (p1/p2, not points array)
    var newWall = {
      id: "wall_" + state.walls.length,
      p1: state.temp.p1,
      p2: state.temp.p2,
      loss: elementDef.loss,
      color: wallType.color,
      thickness: wallType.thickness,
      height: elementDef.height || 2.5,
      material: elementDef.material,
      shape: elementDef.shape || "wall",
      name: wallName,
      type: elementType,
      elementType: elementType,
      width: elementDef.width || null,
    };

    state.walls.push(newWall);

    state.temp = null;
    state.wallSnapPoints = [];
    renderWalls();
  }

  function finishWallPolyline() {
    if (!state.temp || !state.temp.points || state.temp.points.length < 2) {
      state.temp = null;
      state.wallSnapPoints = [];
      return;
    }

    saveState();
    var elementType = state.selectedElementType || "wall";
    var elementDef = null;
    var wallName = "";
    var wallType = null;

    if (elementType === "wall") {
      wallType = wallTypes[state.selectedWallType] || wallTypes["custom"];
      if (state.selectedWallType === "custom") {
        wallType = {
          loss: state.customWallLoss,
          color: "#f59e0b",
          thickness: 3,
          name: "Custom",
        };
      }
      elementDef =
        elementTypes.wall[state.selectedWallType] ||
        elementTypes.wall["custom"];
      if (state.selectedWallType === "custom") {
        elementDef = {
          loss: state.customWallLoss,
          material: "custom",
          color: "#f59e0b",
          thickness: 0.15,
          height: 2.5,
          name: "Custom",
        };
      }
      wallName = generateWallName(state.selectedWallType);
    } else {
      elementDef = elementTypes[elementType];
      var elementCount = 0;
      for (var i = 0; i < state.walls.length; i++) {
        if (state.walls[i].elementType === elementType) elementCount++;
      }
      wallName = elementDef.name + "_" + (elementCount + 1);
      wallType = {
        loss: elementDef.loss,
        color: elementDef.color,
        thickness: 3,
        name: elementDef.name,
      };
    }

    // Create single wall object with points array (polyline)
    var points = state.temp.points;

    // Create single wall object with points array
    // For backward compatibility, also set p1 and p2 to first and last points
    var newWall = {
      id: "wall_" + state.walls.length,
      points: points, // Store all points as polyline
      p1: points[0], // First point for backward compatibility
      p2: points[points.length - 1], // Last point for backward compatibility
      loss: elementDef.loss,
      color: wallType.color,
      thickness: wallType.thickness,
      height: elementDef.height || 2.5,
      material: elementDef.material,
      shape: elementDef.shape || "wall",
      name: wallName,
      type: elementType === "wall" ? state.selectedWallType : elementType,
      elementType: elementType,
      width: elementDef.width || null,
    };

    state.walls.push(newWall);

    state.temp = null;
    state.wallSnapPoints = [];
    renderWalls();
  }

  function storeLegendDefaultPosition() {
    if (!state.legendDefaultPosition) {
      // Default offsets from CSS (not actively used for layout anymore)
      state.legendDefaultPosition = {
        bottom: 10,
        right: 10,
      };
    }
  }

  // Constrain legend position within canvas container bounds
  function constrainLegendPosition(restoreDefault) {
    // Legend layout is now handled purely via CSS:
    // it sits just to the right of the canvas container, anchored to its bottom edge.
    // This function is kept as a no-op for backward compatibility with existing calls.
    return;
  }

  // Legend drag functionality - DISABLED (legend is fixed in bottom-right corner)
  function initLegendDrag() {
    // Drag functionality disabled - legend is fixed in bottom-right corner
    // Hover effect is still active via CSS
  }

  window.pointerPos = pointerPos;
  window.finishWallPolyline = finishWallPolyline;
  window.finishDoorWindow = finishDoorWindow;
  window.constrainLegendPosition = constrainLegendPosition;
  window.storeLegendDefaultPosition = storeLegendDefaultPosition;
  window.initLegendDrag = initLegendDrag;

  document.addEventListener("DOMContentLoaded", function () {

    if (canvas) canvas.addEventListener("mouseleave", function (e) {
      if (state.showTooltip) {
        var tooltip = document.getElementById("apTooltip");
        if (tooltip) {
          tooltip.classList.remove("visible");
        }
      }
    });

    if (canvas) canvas.addEventListener("mousedown", function (e) {
      var p = pointerPos(e);
      // Store mouse down position to detect drag vs click
      state.mouseDownPos = { x: e.clientX, y: e.clientY };
      state.isDragging = false;

      // Double-click to finish wall polyline
      if (
        state.addingWall &&
        state.temp &&
        state.temp.points &&
        state.temp.points.length >= 2 &&
        e.detail === 2
      ) {
        finishWallPolyline();
        draw();
        return;
      }

      // 3D camera controls
      if (
        (state.viewMode === "3d" || state.viewModeTransition > 0.5) &&
        !state.addingWall &&
        !state.addingAP &&
        !state.isCalibrating &&
        !state.manualWallControl
      ) {
        // Middle mouse button (button 1) - Pan camera
        if (e.button === 1) {
          state.isPanning3D = true;
          state.panStartX = e.clientX;
          state.panStartY = e.clientY;
          state.panStartPanX = state.cameraPanX;
          state.panStartPanY = state.cameraPanY;
          e.preventDefault();
          return;
        }

        // Right mouse button (button 2) - Rotate camera
        if (e.button === 2) {
          state.isRotating3D = true;
          state.rotateStartX = e.clientX;
          state.rotateStartY = e.clientY;
          state.rotateStartRotX = state.cameraRotationX;
          state.rotateStartRotY = state.cameraRotationY;
          e.preventDefault();
          return;
        }
      }

      if (state.isCalibrating) {
        var rect = canvas.getBoundingClientRect();
        var px = e.clientX - rect.left;
        var py = e.clientY - rect.top;

        if (!state.tempCalibration) {
          // First click - start calibration line (like walls use state.temp)
          state.tempCalibration = { p1: p, p2: p };
          state.tempCalibrationPixels = {
            p1: { x: px, y: py },
            p2: { x: px, y: py },
          };
        } else {
          // Second click - finish calibration line
          state.tempCalibration.p2 = p;
          state.tempCalibrationPixels.p2 = { x: px, y: py };

          // Move from temp to final calibration line
          state.calibrationLine = {
            p1: state.tempCalibration.p1,
            p2: state.tempCalibration.p2,
          };
          state.calibrationPixels = {
            p1: state.tempCalibrationPixels.p1,
            p2: state.tempCalibrationPixels.p2,
          };

          // Clear temp (like walls clear state.temp)
          state.tempCalibration = null;
          state.tempCalibrationPixels = null;
        }
        draw();
        return;
      }
      if (state.addingFloorPlane) {
        // Start drawing floor plane rectangle
        state.tempFloorPlane = {
          p1: { x: p.x, y: p.y },
          p2: { x: p.x, y: p.y },
          p3: { x: p.x, y: p.y },
          p4: { x: p.x, y: p.y },
        };
        state.floorPlaneDragStart = p;
        draw();
        return;
      }

      if (state.addingWall) {
        // Check element type for constraints
        var elementType = state.selectedElementType;
        var isDoorWindow =
          elementType === "door" ||
          elementType === "doubleDoor" ||
          elementType === "window";

        if (isDoorWindow) {
          // Doors/windows use single-segment drawing (not polyline)
          if (!state.temp) {
            // First click - find wall and project point onto it
            var closestWall = null;
            var minWallDist = Infinity;
            var projP = null;

            for (var i = 0; i < state.walls.length; i++) {
              var w = state.walls[i];
              // Skip doors and windows - only place on actual walls
              if (
                w.elementType === "door" ||
                w.elementType === "doubleDoor" ||
                w.elementType === "window"
              ) {
                continue;
              }

              // Handle polylines
              var wallSegments = [];
              if (w.points && w.points.length >= 2) {
                for (var j = 0; j < w.points.length - 1; j++) {
                  wallSegments.push({ p1: w.points[j], p2: w.points[j + 1] });
                }
              } else if (w.p1 && w.p2) {
                wallSegments.push({ p1: w.p1, p2: w.p2 });
              } else {
                continue; // Skip invalid walls
              }

              // Check each segment
              for (var j = 0; j < wallSegments.length; j++) {
                var seg = wallSegments[j];
                var dx = seg.p2.x - seg.p1.x;
                var dy = seg.p2.y - seg.p1.y;
                var l2 = dx * dx + dy * dy;
                if (l2 == 0) continue;
                var t =
                  ((p.x - seg.p1.x) * (seg.p2.x - seg.p1.x) +
                   (p.y - seg.p1.y) * (seg.p2.y - seg.p1.y)) /
                  l2;
                t = Math.max(0, Math.min(1, t));
                var proj = {
                  x: seg.p1.x + t * (seg.p2.x - seg.p1.x),
                  y: seg.p1.y + t * (seg.p2.y - seg.p1.y),
                };
                var dist = hypot(p.x - proj.x, p.y - proj.y);

                // Use same 20 unit threshold as mousemove
                if (dist < minWallDist && dist < 20) {
                  minWallDist = dist;
                  closestWall = w;
                  projP = proj;
                }
              }
            }

            if (!closestWall) {
              NotificationSystem.warning("Please click ON a wall to place a door or window.");
              return;
            }

            // Use p1/p2 structure for doors/windows (not points array)
            state.temp = { p1: projP, p2: projP, parentWall: closestWall };
          } else {
            // Second click - finish door/window immediately
            var parentWall = state.temp.parentWall;
            var projP = null;

            // Project mouse onto parent wall
            var wallSegments = [];
            if (parentWall.points && parentWall.points.length >= 2) {
              for (var j = 0; j < parentWall.points.length - 1; j++) {
                wallSegments.push({
                  p1: parentWall.points[j],
                  p2: parentWall.points[j + 1],
                });
              }
            } else if (parentWall.p1 && parentWall.p2) {
              wallSegments.push({ p1: parentWall.p1, p2: parentWall.p2 });
            }

            // Find closest point on parent wall
            var minDist = Infinity;
            for (var j = 0; j < wallSegments.length; j++) {
              var seg = wallSegments[j];
              var dx = seg.p2.x - seg.p1.x;
              var dy = seg.p2.y - seg.p1.y;
              var l2 = dx * dx + dy * dy;
              if (l2 > 0) {
                var t =
                  ((p.x - seg.p1.x) * (seg.p2.x - seg.p1.x) +
                   (p.y - seg.p1.y) * (seg.p2.y - seg.p1.y)) /
                  l2;
                t = Math.max(0, Math.min(1, t));
                var proj = {
                  x: seg.p1.x + t * (seg.p2.x - seg.p1.x),
                  y: seg.p1.y + t * (seg.p2.y - seg.p1.y),
                };
                var dist = hypot(p.x - proj.x, p.y - proj.y);
                if (dist < minDist) {
                  minDist = dist;
                  projP = proj;
                }
              }
            }

            if (projP) {
              state.temp.p2 = projP;
            } else {
              state.temp.p2 = p;
            }

            // Finish door/window immediately (single segment)
            finishDoorWindow();
            draw();
            return;
          }
        } else {
          // Regular walls use polyline method
          if (!state.temp) {
            // Start new wall polyline - snap starting point to nearby endpoints/intersections
            var snappedStart = snapWallPoint(p, null);
            state.temp = { points: [snappedStart], preview: snappedStart };
          } else {
            // Continue wall polyline - add new vertex
            var lastPoint = state.temp.points[state.temp.points.length - 1];
            var snappedEnd = snapWallPoint(p, lastPoint);
            state.temp.points.push(snappedEnd);
            state.temp.preview = snappedEnd;
            // Continue polyline - don't finish yet, just add vertex
            // User can double-click or press ESC to finish
          }
        }
        draw();
        return;
      }
      var i,
        hit = null;
      var transition = state.viewModeTransition;

      // Check for antenna hit - use screen coordinates in 3D view for better accuracy
      for (i = 0; i < state.aps.length; i++) {
        var ap = state.aps[i];
        var antennaHeight = ap.z || 2.5;
        var coverageHeight = 1.5; // Height of coverage pattern plane

        // Calculate antenna screen position
        var apScreenX, apScreenY;
        if (transition > 0) {
          // 3D view - project antenna to screen coordinates at coverage height
          // This aligns with where the coverage pattern is rendered
          var ap2d = { x: mx(ap.x), y: my(ap.y) };
          var ap3d = projectToCanvas3D(ap.x, ap.y, coverageHeight);
          apScreenX = ap2d.x + (ap3d.x - ap2d.x) * transition;
          apScreenY = ap2d.y + (ap3d.y - ap2d.y) * transition;
        } else {
          // 2D view - use standard coordinates
          apScreenX = mx(ap.x);
          apScreenY = my(ap.y);
        }

        // Check hit using screen coordinates
        var rect = canvas.getBoundingClientRect();
        var clickScreenX = e.clientX - rect.left;
        var clickScreenY = e.clientY - rect.top;
        var screenDist = hypot(
          clickScreenX - apScreenX,
          clickScreenY - apScreenY
        );

        // Use a threshold that accounts for the antenna dot size (3px radius)
        if (screenDist < 8) {
          // 8px threshold (slightly larger than 3px radius for easier clicking)
          hit = ap;
          break;
        }
      }

      if (hit) {
        // Prevent dragging during optimization
        /*if (state.isOptimizing) {
        alert("Cannot move antennas while optimization is in progress. Please wait for optimization to complete.");
        return;
      }*/

        // Store the hit AP for potential drag or click
        saveState(); // Save state before dragging starts (works for both 2D and 3D)
        state.drag = hit;
        state.dragStartWorld = { x: hit.x, y: hit.y }; // Store initial world position

        // Store initial screen position relative to canvas
        var rect = canvas.getBoundingClientRect();
        state.dragStartScreen = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };

        // Don't select, just store for potential drag
        // Selection/viewing will be handled in mouseup if it's a click
      } else {
        // Only allow wall selection/movement if manual control is enabled
        if (state.manualWallControl) {
          var wall = findWallAt(p);
          if (wall) {
            // Check if multiple walls are selected
            var hasMultipleSelected = state.selectedWallIds.length > 1;
            var isWallSelected =
              state.selectedWallIds.indexOf(wall.id) !== -1;

            // If multiple walls are selected and clicking on any selected wall, start multi-drag
            // OR if clicking on a wall when multiple are selected, add it and start multi-drag
            if (hasMultipleSelected && isWallSelected) {
              // Start multi-wall drag - move all selected walls together
              var selectedWalls = [];
              for (var i = 0; i < state.walls.length; i++) {
                var w = state.walls[i];
                if (state.selectedWallIds.indexOf(w.id) !== -1) {
                  selectedWalls.push({
                    wall: w,
                    originalP1: { x: w.p1.x, y: w.p1.y },
                    originalP2: { x: w.p2.x, y: w.p2.y },
                  });
                }
              }

              state.wallDrag = {
                walls: selectedWalls,
                p: p,
                isMultiDrag: true,
              };
              state.drag = null;
              renderWalls();
              draw();
              return;
            } else if (hasMultipleSelected && !isWallSelected) {
              // Multiple walls selected but clicking on different wall - add it to selection and start multi-drag
              state.selectedWallIds.push(wall.id);
              state.selectedWallId = wall.id;

              var selectedWalls = [];
              for (var i = 0; i < state.walls.length; i++) {
                var w = state.walls[i];
                if (state.selectedWallIds.indexOf(w.id) !== -1) {
                  selectedWalls.push({
                    wall: w,
                    originalP1: { x: w.p1.x, y: w.p1.y },
                    originalP2: { x: w.p2.x, y: w.p2.y },
                  });
                }
              }

              state.wallDrag = {
                walls: selectedWalls,
                p: p,
                isMultiDrag: true,
              };
              state.drag = null;
              renderWalls();
              draw();
              return;
            } else {
              // Single wall drag (existing behavior)
              var wallDx = wall.p2.x - wall.p1.x;
              var wallDy = wall.p2.y - wall.p1.y;
              var absDx = Math.abs(wallDx);
              var absDy = Math.abs(wallDy);
              var orientation = "diagonal";
              if (absDx < 0.1) {
                orientation = "vertical"; // Vertical wall
              } else if (absDy < 0.1) {
                orientation = "horizontal"; // Horizontal wall
              }

              // Calculate original wall length
              var originalLength = hypot(wallDx, wallDy);

              state.wallDrag = {
                wall: wall,
                walls: [
                  {
                    wall: wall,
                    originalP1: { x: wall.p1.x, y: wall.p1.y },
                    originalP2: { x: wall.p2.x, y: wall.p2.y },
                  },
                ],
                p: p,
                orientation: orientation,
                originalP1: { x: wall.p1.x, y: wall.p1.y },
                originalP2: { x: wall.p2.x, y: wall.p2.y },
                originalLength: originalLength,
                isMultiDrag: false,
              };
              saveState(); // Save state before dragging wall
              state.selectedWallId = wall.id;
              // Update multi-selection array
              if (state.selectedWallIds.indexOf(wall.id) === -1) {
                state.selectedWallIds = [wall.id];
              }
              state.drag = null;
              renderWalls(); // Update sidebar to highlight selected wall
              scrollToSelectedWall(); // Scroll to selected wall in sidebar
              draw();
              return;
            }
          } else {
            // Start drag selection if clicking on empty space
            // Only start selection if not in the middle of another operation
            if (
              !state.addingWall &&
              !state.addingAP &&
              !state.addingFloorPlane &&
              !state.isCalibrating
            ) {
              // Check if we should start drag selection (left mouse button, not in 3D view)
              if (
                e.button === 0 &&
                (state.viewMode === "2d" || state.viewModeTransition < 0.5)
              ) {
                state.isSelecting = true;
                state.selectionBox = { p1: p, p2: p };
                state.selectedWallId = null;
                state.selectedWallIds = [];
                state.selectedApId = null; // Deselect antenna
                state.highlight = false; // Clear highlight
                state.viewedApId = null; // Clear viewed antenna
                state.wallDrag = null;
                draw();
                return;
              } else {
                // Single click on empty space - deselect all
                state.selectedWallId = null;
                state.selectedWallIds = [];
                state.selectedApId = null; // Deselect antenna
                state.highlight = false; // Clear highlight
                state.viewedApId = null; // Clear viewed antenna
                state.wallDrag = null;
                renderWalls(); // Update sidebar to remove highlight
                draw();
                return;
              }
            }
          }
        } else {
          // Manual control not enabled - allow drag selection for multi-selection
          if (
            !state.addingWall &&
            !state.addingAP &&
            !state.addingFloorPlane &&
            !state.isCalibrating
          ) {
            // Check if we should start drag selection (left mouse button, not in 3D view)
            if (
              e.button === 0 &&
              (state.viewMode === "2d" || state.viewModeTransition < 0.5)
            ) {
              state.isSelecting = true;
              state.selectionBox = { p1: p, p2: p };
              state.selectedWallId = null;
              state.selectedWallIds = [];
              draw();
              return;
            }
          }
        }

        if (state.addingAP) {
          // Prevent adding antennas during optimization
          /*if (state.isOptimizing) {
          alert("Cannot add antennas while optimization is in progress. Please wait for optimization to complete.");
          return;
        }*/
          // Only add if in addingAP mode
          // Check if antenna pattern is uploaded
          if (!getDefaultAntennaPattern()) {
            NotificationSystem.warning("Please upload an antenna pattern first.");

            state.addingAP = false;
            var addAPBtn = document.getElementById("addAP");
            if (addAPBtn) {
              addAPBtn.className = addAPBtn.className.replace(" toggled", "");
              if (typeof setAddAPBtnText === "function") setAddAPBtnText("Place Antenna Manually");
              else { var lbl = addAPBtn.querySelector("#addAPBtnLabel"); if (lbl) lbl.textContent = "Place Antenna Manually"; else addAPBtn.textContent = "Place Antenna Manually"; }
            }
            draw();
            return;
          }

          var id = "ANT" + (state.aps.length + 1);
          var ap = {
            id: id,
            x: p.x,
            y: p.y,
            tx: 10,
            gt: 5,//(getDefaultAntennaPattern() ? getDefaultAntennaPattern().gain : defaultGt),
            ch: 1,
            azimuth: 0,
            tilt: 0,
            antennaPatternFile: null,
            antennaPatternFileName: null,
          };

          // Assign the global antenna pattern to the new AP (unless it has its own)
          // New APs will use the first uploaded pattern
          var defaultPattern = getDefaultAntennaPattern();
          if (defaultPattern) {
            ap.antennaPattern = defaultPattern;
            // Set the filename from the pattern's name property (Internal Name) as requested
            // This aligns with the backend saving the file based on the internal NAME field
            // Fallback to fileName if name is missing
            ap.antennaPatternFileName = defaultPattern.name ? defaultPattern.name.replace(' ', '_') : "Unknown";
          }

          saveState(); // Save state before adding AP

          // For the first antenna (no cache), generate synchronously for immediate display
          // For subsequent antennas, use async generation with pending flag
          var isFirstAntenna = !state.cachedHeatmap && state.aps.length === 0;

          state.aps.push(ap);
          // Keep old cache temporarily for immediate visual feedback
          // Don't invalidate cache yet - let draw() use old cache first
          state.drag = ap;
          state.dragStartWorld = { x: ap.x, y: ap.y };
          var rect = canvas.getBoundingClientRect();
          state.dragStartScreen = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          };

          // Select the new antenna for highlighting, but do NOT open or prepare the right sidebar
          // while we are in placement mode.
          state.selectedApId = id;
          state.selectedApForDetail = null;
          var apDetailSidebar = document.getElementById("apDetailSidebar");
          if (apDetailSidebar) {
            apDetailSidebar.classList.remove("visible");
          }
          // Cancel any pending heatmap updates
          if (state.heatmapUpdateRequestId !== null) {
            cancelAnimationFrame(state.heatmapUpdateRequestId);
            state.heatmapUpdateRequestId = null;
          }

          if (isFirstAntenna) {
            // First antenna: don't set pending flag, let draw() generate synchronously
            state.heatmapUpdatePending = false;
            state.cachedHeatmap = null; // Ensure no stale cache
          } else {
            // Keep old cache visible - don't invalidate it yet
            // Set pending flag BEFORE draw() to prevent synchronous generation
            state.heatmapUpdatePending = true;
          }

          // Log antenna placement (initial position - old and new are the same)
          logAntennaPositionChange(ap.id, ap.id, ap.x, ap.y, ap.x, ap.y);
          // Enqueue new antenna immediately on placement
          scheduleAntennaEnqueue(ap);
          renderAPs();
          // Draw immediately - will generate synchronously for first antenna, or use cache for others
          draw();

          // For first antenna, async generation already triggered by draw() if needed
          // For subsequent antennas, trigger async heatmap generation
          if (!isFirstAntenna) {
            // Trigger async heatmap generation (cache will be invalidated when new heatmap is ready)
            // This will generate a new heatmap showing all antennas' patterns including the newly added one
            // Use requestAnimationFrame to defer async generation slightly
            // This ensures the immediate draw() completes first
            requestAnimationFrame(function () {
              if (state.showVisualization) {
                generateHeatmapAsync(null, true); // Start with low-res for fast update
              } else {
                state.heatmapUpdatePending = false;
              }
            });
          }
          // Keep placement mode active to allow placing multiple antennas
        }
      }
      //draw();
    });

    window.addEventListener("mousemove", function (e) {
      var p = pointerPos(e);

      // Update tooltip position - keep mouse pointer at left bottom of tooltip
      var tooltip = document.getElementById("apTooltip");
      if (tooltip && tooltip.classList.contains("visible")) {
        // Get tooltip dimensions
        var tooltipRect = tooltip.getBoundingClientRect();
        var tooltipWidth = tooltipRect.width;
        var tooltipHeight = tooltipRect.height;

        // Position tooltip so mouse is at left bottom
        // left = mouseX (pointer at left edge)
        // top = mouseY - height (pointer at bottom edge)
        var leftPos = e.clientX;
        var topPos = e.clientY - tooltipHeight;

        // Add small offset to prevent cursor from overlapping tooltip
        var offsetX = 5; // 5px to the right
        var offsetY = -5; // 5px above

        leftPos += offsetX;
        topPos += offsetY;

        // Ensure tooltip stays within viewport
        var viewportWidth = window.innerWidth;
        var viewportHeight = window.innerHeight;

        // Prevent tooltip from going off right edge
        if (leftPos + tooltipWidth > viewportWidth) {
          leftPos = viewportWidth - tooltipWidth - 10;
        }

        // Prevent tooltip from going off top edge
        if (topPos < 10) {
          topPos = 10;
        }

        // Prevent tooltip from going off left edge
        if (leftPos < 10) {
          leftPos = 10;
        }

        tooltip.style.left = leftPos + "px";
        tooltip.style.top = topPos + "px";
      }

      // 3D camera panning controls (middle mouse button)
      if (state.isPanning3D) {
        var dx = e.clientX - state.panStartX;
        var dy = e.clientY - state.panStartY;
        // Pan in screen space - convert to world space
        var panSpeed = 0.01;
        state.cameraPanX = state.panStartPanX + dx * panSpeed;
        state.cameraPanY = state.panStartPanY + dy * panSpeed;
        draw();
        return;
      }

      // 3D rotation controls (right mouse button) - non-inverted directions
      if (state.isRotating3D) {
        var dx = e.clientX - state.rotateStartX;
        var dy = e.clientY - state.rotateStartY;
        // Non-inverted: dragging right rotates right, dragging up tilts up
        state.cameraRotationY = state.rotateStartRotY + dx * 0.01; // Horizontal rotation - right drag = right rotation
        // Clamp X rotation to prevent flipping upside down (limit to -85 to 85 degrees instead of -90 to 90)
        var maxRotationX = (85 * Math.PI) / 180; // 85 degrees in radians
        state.cameraRotationX = Math.max(
          -maxRotationX,
          Math.min(maxRotationX, state.rotateStartRotX - dy * 0.01)
        ); // Vertical rotation - up drag = tilt up (negative dy)
        draw();
        return;
      }

      // Update selection box while dragging
      if (state.isSelecting && state.selectionBox) {
        state.selectionBox.p2 = p;
        draw();
        return;
      }

      // Update calibration line preview while drawing (like walls update state.temp.p2)
      if (state.isCalibrating && state.tempCalibration) {
        state.tempCalibration.p2 = p;
        var rect = canvas.getBoundingClientRect();
        var px = e.clientX - rect.left;
        var py = e.clientY - rect.top;
        state.tempCalibrationPixels.p2 = { x: px, y: py };
        draw();
        return;
      }

      if (state.tempFloorPlane && state.floorPlaneDragStart) {
        // Update rectangle corners while dragging
        var start = state.floorPlaneDragStart;
        var minX = Math.min(start.x, p.x);
        var maxX = Math.max(start.x, p.x);
        var minY = Math.min(start.y, p.y);
        var maxY = Math.max(start.y, p.y);

        state.tempFloorPlane.p1 = { x: minX, y: minY }; // Top-left
        state.tempFloorPlane.p2 = { x: maxX, y: minY }; // Top-right
        state.tempFloorPlane.p3 = { x: maxX, y: maxY }; // Bottom-right
        state.tempFloorPlane.p4 = { x: minX, y: maxY }; // Bottom-left
        draw();
        return;
      }

      if (state.wallDrag) {
        // Check if this is a multi-wall drag
        if (
          state.wallDrag.isMultiDrag &&
          state.wallDrag.walls &&
          state.wallDrag.walls.length > 1
        ) {
          // Multi-wall drag - move all selected walls together
          var dx = p.x - state.wallDrag.p.x;
          var dy = p.y - state.wallDrag.p.y;

          // Move all walls by the same offset to maintain formation
          for (var i = 0; i < state.wallDrag.walls.length; i++) {
            var wallData = state.wallDrag.walls[i];
            var wall = wallData.wall;

            // Calculate new positions based on original positions + offset
            wall.p1.x = wallData.originalP1.x + dx;
            wall.p1.y = wallData.originalP1.y + dy;
            wall.p2.x = wallData.originalP2.x + dx;
            wall.p2.y = wallData.originalP2.y + dy;
          }

          draw();
          return;
        }

        // Single wall drag (existing behavior)
        var wall =
          state.wallDrag.wall ||
          (state.wallDrag.walls && state.wallDrag.walls[0]
           ? state.wallDrag.walls[0].wall
           : null);
        if (!wall) {
          draw();
          return;
        }
        var dx = p.x - state.wallDrag.p.x;
        var dy = p.y - state.wallDrag.p.y;

        // Calculate new positions (both points move together to maintain orientation)
        var newP1 = { x: wall.p1.x + dx, y: wall.p1.y + dy };
        var newP2 = { x: wall.p2.x + dx, y: wall.p2.y + dy };

        // Track which endpoints were snapped (initialize to false)
        var p1Snapped = false;
        var p2Snapped = false;

        // If snapToGrid is enabled, find intersections and snap endpoints
        if (state.snapToGrid) {
          state.wallSnapPoints = [];
          var intersectionPoints = [];
          var endpointPoints = [];

          // Find intersections with other walls and collect endpoint positions
          for (var i = 0; i < state.walls.length; i++) {
            var otherWall = state.walls[i];
            if (otherWall.id === wall.id) continue; // Skip self

            // Find line-line intersections
            var intersection = lineIntersection(
              newP1,
              newP2,
              otherWall.p1,
              otherWall.p2
            );
            if (intersection) {
              intersectionPoints.push(intersection);
            }

            // Collect endpoints of other walls for snapping
            endpointPoints.push(otherWall.p1);
            endpointPoints.push(otherWall.p2);
          }

          // Snap endpoints to nearest intersection points or other wall endpoints
          var allSnapPoints = intersectionPoints.concat(endpointPoints);

          if (allSnapPoints.length > 0) {
            // Find closest snap point to p1
            var minDist1 = Infinity;
            var closestToP1 = null;
            for (var j = 0; j < allSnapPoints.length; j++) {
              var dist = hypot(
                newP1.x - allSnapPoints[j].x,
                newP1.y - allSnapPoints[j].y
              );
              if (dist < minDist1 && dist < state.snapThreshold) {
                minDist1 = dist;
                closestToP1 = allSnapPoints[j];
              }
            }

            // Find closest snap point to p2
            var minDist2 = Infinity;
            var closestToP2 = null;
            for (var j = 0; j < allSnapPoints.length; j++) {
              var dist = hypot(
                newP2.x - allSnapPoints[j].x,
                newP2.y - allSnapPoints[j].y
              );
              if (dist < minDist2 && dist < state.snapThreshold) {
                minDist2 = dist;
                closestToP2 = allSnapPoints[j];
              }
            }

            // Track which endpoints were snapped
            p1Snapped = !!closestToP1;
            p2Snapped = !!closestToP2;

            // Apply snapping while maintaining wall orientation
            if (state.wallDrag.orientation === "horizontal") {
              // Horizontal wall: maintain same Y coordinate for both endpoints
              var snapY = null;
              if (closestToP1) {
                snapY = closestToP1.y;
                newP1 = { x: closestToP1.x, y: closestToP1.y };
              }
              if (closestToP2) {
                if (snapY === null) {
                  snapY = closestToP2.y;
                }
                newP2 = { x: closestToP2.x, y: closestToP2.y };
              }
              // Ensure both endpoints have the same Y when snapping occurs
              if (snapY !== null) {
                newP1.y = snapY;
                newP2.y = snapY;
              }
              // If no snapping, orientation is already maintained by moving both points together
            } else if (state.wallDrag.orientation === "vertical") {
              // Vertical wall: maintain same X coordinate for both endpoints
              var snapX = null;
              if (closestToP1) {
                snapX = closestToP1.x;
                newP1 = { x: closestToP1.x, y: closestToP1.y };
              }
              if (closestToP2) {
                if (snapX === null) {
                  snapX = closestToP2.x;
                }
                newP2 = { x: closestToP2.x, y: closestToP2.y };
              }
              // Ensure both endpoints have the same X when snapping occurs
              if (snapX !== null) {
                newP1.x = snapX;
                newP2.x = snapX;
              }
              // If no snapping, orientation is already maintained by moving both points together
            } else {
              // Diagonal wall: allow free snapping
              if (closestToP1) {
                newP1 = closestToP1;
              }
              if (closestToP2) {
                newP2 = closestToP2;
              }
            }

            // Store intersection points and snapped endpoints for visual feedback
            state.wallSnapPoints = intersectionPoints;
            if (closestToP1) {
              state.wallSnapPoints.push(closestToP1);
            }
            if (closestToP2 && closestToP2 !== closestToP1) {
              state.wallSnapPoints.push(closestToP2);
            }
          }
        } else {
          state.wallSnapPoints = [];
        }

        // Maintain wall length - adjust endpoints to preserve original length
        var currentLength = hypot(newP2.x - newP1.x, newP2.y - newP1.y);
        var originalLength = state.wallDrag.originalLength;

        if (
          Math.abs(currentLength - originalLength) > 0.01 &&
          originalLength > 0.01
        ) {
          // Calculate direction vector from p1 to p2
          var dirX = (newP2.x - newP1.x) / currentLength;
          var dirY = (newP2.y - newP1.y) / currentLength;

          // Determine which endpoint to adjust based on snapping
          // If both snapped, prefer adjusting p2 (or p1 if p2 was snapped to a critical point)
          // If only one snapped, adjust the other
          // If neither snapped, adjust p2 (shouldn't happen as length is maintained by moving both together)

          var adjustP1 = false;
          var adjustP2 = false;

          if (p1Snapped && !p2Snapped) {
            // Only p1 snapped, adjust p2
            adjustP2 = true;
          } else if (!p1Snapped && p2Snapped) {
            // Only p2 snapped, adjust p1
            adjustP1 = true;
          } else if (p1Snapped && p2Snapped) {
            // Both snapped, adjust p2 to maintain length
            adjustP2 = true;
          } else {
            // Neither snapped, adjust p2 (should maintain length already, but just in case)
            adjustP2 = true;
          }

          if (adjustP2) {
            // Adjust p2 to maintain length, keeping p1 fixed
            if (
              state.snapToGrid &&
              state.wallDrag.orientation === "horizontal"
            ) {
              // Horizontal: maintain Y, adjust X
              var newX2 = newP1.x + dirX * originalLength;
              newP2 = { x: newX2, y: newP1.y };
            } else if (
              state.snapToGrid &&
              state.wallDrag.orientation === "vertical"
            ) {
              // Vertical: maintain X, adjust Y
              var newY2 = newP1.y + dirY * originalLength;
              newP2 = { x: newP1.x, y: newY2 };
            } else {
              // Diagonal or no snapToGrid: adjust both X and Y
              newP2 = {
                x: newP1.x + dirX * originalLength,
                y: newP1.y + dirY * originalLength,
              };
            }
          } else if (adjustP1) {
            // Adjust p1 to maintain length, keeping p2 fixed
            // Reverse direction vector
            if (
              state.snapToGrid &&
              state.wallDrag.orientation === "horizontal"
            ) {
              // Horizontal: maintain Y, adjust X
              var newX1 = newP2.x - dirX * originalLength;
              newP1 = { x: newX1, y: newP2.y };
            } else if (
              state.snapToGrid &&
              state.wallDrag.orientation === "vertical"
            ) {
              // Vertical: maintain X, adjust Y
              var newY1 = newP2.y - dirY * originalLength;
              newP1 = { x: newP2.x, y: newY1 };
            } else {
              // Diagonal or no snapToGrid: adjust both X and Y
              newP1 = {
                x: newP2.x - dirX * originalLength,
                y: newP2.y - dirY * originalLength,
              };
            }
          }
        }

        // Update wall positions
        wall.p1.x = newP1.x;
        wall.p1.y = newP1.y;
        wall.p2.x = newP2.x;
        wall.p2.y = newP2.y;
        state.wallDrag.p = p;
        draw();
      }

      // Detect if user is dragging (moved more than 5 pixels)
      if (state.mouseDownPos && state.drag) {
        var dx = e.clientX - state.mouseDownPos.x;
        var dy = e.clientY - state.mouseDownPos.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          state.isDragging = true;
          // Check if we're dragging an antenna (for heatmap optimization)
          if (!state.isDraggingAntenna) {
            var isAntenna = false;
            for (var i = 0; i < state.aps.length; i++) {
              if (state.aps[i].id === state.drag.id) {
                isAntenna = true;
                break;
              }
            }
            if (isAntenna) {
              state.isDraggingAntenna = true;
            }
          }
        }
      }

      if (!state.drag && !state.temp) return;
      if (state.drag && state.isDragging) {
        var transition = state.viewModeTransition;
        if (transition > 0 && state.dragStartWorld && state.dragStartScreen) {
          // In 3D view, use iterative refinement to find world position
          // that projects to the current mouse position
          var rect = canvas.getBoundingClientRect();
          var targetScreenX = e.clientX - rect.left;
          var targetScreenY = e.clientY - rect.top;

          // Use coverage height for dragging to match visual representation
          // The antenna dot is displayed at coverage height to align with coverage pattern
          var coverageHeight = 1.5;

          // Start with the initial world position
          var worldX = state.dragStartWorld.x;
          var worldY = state.dragStartWorld.y;

          // Calculate screen delta from start position
          var screenDeltaX = targetScreenX - state.dragStartScreen.x;
          var screenDeltaY = targetScreenY - state.dragStartScreen.y;

          // Project the start position to see current screen position at coverage height
          var startScreen = projectToCanvas3D(
            state.dragStartWorld.x,
            state.dragStartWorld.y,
            coverageHeight
          );

          // Calculate scale factor by projecting a small offset at coverage height
          var testOffset = 1.0; // 1 meter
          var testScreen1 = projectToCanvas3D(
            state.dragStartWorld.x + testOffset,
            state.dragStartWorld.y,
            coverageHeight
          );
          var testScreen2 = projectToCanvas3D(
            state.dragStartWorld.x,
            state.dragStartWorld.y + testOffset,
            coverageHeight
          );

          var scaleX =
            testOffset /
            Math.max(0.1, Math.abs(testScreen1.x - startScreen.x));
          var scaleY =
            testOffset /
            Math.max(0.1, Math.abs(testScreen2.y - startScreen.y));

          // Account for camera rotation around Y axis
          var cosY = Math.cos(state.cameraRotationY || 0);
          var sinY = Math.sin(state.cameraRotationY || 0);

          // Convert screen delta to world delta
          // Screen X/Y movement maps to world X/Y with rotation
          var worldDeltaX =
            (screenDeltaX * cosY - screenDeltaY * sinY) * scaleX;
          var worldDeltaY =
            (screenDeltaX * sinY + screenDeltaY * cosY) * scaleY;

          // Apply delta
          worldX = state.dragStartWorld.x + worldDeltaX;
          worldY = state.dragStartWorld.y + worldDeltaY;

          // Refine by projecting and adjusting at coverage height
          var projected = projectToCanvas3D(worldX, worldY, coverageHeight);
          var errorX = targetScreenX - projected.x;
          var errorY = targetScreenY - projected.y;

          // Apply correction if error is significant
          if (Math.abs(errorX) > 0.5 || Math.abs(errorY) > 0.5) {
            var correctX = (errorX * cosY - errorY * sinY) * scaleX * 0.5;
            var correctY = (errorX * sinY + errorY * cosY) * scaleY * 0.5;
            worldX += correctX;
            worldY += correctY;
          }

          state.drag.x = worldX;
          state.drag.y = worldY;
        } else {
          // In 2D view, use standard coordinate conversion
          state.drag.x = p.x;
          state.drag.y = p.y;
        }

        // Update antenna position in array immediately for real-time calculations
        // This ensures any calculations use the current drag position
        if (state.drag && state.isDraggingAntenna) {
          for (var j = 0; j < state.aps.length; j++) {
            if (state.aps[j].id === state.drag.id) {
              // Store original position if not already stored
              if (!state.aps[j]._originalDragPos) {
                state.aps[j]._originalDragPos = {
                  x: state.aps[j].x,
                  y: state.aps[j].y,
                };
              }
              // Update to drag position temporarily
              state.aps[j].x = state.drag.x;
              state.aps[j].y = state.drag.y;
              break;
            }
          }
        }

        draw();
      }
      if (state.temp) {
        // Check if this is a door/window (uses p1/p2 structure, not points array)
        var isDoorOrWindow =
          state.selectedElementType === "door" ||
          state.selectedElementType === "doubleDoor" ||
          state.selectedElementType === "window";

        if (isDoorOrWindow && state.temp.p1) {
          // Doors/windows: project onto parent wall, no horizontal/vertical constraint
          var parentWall = state.temp.parentWall;
          var snapped = { x: p.x, y: p.y };

          if (parentWall) {
            // Project mouse onto parent wall segments
            var wallSegments = [];
            if (parentWall.points && parentWall.points.length >= 2) {
              for (var j = 0; j < parentWall.points.length - 1; j++) {
                wallSegments.push({
                  p1: parentWall.points[j],
                  p2: parentWall.points[j + 1],
                });
              }
            } else if (parentWall.p1 && parentWall.p2) {
              wallSegments.push({ p1: parentWall.p1, p2: parentWall.p2 });
            }

            // Find closest point on parent wall
            var minDist = Infinity;
            for (var j = 0; j < wallSegments.length; j++) {
              var seg = wallSegments[j];
              var dx = seg.p2.x - seg.p1.x;
              var dy = seg.p2.y - seg.p1.y;
              var l2 = dx * dx + dy * dy;
              if (l2 > 0) {
                var t =
                  ((p.x - seg.p1.x) * (seg.p2.x - seg.p1.x) +
                   (p.y - seg.p1.y) * (seg.p2.y - seg.p1.y)) /
                  l2;
                t = Math.max(0, Math.min(1, t));
                var proj = {
                  x: seg.p1.x + t * (seg.p2.x - seg.p1.x),
                  y: seg.p1.y + t * (seg.p2.y - seg.p1.y),
                };
                var dist = hypot(p.x - proj.x, p.y - proj.y);
                if (dist < minDist) {
                  minDist = dist;
                  snapped = proj;
                }
              }
            }
          }

          // Update preview for door/window (p2)
          state.temp.p2 = snapped;
        } else {
          // Regular walls: use polyline method with horizontal/vertical constraint
          // Get the reference point for snapping (last point in polyline, or first point if starting)
          var referencePoint = null;
          if (state.temp.points && state.temp.points.length > 0) {
            referencePoint = state.temp.points[state.temp.points.length - 1];
          } else if (state.temp.p1) {
            referencePoint = state.temp.p1;
          }

          var snapped = { x: p.x, y: p.y };

          // In assisted drawing mode, constrain to horizontal or vertical movement only
          if (state.snapToGrid && referencePoint) {
            var dx = Math.abs(p.x - referencePoint.x);
            var dy = Math.abs(p.y - referencePoint.y);

            // Determine if movement is more horizontal or vertical
            if (dx > dy) {
              // Horizontal movement - keep Y coordinate from reference point
              snapped.y = referencePoint.y;
            } else {
              // Vertical movement - keep X coordinate from reference point
              snapped.x = referencePoint.x;
            }
          }

          // Apply snapping to wall endpoints and intersections (this may override the constraint)
          snapped = snapWallPoint(snapped, referencePoint);

          // Update preview for polyline
          if (state.temp.points && state.temp.points.length > 0) {
            state.temp.preview = snapped;
          } else {
            // Fallback for old structure
            state.temp.p2 = snapped;
          }
        }
        draw();
      }
    });

    window.addEventListener("mouseup", function (e) {
      // Stop 3D panning
      if (state.isPanning3D) {
        state.isPanning3D = false;
        return;
      }

      // Stop 3D rotation
      if (state.isRotating3D) {
        state.isRotating3D = false;
        return;
      }

      // Finalize drag selection
      if (state.isSelecting && state.selectionBox) {
        var selectedWalls = findWallsInSelectionBox(state.selectionBox);
        state.selectedWallIds = selectedWalls.map(function (w) {
          return w.id;
        });
        // For backward compatibility, set selectedWallId to first selected wall
        state.selectedWallId =
          selectedWalls.length > 0 ? selectedWalls[0].id : null;
        state.isSelecting = false;
        state.selectionBox = null;
        renderWalls(); // Update sidebar to highlight selected walls
        draw();
        return;
      }

      // Calibration is now handled by click-click, no drag needed
      // Mouseup handler for calibration removed

      if (state.tempFloorPlane && state.floorPlaneDragStart) {
        // Finish drawing floor plane
        var start = state.floorPlaneDragStart;
        var p = pointerPos(e);
        var minX = Math.min(start.x, p.x);
        var maxX = Math.max(start.x, p.x);
        var minY = Math.min(start.y, p.y);
        var maxY = Math.max(start.y, p.y);

        // Only create if rectangle has non-zero area
        if (Math.abs(maxX - minX) > 0.1 && Math.abs(maxY - minY) > 0.1) {
          // Convert world coordinates to image pixel coordinates
          // This makes the floor plane "stick" to the image
          if (state.backgroundImage) {
            var imgWidth = state.backgroundImage.width;
            var imgHeight = state.backgroundImage.height;

            // Convert world coords to image pixel coords
            var worldToImage = function (wx, wy) {
              return {
                x: (wx / state.w) * imgWidth,
                y: (wy / state.h) * imgHeight,
              };
            };

            var imgP1 = worldToImage(minX, minY);
            var imgP2 = worldToImage(maxX, minY);
            var imgP3 = worldToImage(maxX, maxY);
            var imgP4 = worldToImage(minX, maxY);

            var newFloorPlane = {
              id: "floorPlane_" + state.floorPlanes.length,
              // Store in image pixel coordinates
              imgP1: imgP1,
              imgP2: imgP2,
              imgP3: imgP3,
              imgP4: imgP4,
              // Also store world coordinates for RF calculations
              p1: { x: minX, y: minY },
              p2: { x: maxX, y: minY },
              p3: { x: maxX, y: maxY },
              p4: { x: minX, y: maxY },
              attenuation: state.floorPlaneAttenuation,
              height: state.floorPlaneHeight || 0,
              type: state.floorPlaneType || "horizontal",
              inclination:
                state.floorPlaneType === "inclined"
                ? state.floorPlaneInclination || 0
                : 0,
              inclinationDirection:
                state.floorPlaneType === "inclined"
                ? state.floorPlaneInclinationDirection || 0
                : 0,
              name: "Floor Plane " + (state.floorPlanes.length + 1),
            };
            saveState(); // Save state before adding floor plane
            state.floorPlanes.push(newFloorPlane);
          } else {
            // No image - store in world coordinates as before
            var newFloorPlane = {
              id: "floorPlane_" + state.floorPlanes.length,
              p1: { x: minX, y: minY },
              p2: { x: maxX, y: minY },
              p3: { x: maxX, y: maxY },
              p4: { x: minX, y: maxY },
              attenuation: state.floorPlaneAttenuation,
              height: state.floorPlaneHeight || 0,
              type: state.floorPlaneType || "horizontal",
              inclination:
                state.floorPlaneType === "inclined"
                ? state.floorPlaneInclination || 0
                : 0,
              inclinationDirection:
                state.floorPlaneType === "inclined"
                ? state.floorPlaneInclinationDirection || 0
                : 0,
              name: "Floor Plane " + (state.floorPlanes.length + 1),
            };
            state.floorPlanes.push(newFloorPlane);
          }
          renderFloorPlanes();
        }

        state.tempFloorPlane = null;
        state.floorPlaneDragStart = null;
        draw();
        return;
      }

      // Legend dragging is disabled - no check needed

      // If it was a click (not a drag) and an AP was hit, view its pattern and show detail sidebar
      if (state.drag && !state.isDragging) {
        var hit = state.drag;
        // Set viewed state (temporary, shows pattern without full selection)
        state.viewedApId = hit.id;
        // Show detail sidebar but don't set selectedApId or highlight
        state.selectedApForDetail = hit;

        document.getElementById("apDetailSidebar").classList.add("visible");
        renderApDetails();
        state.justOpenedApSidebar = true;
        setTimeout(function () {
          state.justOpenedApSidebar = false;
        }, 100);

        // Update sidebar to highlight and scroll to the viewed antenna
        renderAPs();
        scrollToSelectedAp();
        draw(); // Redraw to show the pattern
        // Stop event propagation to prevent document click handler from closing it
        e.stopPropagation();
      }

      // Handle wall drag completion (both single and multi-wall)
      if (state.wallDrag) {
        // Clear snap points when wall dragging stops
        state.wallSnapPoints = [];
        // Clear drag state, but keep selection (selectedWallIds remains)
        state.wallDrag = null;
        draw();
      }

      // Track antenna position change if an antenna was dragged
      if (state.drag && state.dragStartWorld && state.isDragging) {
        // Check if this is an antenna (has id starting with 'ANT' or is in aps array)
        var isAntenna = false;
        for (var i = 0; i < state.aps.length; i++) {
          if (state.aps[i].id === state.drag.id) {
            isAntenna = true;
            // Check if position actually changed
            var oldX = state.dragStartWorld.x;
            var oldY = state.dragStartWorld.y;
            var newX = state.drag.x;
            var newY = state.drag.y;
            var threshold = 0.01; // 1cm threshold to avoid logging tiny movements
            if (
              Math.abs(oldX - newX) > threshold ||
              Math.abs(oldY - newY) > threshold
            ) {
              logAntennaPositionChange(
                state.drag.id,
                state.drag.id,
                oldX,
                oldY,
                newX,
                newY
              );
            }
            break;
          }
        }
      }

      // Clear antenna dragging flag and trigger async heatmap update when dragging ends
      if (state.isDraggingAntenna) {
        state.isDraggingAntenna = false;
        // Update the actual antenna position in the array and restore original if needed
        if (state.drag) {
          for (var i = 0; i < state.aps.length; i++) {
            if (state.aps[i].id === state.drag.id) {
              state.aps[i].x = state.drag.x;
              state.aps[i].y = state.drag.y;
              // Clear temporary drag position marker
              if (state.aps[i]._originalDragPos) {
                delete state.aps[i]._originalDragPos;
              }
              // Enqueue antenna after drag ends in 2D/transition mode
              scheduleAntennaEnqueue(state.aps[i]);
              break;
            }
          }
        }
        // Trigger async heatmap update immediately - start with low-res for fast feedback
        state.cachedHeatmap = null; // Invalidate cache
        // Use setTimeout with 0 delay to ensure it runs after current execution
        // Start with low-res for immediate visual feedback, then refine
        setTimeout(function () {
          generateHeatmapAsync(null, true); // true = use low-res first
        }, 0);
      }

      state.drag = null;
      state.mouseDownPos = null;
      state.isDragging = false;
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        // Exit antenna placement mode if active
        if (state.addingAP) {
          exitAntennaPlacementMode();
          return; // Exit early to prevent deselection when exiting placement mode
        }

        // Close left sidebar if open
        if (iconSidebarData) {
          var sidebar = iconSidebarData.sidebar;
          var iconButtons = document.querySelectorAll(".icon-btn");
          if (sidebar && sidebar.classList.contains("expanded")) {
            sidebar.classList.remove("expanded");
            iconButtons.forEach(function (b) {
              b.classList.remove("active");
            });
            iconSidebarData.currentSection = null;
            // Hide all sections
            var sections = document.querySelectorAll(".section-content");
            sections.forEach(function (s) {
              s.classList.remove("active");
            });
            // Restore legend to default position after sidebar collapse (if not manually moved)
            setTimeout(function () {
              constrainLegendPosition(true); // Restore default if not manually moved
            }, 350); // Wait for transition to complete
          }
        }

        // Close right sidebar if open
        var apDetailSidebar = document.getElementById("apDetailSidebar");
        if (apDetailSidebar && apDetailSidebar.classList.contains("visible")) {
          apDetailSidebar.classList.remove("visible");
        }

        // Deselect all selected items
        state.selectedApId = null;
        state.viewedApId = null; // Also clear viewed antenna
        state.highlight = false;
        state.selectedApForDetail = null;
        state.selectedWallId = null;
        state.selectedWallIds = [];
        renderWalls(); // Update sidebar to remove highlight
        renderAPs(); // Update antenna cards to remove highlight

        // Reset scrolling to the very top of the antenna list
        setTimeout(function () {
          var apList = document.getElementById("apList");
          if (apList) {
            // Try scrolling the list element itself
            if (apList.scrollTop !== undefined) {
              apList.scrollTop = 0;
            }
            // Also try scrolling the parent sidebar-content container
            var sidebarContent = apList.closest(".sidebar-content");
            if (sidebarContent && sidebarContent.scrollTop !== undefined) {
              sidebarContent.scrollTop = 0;
            }
            // Fallback to scrollIntoView on first item
            var firstItem = apList.querySelector(".list-item");
            if (firstItem) {
              firstItem.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }
          }
        }, 50); // Wait for renderAPs to complete

        draw();
      }
    });

    if (canvas) canvas.addEventListener("wheel", function (e) {
      if (state.viewMode === "3d" || state.viewModeTransition > 0.5) {
        e.preventDefault();
        var delta = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
        state.cameraZoom = Math.max(
          0.3,
          Math.min(3.0, state.cameraZoom * delta)
        );
        draw();
      }
    });

    // Prevent context menu on right click when in 3D mode or when rotating
    if (canvas) canvas.addEventListener("contextmenu", function (e) {
      if (
        state.viewMode === "3d" ||
        state.viewModeTransition > 0.5 ||
        state.isRotating3D
      ) {
        e.preventDefault();
      }
    });

    // Also prevent context menu on Three.js canvas in 3D mode
    if (state.threeCanvas) {
      state.threeCanvas.addEventListener("contextmenu", function (e) {
        if (
          state.viewMode === "3d" ||
          state.viewModeTransition > 0.5 ||
          state.isRotating3D
        ) {
          e.preventDefault();
        }
      });
    }

    window.addEventListener("resize", function () {
      draw();
      // Constrain legend position when window resizes
      constrainLegendPosition();
    });


    // AI ADD: Ensure canvas renders once all resources (CSS, images) are loaded
    window.addEventListener("load", function () {
      draw();
    });

    // Store default legend position (kept for compatibility; actual positioning is CSS-driven)

    window.addEventListener("mousemove", function (e) {
      // Handle AP tooltip (only if not in drawing mode)
      if (
        state.showTooltip &&
        !state.addingWall &&
        !state.addingAP &&
        !state.isCalibrating
      ) {
        var tooltip = document.getElementById("apTooltip");
        var canvas = document.getElementById("plot");
        if (tooltip && canvas) {
          var canvasRect = canvas.getBoundingClientRect();
          // Get exact cursor tip position relative to viewport
          var cursorX = e.clientX;
          var cursorY = e.clientY;

          // Check if cursor tip is over canvas
          if (
            cursorX >= canvasRect.left &&
            cursorX <= canvasRect.right &&
            cursorY >= canvasRect.top &&
            cursorY <= canvasRect.bottom
          ) {
            // Get pixel coordinates of cursor tip relative to canvas
            var pixelX = cursorX - canvasRect.left;
            var pixelY = cursorY - canvasRect.top;

            // Convert cursor tip pixel coordinates to world coordinates
            var worldX = invx(pixelX);
            var worldY = invy(pixelY);

            var csvValue = null;
            // YOUSEF COMMENT CSV
            // if (
            //   state.csvCoverageData &&
            //   state.csvCoverageGrid &&
            //   state.view === "rssi"
            // ) {
            //   csvValue = interpolateRsrpFromCsv(worldX, worldY);
            // }

            var best = (typeof bestApAt === 'function' ? bestApAt : RadioCalculations.bestApAt)(worldX, worldY);

            // Show tooltip if we have CSV data or an AP
            if (csvValue !== null || (best && best.ap)) {
              var value, unit, modeName, tooltipText;

              // If CSV coverage data is available, use it
              if (csvValue !== null) {
                value = csvValue;
                unit = "dBm";
                modeName = "RSRP";
                tooltipText =
                  "Coverage Map\n" +
                  modeName +
                  ": " +
                  value.toFixed(1) +
                  " " +
                  unit;
              } else if (best && best.ap) {
                // Calculate value based on current view mode
                if (state.view === "rssi") {
                  value = best.rssiDbm;
                  unit = "dBm";
                  modeName = "RSSI";
                } else if (state.view === "snr") {
                  value = best.rssiDbm - state.noise;
                  unit = "dB";
                  modeName = "SNR";
                } else if (state.view === "cci") {
                  // Count interfering antennas (power > -85, same channel as best server)
                  value = countInterferingAntennas(worldX, worldY, best.ap);
                  unit = "";
                  modeName = "CCI Count";
                } else if (state.view === "thr") {
                  var Idbm2 = cciAt(worldX, worldY, best.ap);
                  var sinr = sinrAt(best.rssiDbm, Idbm2);
                  value = throughputFromSinr(sinr);
                  unit = "Mbps";
                  modeName = "Throughput";
                } else if (state.view === "best") {
                  value = null;
                  unit = "";
                  modeName = "Best Server";
                } else if (state.view === "servch") {
                  value = best.ap.ch || "N/A";
                  unit = "";
                  modeName = "Serving Channel";
                } else {
                  value = best.rssiDbm;
                  unit = "dBm";
                  modeName = "RSSI";
                }

                // Build tooltip text
                tooltipText = "Antenna: " + best.ap.id;
                if (value !== null) {
                  if (state.view === "servch") {
                    tooltipText += "\n" + modeName + ": " + value;
                  } else if (state.view === "cci") {
                    // CCI count is an integer, no decimal places
                    tooltipText += "\n" + modeName + ": " + Math.round(value) + (unit ? " " + unit : "");
                  } else {
                    tooltipText +=
                      "\n" + modeName + ": " + value.toFixed(1) + " " + unit;
                  }
                } else {
                  tooltipText += "\n" + modeName;
                }
              }

              tooltip.textContent = tooltipText;

              // Position tooltip at the tip of the pointer
              // cursorY is top of cursor, cursor tip is at bottom (~18px below for standard cursor)
              var cursorTipY = cursorY - 25; // Cursor tip position

              // Show tooltip first to get dimensions
              tooltip.style.display = "block";
              var tooltipWidth = tooltip.offsetWidth;
              var tooltipHeight = tooltip.offsetHeight;

              // Position tooltip at cursor tip with small offset to avoid covering cursor
              tooltip.style.left = cursorX - 280 + "px"; // 10px offset to the right of cursor tip
              tooltip.style.top = cursorTipY - 37 + "px"; // 10px offset below cursor tip
              tooltip.style.transform = "none"; // No transform needed
              tooltip.classList.add("visible");
            } else {
              tooltip.classList.remove("visible");
            }
          } else {
            tooltip.classList.remove("visible");
          }
        }
      } else if (state.showTooltip) {
        // Hide tooltip if in drawing mode
        var tooltip = document.getElementById("apTooltip");
        if (tooltip) {
          tooltip.classList.remove("visible");
        }
      }

      // Legend dragging disabled - legend is fixed in bottom-left corner
    });

    window.addEventListener("keydown", function (e) {
      // Check if Delete or Backspace key is pressed
      // Support both modern e.key and legacy keyCode for better browser compatibility
      var isDeleteKey =
        e.key === "Delete" ||
        e.key === "Backspace" ||
        e.keyCode === 46 || // Delete key
        e.keyCode === 8;    // Backspace key

      if (
        isDeleteKey &&
        !state.addingWall &&
        !state.addingAP &&
        !state.addingFloorPlane
      ) {
        // Don't delete if user is editing an input field
        var activeElement = document.activeElement;
        if (
          activeElement &&
          (activeElement.tagName === "INPUT" ||
           activeElement.tagName === "TEXTAREA")
        ) {
          // User is editing a text field, allow normal backspace behavior
          return;
        }

        // Prevent default behavior (e.g., browser back navigation)
        e.preventDefault();

        // Check if there's anything to delete
        // Check for selectedApId (from select button) or viewedApId (from canvas click, not drag)
        var antennaToDelete = null;
        if (state.selectedApId) {
          antennaToDelete = state.selectedApId;
        } else if (state.viewedApId && !state.isDraggingAntenna) {
          // Antenna is selected via canvas click (not being dragged)
          antennaToDelete = state.viewedApId;
        }

        var hasSelection =
          antennaToDelete !== null ||
          state.selectedWallIds.length > 0 ||
          state.selectedWallId !== null;

        if (!hasSelection) return;

        // Save state BEFORE deletion for undo
        saveState();

        var deleted = false;

        // Delete selected antenna (either from select button or canvas click, not while dragging)
        if (antennaToDelete) {
          for (var i = 0; i < state.aps.length; i++) {
            if (state.aps[i].id === antennaToDelete) {
              state.aps.splice(i, 1);
              state.selectedApId = null;
              state.viewedApId = null; // Clear viewed state
              state.highlight = false;
              state.selectedApForDetail = null;
              state.drag = null; // Clear drag state
              state.isDraggingAntenna = false; // Clear dragging flag
              var apDetailSidebar = document.getElementById("apDetailSidebar");
              if (apDetailSidebar)
                apDetailSidebar.classList.remove("visible");

              // Cancel any pending heatmap updates and invalidate cache IMMEDIATELY
              // This prevents the old cached heatmap from being rendered even for a single frame
              if (state.heatmapUpdateRequestId !== null) {
                cancelAnimationFrame(state.heatmapUpdateRequestId);
                state.heatmapUpdateRequestId = null;
              }
              // Clear cache BEFORE any draw() calls to prevent flash
              state.cachedHeatmap = null;
              state.cachedHeatmapAntennaCount = 0;
              state.heatmapUpdatePending = true; // Set to true to prevent using any stale cache
              state.heatmapWorkerCallback = null; // Clear any pending worker callback

              deleted = true;
              break;
            }
          }
        }

        // Delete selected walls
        if (state.selectedWallIds.length > 0) {
          // Delete walls in reverse order to maintain correct indices
          for (var i = state.walls.length - 1; i >= 0; i--) {
            if (state.selectedWallIds.indexOf(state.walls[i].id) !== -1) {
              state.walls.splice(i, 1);
              deleted = true;
            }
          }
          state.selectedWallIds = [];
          state.selectedWallId = null;
          state.wallDrag = null;
        } else if (state.selectedWallId) {
          // Handle single wall selection (backward compatibility)
          for (var i = 0; i < state.walls.length; i++) {
            if (state.walls[i].id === state.selectedWallId) {
              state.walls.splice(i, 1);
              state.selectedWallId = null;
              state.wallDrag = null;
              deleted = true;
              break;
            }
          }
        }

        if (deleted) {
          renderAPs();
          renderWalls();

          // Start heatmap regeneration BEFORE draw() to minimize delay
          if (state.showVisualization) {
            generateHeatmapAsync(null, true); // Start with low-res for fast update
          }

          // Draw after starting regeneration - validation will prevent using stale cache
          draw();
        }
        return;
      }

      // Check if ESC key is pressed (keyCode 27 or key === 'Escape')
      if ((e.keyCode === 27 || e.key === "Escape") && state.addingWall) {
        // Finish or cancel wall drawing
        var isDoorWindow =
          state.selectedElementType === "door" ||
          state.selectedElementType === "doubleDoor" ||
          state.selectedElementType === "window";

        if (isDoorWindow) {
          // Doors/windows: just cancel (they finish on second click)
          state.temp = null;
          state.wallSnapPoints = [];
        } else if (
          state.temp &&
          state.temp.points &&
          state.temp.points.length >= 2
        ) {
          // Finish polyline if there are at least 2 points
          finishWallPolyline();
        } else {
          // Cancel drawing
          state.temp = null;
          state.wallSnapPoints = [];
        }
        state.addingWall = false;
        // Update button appearance
        var addBtn = document.getElementById("addWall");
        if (addBtn) {
          addBtn.className = addBtn.className.replace(" toggled", "");
          addBtn.textContent = getAddButtonText(false);
        }
        draw();
      } else if ((e.keyCode === 27 || e.key === "Escape") && state.addingAP) {
        // Terminate antenna placement
        state.addingAP = false;
        // Update button appearance
        var addAPBtn = document.getElementById("addAP");
        if (addAPBtn) {
          addAPBtn.className = addAPBtn.className.replace(" toggled", "");
          if (typeof setAddAPBtnText === "function") setAddAPBtnText("Place Antenna Manually");
          else { var lbl = addAPBtn.querySelector("#addAPBtnLabel"); if (lbl) lbl.textContent = "Place Antenna Manually"; else addAPBtn.textContent = "Place Antenna Manually"; }
        }
        draw();
      } else if (
        (e.keyCode === 27 || e.key === "Escape") &&
        state.addingFloorPlane
      ) {
        // Terminate floor plane drawing
        state.addingFloorPlane = false;
        state.tempFloorPlane = null;
        state.floorPlaneDragStart = null;
        // Update button appearance
        var addFloorPlaneBtn = document.getElementById("addFloorPlane");
        if (addFloorPlaneBtn) {
          addFloorPlaneBtn.className = addFloorPlaneBtn.className.replace(
            " toggled",
            ""
          );
          if (typeof setAddFloorPlaneBtnText === "function") setAddFloorPlaneBtnText("Add Floor Plane");
          else { var lbl = addFloorPlaneBtn.querySelector("#addFloorPlaneBtnLabel"); if (lbl) lbl.textContent = "Add Floor Plane"; else addFloorPlaneBtn.textContent = "Add Floor Plane"; }
        }
        draw();
      } else if (
        (e.keyCode === 27 || e.key === "Escape") &&
        state.isCalibrating
      ) {
        // Cancel calibration line drawing (clear temp, but keep calibration mode active)
        state.tempCalibration = null;
        state.tempCalibrationPixels = null;
        // Also clear the final calibration line if it exists
        state.calibrationLine = null;
        state.calibrationPixels = null;
        draw();
      } else if (
        (e.keyCode === 27 || e.key === "Escape") &&
        state.selectedApId
      ) {
        // Deselect selected antenna
        state.selectedApId = null;
        state.viewedApId = null; // Also clear viewed antenna
        state.highlight = false;
        state.selectedApForDetail = null;
        var apDetailSidebar = document.getElementById("apDetailSidebar");
        if (apDetailSidebar) apDetailSidebar.classList.remove("visible");
        renderAPs(); // Update button states

        // Reset scrolling to the very top of the antenna list
        setTimeout(function () {
          var apList = document.getElementById("apList");
          if (apList) {
            // Try scrolling the list element itself
            if (apList.scrollTop !== undefined) {
              apList.scrollTop = 0;
            }
            // Also try scrolling the parent sidebar-content container
            var sidebarContent = apList.closest(".sidebar-content");
            if (sidebarContent && sidebarContent.scrollTop !== undefined) {
              sidebarContent.scrollTop = 0;
            }
            // Fallback to scrollIntoView on first item
            var firstItem = apList.querySelector(".list-item");
            if (firstItem) {
              firstItem.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }
          }
        }, 50); // Wait for renderAPs to complete

        draw();
      } else if (
        (e.keyCode === 27 || e.key === "Escape") &&
        (state.selectedWallId || state.selectedWallIds.length > 0)
      ) {
        // Deselect all walls
        state.selectedWallId = null;
        state.selectedWallIds = [];
        state.wallDrag = null;
        renderWalls();
        draw();
      }
    });

  }); // end DOMContentLoaded

})(); // <--- These parentheses () execute the function immediately
