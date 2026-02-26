//
// ContourRenderer.js
// Draws contour lines on the canvas using a marching-squares approach to
// show signal strength zone boundaries (weak/mid and mid/strong thresholds).
//
// All functions are exposed on window for global access.
//
// Depends on: global state, ctx, getValueAt (monolith), mx/my (monolith),
//             colorZone (ColorSystem), hypot (GeometryUtils)
//
// Called by:
//   draw() — renders contour overlay after the heatmap when state.showContours is true
//

(function () {
  "use strict";

  function drawContours() {
    if (
      !state.showContours ||
      state.view === "best" ||
      state.view === "servch"
    )
      return;

    var cols = Math.max(20, Math.floor(state.w / state.res));
    var rows = Math.max(14, Math.floor(state.h / state.res));
    var dx = state.w / cols,
      dy = state.h / rows;

    var range = state.maxVal - state.minVal;
    var weakMidThreshold = state.minVal + range * 0.33;
    var midStrongThreshold = state.minVal + range * 0.67;

    drawContourLine(cols, rows, dx, dy, weakMidThreshold, "#1a1a1a", 4);
    drawContourLine(cols, rows, dx, dy, midStrongThreshold, "#1a1a1a", 4);

    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  }

  function drawContourLine(
    cols,
    rows,
    dx,
    dy,
    threshold,
    color,
    lineWidth
  ) {
    lineWidth = lineWidth || 4;
    var savedStrokeStyle = ctx.strokeStyle;
    var savedLineWidth = ctx.lineWidth;
    var savedLineDash = ctx.getLineDash ? ctx.getLineDash() : [];
    var savedLineCap = ctx.lineCap;
    var savedLineJoin = ctx.lineJoin;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    var fineFactor = 4;
    var fineDx = dx / fineFactor;
    var fineDy = dy / fineFactor;
    var fineCols = cols * fineFactor;
    var fineRows = rows * fineFactor;

    var points = [];
    var i, j;

    for (i = 0; i <= fineRows; i++) {
      var y = i * fineDy;
      for (j = 0; j < fineCols; j++) {
        var x1 = j * fineDx;
        var x2 = (j + 1) * fineDx;
        var val1 = getValueAt(x1, y);
        var val2 = getValueAt(x2, y);

        if (Math.abs(val2 - val1) > 0.001) {
          if (
            (val1 < threshold && val2 >= threshold) ||
            (val1 >= threshold && val2 < threshold)
          ) {
            var t = (threshold - val1) / (val2 - val1);
            if (t >= 0 && t <= 1) {
              var px = x1 + t * (x2 - x1);
              points.push({
                x: px,
                y: y,
                edge: "h",
                idx: i * fineCols + j,
              });
            }
          }
        }
      }
    }

    for (i = 0; i < fineRows; i++) {
      var y1 = i * fineDy;
      var y2 = (i + 1) * fineDy;
      for (j = 0; j <= fineCols; j++) {
        var x = j * fineDx;
        var val1 = getValueAt(x, y1);
        var val2 = getValueAt(x, y2);

        if (Math.abs(val2 - val1) > 0.001) {
          if (
            (val1 < threshold && val2 >= threshold) ||
            (val1 >= threshold && val2 < threshold)
          ) {
            var t = (threshold - val1) / (val2 - val1);
            if (t >= 0 && t <= 1) {
              var py = y1 + t * (y2 - y1);
              points.push({
                x: x,
                y: py,
                edge: "v",
                idx: i * (fineCols + 1) + j,
              });
            }
          }
        }
      }
    }

    if (points.length > 1) {
      var used = [];
      var contours = [];
      var maxConnectionDist = Math.max(dx, dy) * 1.8;

      for (i = 0; i < points.length; i++) {
        if (used[i]) continue;

        var contour = [points[i]];
        used[i] = true;
        var current = points[i];
        var found = true;
        var iterations = 0;
        var maxIterations = points.length;

        while (found && iterations < maxIterations) {
          iterations++;
          found = false;
          var minDist = maxConnectionDist;
          var closestIdx = -1;

          for (j = 0; j < points.length; j++) {
            if (used[j]) continue;
            var dist = hypot(
              points[j].x - current.x,
              points[j].y - current.y
            );
            if (dist < minDist) {
              minDist = dist;
              closestIdx = j;
              found = true;
            }
          }

          if (found) {
            contour.push(points[closestIdx]);
            used[closestIdx] = true;
            current = points[closestIdx];
          }
        }

        if (contour.length > 2) {
          contours.push(contour);
        }
      }

      for (var c = 0; c < contours.length; c++) {
        var contour = contours[c];
        if (contour.length < 2) continue;

        ctx.beginPath();
        ctx.moveTo(mx(contour[0].x), my(contour[0].y));

        for (var p = 1; p < contour.length; p++) {
          if (p === contour.length - 1) {
            ctx.lineTo(mx(contour[p].x), my(contour[p].y));
          } else {
            var midX = (contour[p].x + contour[p + 1].x) / 2;
            var midY = (contour[p].y + contour[p + 1].y) / 2;
            ctx.quadraticCurveTo(
              mx(contour[p].x),
              my(contour[p].y),
              mx(midX),
              my(midY)
            );
          }
        }

        if (contour.length > 3) {
          var first = contour[0];
          var last = contour[contour.length - 1];
          var distToStart = hypot(last.x - first.x, last.y - first.y);
          if (distToStart < maxConnectionDist * 2) {
            ctx.closePath();
          }
        }

        ctx.stroke();
      }
    }

    ctx.strokeStyle = savedStrokeStyle;
    ctx.lineWidth = savedLineWidth;
    ctx.setLineDash(savedLineDash);
    ctx.lineCap = savedLineCap;
    ctx.lineJoin = savedLineJoin;
  }

  window.drawContours = drawContours;
  window.drawContourLine = drawContourLine;
})();
