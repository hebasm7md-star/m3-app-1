// LegendRenderer.js
// Handles updating the legend UI based on the current visualization state

var LegendRenderer = (function () {
  function updateLegendUI(numericLegend) {
    var state = window.state;
    var updateLegendBar = window.updateLegendBar;
    var colorForAP = window.colorForAP;
    var colorForChannel = window.colorForChannel;
    var colorForCount = window.colorForCount;
    var i;

    // legends - only show if visualization is enabled
    if (state.showVisualization) {
      if (numericLegend) {
        updateLegendBar();
        var legendMinEl = document.getElementById("legendMin");
        if (legendMinEl) legendMinEl.textContent = state.minVal;
        var legendMaxEl = document.getElementById("legendMax");
        if (legendMaxEl) legendMaxEl.textContent = state.maxVal;
        var catLegendEl = document.getElementById("catLegend");
        if (catLegendEl) catLegendEl.style.display = "none";
      } else {
        var cat = document.getElementById("catLegend");
        if (!cat) return;
        cat.innerHTML = "";
        cat.style.display = "block";
        if (state.view === "best") {
          // Best server: one color per AP
          for (i = 0; i < state.aps.length; i++) {
            var a = state.aps[i],
              c = colorForAP(a.id);
            var item = document.createElement("div");
            item.className = "legend-item";
            var swatch = document.createElement("div");
            swatch.className = "legend-swatch";
            swatch.style.background =
              "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
            item.appendChild(swatch);
            item.appendChild(
              document.createTextNode(a.id + " (ch " + a.ch + ")")
            );
            cat.appendChild(item);
          }
        } else if (state.view === "servch") {
          // Serving channel: one color per unique channel
          var seen = [],
            j,
            exists;
          for (i = 0; i < state.aps.length; i++) {
            exists = false;
            for (j = 0; j < seen.length; j++) {
              if (seen[j] === state.aps[i].ch) {
                exists = true;
                break;
              }
            }
            if (!exists) seen.push(state.aps[i].ch);
          }
          for (i = 0; i < seen.length; i++) {
            var ch = seen[i],
              c2 = colorForChannel(ch);
            var item2 = document.createElement("div");
            item2.className = "legend-item";
            var swatch2 = document.createElement("div");
            swatch2.className = "legend-swatch";
            swatch2.style.background =
              "rgb(" + c2[0] + "," + c2[1] + "," + c2[2] + ")";
            item2.appendChild(swatch2);
            item2.appendChild(document.createTextNode("Channel " + ch));
            cat.appendChild(item2);
          }
        } else if (state.view === "cci") {
          // CCI: show discrete count buckets with their random-assigned colors
          // Use the current maxVal (which for CCI is the max count) to know how many to show,
          // but cap at a reasonable upper bound for readability.
          var maxCount = Math.max(0, Math.round(state.maxVal || 0));
          var maxLegendCount = Math.min(maxCount, 12); // don't spam the legend too much

          for (i = 0; i <= maxLegendCount; i++) {
            var cnt = i;
            var col = colorForCount(cnt);
            var item3 = document.createElement("div");
            item3.className = "legend-item";
            var swatch3 = document.createElement("div");
            swatch3.className = "legend-swatch";
            swatch3.style.background =
              "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";

            var label;
            if (cnt === 0) {
              label = "0 interferers";
            } else if (cnt === 1) {
              label = "1 interferer";
            } else {
              label = cnt + " interferers";
            }

            item3.appendChild(swatch3);
            item3.appendChild(document.createTextNode(label));
            cat.appendChild(item3);
          }

          // If there are counts above the cap, show a final "N+ interferers" entry
          if (maxCount > maxLegendCount) {
            var extraCnt = maxLegendCount + 1;
            var extraCol = colorForCount(extraCnt);
            var extraItem = document.createElement("div");
            extraItem.className = "legend-item";
            var extraSwatch = document.createElement("div");
            extraSwatch.className = "legend-swatch";
            extraSwatch.style.background =
              "rgb(" + extraCol[0] + "," + extraCol[1] + "," + extraCol[2] + ")";
            extraItem.appendChild(extraSwatch);
            extraItem.appendChild(
              document.createTextNode(extraCnt + "+ interferers")
            );
            cat.appendChild(extraItem);
          }
        }
      }
    } else {
      // Hide legend when visualization is off
      var legendBarEl = document.getElementById("legendBar");
      if (legendBarEl) legendBarEl.style.display = "none";
      var legendMinEl2 = document.getElementById("legendMin");
      if (legendMinEl2) legendMinEl2.style.display = "none";
      var legendMaxEl2 = document.getElementById("legendMax");
      if (legendMaxEl2) legendMaxEl2.style.display = "none";
      var catLegendEl2 = document.getElementById("catLegend");
      if (catLegendEl2) catLegendEl2.style.display = "none";
    }
  }

  return {
    updateLegendUI: updateLegendUI
  };
})();

window.updateLegendUI = LegendRenderer.updateLegendUI;
