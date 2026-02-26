// FloorPlaneManager.js
// Handles floor plane-related UI events and logic

var FloorPlaneManager = (function () {
  function init() {
    // Function to update visibility of inclination controls based on plane type
    window.updateFloorPlaneTypeVisibility = function() {
      if (state.floorPlaneType === "inclined") {
        document.getElementById("floorPlaneInclinationContainer").style.display = "block";
        document.getElementById("floorPlaneInclinationDirectionContainer").style.display = "block";
      } else {
        document.getElementById("floorPlaneInclinationContainer").style.display = "none";
        document.getElementById("floorPlaneInclinationDirectionContainer").style.display = "none";
      }
    };

    // Handle floor plane type change
    var floorPlaneTypeSelect = document.getElementById("floorPlaneType");
    if (floorPlaneTypeSelect) {
      floorPlaneTypeSelect.addEventListener("change", function () {
        state.floorPlaneType = document.getElementById("floorPlaneType").value;
        updateFloorPlaneTypeVisibility();
      });
    }

    // Handle floor plane height input
    var floorPlaneHeightInput = document.getElementById("floorPlaneHeight");
    if (floorPlaneHeightInput) {
      floorPlaneHeightInput.addEventListener("input", function () {
        var val = document.getElementById("floorPlaneHeight").value.trim();
        if (val === "" || val === "-") {
          // Allow empty during editing, set to 0 in model for calculations
          state.floorPlaneHeight = 0;
        } else {
          var numVal = +val;
          if (!isNaN(numVal)) {
            state.floorPlaneHeight = numVal;
          }
        }
      });
      floorPlaneHeightInput.addEventListener("blur", function () {
        var val = document.getElementById("floorPlaneHeight").value.trim();
        if (val === "" || val === "-") {
          state.floorPlaneHeight = 0;
          document.getElementById("floorPlaneHeight").value = "0";
        }
      });
    }

    // Handle floor plane inclination input
    var floorPlaneInclinationInput = document.getElementById("floorPlaneInclination");
    if (floorPlaneInclinationInput) {
      floorPlaneInclinationInput.addEventListener("input", function () {
        var val = document.getElementById("floorPlaneInclination").value.trim();
        if (val === "" || val === "-") {
          // Allow empty during editing, set to 0 in model for calculations
          state.floorPlaneInclination = 0;
        } else {
          var numVal = +val;
          if (!isNaN(numVal)) {
            state.floorPlaneInclination = numVal;
          }
        }
      });
      floorPlaneInclinationInput.addEventListener("blur", function () {
        var val = document.getElementById("floorPlaneInclination").value.trim();
        if (val === "" || val === "-") {
          state.floorPlaneInclination = 0;
          document.getElementById("floorPlaneInclination").value = "0";
        }
      });
    }

    // Handle floor plane inclination direction input
    var floorPlaneInclinationDirectionInput = document.getElementById("floorPlaneInclinationDirection");
    if (floorPlaneInclinationDirectionInput) {
      floorPlaneInclinationDirectionInput.addEventListener("input", function () {
        var val = document.getElementById("floorPlaneInclinationDirection").value.trim();
        if (val === "" || val === "-") {
          // Allow empty during editing, set to 0 in model for calculations
          state.floorPlaneInclinationDirection = 0;
        } else {
          var numVal = +val;
          if (!isNaN(numVal)) {
            state.floorPlaneInclinationDirection = numVal;
          }
        }
      });
      floorPlaneInclinationDirectionInput.addEventListener("blur", function () {
        var val = document.getElementById("floorPlaneInclinationDirection").value.trim();
        if (val === "" || val === "-") {
          state.floorPlaneInclinationDirection = 0;
          document.getElementById("floorPlaneInclinationDirection").value = "0";
        }
      });
    }

    // Handle floor plane attenuation input
    var floorPlaneAttenuationInput = document.getElementById("floorPlaneAttenuation");
    if (floorPlaneAttenuationInput) {
      floorPlaneAttenuationInput.addEventListener("input", function () {
        var val = document.getElementById("floorPlaneAttenuation").value.trim();
        if (val === "" || val === "-") {
          // Allow empty during editing, set to 0 in model for calculations
          state.floorPlaneAttenuation = 0;
        } else {
          var numVal = +val;
          if (!isNaN(numVal)) {
            state.floorPlaneAttenuation = numVal;
          }
        }
      });
      floorPlaneAttenuationInput.addEventListener("blur", function () {
        var val = document.getElementById("floorPlaneAttenuation").value.trim();
        if (val === "" || val === "-") {
          state.floorPlaneAttenuation = 0;
          document.getElementById("floorPlaneAttenuation").value = "0";
        }
      });
    }
  }

  return {
    init: init
  };
})();
