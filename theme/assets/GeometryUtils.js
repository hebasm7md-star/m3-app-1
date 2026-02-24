(function () {
  "use strict";

  /* ── Math helpers (used across multiple modules) ── */

  function clamp01(t) {
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  function log10(x) {
    return Math.log(x) / Math.log(10);
  }

  function dbmToLin(dBm) {
    return Math.pow(10, dBm / 10);
  }

  function linToDbm(lin) {
    return 10 * log10(Math.max(lin, 1e-12));
  }

  function hypot(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  function orient(p, q, r) {
    return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  }

  function onSeg(p, q, r) {
    return (
      Math.min(p.x, r.x) <= q.x &&
      q.x <= Math.max(p.x, r.x) &&
      Math.min(p.y, r.y) <= q.y &&
      q.y <= Math.max(p.y, r.y)
    );
  }

  function inter(a1, a2, b1, b2) {
    var o1 = orient(a1, a2, b1),
      o2 = orient(a1, a2, b2),
      o3 = orient(b1, b2, a1),
      o4 = orient(b1, b2, a2);
    if (
      (o1 === 0 && onSeg(a1, b1, a2)) ||
      (o2 === 0 && onSeg(a1, b2, a2)) ||
      (o3 === 0 && onSeg(b1, a1, b2)) ||
      (o4 === 0 && onSeg(b1, a2, b2))
    )
      return true;
    return o1 > 0 !== o2 > 0 && o3 > 0 !== o4 > 0;
  }

  function lineIntersection(a1, a2, b1, b2) {
    var x1 = a1.x,
      y1 = a1.y;
    var x2 = a2.x,
      y2 = a2.y;
    var x3 = b1.x,
      y3 = b1.y;
    var x4 = b2.x,
      y4 = b2.y;

    var denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null;

    var t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    var u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1),
      };
    }
    return null;
  }

  function snapWallPoint(p, startPoint) {
    if (!state.snapToGrid) return p;

    var snapped = { x: p.x, y: p.y };
    var snapDistance = state.snapThreshold;
    var snappedTo = null;

    if (startPoint) {
      var dx = Math.abs(p.x - startPoint.x);
      var dy = Math.abs(p.y - startPoint.y);

      if (dx > dy && dx > snapDistance) {
        snapped.y = startPoint.y;
        snappedTo = "horizontal";
      } else if (dy > dx && dy > snapDistance) {
        snapped.x = startPoint.x;
        snappedTo = "vertical";
      }
    }

    var minDist = snapDistance;
    var closestPoint = null;

    for (var i = 0; i < state.walls.length; i++) {
      var w = state.walls[i];

      var wallPoints = [];
      var wallSegments = [];
      if (w.points && w.points.length >= 2) {
        wallPoints = w.points;
        for (var j = 0; j < w.points.length - 1; j++) {
          wallSegments.push({ p1: w.points[j], p2: w.points[j + 1] });
        }
      } else if (w.p1 && w.p2) {
        wallPoints = [w.p1, w.p2];
        wallSegments.push({ p1: w.p1, p2: w.p2 });
      } else {
        continue;
      }

      for (var j = 0; j < wallPoints.length; j++) {
        var wp = wallPoints[j];
        var dist = hypot(p.x - wp.x, p.y - wp.y);
        if (dist < minDist) {
          minDist = dist;
          closestPoint = wp;
        }
      }

      if (startPoint) {
        for (var j = 0; j < wallSegments.length; j++) {
          var seg = wallSegments[j];
          var intersection = lineIntersection(
            startPoint,
            p,
            seg.p1,
            seg.p2
          );
          if (intersection) {
            var dist = hypot(p.x - intersection.x, p.y - intersection.y);
            if (dist < minDist) {
              minDist = dist;
              closestPoint = intersection;
            }
          }
        }
      }
    }

    if (startPoint) {
      for (var i = 0; i < state.walls.length; i++) {
        var w1 = state.walls[i];
        var segs1 = [];
        if (w1.points && w1.points.length >= 2) {
          for (var k = 0; k < w1.points.length - 1; k++) {
            segs1.push({ p1: w1.points[k], p2: w1.points[k + 1] });
          }
        } else if (w1.p1 && w1.p2) {
          segs1.push({ p1: w1.p1, p2: w1.p2 });
        }

        for (var j = i + 1; j < state.walls.length; j++) {
          var w2 = state.walls[j];
          var segs2 = [];
          if (w2.points && w2.points.length >= 2) {
            for (var k = 0; k < w2.points.length - 1; k++) {
              segs2.push({ p1: w2.points[k], p2: w2.points[k + 1] });
            }
          } else if (w2.p1 && w2.p2) {
            segs2.push({ p1: w2.p1, p2: w2.p2 });
          }

          for (var s1 = 0; s1 < segs1.length; s1++) {
            for (var s2 = 0; s2 < segs2.length; s2++) {
              var intersection = lineIntersection(
                segs1[s1].p1,
                segs1[s1].p2,
                segs2[s2].p1,
                segs2[s2].p2
              );
              if (intersection) {
                var dist = hypot(
                  p.x - intersection.x,
                  p.y - intersection.y
                );
                if (dist < minDist) {
                  minDist = dist;
                  closestPoint = intersection;
                }
              }
            }
          }
        }
      }
    }

    if (closestPoint) {
      snapped = { x: closestPoint.x, y: closestPoint.y };
      state.wallSnapPoints = [closestPoint];
    } else {
      state.wallSnapPoints = [];
    }

    return snapped;
  }

  function pointToLineDistance(px, py, lx1, ly1, dirX, dirY, len) {
    var dx = px - lx1;
    var dy = py - ly1;
    var proj = dx * dirX + dy * dirY;
    proj = Math.max(0, Math.min(len, proj));
    var projX = lx1 + dirX * proj;
    var projY = ly1 + dirY * proj;
    return Math.sqrt(
      (px - projX) * (px - projX) + (py - projY) * (py - projY)
    );
  }

  function lineIntersectsWallWithThickness(
    lineStart,
    lineEnd,
    wallStart,
    wallEnd,
    thickness
  ) {
    if (inter(lineStart, lineEnd, wallStart, wallEnd)) {
      return true;
    }

    var wallDx = wallEnd.x - wallStart.x;
    var wallDy = wallEnd.y - wallStart.y;
    var wallLen = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
    if (wallLen < 0.001) return false;

    var wallDirX = wallDx / wallLen;
    var wallDirY = wallDy / wallLen;

    var dist1 = pointToLineDistance(
      lineStart.x,
      lineStart.y,
      wallStart.x,
      wallStart.y,
      wallDirX,
      wallDirY,
      wallLen
    );
    var dist2 = pointToLineDistance(
      lineEnd.x,
      lineEnd.y,
      wallStart.x,
      wallStart.y,
      wallDirX,
      wallDirY,
      wallLen
    );

    var minDist = Math.min(dist1, dist2);

    var perpX = -wallDirY;
    var perpY = wallDirX;
    var halfThick = thickness / 2;

    var w1 = {
      x: wallStart.x + perpX * halfThick,
      y: wallStart.y + perpY * halfThick,
    };
    var w2 = {
      x: wallEnd.x + perpX * halfThick,
      y: wallEnd.y + perpY * halfThick,
    };
    var w3 = {
      x: wallEnd.x - perpX * halfThick,
      y: wallEnd.y - perpY * halfThick,
    };
    var w4 = {
      x: wallStart.x - perpX * halfThick,
      y: wallStart.y - perpY * halfThick,
    };

    if (
      inter(lineStart, lineEnd, w1, w2) ||
      inter(lineStart, lineEnd, w2, w3) ||
      inter(lineStart, lineEnd, w3, w4) ||
      inter(lineStart, lineEnd, w4, w1)
    ) {
      return true;
    }

    return minDist <= thickness;
  }

  function pointInRect(x, y, rect) {
    var minX = Math.min(rect.p1.x, rect.p2.x, rect.p3.x, rect.p4.x);
    var maxX = Math.max(rect.p1.x, rect.p2.x, rect.p3.x, rect.p4.x);
    var minY = Math.min(rect.p1.y, rect.p2.y, rect.p3.y, rect.p4.y);
    var maxY = Math.max(rect.p1.y, rect.p2.y, rect.p3.y, rect.p4.y);
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }

  function lineIntersectsFloorPlane(ax, ay, bx, by, floorPlane) {
    if (
      pointInRect(ax, ay, floorPlane) ||
      pointInRect(bx, by, floorPlane)
    ) {
      return true;
    }

    var edges = [
      { p1: floorPlane.p1, p2: floorPlane.p2 },
      { p1: floorPlane.p2, p2: floorPlane.p3 },
      { p1: floorPlane.p3, p2: floorPlane.p4 },
      { p1: floorPlane.p4, p2: floorPlane.p1 },
    ];

    for (var i = 0; i < edges.length; i++) {
      if (
        inter({ x: ax, y: ay }, { x: bx, y: by }, edges[i].p1, edges[i].p2)
      ) {
        return true;
      }
    }

    return false;
  }

  function findWallAt(p) {
    var threshold = 0.5;
    for (var i = 0; i < state.walls.length; i++) {
      var wall = state.walls[i];
      if (
        wall.elementType === "door" ||
        wall.elementType === "doubleDoor" ||
        wall.elementType === "window"
      ) {
        continue;
      }

      var wallSegments = [];
      if (wall.points && wall.points.length >= 2) {
        for (var j = 0; j < wall.points.length - 1; j++) {
          wallSegments.push({ p1: wall.points[j], p2: wall.points[j + 1] });
        }
      } else if (wall.p1 && wall.p2) {
        wallSegments.push({ p1: wall.p1, p2: wall.p2 });
      } else {
        continue;
      }

      for (var j = 0; j < wallSegments.length; j++) {
        var seg = wallSegments[j];
        var p1 = seg.p1;
        var p2 = seg.p2;

        var dx = p2.x - p1.x;
        var dy = p2.y - p1.y;

        if (dx === 0 && dy === 0) continue;

        var t =
          ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / (dx * dx + dy * dy);

        var closestPoint;
        if (t < 0) {
          closestPoint = p1;
        } else if (t > 1) {
          closestPoint = p2;
        } else {
          closestPoint = { x: p1.x + t * dx, y: p1.y + t * dy };
        }

        var dist = hypot(p.x - closestPoint.x, p.y - closestPoint.y);

        if (dist < threshold) {
          return wall;
        }
      }
    }
    return null;
  }

  function findWallsInSelectionBox(box) {
    if (!box || !box.p1 || !box.p2) return [];

    var minX = Math.min(box.p1.x, box.p2.x);
    var maxX = Math.max(box.p1.x, box.p2.x);
    var minY = Math.min(box.p1.y, box.p2.y);
    var maxY = Math.max(box.p1.y, box.p2.y);

    var selectedWalls = [];

    for (var i = 0; i < state.walls.length; i++) {
      var wall = state.walls[i];
      if (
        wall.elementType === "door" ||
        wall.elementType === "doubleDoor" ||
        wall.elementType === "window"
      ) {
        continue;
      }

      var p1 = wall.p1;
      var p2 = wall.p2;

      var p1Inside =
        p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY;
      var p2Inside =
        p2.x >= minX && p2.x <= maxX && p2.y >= minY && p2.y <= maxY;

      var intersects = p1Inside || p2Inside;

      if (!intersects) {
        var boxEdges = [
          { p1: { x: minX, y: minY }, p2: { x: maxX, y: minY } },
          { p1: { x: maxX, y: minY }, p2: { x: maxX, y: maxY } },
          { p1: { x: maxX, y: maxY }, p2: { x: minX, y: maxY } },
          { p1: { x: minX, y: maxY }, p2: { x: minX, y: minY } },
        ];

        for (var j = 0; j < boxEdges.length; j++) {
          var edge = boxEdges[j];
          if (lineIntersection(p1, p2, edge.p1, edge.p2)) {
            intersects = true;
            break;
          }
        }
      }

      if (intersects) {
        selectedWalls.push(wall);
      }
    }

    return selectedWalls;
  }

  function isLineOnWall(lineP1, lineP2) {
    var threshold = 0.3;
    var angleThreshold = 0.1;

    for (var i = 0; i < state.walls.length; i++) {
      var wall = state.walls[i];
      if (
        wall.elementType === "door" ||
        wall.elementType === "doubleDoor" ||
        wall.elementType === "window"
      ) {
        continue;
      }

      var wallSegments = [];
      if (wall.points && wall.points.length >= 2) {
        for (var j = 0; j < wall.points.length - 1; j++) {
          wallSegments.push({ p1: wall.points[j], p2: wall.points[j + 1] });
        }
      } else if (wall.p1 && wall.p2) {
        wallSegments.push({ p1: wall.p1, p2: wall.p2 });
      } else {
        continue;
      }

      for (var segIdx = 0; segIdx < wallSegments.length; segIdx++) {
        var seg = wallSegments[segIdx];
        var wallP1 = seg.p1;
        var wallP2 = seg.p2;

        var wallDx = wallP2.x - wallP1.x;
        var wallDy = wallP2.y - wallP1.y;
        var wallLength = hypot(wallDx, wallDy);

        if (wallLength < 0.01) continue;

        var wallDirX = wallDx / wallLength;
        var wallDirY = wallDy / wallLength;

        var lineDx = lineP2.x - lineP1.x;
        var lineDy = lineP2.y - lineP1.y;
        var lineLength = hypot(lineDx, lineDy);

        if (lineLength < 0.01) continue;

        var lineDirX = lineDx / lineLength;
        var lineDirY = lineDy / lineLength;

        var dotProduct = wallDirX * lineDirX + wallDirY * lineDirY;
        var angleDiff = Math.abs(
          Math.acos(Math.max(-1, Math.min(1, dotProduct)))
        );
        var isParallel =
          angleDiff < angleThreshold ||
          Math.abs(angleDiff - Math.PI) < angleThreshold;

        if (!isParallel) continue;

        var projectPoint = function (
          point,
          wP1,
          wP2,
          wDirX,
          wDirY
        ) {
          var toPointX = point.x - wP1.x;
          var toPointY = point.y - wP1.y;
          var t = toPointX * wDirX + toPointY * wDirY;
          var projX = wP1.x + t * wDirX;
          var projY = wP1.y + t * wDirY;
          return { x: projX, y: projY, t: t };
        };

        var proj1 = projectPoint(
          lineP1,
          wallP1,
          wallP2,
          wallDirX,
          wallDirY
        );
        var proj2 = projectPoint(
          lineP2,
          wallP1,
          wallP2,
          wallDirX,
          wallDirY
        );

        var withinBounds1 =
          proj1.t >= -threshold && proj1.t <= wallLength + threshold;
        var withinBounds2 =
          proj2.t >= -threshold && proj2.t <= wallLength + threshold;

        var dist1 = hypot(lineP1.x - proj1.x, lineP1.y - proj1.y);
        var dist2 = hypot(lineP2.x - proj2.x, lineP2.y - proj2.y);

        if (
          withinBounds1 &&
          withinBounds2 &&
          dist1 < threshold &&
          dist2 < threshold
        ) {
          return true;
        }
      }
    }

    return false;
  }

  window.clamp01 = clamp01;
  window.log10 = log10;
  window.dbmToLin = dbmToLin;
  window.linToDbm = linToDbm;
  window.hypot = hypot;
  window.orient = orient;
  window.onSeg = onSeg;
  window.inter = inter;
  window.lineIntersection = lineIntersection;
  window.snapWallPoint = snapWallPoint;
  window.pointToLineDistance = pointToLineDistance;
  window.lineIntersectsWallWithThickness = lineIntersectsWallWithThickness;
  window.pointInRect = pointInRect;
  window.lineIntersectsFloorPlane = lineIntersectsFloorPlane;
  window.findWallAt = findWallAt;
  window.findWallsInSelectionBox = findWallsInSelectionBox;
  window.isLineOnWall = isLineOnWall;
})();
