// WallManager.js
// Handles wall-related UI events and logic

var WallManager = (function () {
  function init() {
    // Count how many walls of a specific type exist
    window.countWallsByType = function(wallType) {
      var count = 0;
      for (var i = 0; i < state.walls.length; i++) {
        if (state.walls[i].type === wallType) {
          count++;
        }
      }
      return count;
    };

    // Generate wall name based on type
    window.generateWallName = function(wallType) {
      var typeInfo = wallTypes[wallType];
      var typeName = typeInfo ? typeInfo.name : "Wall";
      var count = countWallsByType(wallType);
      return typeName + "_" + (count + 1);
    };

    var addWallBtn = document.getElementById("addWall");
    if (addWallBtn) {
      addWallBtn.addEventListener("click", function () {
        // Validation: Prevent adding if no element is selected
        // The user must visually select an element type (icon) first
        if (!state.selectedElementType) {
          NotificationSystem.info("Please select an element type from the list first.");
          return;
        }

        // Handle floorPlane separately
        if (state.selectedElementType === "floorPlane") {
          state.addingFloorPlane = !state.addingFloorPlane;
          var addBtn = document.getElementById("addWall");
          if (state.addingFloorPlane) {
            state.addingAP = false;
            state.addingWall = false;
            state.isCalibrating = false;
            addBtn.textContent = getAddButtonText(true);
            setAddAPBtnText("Place Antenna Manually");

            // Collapse sidebar
            var sidebar = document.getElementById("mainSidebar");
            if (sidebar && sidebar.classList.contains("expanded")) {
              sidebar.classList.remove("expanded");
              var iconButtons = document.querySelectorAll(".icon-btn");
              iconButtons.forEach(function (b) {
                b.classList.remove("active");
              });
              if (window.iconSidebarData) {
                window.iconSidebarData.currentSection = null;
              }
              // Restore legend to default position after sidebar collapse
              setTimeout(function () {
                if (typeof constrainLegendPosition === "function") {
                  constrainLegendPosition(true);
                }
              }, 350);
            }
          } else {
            addBtn.textContent = getAddButtonText(false);
          }
          if (!state.addingFloorPlane) state.tempFloorPlane = null;
          draw();
          return;
        }

        // Handle other element types (wall, door, window, etc.)
        state.addingWall = !state.addingWall;
        var addBtn = document.getElementById("addWall");
        if (state.addingWall) {
          state.addingAP = false;
          state.addingFloorPlane = false;
          state.isCalibrating = false;
          addBtn.textContent = getAddButtonText(true);
          setAddAPBtnText("Place Antenna Manually");

          // Collapse sidebar
          var sidebar = document.getElementById("mainSidebar");
          if (sidebar && sidebar.classList.contains("expanded")) {
            sidebar.classList.remove("expanded");
            var iconButtons = document.querySelectorAll(".icon-btn");
            iconButtons.forEach(function (b) {
              b.classList.remove("active");
            });
            if (window.iconSidebarData) {
              window.iconSidebarData.currentSection = null;
            }
            // Restore legend to default position after sidebar collapse
            setTimeout(function () {
              if (typeof constrainLegendPosition === "function") {
                constrainLegendPosition(true);
              }
            }, 350);
          }
        } else {
          addBtn.textContent = getAddButtonText(false);
        }
        if (!state.addingWall) state.temp = null;
        draw();
      });
    }

    var elementTypeSelect = document.getElementById("elementType");
    if (elementTypeSelect) {
      elementTypeSelect.addEventListener("change", function () {
        state.selectedElementType = document.getElementById("elementType").value;
        // Show wall type dropdown only when wall is selected
        if (state.selectedElementType === "wall") {
          document.getElementById("wallTypeContainer").style.display = "block";
          document.getElementById("floorPlaneAttenuationContainer").style.display = "none";
          document.getElementById("floorPlaneHeightContainer").style.display = "none";
          document.getElementById("floorPlaneTypeContainer").style.display = "none";
          document.getElementById("floorPlaneInclinationContainer").style.display = "none";
          document.getElementById("floorPlaneInclinationDirectionContainer").style.display = "none";
        } else if (state.selectedElementType === "floorPlane") {
          document.getElementById("wallTypeContainer").style.display = "none";
          document.getElementById("customWallInput").style.display = "none";
          document.getElementById("floorPlaneAttenuationContainer").style.display = "block";
          document.getElementById("floorPlaneHeightContainer").style.display = "block";
          document.getElementById("floorPlaneTypeContainer").style.display = "block";
          if (typeof updateFloorPlaneTypeVisibility === "function") {
            updateFloorPlaneTypeVisibility();
          }
        } else {
          document.getElementById("wallTypeContainer").style.display = "none";
          document.getElementById("customWallInput").style.display = "none";
          document.getElementById("floorPlaneAttenuationContainer").style.display = "none";
          document.getElementById("floorPlaneHeightContainer").style.display = "none";
          document.getElementById("floorPlaneTypeContainer").style.display = "none";
          document.getElementById("floorPlaneInclinationContainer").style.display = "none";
          document.getElementById("floorPlaneInclinationDirectionContainer").style.display = "none";
        }
        var addBtn = document.getElementById("addWall");
        if (addBtn) {
          if (state.selectedElementType) {
            addBtn.style.display = "";
            if (!state.addingWall && !state.addingFloorPlane) {
              addBtn.textContent = getAddButtonText(false);
            }
          } else {
            addBtn.style.display = "none";
          }
        }
      });
    }

    var wallTypeSelect = document.getElementById("wallType");
    if (wallTypeSelect) {
      wallTypeSelect.addEventListener("change", function () {
        state.selectedWallType = document.getElementById("wallType").value;
        if (state.selectedWallType === "custom") {
          document.getElementById("customWallInput").style.display = "block";
        } else {
          document.getElementById("customWallInput").style.display = "none";
        }
      });
    }

    var customWallLossInput = document.getElementById("customWallLoss");
    if (customWallLossInput) {
      customWallLossInput.addEventListener("input", function () {
        var val = document.getElementById("customWallLoss").value.trim();
        if (val === "" || val === "-") {
          // Allow empty during editing, set to 0 in model for calculations
          state.customWallLoss = 0;
        } else {
          var numVal = +val;
          if (!isNaN(numVal)) {
            state.customWallLoss = numVal;
          }
        }
      });
      customWallLossInput.addEventListener("blur", function () {
        var val = document.getElementById("customWallLoss").value.trim();
        if (val === "" || val === "-") {
          state.customWallLoss = 0;
          document.getElementById("customWallLoss").value = "0";
        }
      });
    }

    // Walls Help Modal handlers
    var wallsHelpIcon = document.getElementById("wallsHelpIcon");
    if (wallsHelpIcon) {
      wallsHelpIcon.addEventListener("click", function (e) {
        e.stopPropagation();
        var modal = document.getElementById("wallsHelpModal");
        var icon = document.getElementById("wallsHelpIcon");
        if (modal && icon) {
          // Toggle: if modal is already open, close it
          if (modal.style.display === "block") {
            modal.style.display = "none";
            return;
          }

          // Otherwise, open it
          // Get icon position
          var iconRect = icon.getBoundingClientRect();
          // Position modal below the icon
          modal.style.display = "block";
          modal.style.top = iconRect.bottom + 8 + "px";
          modal.style.left = iconRect.left + "px";
          // Adjust if modal would go off screen
          var modalContent = modal.querySelector(".help-modal-content");
          if (modalContent) {
            var modalWidth = modalContent.offsetWidth || 320;
            if (iconRect.left + modalWidth > window.innerWidth) {
              modal.style.left = window.innerWidth - modalWidth - 10 + "px";
            }
            if (iconRect.left < 0) {
              modal.style.left = "10px";
            }
          }
        }
      });
    }

    var closeWallsHelpBtn = document.getElementById("closeWallsHelp");
    if (closeWallsHelpBtn) {
      closeWallsHelpBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var modal = document.getElementById("wallsHelpModal");
        if (modal) {
          modal.style.display = "none";
        }
      });
    }

    // Close help modal when clicking anywhere outside of it
    window.closeWallsHelpModal = function(e) {
      var modal = document.getElementById("wallsHelpModal");
      var icon = document.getElementById("wallsHelpIcon");
      if (!modal || modal.style.display !== "block") return;

      var modalContent = modal.querySelector(".help-modal-content");
      var iconSidebar = document.querySelector(".icon-sidebar");

      // Check what was clicked - traverse up the DOM tree
      var clickedElement = e.target;
      var isClickInModal = false;
      var isClickOnHelpIcon = false;

      while (clickedElement && clickedElement !== document.body) {
        // Check if inside modal
        if (modalContent && modalContent.contains(clickedElement)) {
          isClickInModal = true;
          break;
        }
        // Check if on help icon
        if (
          clickedElement === icon ||
          (icon && icon.contains(clickedElement))
        ) {
          isClickOnHelpIcon = true;
          break;
        }
        clickedElement = clickedElement.parentElement;
      }

      // Check if click is on sidebar icon button or inside icon sidebar
      var isClickOnSidebarIcon = false;
      if (iconSidebar) {
        clickedElement = e.target;
        while (clickedElement && clickedElement !== document.body) {
          if (
            clickedElement.classList &&
            clickedElement.classList.contains("icon-btn")
          ) {
            isClickOnSidebarIcon = true;
            break;
          }
          if (clickedElement === iconSidebar) {
            isClickOnSidebarIcon = true;
            break;
          }
          clickedElement = clickedElement.parentElement;
        }
      }

      // Close if clicking outside modal (including sidebar icons), but not if clicking on the help icon itself
      if (!isClickInModal && !isClickOnHelpIcon) {
        modal.style.display = "none";
      }
    };

    // Add click listener to document
    document.addEventListener("click", window.closeWallsHelpModal);

    // Close modal when clicking outside
    document.addEventListener("click", function (e) {
      var modal = document.getElementById("wallsHelpModal");
      var icon = document.getElementById("wallsHelpIcon");
      if (modal && modal.style.display !== "none") {
        // Check if click is outside modal and icon
        if (!modal.contains(e.target) && !icon.contains(e.target)) {
          modal.style.display = "none";
        }
      }
    });
  }

  // Function to finish door/window as single segment (not polyline)
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
    if (typeof isLineOnWall === 'function' && !isLineOnWall(state.temp.p1, state.temp.p2)) {
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

  // Function to finish polyline and create wall segments
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

  // Expose for canvas interaction
  window.finishDoorWindow = finishDoorWindow;
  window.finishWallPolyline = finishWallPolyline;

  return {
    init: init
  };
})();
