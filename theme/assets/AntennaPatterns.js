(function () {
  "use strict";

  function getDefaultAntennaPattern() {
    if (
      state.defaultAntennaPatternIndex >= 0 &&
      state.defaultAntennaPatternIndex < state.antennaPatterns.length
    ) {
      return state.antennaPatterns[state.defaultAntennaPatternIndex];
    }
    return null;
  }

  function deleteAntennaPattern(patternIndex) {
    if (patternIndex < 0 || patternIndex >= state.antennaPatterns.length) {
      return;
    }

    var pattern = state.antennaPatterns[patternIndex];
    var patternName = pattern.name || "Unnamed Pattern";

    var usedByAntennas = [];
    for (var i = 0; i < state.aps.length; i++) {
      if (state.aps[i].antennaPattern === pattern) {
        usedByAntennas.push(state.aps[i].id || ("AP " + (i + 1)));
      }
    }

    var message = "Pattern: " + patternName;
    if (usedByAntennas.length > 0) {
      message += "\nUsed by " + usedByAntennas.length + " antenna(s): " + usedByAntennas.join(", ");
      message += "\nThese antennas will lose their pattern assignment.";
    }

    NotificationSystem.confirm(message, "Delete Pattern", function (confirmed) {
      if (confirmed) {
        for (var i = 0; i < state.aps.length; i++) {
          if (state.aps[i].antennaPattern === pattern) {
            state.aps[i].antennaPattern = null;
            state.aps[i].antennaPatternFileName = null;
          }
        }

        state.antennaPatterns.splice(patternIndex, 1);

        if (state.defaultAntennaPatternIndex === patternIndex) {
          state.defaultAntennaPatternIndex = -1;
        } else if (state.defaultAntennaPatternIndex > patternIndex) {
          state.defaultAntennaPatternIndex--;
        }

        if (state.antennaPatterns.length === 0) {
          state.defaultAntennaPatternIndex = -1;
          for (var i = 0; i < state.aps.length; i++) {
            state.aps[i].antennaPattern = null;
            state.aps[i].antennaPatternFileName = null;
          }
        } else if (state.defaultAntennaPatternIndex === -1 && state.antennaPatterns.length > 0) {
          state.defaultAntennaPatternIndex = 0;
        }

        updateAntennaPatternsList();

        if (state.antennaPatterns.length === 0) {
          for (var j = 0; j < state.aps.length; j++) {
            if (state.aps[j].antennaPattern !== null) {
              state.aps[j].antennaPattern = null;
              state.aps[j].antennaPatternFileName = null;
            }
          }
        }

        if (state.heatmapUpdateRequestId !== null) {
          cancelAnimationFrame(state.heatmapUpdateRequestId);
          state.heatmapUpdateRequestId = null;
        }
        state.heatmapUpdatePending = false;
        state.cachedHeatmap = null;

        if (typeof draw === "function") draw();

        NotificationSystem.success("Pattern deleted successfully!");
      }
    }, {danger: true, confirmLabel: 'Delete', icon: '\u{1F5D1}\u{FE0F}'});
  }

  function updateAntennaPatternsList() {
    var listContainer = document.getElementById("antennaPatternsList");
    var select = document.getElementById("defaultAntennaPatternSelect");

    if (!listContainer || !select) return;

    if (state.antennaPatterns.length === 0) {
      listContainer.style.display = "none";
      return;
    }

    listContainer.style.display = "block";

    select.innerHTML = '<option value="-1">No default pattern</option>';

    for (var i = 0; i < state.antennaPatterns.length; i++) {
      var pattern = state.antennaPatterns[i];
      var option = document.createElement("option");
      option.value = i;
      var displayText = pattern.name || "Unnamed Pattern";
      if (pattern.frequency) {
        displayText += " (" + pattern.frequency + " MHz)";
      }
      if (pattern.gain) {
        displayText += " - " + pattern.gain + " dBi";
      }
      option.textContent = displayText;
      if (i === state.defaultAntennaPatternIndex) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    var deleteButton = document.getElementById("deleteSelectedPattern");
    if (deleteButton) {
      var selectedValue = select.value;
      if (selectedValue !== "-1" && selectedValue !== null && selectedValue !== "") {
        deleteButton.style.display = "flex";
      } else {
        deleteButton.style.display = "none";
      }
    }

    for (var idx = 0; idx < state.aps.length; idx++) {
      var patternSelectId = "patternSelect_" + idx;
      var patternSelect = document.getElementById(patternSelectId);
      if (patternSelect) {
        patternSelect.innerHTML = '<option value="-1">Select from uploaded patterns...</option>';

        for (var j = 0; j < state.antennaPatterns.length; j++) {
          var apPattern = state.antennaPatterns[j];
          var apOption = document.createElement("option");
          apOption.value = j;
          var apDisplayText = apPattern.name || "Unnamed Pattern";
          if (apPattern.frequency) {
            apDisplayText += " (" + apPattern.frequency + " MHz)";
          }
          if (apPattern.gain) {
            apDisplayText += " - " + apPattern.gain + " dBi";
          }
          apOption.textContent = apDisplayText;

          var ap = state.aps[idx];
          if (ap && ap.antennaPattern && ap.antennaPattern === apPattern) {
            apOption.selected = true;
          }
          patternSelect.appendChild(apOption);
        }
      }
    }
  }

  function parseAntennaPattern(fileContent) {
    var lines = fileContent.split("\n");
    var pattern = {
      name: "",
      frequency: 0,
      hWidth: 360,
      gain: 0,
      horizontal: {},
      vertical: {},
    };

    var currentSection = null;
    var hData = [];
    var vData = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith("NAME ")) {
        pattern.name = line.substring(5).trim();
      } else if (line.startsWith("FREQUENCY ")) {
        pattern.frequency = parseFloat(line.substring(10));
      } else if (line.startsWith("H_WIDTH ")) {
        pattern.hWidth = parseFloat(line.substring(8));
      } else if (line.startsWith("GAIN ")) {
        var gainStr = line.substring(5).trim();
        var parsedGain = parseFloat(gainStr);
        if (!isNaN(parsedGain)) {
          pattern.gain = /dBd/i.test(gainStr) ? parsedGain + 2.15 : parsedGain;
        }
      } else if (line.startsWith("HORIZONTAL")) {
        currentSection = "horizontal";
        hData = [];
      } else if (line.startsWith("VERTICAL")) {
        currentSection = "vertical";
        vData = [];
      } else if (currentSection) {
        var parts = line.split(/\s+/);
        if (parts.length >= 2) {
          var angle = parseFloat(parts[0]);
          var value = parseFloat(parts[1]);
          if (!isNaN(angle) && !isNaN(value)) {
            var angleKey = Math.round(angle);
            if (currentSection === "horizontal") {
              pattern.horizontal[angleKey] = value;
              hData.push({ angle: angle, gain: value > 0 ? -value : value });
            } else if (currentSection === "vertical") {
              pattern.vertical[angleKey] = value;
              vData.push({ angle: angle, gain: value > 0 ? -value : value });
            }
          }
        }
      }
    }

    hData.sort(function (a, b) {
      return a.angle - b.angle;
    });
    vData.sort(function (a, b) {
      return a.angle - b.angle;
    });
    pattern.horizontalData = hData;
    pattern.verticalData = vData;

    if (hData.length > 0) {
      pattern._maxValue = pattern.gain;
      pattern._minValue = hData.length > 0 ? Math.min.apply(null, hData.map(function(d) { return d.gain; })) : 0;
      pattern._peakAngle = hData.length > 0 ? hData.reduce(function(a, b) { return b.gain > a.gain ? b : a; }).angle : 0;
      console.log(
        "Pattern parsed:",
        pattern.name,
        "H points:",
        hData.length,
        "Range:",
        pattern._minValue.toFixed(2),
        "to",
        pattern._maxValue.toFixed(2),
        "Peak at angle:",
        pattern._peakAngle,
        "Peak gain:",
        pattern.gain
      );
    }

    return pattern;
  }

  window.getDefaultAntennaPattern = getDefaultAntennaPattern;
  window.deleteAntennaPattern = deleteAntennaPattern;
  window.updateAntennaPatternsList = updateAntennaPatternsList;
  window.parseAntennaPattern = parseAntennaPattern;
})();