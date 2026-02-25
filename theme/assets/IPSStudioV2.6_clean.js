
/* ========= Core Functions ========= */
// Draw image mapped to four corners using triangle-based texture mapping
// This makes the image "stick" to the plane like a sticker and rotate with it
// Draw image mapped to four world corners with perspective-correct subdivision
// This ensures the image "sticks" to the 3D geometry (walls) during zoom/pan
// by calculating screen positions for every grid vertex using the 3D projection matrix
// rather than linearly interpolating screen corners.
function drawProjectedImage(
  ctx,
  img,
  srcX,
  srcY,
  srcWidth,
  srcHeight,
  wP1,
  wP2,
  wP3,
  wP4,
  projector
) {
  // Extract the source image portion to a temporary canvas
  var tempCanvas = document.createElement("canvas");
  tempCanvas.width = srcWidth;
  tempCanvas.height = srcHeight;
  var tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(
    img,
    srcX,
    srcY,
    srcWidth,
    srcHeight,
    0,
    0,
    srcWidth,
    srcHeight
  );

  var MAX_DEPTH = 3; // 3 levels = 8x8 grid

  function mid(p1, p2) {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  // Subdivide in World Space (w) and Source Space (s)
  // Then project World -> Screen (d) at the leaf level
  function subdivide(wP1, wP2, wP3, wP4, sP1, sP2, sP3, sP4, depth) {
    if (depth >= MAX_DEPTH) {
      // Leaf level: Project world points to screen points
      var dP1 = projector(wP1);
      var dP2 = projector(wP2);
      var dP3 = projector(wP3);
      var dP4 = projector(wP4);

      // Draw 2 triangles
      // Triangle 1: P1, P2, P3
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(dP1.x, dP1.y);
      ctx.lineTo(dP2.x, dP2.y);
      ctx.lineTo(dP3.x, dP3.y);
      ctx.closePath();
      ctx.clip();
      drawTriangleTexture(ctx, tempCanvas, sP1, sP2, sP3, dP1, dP2, dP3);
      ctx.restore();

      // Triangle 2: P1, P3, P4
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(dP1.x, dP1.y);
      ctx.lineTo(dP3.x, dP3.y);
      ctx.lineTo(dP4.x, dP4.y);
      ctx.closePath();
      ctx.clip();
      drawTriangleTexture(ctx, tempCanvas, sP1, sP3, sP4, dP1, dP3, dP4);
      ctx.restore();
      return;
    }

    // Calculate midpoints in World Space (Linear interpolation is correct for flat planes)
    var wM12 = mid(wP1, wP2);
    var wM23 = mid(wP2, wP3);
    var wM34 = mid(wP3, wP4);
    var wM41 = mid(wP4, wP1);
    var wCenter = mid(wM12, wM34);

    // Calculate midpoints in Source Space
    var sM12 = mid(sP1, sP2);
    var sM23 = mid(sP2, sP3);
    var sM34 = mid(sP3, sP4);
    var sM41 = mid(sP4, sP1);
    var sCenter = mid(sM12, sM34);

    // Recurse
    subdivide(
      wP1,
      wM12,
      wCenter,
      wM41,
      sP1,
      sM12,
      sCenter,
      sM41,
      depth + 1
    );
    subdivide(
      wM12,
      wP2,
      wM23,
      wCenter,
      sM12,
      sP2,
      sM23,
      sCenter,
      depth + 1
    );
    subdivide(
      wCenter,
      wM23,
      wP3,
      wM34,
      sCenter,
      sM23,
      sP3,
      sM34,
      depth + 1
    );
    subdivide(
      wM41,
      wCenter,
      wM34,
      wP4,
      sM41,
      sCenter,
      sM34,
      sP4,
      depth + 1
    );
  }

  // Initial Source Corners (relative to temp canvas)
  var sP1 = { x: 0, y: 0 };
  var sP2 = { x: srcWidth, y: 0 };
  var sP3 = { x: srcWidth, y: srcHeight };
  var sP4 = { x: 0, y: srcHeight };

  // Calculate outer boundary for clipping
  // We project the 4 corners to establish the clip path
  var clipP1 = projector(wP1);
  var clipP2 = projector(wP2);
  var clipP3 = projector(wP3);
  var clipP4 = projector(wP4);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(clipP1.x, clipP1.y);
  ctx.lineTo(clipP2.x, clipP2.y);
  ctx.lineTo(clipP3.x, clipP3.y);
  ctx.lineTo(clipP4.x, clipP4.y);
  ctx.closePath();
  ctx.clip();

  subdivide(wP1, wP2, wP3, wP4, sP1, sP2, sP3, sP4, 0);

  ctx.restore();
}

// Draw a triangle with texture mapping (helper function)
function drawTriangleTexture(
  ctx,
  img,
  srcP1,
  srcP2,
  srcP3,
  dstP1,
  dstP2,
  dstP3
) {
  // Calculate affine transform matrix for triangle mapping
  // We need to map: srcP1->dstP1, srcP2->dstP2, srcP3->dstP3

  // Calculate vectors from srcP1
  var ux = srcP2.x - srcP1.x;
  var uy = srcP2.y - srcP1.y;
  var vx = srcP3.x - srcP1.x;
  var vy = srcP3.y - srcP1.y;

  // Calculate vectors from dstP1
  var dux = dstP2.x - dstP1.x;
  var duy = dstP2.y - dstP1.y;
  var dvx = dstP3.x - dstP1.x;
  var dvy = dstP3.y - dstP1.y;

  // Calculate determinant for solving the system
  var det = ux * vy - uy * vx;
  if (Math.abs(det) < 1e-10) return; // Degenerate triangle

  // Solve for transform matrix coefficients
  // The transform maps source coordinates to destination coordinates
  var a = (dux * vy - dvx * uy) / det;
  var b = (duy * vy - dvy * uy) / det;
  var c = (dvx * ux - dux * vx) / det;
  var d = (dvy * ux - duy * vx) / det;
  var e = dstP1.x - a * srcP1.x - c * srcP1.y;
  var f = dstP1.y - b * srcP1.x - d * srcP1.y;

  // Save current transform state
  ctx.save();

  // Apply transform and draw the image
  // The transform maps the source triangle to the destination triangle
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);

  // Restore transform state
  ctx.restore();
}

// Render coverage pattern as a flat plane at ground level (0m) in 3D view
// Note: Heatmap is calculated at 1.5m but displayed at 0m
function renderCoveragePlane3D(ctx, heatmapCanvas, transition) {
  if (transition <= 0) return; // Only render in 3D view

  var displayHeight = 0; // Display height at ground level (0m)

  // Define the four corners of the coverage area at ground level
  // These match the world coordinate system used for antennas
  var corners = [
    { x: 0, y: 0, z: displayHeight }, // Bottom-left
    { x: state.w, y: 0, z: displayHeight }, // Bottom-right
    { x: state.w, y: state.h, z: displayHeight }, // Top-right
    { x: 0, y: state.h, z: displayHeight }, // Top-left
  ];

  // Project corners to 3D canvas coordinates
  var p1_3d = projectToCanvas3D(corners[0].x, corners[0].y, corners[0].z);
  var p2_3d = projectToCanvas3D(corners[1].x, corners[1].y, corners[1].z);
  var p3_3d = projectToCanvas3D(corners[2].x, corners[2].y, corners[2].z);
  var p4_3d = projectToCanvas3D(corners[3].x, corners[3].y, corners[3].z);

  // Get 2D positions using mx/my to match antenna positioning (includes padding)
  var p1_2d = { x: mx(0), y: my(0) };
  var p2_2d = { x: mx(state.w), y: my(0) };
  var p3_2d = { x: mx(state.w), y: my(state.h) };
  var p4_2d = { x: mx(0), y: my(state.h) };

  // Interpolate between 2D and 3D positions based on transition
  var canvasP1 = {
    x: p1_2d.x + (p1_3d.x - p1_2d.x) * transition,
    y: p1_2d.y + (p1_3d.y - p1_2d.y) * transition,
  };
  var canvasP2 = {
    x: p2_2d.x + (p2_3d.x - p2_2d.x) * transition,
    y: p2_2d.y + (p2_3d.y - p2_2d.y) * transition,
  };
  var canvasP3 = {
    x: p3_2d.x + (p3_3d.x - p3_2d.x) * transition,
    y: p3_2d.y + (p3_3d.y - p3_2d.y) * transition,
  };
  var canvasP4 = {
    x: p4_2d.x + (p4_3d.x - p4_2d.x) * transition,
    y: p4_2d.y + (p4_3d.y - p4_2d.y) * transition,
  };

  // Render the heatmap as a textured plane
  ctx.save();
  ctx.globalAlpha = 0.85; // Slightly transparent so walls/APs are visible

  // World Points mapping to image corners - ensure correct coordinate mapping
  // The heatmap image has coordinates: (0,0) top-left to (width,height) bottom-right
  // World coordinates: (0,0) bottom-left to (w,h) top-right
  // Standard mapping: Image y=0 (top) -> World y=h (top), Image y=height (bottom) -> World y=0 (bottom)
  // So we map: Image(0,0) -> World(0,h), Image(width,0) -> World(w,h),
  //            Image(width,height) -> World(w,0), Image(0,height) -> World(0,0)
  var wP1 = { x: 0, y: state.h }; // Top-left in world = Image(0,0)
  var wP2 = { x: state.w, y: state.h }; // Top-right in world = Image(width,0)
  var wP3 = { x: state.w, y: 0 }; // Bottom-right in world = Image(width,height)
  var wP4 = { x: 0, y: 0 }; // Bottom-left in world = Image(0,height)

  var projector = function (p) {
    var p2d = { x: mx(p.x), y: my(p.y) };
    // Render at 0m (ground) but heatmap is calculated at 1.5m
    var p3d = projectToCanvas3D(p.x, p.y, 0); // Display at z=0m (ground)
    return {
      x: p2d.x + (p3d.x - p2d.x) * transition,
      y: p2d.y + (p3d.y - p2d.y) * transition,
    };
  };

  // Draw pattern - the pattern is already calculated correctly accounting for antenna positions
  // and azimuth, so we just need to map it correctly to world coordinates
  drawProjectedImage(
    ctx,
    heatmapCanvas,
    0,
    0,
    heatmapCanvas.width,
    heatmapCanvas.height,
    wP1,
    wP2,
    wP3,
    wP4,
    projector
  );

  ctx.restore();
}

// Fast 3D projection - converts 2D wall coordinates to 3D canvas coordinates
// worldX, worldY are the 2D coordinates (same as used in 2D mode)
// height is the wall height in meters
function projectToCanvas3D(worldX, worldY, height) {
  // Convert 2D coordinates to 3D space (centered)
  var x = worldX - state.w / 2;
  var z = (worldY - state.h / 2); // Flip on y-axis
  var y = height;

  // Apply camera rotation
  var rotX = state.cameraRotationX;
  var rotY = state.cameraRotationY;

  // Rotate around Y axis (horizontal rotation)
  var cosY = Math.cos(rotY);
  var sinY = Math.sin(rotY);
  var x1 = x * cosY - z * sinY;
  var z1 = x * sinY + z * cosY;
  var y1 = y;

  // Rotate around X axis (vertical rotation)
  var cosX = Math.cos(rotX);
  var sinX = Math.sin(rotX);
  var x2 = x1;
  var y2 = y1 * cosX - z1 * sinX;
  var z2 = y1 * sinX + z1 * cosX;

  // Apply zoom
  var zoom = state.cameraZoom;
  x2 *= zoom;
  y2 *= zoom;
  z2 *= zoom;

  // Perspective projection - preserve 2D orientation
  // Coordinate mapping: worldX -> x (right), worldY -> z (depth), height -> y (up)
  // With cameraRotationY = 0, X rotation tilts view down while preserving horizontal orientation
  var distance = Math.max(z2 + 20, 1); // Camera distance
  var fov = 500;
  var scale = fov / distance;

  // Apply camera pan (after rotation, before projection)
  x2 += state.cameraPanX;
  z2 += state.cameraPanY;

  // Project to screen - preserve 2D directions
  // x2 (worldX) maps directly to screen X (right)
  // z2 (worldY after rotation) provides depth/base Y position
  // y2 (height after rotation) adds vertical offset
  var screenX = x2 * scale;
  // Use z2 for base Y position (worldY), y2 adds vertical offset from height
  // Negate screenY to fix y-axis mirroring for z2 (depth), but y2 (height) must go UP (negative screen Y)
  // z2 increases "down" the screen (depth). y2 increases "up" in 3D.
  // We want higher y2 to result in lower screenY.
  // screenY = -z2*scale (base ground) - y2*scale (height offset)
  var screenY = -(z2 * scale + y2 * scale);

  // Map to canvas coordinates - preserve 2D coordinate system
  var baseScale =
    (Math.min(canvas.width, canvas.height) / Math.max(state.w, state.h)) *
    0.8;
  var canvasX =
    pad() +
    ((state.w / 2 + (screenX * baseScale) / fov) *
     (canvas.width - 2 * pad())) /
    state.w;
  var canvasY =
    pad() +
    ((state.h / 2 + (screenY * baseScale) / fov) *
     (canvas.height - 2 * pad())) /
    state.h;

  return { x: canvasX, y: canvasY, depth: z2 };
}

// Unproject screen coordinates back to world coordinates at a given height
// Uses a simpler approach: projects two nearby points and interpolates
function unprojectFromCanvas3D(screenX, screenY, targetHeight) {
  // Use the inverse of the 2D mapping as a starting point
  var worldX = invx(screenX);
  var worldY = invy(screenY);

  // In 3D view, we need to account for perspective
  // For dragging, we can use a simpler approach: track the delta in screen space
  // and convert it proportionally to world space
  // But for now, use the 2D inverse mapping which should be close enough
  // The main issue is axis inversion, which we'll handle in the drag handler

  return { x: worldX, y: worldY };
}

/* AI COMMENT — state, elementTypes, wallTypes moved to Config.js */

// Get button text based on selected element type
function getAddButtonText(isDrawing) {
  if (isDrawing) {
    return "Drawing...";
  }
  var elementNames = {
    wall: "Add Wall",
    door: "Add Door",
    doubleDoor: "Add Double Door",
    window: "Add Window",
    floorPlane: "Add Floor Plane",
  };
  return elementNames[state.selectedElementType] || "";
}

// Count how many walls of a specific type exist
function countWallsByType(wallType) {
  var count = 0;
  for (var i = 0; i < state.walls.length; i++) {
    if (state.walls[i].type === wallType) {
      count++;
    }
  }
  return count;
}

// Generate wall name based on type
function generateWallName(wallType) {
  var typeInfo = wallTypes[wallType];
  var typeName = typeInfo ? typeInfo.name : "Wall";
  var count = countWallsByType(wallType);
  return typeName + "_" + (count + 1);
}

var canvas = document.getElementById("plot"),
  ctx = canvas.getContext("2d");
// Enable image smoothing for smoother rendering
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";

// Initialize after DOM and all scripts are loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    if (typeof initHeatmapWorker === "function") initHeatmapWorker();
    setTimeout(function() { if (typeof initThreeJS === "function") initThreeJS(); }, 100);
  });
} else {
  // DOM already loaded
  if (typeof initHeatmapWorker === "function") initHeatmapWorker();
  setTimeout(function() { if (typeof initThreeJS === "function") initThreeJS(); }, 100);
}

var _propModel = new PropagationModel25D({
  frequency:      state.freq,
  N:              state.N,
  verticalFactor: 2.0,
  shapeFactor:    3.0,
  referenceOffset: 0.0
});

// Keep model config in sync with state changes
function _syncPropModel() {
  _propModel.freq = state.freq;
  _propModel.N    = state.N;
}

// wallsLoss  kept inline (app-specific door/window/thickness logic below)




function p525(ax, ay, x, y) {
  _syncPropModel();
  var d = Math.max(hypot(x - ax, y - ay), 0.5);
  return _propModel.fspl(state.freq, d) +
    _propModel.groundPlaneLoss({x:ax, y:ay}, {x:x, y:y}, state.groundPlane) +
    _propModel.floorPlanesLoss({x:ax, y:ay}, {x:x, y:y}, state.floorPlanes);
}

function modelLoss(ax, ay, x, y) {
  _syncPropModel();

  if (state.model === "p525") {
    return p525(ax, ay, x, y);
  }

  // Default: p25d
  return _propModel.p25dLoss(
    {x: ax, y: ay},
    {x: x, y: y},
    state.walls,
    state.floorPlanes,
    state.groundPlane,
    state.elementTypes
  );
}




// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Initialize standalone modules with dependencies ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
function getAngleDependentGain(ap, x, y) {
  var effectiveAp = ap;
  if (!ap.antennaPattern && state.antennaPatterns.length > 0) {
    effectiveAp = Object.assign({}, ap, { antennaPattern: getDefaultAntennaPattern() });
  }
  return _propModel.getAngleDependentGain(effectiveAp, { x: x, y: y });
}

function rssi(tx, gt, L) {
  return _propModel.rssi(tx, gt, L);
}

window.modelLoss             = modelLoss;
window.getAngleDependentGain = getAngleDependentGain;
window.rssi                  = rssi;

RadioCalculations.init({
  state:                  state,
  modelLoss:              modelLoss,
  getAngleDependentGain:  getAngleDependentGain,
  propModel:              _propModel
});

DataExportSystem.init({
  state: state
});



void 0; // placeholder - original block commented out above

// Render ground plane with uploaded image as texture
function renderGroundPlane(ctx, transition) {
  if (!state.groundPlane || !state.groundPlane.enabled) return;

  // Ground plane is always present, render it even without image
  // Render in both 2D and 3D views
  var is3D = transition > 0;

  // Ground plane corners in world coordinates (at z=0, which is the floor)
  // If we have an image with aspect ratio, preserve it by centering and fitting
  var corners;
  if (state.backgroundImage && state.backgroundImageAspectRatio && 
      state.backgroundImageDisplayWidth && state.backgroundImageDisplayHeight) {
    // Calculate centered position for the image
    var offsetX = (state.w - state.backgroundImageDisplayWidth) / 2;
    var offsetY = (state.h - state.backgroundImageDisplayHeight) / 2;

    corners = [
      { x: offsetX, y: offsetY, z: 0 }, // Bottom-left
      { x: offsetX + state.backgroundImageDisplayWidth, y: offsetY, z: 0 }, // Bottom-right
      { x: offsetX + state.backgroundImageDisplayWidth, y: offsetY + state.backgroundImageDisplayHeight, z: 0 }, // Top-right
      { x: offsetX, y: offsetY + state.backgroundImageDisplayHeight, z: 0 }, // Top-left
    ];
  } else {
    // No image or no aspect ratio info - use full canvas
    corners = [
      { x: 0, y: 0, z: 0 }, // Bottom-left
      { x: state.w, y: 0, z: 0 }, // Bottom-right
      { x: state.w, y: state.h, z: 0 }, // Top-right
      { x: 0, y: state.h, z: 0 }, // Top-left
    ];
  }

  // Calculate corner positions based on view mode
  var corners2D;
  if (state.backgroundImage && state.backgroundImageAspectRatio && 
      state.backgroundImageDisplayWidth && state.backgroundImageDisplayHeight) {
    // Use adjusted corners for image
    var offsetX = (state.w - state.backgroundImageDisplayWidth) / 2;
    var offsetY = (state.h - state.backgroundImageDisplayHeight) / 2;
    corners2D = [
      { x: mx(offsetX), y: my(offsetY) },
      { x: mx(offsetX + state.backgroundImageDisplayWidth), y: my(offsetY) },
      { x: mx(offsetX + state.backgroundImageDisplayWidth), y: my(offsetY + state.backgroundImageDisplayHeight) },
      { x: mx(offsetX), y: my(offsetY + state.backgroundImageDisplayHeight) },
    ];
  } else {
    // Use full canvas corners
    corners2D = [
      { x: mx(0), y: my(0) },
      { x: mx(state.w), y: my(0) },
      { x: mx(state.w), y: my(state.h) },
      { x: mx(0), y: my(state.h) },
    ];
  }

  var finalCorners = [];

  if (is3D) {
    // Project corners to 3D
    var projectedCorners = [];
    for (var i = 0; i < corners.length; i++) {
      var corner = corners[i];
      var projected = projectToCanvas3D(corner.x, corner.y, corner.z);
      projectedCorners.push(projected);
    }

    // Interpolate between 2D and 3D positions
    for (var i = 0; i < corners.length; i++) {
      finalCorners.push({
        x:
          corners2D[i].x +
          (projectedCorners[i].x - corners2D[i].x) * transition,
        y:
          corners2D[i].y +
          (projectedCorners[i].y - corners2D[i].y) * transition,
      });
    }
  } else {
    // Pure 2D view - use 2D corners directly
    finalCorners = corners2D;
  }

  // Draw the ground plane with the background image
  ctx.save();

  // First, draw grey background for the entire canvas area
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = "#b8b8b8"; // Grey background
  var fullCanvasCorners = [
    { x: mx(0), y: my(0) },
    { x: mx(state.w), y: my(0) },
    { x: mx(state.w), y: my(state.h) },
    { x: mx(0), y: my(state.h) },
  ];
  var fullCanvasCorners3D = [];
  if (is3D) {
    var fullCorners = [
      { x: 0, y: 0, z: 0 },
      { x: state.w, y: 0, z: 0 },
      { x: state.w, y: state.h, z: 0 },
      { x: 0, y: state.h, z: 0 },
    ];
    for (var i = 0; i < fullCorners.length; i++) {
      var projected = projectToCanvas3D(fullCorners[i].x, fullCorners[i].y, fullCorners[i].z);
      fullCanvasCorners3D.push(projected);
    }
    // Interpolate between 2D and 3D positions
    for (var i = 0; i < fullCanvasCorners.length; i++) {
      fullCanvasCorners[i] = {
        x: fullCanvasCorners[i].x + (fullCanvasCorners3D[i].x - fullCanvasCorners[i].x) * transition,
        y: fullCanvasCorners[i].y + (fullCanvasCorners3D[i].y - fullCanvasCorners[i].y) * transition,
      };
    }
  }
  ctx.beginPath();
  ctx.moveTo(fullCanvasCorners[0].x, fullCanvasCorners[0].y);
  ctx.lineTo(fullCanvasCorners[1].x, fullCanvasCorners[1].y);
  ctx.lineTo(fullCanvasCorners[2].x, fullCanvasCorners[2].y);
  ctx.lineTo(fullCanvasCorners[3].x, fullCanvasCorners[3].y);
  ctx.closePath();
  ctx.fill();

  // Calculate average depth for lighting/shading (only in 3D)
  var avgDepth = 0;
  var lightFactor = 1.0;
  if (is3D) {
    var projectedCorners = [];
    for (var i = 0; i < corners.length; i++) {
      var corner = corners[i];
      var projected = projectToCanvas3D(corner.x, corner.y, corner.z);
      projectedCorners.push(projected);
    }
    avgDepth =
      (projectedCorners[0].depth +
       projectedCorners[1].depth +
       projectedCorners[2].depth +
       projectedCorners[3].depth) /
      4;
    lightFactor = Math.max(0.7, Math.min(1.0, 1.0 - avgDepth * 0.01));
  }

  // If image is uploaded, use it as texture on the ground plane
  if (state.backgroundImage) {
    ctx.globalAlpha = state.backgroundImageAlpha;
    ctx.globalCompositeOperation = "source-over";

    // Define projector lambda for ground plane (z=0)
    var projector = function (p) {
      var p2d = { x: mx(p.x), y: my(p.y) };
      var p3d = projectToCanvas3D(p.x, p.y, 0); // Ground planes at z=0
      return {
        x: p2d.x + (p3d.x - p2d.x) * transition,
        y: p2d.y + (p3d.y - p2d.y) * transition,
      };
    };

    // Use drawProjectedImage for both 2D and 3D views to ensure consistent rendering
    drawProjectedImage(
      ctx,
      state.backgroundImage,
      0,
      0,
      state.backgroundImage.width,
      state.backgroundImage.height,
      corners[0],
      corners[1],
      corners[2],
      corners[3],
      projector
    );
  }
  // Note: Grey background is already drawn above, so we don't need to draw it again here

  ctx.restore();
}

function draw() {
  // Smooth transition between 2D and 3D
  var needsRedraw = false;
  if (state.viewMode !== state.viewModeTarget) {
    // Animate transition
    var transitionSpeed = 0.08; // Slower for smoother transition
    if (state.viewModeTarget === "3d") {
      state.viewModeTransition = Math.min(
        1,
        state.viewModeTransition + transitionSpeed
      );
      if (state.viewModeTransition >= 1) {
        state.viewMode = "3d";
        state.viewModeTransition = 1;
      }
      needsRedraw = true;
    } else {
      state.viewModeTransition = Math.max(
        0,
        state.viewModeTransition - transitionSpeed
      );
      if (state.viewModeTransition <= 0) {
        state.viewMode = "2d";
        state.viewModeTransition = 0;
      }
      needsRedraw = true;
    }
  }

  // Update Three.js camera if in 3D mode
  var transition = state.viewModeTransition;
  if (transition > 0 && state.useThreeJS && state.threeRenderer) {
    updateThreeJSCamera();
    // Update pointer-events based on view mode
    updateThreeCanvasPointerEvents();
  } else {
    // Ensure pointer-events is 'none' in 2D mode
    updateThreeCanvasPointerEvents();
  }

  // Continue animation if transitioning (will be called again at end of function)

  // Generate color map for best view mode to ensure distinct colors for each AP
  if (state.view === "best") {
    state.apColorMap = getAPColorMap(state.aps);
  } else {
    state.apColorMap = null; // Clear color map for other views
  }

  // Hard safety: while in antenna placement mode, always force the AP detail sidebar closed
  // so no other code path can leave it visible during placement.
  if (state.addingAP) {
    state.selectedApForDetail = null;
    var forcedSidebar = document.getElementById("apDetailSidebar");
    if (forcedSidebar) {
      forcedSidebar.classList.remove("visible");
    }
  }

  // Set cursor based on current action
  if (
    state.addingWall ||
    state.addingAP ||
    state.addingFloorPlane ||
    state.isCalibrating
  ) {
    canvas.style.cursor = "crosshair";
  } else if (state.viewMode === "3d" || state.viewModeTransition > 0) {
    if (state.isPanning3D) {
      canvas.style.cursor = "move";
    } else if (state.isRotating3D) {
      canvas.style.cursor = "grabbing";
    } else {
      canvas.style.cursor = "grab";
    }
  } else {
    canvas.style.cursor = "default";
  }

  var parent = canvas.parentNode;
  canvas.width = parent.clientWidth - 4;
  canvas.height = parent.clientHeight - 4;

  var unit = "dBm",
    modeName = "RSSI",
    numericLegend = true;
  if (state.view === "snr") {
    unit = "dB";
    modeName = "SNR";
  }
  if (state.view === "sinr") {
    unit = "dB";
    modeName = "SINR";
  }
  if (state.view === "cci") {
    unit = "";
    modeName = "CCI Count";
    // Use a categorical legend for discrete interference counts
    numericLegend = false;
  }
  if (state.view === "thr") {
    unit = "Mbps";
    modeName = "Throughput";
  }
  if (state.view === "best") {
    unit = "";
    modeName = "Best Server";
    numericLegend = false;
  }
  if (state.view === "servch") {
    unit = "";
    modeName = "Serving Channel";
    numericLegend = false;
  }

  document.getElementById("legendUnit").textContent = unit;
  document.getElementById("modeName").textContent = modeName;
  document.getElementById("legendBar").style.display = numericLegend ? "block" : "none";
  document.getElementById("legendMin").style.display = numericLegend ? "inline" : "none";
  document.getElementById("legendMax").style.display = numericLegend ? "inline" : "none";

  // Only generate and render heatmap if visualization is enabled
  var off = null;
  if (state.showVisualization) {
    // During antenna dragging: recalculate heatmap in real-time at optimized resolution for smooth movement
    // When not dragging: use cache if available, or generate at full resolution
    if (state.isDraggingAntenna) {
      // OPTIMIZATION: Balanced resolution + simplified calculations during drag for speed
      if (state.aps.length > 0) {
        // Use 0.75x resolution multiplier for good balance between speed and quality
        var resolutionMultiplier = 1.6;
        // Use normal grid step size for maximum detail during drag
        var dragRes = state.res * 8; // Use normal grid cells for better detail
        var baseCols = Math.max(20, Math.floor(state.w / dragRes));
        var baseRows = Math.max(14, Math.floor(state.h / dragRes));
        var cols = Math.floor(baseCols * resolutionMultiplier);
        var rows = Math.floor(baseRows * resolutionMultiplier);
        var dx = state.w / cols,
          dy = state.h / rows;
        var img = ctx.createImageData(cols, rows);

        // Cache selectedAP lookup (only once, not per pixel)
        var selectedAP = null,
          i;
        for (i = 0; i < state.aps.length; i++) {
          if (state.aps[i].id === state.selectedApId) {
            selectedAP = state.aps[i];
            break;
          }
        }
        var useOnlySelected = state.highlight && selectedAP && selectedAP.enabled !== false;

        // Cache noise value
        var noiseVal = state.noise;

        // Simplified gain function for drag (use static gain, skip complex pattern calculations)
        function getSimpleGain(ap) {
          return ap.gt || 0; // Just use static gain during drag for speed
        }

        // Optimized loop - skip CSV, skip complex views during drag
        var isRSSI = state.view === "rssi";
        var isSNR = state.view === "snr";
        var isSINR = state.view === "sinr";
        var isBest = state.view === "best";
        var isServCh = state.view === "servch";
        var isCCI = state.view === "cci";
        var isThr = state.view === "thr";

        // Support RSSI, SNR, SINR, Best Server, Serving Channel, CCI, and Throughput during drag (with simplified calculations)
        if (!isRSSI && !isSNR && !isSINR && !isBest && !isServCh && !isCCI && !isThr) {
          // Fallback: don't use cached heatmap during drag (it has old positions) - set to null to prevent deformed pattern flash
          // The heatmap will be regenerated when drag ends
          off = null;
        } else {
          // Simplified best AP calculation function for dragging (uses getSimpleGain)
          function bestApAtSimple(x, y) {
            var i, best = -1e9, ap = null;
            for (i = 0; i < state.aps.length; i++) {
              var a = state.aps[i];
              if (a.enabled === false) continue;
              var pr = rssi(
                a.tx,
                getSimpleGain(a),
                modelLoss(a.x, a.y, x, y)
              );
              if (pr > best) {
                best = pr;
                ap = a;
              }
            }
            return { ap: ap, rssiDbm: best };
          }

          // CCI calculation function for dragging (uses getAngleDependentGain for accuracy)
          function cciAtSimple(x, y, servingAp) {
            if (!servingAp) return -200;
            var i, sumLin = 0;
            for (i = 0; i < state.aps.length; i++) {
              var ap = state.aps[i];
              if (ap.enabled === false) continue;
              if (ap === servingAp) continue;
              if (ap.ch !== servingAp.ch) continue;
              var p = _propModel.rssi(
                ap.tx,
                _propModel.getAngleDependentGain(ap, {x: x, y: y}),
                modelLoss(ap.x, ap.y, x, y)
              );
              sumLin += dbmToLin(p);
            }
            if (sumLin <= 0) return -200;
            return linToDbm(sumLin);
          }

          for (var r = 0; r < rows; r++) {
            var y = (r + 0.5) * dy;
            for (var c = 0; c < cols; c++) {
              var x = (c + 0.5) * dx;
              var idx = 4 * (r * cols + c);

              // SKIP CSV interpolation during drag - too expensive
              // Use simplified calculations for CCI/Throughput during drag

              if (isBest || isServCh) {
                // Best Server and Serving Channel use full bestApAt with angle-dependent gain
                var best = useOnlySelected ? { ap: selectedAP, rssiDbm: 0 } : bestApAt(x, y);
                if (useOnlySelected && selectedAP) {
                  // Use angle-dependent gain calculation for accuracy
                  best.rssiDbm = _propModel.rssi(
                    selectedAP.tx,
                    _propModel.getAngleDependentGain(selectedAP, {x: x, y: y}),
                    modelLoss(selectedAP.x, selectedAP.y, x, y)
                  );
                }

                var col;
                if (isBest) {
                  col = best.ap ? colorForAP(best.ap.id) : [200, 200, 200, 230];
                } else {
                  var ch = best.ap ? best.ap.ch : 0;
                  col = colorForChannel(ch);
                }
                img.data[idx] = col[0];
                img.data[idx + 1] = col[1];
                img.data[idx + 2] = col[2];
                img.data[idx + 3] = col[3];
              } else {
                // RSSI, SNR, CCI, or Throughput view
                // All views use bestApAt with angle-dependent gain for accuracy
                var bestN = useOnlySelected ? { ap: selectedAP, rssiDbm: 0 } : bestApAt(x, y);
                if (useOnlySelected && selectedAP) {
                  bestN.rssiDbm = _propModel.rssi(
                    selectedAP.tx,
                    _propModel.getAngleDependentGain(selectedAP, {x: x, y: y}),
                    modelLoss(selectedAP.x, selectedAP.y, x, y)
                  );
                }

                var value;
                if (isSNR) {
                  value = bestN.rssiDbm - noiseVal;
                } else if (isSINR) {
                  if (!bestN.ap) {
                    value = -Infinity;
                  } else {
                    var IdbmDrag = cciAtSimple(x, y, bestN.ap);
                    value = sinrAt(bestN.rssiDbm, IdbmDrag);
                  }
                } else if (isCCI) {
                  // Count interfering antennas (power > -85, same channel as best server)
                  value = bestN.ap ? countInterferingAntennas(x, y, bestN.ap) : 0;
                } else if (isThr) {
                  if (!bestN.ap) {
                    value = 0; // No AP, no throughput
                  } else {
                    var Idbm2 = cciAtSimple(x, y, bestN.ap);
                    var sinr = sinrAt(bestN.rssiDbm, Idbm2);
                    value = throughputFromSinr(sinr);
                  }
                } else {
                  value = bestN.rssiDbm;
                }

                var col;
                if (isCCI) {
                  // Use discrete color map for count values
                  col = colorForCount(value);
                } else {
                  col = colorNumeric(value);
                }
                img.data[idx] = col[0];
                img.data[idx + 1] = col[1];
                img.data[idx + 2] = col[2];
                img.data[idx + 3] = col[3];
              }
            }
          }

          // Create canvas and render - use medium quality smoothing for good balance
          off = document.createElement("canvas");
          off.width = cols;
          off.height = rows;
          var offCtx = off.getContext("2d");
          offCtx.imageSmoothingEnabled = true;
          offCtx.imageSmoothingQuality = "medium"; // Medium quality for good balance
          offCtx.putImageData(img, 0, 0);

          // Don't cache during drag - we want real-time updates
          // Cache will be updated when drag ends
        }
      } else {
        // No antennas yet, no need to generate heatmap
        off = null;
      }
    } else if (state.cachedHeatmap) {
      // Use cached heatmap if available (when not dragging)
      off = state.cachedHeatmap;
      // If update is pending, it will replace the cache when done
    } else if (!state.heatmapUpdatePending) {
      // No cache exists and no update pending - generate synchronously for initial display
      // This ensures the heatmap shows immediately on first load
      // Generate if we have antennas OR CSV coverage data
      if (
        state.aps.length > 0 ||
        (state.csvCoverageData && state.csvCoverageGrid)
      ) {
        var resolutionMultiplier = 1.5; // High quality rendering
        var baseCols = Math.max(20, Math.floor(state.w / state.res));
        var baseRows = Math.max(14, Math.floor(state.h / state.res));
        var cols = baseCols * resolutionMultiplier;
        var rows = baseRows * resolutionMultiplier;
        var dx = state.w / cols,
          dy = state.h / rows;
        var img = ctx.createImageData(cols, rows);

        var selectedAP = null,
          i;
        for (i = 0; i < state.aps.length; i++) {
          if (state.aps[i].id === state.selectedApId) {
            selectedAP = state.aps[i];
            break;
          }
        }
        var useOnlySelected = state.highlight && selectedAP && selectedAP.enabled !== false;

        for (var r = 0; r < rows; r++) {
          var y = (r + 0.5) * dy;
          for (var c = 0; c < cols; c++) {
            var x = (c + 0.5) * dx;
            var idx = 4 * (r * cols + c);

            // YOUSEF COMMENT CSV
            // // Check if CSV coverage data is available and view is RSSI
            // if (
            //   state.csvCoverageData &&
            //   state.csvCoverageGrid &&
            //   state.view === "rssi"
            // ) {
            //   var csvValue = interpolateRsrpFromCsv(x, y);
            //   if (csvValue !== null && !isNaN(csvValue)) {
            //     var col = colorNumeric(csvValue);
            //     img.data[idx] = col[0];
            //     img.data[idx + 1] = col[1];
            //     img.data[idx + 2] = col[2];
            //     img.data[idx + 3] = col[3];
            //     continue;
            //   } else {
            //     img.data[idx] = 0;
            //     img.data[idx + 1] = 0;
            //     img.data[idx + 2] = 0;
            //     img.data[idx + 3] = 0;
            //     continue;
            //   }
            // }

            if (state.view === "best") {
              var best = bestApAt(x, y);
              if (useOnlySelected) {
                best.ap = selectedAP;
                best.rssiDbm = rssi(
                  selectedAP.tx,
                  getAngleDependentGain(selectedAP, x, y),
                  modelLoss(selectedAP.x, selectedAP.y, x, y)
                );
              }
              var colAP = best.ap
                ? colorForAP(best.ap.id)
                : [200, 200, 200, 230];
              img.data[idx] = colAP[0];
              img.data[idx + 1] = colAP[1];
              img.data[idx + 2] = colAP[2];
              img.data[idx + 3] = colAP[3];
              continue;
            }
            if (state.view === "servch") {
              var best2 = bestApAt(x, y);
              if (useOnlySelected) {
                best2.ap = selectedAP;
                best2.rssiDbm = rssi(
                  selectedAP.tx,
                  getAngleDependentGain(selectedAP, x, y),
                  modelLoss(selectedAP.x, selectedAP.y, x, y)
                );
              }
              var ch = best2.ap ? best2.ap.ch : 0;
              var colCH = colorForChannel(ch);
              img.data[idx] = colCH[0];
              img.data[idx + 1] = colCH[1];
              img.data[idx + 2] = colCH[2];
              img.data[idx + 3] = colCH[3];
              continue;
            }

            var bestN = bestApAt(x, y);
            if (useOnlySelected) {
              bestN.ap = selectedAP;
              bestN.rssiDbm = rssi(
                selectedAP.tx,
                getAngleDependentGain(selectedAP, x, y),
                modelLoss(selectedAP.x, selectedAP.y, x, y)
              );
            }

            var value;
            if (state.view === "rssi") {
              value = bestN.rssiDbm;
            } else if (state.view === "snr") {
              value = bestN.rssiDbm - state.noise;
            } else if (state.view === "sinr") {
              var IdbmSinr = cciAt(x, y, bestN.ap);
              value = sinrAt(bestN.rssiDbm, IdbmSinr);
            } else if (state.view === "cci") {
              // Count interfering antennas (power > -85, same channel as best server)
              value = countInterferingAntennas(x, y, bestN.ap);
            } else if (state.view === "thr") {
              var Idbm2 = cciAt(x, y, bestN.ap);
              var sinr = sinrAt(bestN.rssiDbm, Idbm2);
              value = throughputFromSinr(sinr);
            } else {
              value = bestN.rssiDbm;
            }

            var col;
            if (state.view === "cci") {
              // Use discrete color map for count values
              col = colorForCount(value);
            } else {
              col = colorNumeric(value);
            }
            img.data[idx] = col[0];
            img.data[idx + 1] = col[1];
            img.data[idx + 2] = col[2];
            img.data[idx + 3] = col[3];
          }
        }

        off = document.createElement("canvas");
        off.width = cols;
        off.height = rows;
        var offCtx = off.getContext("2d");
        offCtx.imageSmoothingEnabled = true;
        offCtx.imageSmoothingQuality = "high";
        offCtx.putImageData(img, 0, 0);

        state.cachedHeatmap = off;
        state.cachedHeatmapAntennaCount = state.aps.length; // Store antenna count for validation
      } else {
        // No antennas yet, no need to generate heatmap
        off = null;
      }
    } else if (state.heatmapUpdatePending) {
      // Update is pending - use cached heatmap ONLY if it's still valid (same antenna count)
      // This prevents disappearing while keeping the display smooth during updates
      // If antenna count changed (e.g., deletion), cache is invalid and we show nothing
      if (state.cachedHeatmap && state.cachedHeatmapAntennaCount === state.aps.length) {
        // Cache is still valid - use it to prevent disappearing
        off = state.cachedHeatmap;
      } else {
        // Cache is invalid or doesn't exist - clear it and show nothing
        if (state.cachedHeatmap && state.cachedHeatmapAntennaCount !== state.aps.length) {
          state.cachedHeatmap = null;
          state.cachedHeatmapAntennaCount = 0;
        }
        off = null;
      }
    } else {
      // No update pending - use cached heatmap ONLY if it's valid
      // Validate cached heatmap matches current antenna count
      if (state.cachedHeatmap && state.cachedHeatmapAntennaCount === state.aps.length) {
        off = state.cachedHeatmap;
      } else {
        // Cached heatmap is invalid - clear it immediately
        if (state.cachedHeatmap && state.cachedHeatmapAntennaCount !== state.aps.length) {
          state.cachedHeatmap = null;
          state.cachedHeatmapAntennaCount = 0;
        }
        off = null;

        // If no valid cache and we have antennas, trigger async generation
        if (
          !state.isDraggingAntenna &&
          (state.aps.length > 0 ||
           (state.csvCoverageData && state.csvCoverageGrid))
        ) {
          // No cache and no update pending - fallback: trigger async generation
          // This handles cases where sync generation didn't run (e.g., no antennas yet, or edge cases)
          generateHeatmapAsync(null, true); // Start with low-res for fast initial display
        }
      }
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // XD View Isolation: If in XD tab, we will force a 2D transition for ground plane rendering below.
  // (Early return removed to allow UI updates and animation cycle to continue)

  // Render ground plane (always present, with image as texture if uploaded)
  // The image is ONLY used as texture on the ground plane, not as a 2D background
  var transition = state.activeSection === "xd" ? 0 : state.viewModeTransition;
  var useThree3D =
    transition > 0 &&
    state.useThreeJS &&
    state.threeRenderer &&
    state.threeScene;

  // Use Three.js for 3D rendering if available and in 3D mode
  if (useThree3D) {
    // Clear Three.js canvas first
    if (state.threeCanvas) {
      var threeCtx = state.threeCanvas.getContext("2d");
      if (threeCtx) {
        threeCtx.clearRect(
          0,
          0,
          state.threeCanvas.width,
          state.threeCanvas.height
        );
      }
    }

    // Render 3D scene with Three.js
    renderThreeJSScene(transition, off);

    // Three.js renders directly to its canvas, which is overlaid on top
    // The canvas is already positioned and visible, so no need to composite

    // Hide legacy 3D model when Three.js is active; we only keep the Three.js scene visible.
    // (Ground plane / background can be migrated to Three.js later.)
  } else {
    // Pure 2D rendering or Three.js not available
    renderGroundPlane(ctx, transition);
  }

  // Draw heatmap only if visualization is enabled
  // XD Tab Isolation: skip heatmap rendering in XD tab
  if (state.showVisualization && off && state.activeSection !== 'xd') {
    // Draw 2D heatmap only when in 2D view (transition = 0)
    if (transition <= 0) {
      // Ensure smoothing is enabled when drawing the heatmap
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Draw the heatmap with proper scaling
      var heatmapX = pad();
      var heatmapY = pad();
      var heatmapWidth = canvas.width - 2 * pad();
      var heatmapHeight = canvas.height - 2 * pad();

      ctx.drawImage(
        off,
        heatmapX,
        heatmapY,
        heatmapWidth,
        heatmapHeight
      );

      // Draw border around heatmap
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        heatmapX,
        heatmapY,
        heatmapWidth,
        heatmapHeight
      );
      ctx.restore();
    } else if (!state.useThreeJS || !state.threeRenderer) {
      // In 3D view without Three.js, render coverage pattern as a flat plane at ground level (0m)
      renderCoveragePlane3D(ctx, off, transition);
    }
    // If Three.js is active, heatmap is rendered as texture in renderThreeJSScene
  } else if (!state.showVisualization) {
    // Draw border even when visualization is off
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      pad(),
      pad(),
      canvas.width - 2 * pad(),
      canvas.height - 2 * pad()
    );
  }

  // Legacy canvas rendering (2D + legacy 3D).
  // IMPORTANT: When Three.js is active in 3D mode, skip 3D elements (walls, antennas, floor planes)
  // but keep 2D elements (calibration lines, etc.)
  // XD Tab Isolation: skip wall/floor rendering in XD tab
  if (!useThree3D && state.activeSection !== 'xd') {
    // Floor planes - render with background image as texture in both 2D and 3D
    // Floor planes use the image portion that the rectangle covers as texture
    // Sort floor planes by z-depth in 3D view to ensure proper rendering order
    var floorPlanesToRender = state.floorPlanes.slice();
    if (transition > 0) {
      // Sort by average z-depth (higher z = further back, render first)
      floorPlanesToRender.sort(function (a, b) {
        var getAvgZ = function (fp) {
          var baseHeight = fp.height || 0;
          var planeType = fp.type || "horizontal";
          var getZForPoint = function (x, y) {
            var z;
            if (planeType === "horizontal") {
              z = baseHeight;
            } else {
              var inclination = ((fp.inclination || 0) * Math.PI) / 180;
              var direction =
                ((fp.inclinationDirection || 0) * Math.PI) / 180;
              var centerX = (fp.p1.x + fp.p2.x + fp.p3.x + fp.p4.x) / 4;
              var centerY = (fp.p1.y + fp.p2.y + fp.p3.y + fp.p4.y) / 4;
              var dx = x - centerX;
              var dy = y - centerY;
              var distance =
                dx * Math.cos(direction) + dy * Math.sin(direction);
              z = baseHeight + distance * Math.tan(inclination);
            }
            // Ensure floor planes are always rendered above the ground plane (z=0)
            // Add a minimum offset to prevent z-fighting and ensure visibility above ground
            return Math.max(z, 0.1);
          };
          var z1 = getZForPoint(fp.p1.x, fp.p1.y);
          var z2 = getZForPoint(fp.p2.x, fp.p2.y);
          var z3 = getZForPoint(fp.p3.x, fp.p3.y);
          var z4 = getZForPoint(fp.p4.x, fp.p4.y);
          return (z1 + z2 + z3 + z4) / 4;
        };
        return getAvgZ(b) - getAvgZ(a); // Sort descending (higher z first, so lower z renders last on top)
      });
    }
    for (i = 0; i < floorPlanesToRender.length; i++) {
      var fp = floorPlanesToRender[i];

      if (!state.backgroundImage || !fp.imgP1) {
        // No image or no image coordinates - use solid gray color
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = "source-over";

        // Calculate Z coordinates for 3D rendering
        var baseHeight = fp.height || 0;
        var planeType = fp.type || "horizontal";

        var getZForPoint = function (x, y) {
          var z;
          if (planeType === "horizontal") {
            z = baseHeight;
          } else {
            var inclination = ((fp.inclination || 0) * Math.PI) / 180;
            var direction =
              ((fp.inclinationDirection || 0) * Math.PI) / 180;
            var centerX = (fp.p1.x + fp.p2.x + fp.p3.x + fp.p4.x) / 4;
            var centerY = (fp.p1.y + fp.p2.y + fp.p3.y + fp.p4.y) / 4;
            var dx = x - centerX;
            var dy = y - centerY;
            var distance =
              dx * Math.cos(direction) + dy * Math.sin(direction);
            z = baseHeight + distance * Math.tan(inclination);
          }
          // Ensure floor planes are always rendered above the ground plane (z=0)
          // Add a minimum offset to prevent z-fighting and ensure visibility above ground
          return Math.max(z, 0.1);
        };

        var z1 = getZForPoint(fp.p1.x, fp.p1.y);
        var z2 = getZForPoint(fp.p2.x, fp.p2.y);
        var z3 = getZForPoint(fp.p3.x, fp.p3.y);
        var z4 = getZForPoint(fp.p4.x, fp.p4.y);

        if (transition > 0) {
          // 3D view - render with proper Z coordinates
          var p1_2d = { x: mx(fp.p1.x), y: my(fp.p1.y) };
          var p2_2d = { x: mx(fp.p2.x), y: my(fp.p2.y) };
          var p3_2d = { x: mx(fp.p3.x), y: my(fp.p3.y) };
          var p4_2d = { x: mx(fp.p4.x), y: my(fp.p4.y) };

          var p1_3d = projectToCanvas3D(fp.p1.x, fp.p1.y, z1);
          var p2_3d = projectToCanvas3D(fp.p2.x, fp.p2.y, z2);
          var p3_3d = projectToCanvas3D(fp.p3.x, fp.p3.y, z3);
          var p4_3d = projectToCanvas3D(fp.p4.x, fp.p4.y, z4);

          var canvasP1 = {
            x: p1_2d.x + (p1_3d.x - p1_2d.x) * transition,
            y: p1_2d.y + (p1_3d.y - p1_2d.y) * transition,
          };
          var canvasP2 = {
            x: p2_2d.x + (p2_3d.x - p2_2d.x) * transition,
            y: p2_2d.y + (p2_3d.y - p2_2d.y) * transition,
          };
          var canvasP3 = {
            x: p3_2d.x + (p3_3d.x - p3_2d.x) * transition,
            y: p3_2d.y + (p3_3d.y - p3_2d.y) * transition,
          };
          var canvasP4 = {
            x: p4_2d.x + (p4_3d.x - p4_2d.x) * transition,
            y: p4_2d.y + (p4_3d.y - p4_2d.y) * transition,
          };

          ctx.fillStyle = "#8b8b8b";
          ctx.beginPath();
          ctx.moveTo(canvasP1.x, canvasP1.y);
          ctx.lineTo(canvasP2.x, canvasP2.y);
          ctx.lineTo(canvasP3.x, canvasP3.y);
          ctx.lineTo(canvasP4.x, canvasP4.y);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = "#6b6b6b";
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // 2D view
          ctx.fillStyle = "#8b8b8b";
          ctx.beginPath();
          ctx.moveTo(mx(fp.p1.x), my(fp.p1.y));
          ctx.lineTo(mx(fp.p2.x), my(fp.p2.y));
          ctx.lineTo(mx(fp.p3.x), my(fp.p3.y));
          ctx.lineTo(mx(fp.p4.x), my(fp.p4.y));
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#6b6b6b";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.restore();
        continue;
      }

      ctx.save();

      var imgWidth = state.backgroundImage.width;
      var imgHeight = state.backgroundImage.height;

      // Calculate source rectangle in image pixel coordinates (the portion of image to extract)
      var srcMinX = Math.min(
        fp.imgP1.x,
        fp.imgP2.x,
        fp.imgP3.x,
        fp.imgP4.x
      );
      var srcMaxX = Math.max(
        fp.imgP1.x,
        fp.imgP2.x,
        fp.imgP3.x,
        fp.imgP4.x
      );
      var srcMinY = Math.min(
        fp.imgP1.y,
        fp.imgP2.y,
        fp.imgP3.y,
        fp.imgP4.y
      );
      var srcMaxY = Math.max(
        fp.imgP1.y,
        fp.imgP2.y,
        fp.imgP3.y,
        fp.imgP4.y
      );

      // Ensure source coordinates are within image bounds
      var srcX = Math.max(0, Math.min(Math.floor(srcMinX), imgWidth - 1));
      var srcY = Math.max(
        0,
        Math.min(Math.floor(srcMinY), imgHeight - 1)
      );
      var srcWidth = Math.max(
        1,
        Math.min(Math.ceil(srcMaxX - srcMinX), imgWidth - srcX)
      );
      var srcHeight = Math.max(
        1,
        Math.min(Math.ceil(srcMaxY - srcMinY), imgHeight - srcY)
      );

      if (transition > 0) {
        // 3D view - render floor plane as a 3D surface with image texture
        // Calculate Z coordinates for each corner based on height and inclination
        var baseHeight = fp.height || 0;
        var planeType = fp.type || "horizontal";

        // Function to calculate Z coordinate for a point on the plane
        var getZForPoint = function (x, y) {
          var z;
          if (planeType === "horizontal") {
            z = baseHeight;
          } else {
            // Inclined plane - calculate Z based on inclination angle and direction
            var inclination = ((fp.inclination || 0) * Math.PI) / 180; // Convert to radians
            var direction =
              ((fp.inclinationDirection || 0) * Math.PI) / 180; // Convert to radians

            // Calculate center of plane
            var centerX = (fp.p1.x + fp.p2.x + fp.p3.x + fp.p4.x) / 4;
            var centerY = (fp.p1.y + fp.p2.y + fp.p3.y + fp.p4.y) / 4;

            // Calculate distance from center in the direction of inclination
            var dx = x - centerX;
            var dy = y - centerY;

            // Project onto the inclination direction vector
            var distance =
              dx * Math.cos(direction) + dy * Math.sin(direction);

            // Calculate Z based on distance and inclination angle
            z = baseHeight + distance * Math.tan(inclination);
          }
          // Ensure floor planes are always rendered above the ground plane (z=0)
          // Add a minimum offset to prevent z-fighting and ensure visibility above ground
          return Math.max(z, 0.1);
        };

        var z1 = getZForPoint(fp.p1.x, fp.p1.y);
        var z2 = getZForPoint(fp.p2.x, fp.p2.y);
        var z3 = getZForPoint(fp.p3.x, fp.p3.y);
        var z4 = getZForPoint(fp.p4.x, fp.p4.y);

        var p1_2d = { x: mx(fp.p1.x), y: my(fp.p1.y) };
        var p2_2d = { x: mx(fp.p2.x), y: my(fp.p2.y) };
        var p3_2d = { x: mx(fp.p3.x), y: my(fp.p3.y) };
        var p4_2d = { x: mx(fp.p4.x), y: my(fp.p4.y) };

        var p1_3d = projectToCanvas3D(fp.p1.x, fp.p1.y, z1);
        var p2_3d = projectToCanvas3D(fp.p2.x, fp.p2.y, z2);
        var p3_3d = projectToCanvas3D(fp.p3.x, fp.p3.y, z3);
        var p4_3d = projectToCanvas3D(fp.p4.x, fp.p4.y, z4);

        // Interpolate between 2D and 3D positions
        var canvasP1 = {
          x: p1_2d.x + (p1_3d.x - p1_2d.x) * transition,
          y: p1_2d.y + (p1_3d.y - p1_2d.y) * transition,
        };
        var canvasP2 = {
          x: p2_2d.x + (p2_3d.x - p2_2d.x) * transition,
          y: p2_2d.y + (p2_3d.y - p2_2d.y) * transition,
        };
        var canvasP3 = {
          x: p3_2d.x + (p3_3d.x - p3_2d.x) * transition,
          y: p3_2d.y + (p3_3d.y - p3_2d.y) * transition,
        };
        var canvasP4 = {
          x: p4_2d.x + (p4_3d.x - p4_2d.x) * transition,
          y: p4_2d.y + (p4_3d.y - p4_2d.y) * transition,
        };

        // Set opacity for 3D floor plane - fully opaque
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = "source-over";

        // Draw the image mapped to the four 3D-projected corners
        if (srcWidth > 0 && srcHeight > 0) {
          // Create projector function that maps World (x,y) -> Screen (x,y)
          // This handles Z-elevation and Perspective projection internally
          var projector = function (p) {
            // Calculate Z based on floor plane settings
            var z = baseHeight;
            if (planeType !== "horizontal") {
              var inclination = ((fp.inclination || 0) * Math.PI) / 180;
              var direction =
                ((fp.inclinationDirection || 0) * Math.PI) / 180;
              var centerX = (fp.p1.x + fp.p2.x + fp.p3.x + fp.p4.x) / 4;
              var centerY = (fp.p1.y + fp.p2.y + fp.p3.y + fp.p4.y) / 4;
              var dx = p.x - centerX;
              var dy = p.y - centerY;
              var distance =
                dx * Math.cos(direction) + dy * Math.sin(direction);
              z = baseHeight + distance * Math.tan(inclination);
            }

            var p2d = { x: mx(p.x), y: my(p.y) };
            var p3d = projectToCanvas3D(p.x, p.y, z);

            return {
              x: p2d.x + (p3d.x - p2d.x) * transition,
              y: p2d.y + (p3d.y - p2d.y) * transition,
            };
          };

          // Map image using world coordinates and projector
          drawProjectedImage(
            ctx,
            state.backgroundImage,
            srcX,
            srcY,
            srcWidth,
            srcHeight,
            fp.p1,
            fp.p2,
            fp.p3,
            fp.p4,
            projector
          );
        } else {
          // Fallback: draw solid color if image extraction fails
          ctx.fillStyle = "#8b8b8b";
          ctx.beginPath();
          // Calculate canvas coordinates for fallback (reusing logic as projector is local)
          // We can just project the 4 corners directly
          var getZ = function (p) {
            if (planeType === "horizontal") return baseHeight;
            var inclination = ((fp.inclination || 0) * Math.PI) / 180;
            var direction =
              ((fp.inclinationDirection || 0) * Math.PI) / 180;
            var centerX = (fp.p1.x + fp.p2.x + fp.p3.x + fp.p4.x) / 4;
            var centerY = (fp.p1.y + fp.p2.y + fp.p3.y + fp.p4.y) / 4;
            var dx = p.x - centerX;
            var dy = p.y - centerY;
            var distance =
              dx * Math.cos(direction) + dy * Math.sin(direction);
            return baseHeight + distance * Math.tan(inclination);
          };
          var project = function (p) {
            var z = getZ(p);
            var p2d = { x: mx(p.x), y: my(p.y) };
            var p3d = projectToCanvas3D(p.x, p.y, z);
            return {
              x: p2d.x + (p3d.x - p2d.x) * transition,
              y: p2d.y + (p3d.y - p2d.y) * transition,
            };
          };
          var cP1 = project(fp.p1);
          var cP2 = project(fp.p2);
          var cP3 = project(fp.p3);
          var cP4 = project(fp.p4);

          ctx.moveTo(cP1.x, cP1.y);
          ctx.lineTo(cP2.x, cP2.y);
          ctx.lineTo(cP3.x, cP3.y);
          ctx.lineTo(cP4.x, cP4.y);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // 2D view - render floor plane with image texture
        // Map image pixel coordinates to canvas coordinates
        var imgToCanvas = function (imgX, imgY) {
          // Image pixel (0,0) maps to canvas (mx(0), my(0))
          // Image pixel (imgWidth, imgHeight) maps to canvas (mx(state.w), my(state.h))
          var canvasX = mx(0) + (imgX / imgWidth) * (mx(state.w) - mx(0));
          var canvasY =
            my(0) + (imgY / imgHeight) * (my(state.h) - my(0));
          return { x: canvasX, y: canvasY };
        };

        // Convert image pixel coordinates to canvas coordinates
        var canvasP1 = imgToCanvas(fp.imgP1.x, fp.imgP1.y);
        var canvasP2 = imgToCanvas(fp.imgP2.x, fp.imgP2.y);
        var canvasP3 = imgToCanvas(fp.imgP3.x, fp.imgP3.y);
        var canvasP4 = imgToCanvas(fp.imgP4.x, fp.imgP4.y);

        // Calculate destination rectangle in canvas coordinates
        var dstMinX = Math.min(
          canvasP1.x,
          canvasP2.x,
          canvasP3.x,
          canvasP4.x
        );
        var dstMaxX = Math.max(
          canvasP1.x,
          canvasP2.x,
          canvasP3.x,
          canvasP4.x
        );
        var dstMinY = Math.min(
          canvasP1.y,
          canvasP2.y,
          canvasP3.y,
          canvasP4.y
        );
        var dstMaxY = Math.max(
          canvasP1.y,
          canvasP2.y,
          canvasP3.y,
          canvasP4.y
        );

        var dstWidth = dstMaxX - dstMinX;
        var dstHeight = dstMaxY - dstMinY;

        // Set opacity for floor plane - fully opaque
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = "source-over";

        // Set up clipping path for the floor plane rectangle
        ctx.beginPath();
        ctx.moveTo(canvasP1.x, canvasP1.y);
        ctx.lineTo(canvasP2.x, canvasP2.y);
        ctx.lineTo(canvasP3.x, canvasP3.y);
        ctx.lineTo(canvasP4.x, canvasP4.y);
        ctx.closePath();
        ctx.clip();

        // Draw the image portion - this makes the floor plane "stick" to the image
        if (
          srcWidth > 0 &&
          srcHeight > 0 &&
          dstWidth > 0 &&
          dstHeight > 0
        ) {
          ctx.drawImage(
            state.backgroundImage,
            srcX,
            srcY,
            srcWidth,
            srcHeight, // Source rectangle in image (pixel coords)
            dstMinX,
            dstMinY,
            dstWidth,
            dstHeight // Destination rectangle in canvas
          );
        }
      }

      ctx.restore();

      // Draw border to show the floor plane boundary
      var borderP1, borderP2, borderP3, borderP4;
      if (transition > 0) {
        // 3D border - use same z calculation as floor plane surface
        var baseHeight = fp.height || 0;
        var planeType = fp.type || "horizontal";

        var getZForPoint = function (x, y) {
          if (planeType === "horizontal") {
            return baseHeight;
          } else {
            var inclination = ((fp.inclination || 0) * Math.PI) / 180;
            var direction =
              ((fp.inclinationDirection || 0) * Math.PI) / 180;
            var centerX = (fp.p1.x + fp.p2.x + fp.p3.x + fp.p4.x) / 4;
            var centerY = (fp.p1.y + fp.p2.y + fp.p3.y + fp.p4.y) / 4;
            var dx = x - centerX;
            var dy = y - centerY;
            var distance =
              dx * Math.cos(direction) + dy * Math.sin(direction);
            return baseHeight + distance * Math.tan(inclination);
          }
        };

        var z1 = getZForPoint(fp.p1.x, fp.p1.y);
        var z2 = getZForPoint(fp.p2.x, fp.p2.y);
        var z3 = getZForPoint(fp.p3.x, fp.p3.y);
        var z4 = getZForPoint(fp.p4.x, fp.p4.y);

        var p1_2d = { x: mx(fp.p1.x), y: my(fp.p1.y) };
        var p2_2d = { x: mx(fp.p2.x), y: my(fp.p2.y) };
        var p3_2d = { x: mx(fp.p3.x), y: my(fp.p3.y) };
        var p4_2d = { x: mx(fp.p4.x), y: my(fp.p4.y) };
        var p1_3d = projectToCanvas3D(fp.p1.x, fp.p1.y, z1);
        var p2_3d = projectToCanvas3D(fp.p2.x, fp.p2.y, z2);
        var p3_3d = projectToCanvas3D(fp.p3.x, fp.p3.y, z3);
        var p4_3d = projectToCanvas3D(fp.p4.x, fp.p4.y, z4);
        borderP1 = {
          x: p1_2d.x + (p1_3d.x - p1_2d.x) * transition,
          y: p1_2d.y + (p1_3d.y - p1_2d.y) * transition,
        };
        borderP2 = {
          x: p2_2d.x + (p2_3d.x - p2_2d.x) * transition,
          y: p2_2d.y + (p2_3d.y - p2_2d.y) * transition,
        };
        borderP3 = {
          x: p3_2d.x + (p3_3d.x - p3_2d.x) * transition,
          y: p3_2d.y + (p3_3d.y - p3_2d.y) * transition,
        };
        borderP4 = {
          x: p4_2d.x + (p4_3d.x - p4_2d.x) * transition,
          y: p4_2d.y + (p4_3d.y - p4_2d.y) * transition,
        };
      } else {
        // 2D border - use image coordinates
        var imgToCanvas = function (imgX, imgY) {
          var imgWidth = state.backgroundImage.width;
          var imgHeight = state.backgroundImage.height;
          var canvasX = mx(0) + (imgX / imgWidth) * (mx(state.w) - mx(0));
          var canvasY =
            my(0) + (imgY / imgHeight) * (my(state.h) - my(0));
          return { x: canvasX, y: canvasY };
        };
        borderP1 = imgToCanvas(fp.imgP1.x, fp.imgP1.y);
        borderP2 = imgToCanvas(fp.imgP2.x, fp.imgP2.y);
        borderP3 = imgToCanvas(fp.imgP3.x, fp.imgP3.y);
        borderP4 = imgToCanvas(fp.imgP4.x, fp.imgP4.y);
      }

      ctx.strokeStyle = "#6b6b6b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(borderP1.x, borderP1.y);
      ctx.lineTo(borderP2.x, borderP2.y);
      ctx.lineTo(borderP3.x, borderP3.y);
      ctx.lineTo(borderP4.x, borderP4.y);
      ctx.closePath();
      ctx.stroke();
    }

    // temp floor plane - render while drawing
    if (state.tempFloorPlane) {
      ctx.save();

      // Calculate canvas coordinates for the temp floor plane
      var canvasP1, canvasP2, canvasP3, canvasP4;

      if (transition > 0) {
        // 3D view - project to 3D using height and type settings
        var baseHeight = state.floorPlaneHeight || 0;
        var planeType = state.floorPlaneType || "horizontal";

        var getZForPoint = function (x, y) {
          if (planeType === "horizontal") {
            return baseHeight;
          } else {
            var inclination =
              ((state.floorPlaneInclination || 0) * Math.PI) / 180;
            var direction =
              ((state.floorPlaneInclinationDirection || 0) * Math.PI) /
              180;
            var centerX =
              (state.tempFloorPlane.p1.x +
               state.tempFloorPlane.p2.x +
               state.tempFloorPlane.p3.x +
               state.tempFloorPlane.p4.x) /
              4;
            var centerY =
              (state.tempFloorPlane.p1.y +
               state.tempFloorPlane.p2.y +
               state.tempFloorPlane.p3.y +
               state.tempFloorPlane.p4.y) /
              4;
            var dx = x - centerX;
            var dy = y - centerY;
            var distance =
              dx * Math.cos(direction) + dy * Math.sin(direction);
            return baseHeight + distance * Math.tan(inclination);
          }
        };

        var z1 = getZForPoint(
          state.tempFloorPlane.p1.x,
          state.tempFloorPlane.p1.y
        );
        var z2 = getZForPoint(
          state.tempFloorPlane.p2.x,
          state.tempFloorPlane.p2.y
        );
        var z3 = getZForPoint(
          state.tempFloorPlane.p3.x,
          state.tempFloorPlane.p3.y
        );
        var z4 = getZForPoint(
          state.tempFloorPlane.p4.x,
          state.tempFloorPlane.p4.y
        );

        var p1_2d = {
          x: mx(state.tempFloorPlane.p1.x),
          y: my(state.tempFloorPlane.p1.y),
        };
        var p2_2d = {
          x: mx(state.tempFloorPlane.p2.x),
          y: my(state.tempFloorPlane.p2.y),
        };
        var p3_2d = {
          x: mx(state.tempFloorPlane.p3.x),
          y: my(state.tempFloorPlane.p3.y),
        };
        var p4_2d = {
          x: mx(state.tempFloorPlane.p4.x),
          y: my(state.tempFloorPlane.p4.y),
        };

        var p1_3d = projectToCanvas3D(
          state.tempFloorPlane.p1.x,
          state.tempFloorPlane.p1.y,
          z1
        );
        var p2_3d = projectToCanvas3D(
          state.tempFloorPlane.p2.x,
          state.tempFloorPlane.p2.y,
          z2
        );
        var p3_3d = projectToCanvas3D(
          state.tempFloorPlane.p3.x,
          state.tempFloorPlane.p3.y,
          z3
        );
        var p4_3d = projectToCanvas3D(
          state.tempFloorPlane.p4.x,
          state.tempFloorPlane.p4.y,
          z4
        );

        canvasP1 = {
          x: p1_2d.x + (p1_3d.x - p1_2d.x) * transition,
          y: p1_2d.y + (p1_3d.y - p1_2d.y) * transition,
        };
        canvasP2 = {
          x: p2_2d.x + (p2_3d.x - p2_2d.x) * transition,
          y: p2_2d.y + (p2_3d.y - p2_2d.y) * transition,
        };
        canvasP3 = {
          x: p3_2d.x + (p3_3d.x - p3_2d.x) * transition,
          y: p3_2d.y + (p3_3d.y - p3_2d.y) * transition,
        };
        canvasP4 = {
          x: p4_2d.x + (p4_3d.x - p4_2d.x) * transition,
          y: p4_2d.y + (p4_3d.y - p4_2d.y) * transition,
        };
      } else {
        // 2D view
        canvasP1 = {
          x: mx(state.tempFloorPlane.p1.x),
          y: my(state.tempFloorPlane.p1.y),
        };
        canvasP2 = {
          x: mx(state.tempFloorPlane.p2.x),
          y: my(state.tempFloorPlane.p2.y),
        };
        canvasP3 = {
          x: mx(state.tempFloorPlane.p3.x),
          y: my(state.tempFloorPlane.p3.y),
        };
        canvasP4 = {
          x: mx(state.tempFloorPlane.p4.x),
          y: my(state.tempFloorPlane.p4.y),
        };
      }

      // Draw temp floor plane - fully opaque in 3D, semi-transparent in 2D for preview
      ctx.globalAlpha = transition > 0 ? 1.0 : 0.5;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#8b8b8b";
      ctx.beginPath();
      ctx.moveTo(canvasP1.x, canvasP1.y);
      ctx.lineTo(canvasP2.x, canvasP2.y);
      ctx.lineTo(canvasP3.x, canvasP3.y);
      ctx.lineTo(canvasP4.x, canvasP4.y);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#6b6b6b";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // walls - with smooth 2D/3D transition
    var transition = state.viewModeTransition;
    var wallHeight = 2.5; // Default wall height in meters

    // Function to render corner pieces for joined walls
    function renderWallCorners(ctx, transition) {
      var wallThickness = 0.15; // 15cm wall thickness
      var cornerThreshold = 0.05; // 5cm threshold for detecting corners
      var processedCorners = {}; // Track processed corners to avoid duplicates

      for (var i = 0; i < state.walls.length; i++) {
        var w1 = state.walls[i];
        if (w1.elementType && w1.elementType !== "wall") continue; // Skip doors/windows

        for (var j = i + 1; j < state.walls.length; j++) {
          var w2 = state.walls[j];
          if (w2.elementType && w2.elementType !== "wall") continue; // Skip doors/windows

          // Check if walls share an endpoint (corner)
          var cornerPoint = null;
          var w1Endpoint = null; // Which endpoint of w1
          var w2Endpoint = null; // Which endpoint of w2

          // Check w1.p1 with w2 endpoints
          var dist1 = hypot(w1.p1.x - w2.p1.x, w1.p1.y - w2.p1.y);
          var dist2 = hypot(w1.p1.x - w2.p2.x, w1.p1.y - w2.p2.y);

          if (dist1 < cornerThreshold) {
            cornerPoint = { x: w1.p1.x, y: w1.p1.y };
            w1Endpoint = "p1";
            w2Endpoint = "p1";
          } else if (dist2 < cornerThreshold) {
            cornerPoint = { x: w1.p1.x, y: w1.p1.y };
            w1Endpoint = "p1";
            w2Endpoint = "p2";
          }

          // Check w1.p2 with w2 endpoints
          if (!cornerPoint) {
            dist1 = hypot(w1.p2.x - w2.p1.x, w1.p2.y - w2.p1.y);
            dist2 = hypot(w1.p2.x - w2.p2.x, w1.p2.y - w2.p2.y);

            if (dist1 < cornerThreshold) {
              cornerPoint = { x: w1.p2.x, y: w1.p2.y };
              w1Endpoint = "p2";
              w2Endpoint = "p1";
            } else if (dist2 < cornerThreshold) {
              cornerPoint = { x: w1.p2.x, y: w1.p2.y };
              w1Endpoint = "p2";
              w2Endpoint = "p2";
            }
          }

          if (cornerPoint) {
            // Create unique key for this corner to avoid duplicates
            var cornerKey =
              cornerPoint.x.toFixed(3) + "," + cornerPoint.y.toFixed(3);
            if (processedCorners[cornerKey]) continue;
            processedCorners[cornerKey] = true;

            // Calculate wall directions (pointing away from corner)
            var w1dx = w1.p2.x - w1.p1.x;
            var w1dy = w1.p2.y - w1.p1.y;
            var w1len = Math.sqrt(w1dx * w1dx + w1dy * w1dy);
            var w1dirX = w1len > 0 ? w1dx / w1len : 0;
            var w1dirY = w1len > 0 ? w1dy / w1len : 0;
            if (w1Endpoint === "p1") {
              w1dirX = -w1dirX;
              w1dirY = -w1dirY;
            }

            var w2dx = w2.p2.x - w2.p1.x;
            var w2dy = w2.p2.y - w2.p1.y;
            var w2len = Math.sqrt(w2dx * w2dx + w2dy * w2dy);
            var w2dirX = w2len > 0 ? w2dx / w2len : 0;
            var w2dirY = w2len > 0 ? w2dy / w2len : 0;
            if (w2Endpoint === "p1") {
              w2dirX = -w2dirX;
              w2dirY = -w2dirY;
            }

            // Calculate perpendicular directions for thickness (pointing outward from wall)
            var w1perpX = -w1dirY;
            var w1perpY = w1dirX;
            var w2perpX = -w2dirY;
            var w2perpY = w2dirX;

            // Calculate the corner block points
            // For a proper corner, we need to create an L-shaped block that connects the two walls
            var halfThick = wallThickness / 2;

            // Calculate the 4 points that form the corner block
            // Point 1: Outer corner along wall 1's perpendicular direction
            var outerCorner1 = {
              x: cornerPoint.x + w1perpX * halfThick,
              y: cornerPoint.y + w1perpY * halfThick,
            };
            // Point 2: Outer corner along wall 2's perpendicular direction
            var outerCorner2 = {
              x: cornerPoint.x + w2perpX * halfThick,
              y: cornerPoint.y + w2perpY * halfThick,
            };
            // Point 3: Inner corner (opposite to outerCorner1)
            var innerCorner1 = {
              x: cornerPoint.x - w1perpX * halfThick,
              y: cornerPoint.y - w1perpY * halfThick,
            };
            // Point 4: Inner corner (opposite to outerCorner2)
            var innerCorner2 = {
              x: cornerPoint.x - w2perpX * halfThick,
              y: cornerPoint.y - w2perpY * halfThick,
            };

            // For a proper corner block, we use:
            // - The corner point itself
            // - The two outer corners (extending outward from each wall)
            // - The intersection point of the two inner edges

            // Calculate the intersection of the two inner edges (where the walls' inner faces meet)
            // This is the point where the two inner perpendicular lines intersect
            var innerIntersection = {
              x:
                cornerPoint.x - w1perpX * halfThick - w2perpX * halfThick,
              y:
                cornerPoint.y - w1perpY * halfThick - w2perpY * halfThick,
            };

            // Use the corner point, two outer corners, and inner intersection to form the corner block
            var cp1 = cornerPoint; // The actual corner point
            var cp2 = outerCorner1; // Outer corner along wall 1
            var cp3 = outerCorner2; // Outer corner along wall 2
            var cp4 = innerIntersection; // Inner intersection point

            // Render corner block
            var elementHeight = w1.height || 2.5;
            var elementBottomZ = 0.01;

            // Project corner points to 3D
            var cp1Bottom_3d = projectToCanvas3D(
              cp1.x,
              cp1.y,
              elementBottomZ
            );
            var cp2Bottom_3d = projectToCanvas3D(
              cp2.x,
              cp2.y,
              elementBottomZ
            );
            var cp3Bottom_3d = projectToCanvas3D(
              cp3.x,
              cp3.y,
              elementBottomZ
            );
            var cp4Bottom_3d = projectToCanvas3D(
              cp4.x,
              cp4.y,
              elementBottomZ
            );

            var cp1Top_3d = projectToCanvas3D(
              cp1.x,
              cp1.y,
              elementBottomZ + elementHeight
            );
            var cp2Top_3d = projectToCanvas3D(
              cp2.x,
              cp2.y,
              elementBottomZ + elementHeight
            );
            var cp3Top_3d = projectToCanvas3D(
              cp3.x,
              cp3.y,
              elementBottomZ + elementHeight
            );
            var cp4Top_3d = projectToCanvas3D(
              cp4.x,
              cp4.y,
              elementBottomZ + elementHeight
            );

            // Interpolate for transition
            var cp1_2d = { x: mx(cp1.x), y: my(cp1.y) };
            var cp2_2d = { x: mx(cp2.x), y: my(cp2.y) };
            var cp3_2d = { x: mx(cp3.x), y: my(cp3.y) };
            var cp4_2d = { x: mx(cp4.x), y: my(cp4.y) };

            var cp1Bottom = {
              x: cp1_2d.x + (cp1Bottom_3d.x - cp1_2d.x) * transition,
              y: cp1_2d.y + (cp1Bottom_3d.y - cp1_2d.y) * transition,
            };
            var cp2Bottom = {
              x: cp2_2d.x + (cp2Bottom_3d.x - cp2_2d.x) * transition,
              y: cp2_2d.y + (cp2Bottom_3d.y - cp2_2d.y) * transition,
            };
            var cp3Bottom = {
              x: cp3_2d.x + (cp3Bottom_3d.x - cp3_2d.x) * transition,
              y: cp3_2d.y + (cp3Bottom_3d.y - cp3_2d.y) * transition,
            };
            var cp4Bottom = {
              x: cp4_2d.x + (cp4Bottom_3d.x - cp4_2d.x) * transition,
              y: cp4_2d.y + (cp4Bottom_3d.y - cp4_2d.y) * transition,
            };

            var cp1Top = {
              x: cp1_2d.x + (cp1Top_3d.x - cp1_2d.x) * transition,
              y: cp1_2d.y + (cp1Top_3d.y - cp1_2d.y) * transition,
            };
            var cp2Top = {
              x: cp2_2d.x + (cp2Top_3d.x - cp2_2d.x) * transition,
              y: cp2_2d.y + (cp2Top_3d.y - cp2_2d.y) * transition,
            };
            var cp3Top = {
              x: cp3_2d.x + (cp3Top_3d.x - cp3_2d.x) * transition,
              y: cp3_2d.y + (cp3Top_3d.y - cp3_2d.y) * transition,
            };
            var cp4Top = {
              x: cp4_2d.x + (cp4Top_3d.x - cp4_2d.x) * transition,
              y: cp4_2d.y + (cp4Top_3d.y - cp4_2d.y) * transition,
            };

            // Get wall color (use first wall's color)
            var wallColor = w1.color || "#60a5fa";
            var rgb = hexToRgb(wallColor);
            if (!rgb) {
              rgb = { r: 96, g: 165, b: 250 };
            }
            var avgDepth =
              (cp1Bottom_3d.depth +
               cp2Bottom_3d.depth +
               cp3Bottom_3d.depth +
               cp4Bottom_3d.depth) /
              4;
            var lightFactor = Math.max(
              0.4,
              Math.min(1.0, 0.7 + avgDepth * 0.01)
            );
            var shadedColor =
              "rgb(" +
              Math.round(rgb.r * lightFactor) +
              "," +
              Math.round(rgb.g * lightFactor) +
              "," +
              Math.round(rgb.b * lightFactor) +
              ")";
            var darkerColor =
              "rgb(" +
              Math.round(rgb.r * lightFactor * 0.7) +
              "," +
              Math.round(rgb.g * lightFactor * 0.7) +
              "," +
              Math.round(rgb.b * lightFactor * 0.7) +
              ")";

            ctx.save();
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = "source-over";

            // Draw corner block faces
            // Top face
            ctx.beginPath();
            ctx.moveTo(cp1Top.x, cp1Top.y);
            ctx.lineTo(cp2Top.x, cp2Top.y);
            ctx.lineTo(cp4Top.x, cp4Top.y);
            ctx.lineTo(cp3Top.x, cp3Top.y);
            ctx.closePath();
            ctx.fillStyle = darkerColor;
            ctx.fill();

            // Bottom face
            ctx.beginPath();
            ctx.moveTo(cp1Bottom.x, cp1Bottom.y);
            ctx.lineTo(cp3Bottom.x, cp3Bottom.y);
            ctx.lineTo(cp4Bottom.x, cp4Bottom.y);
            ctx.lineTo(cp2Bottom.x, cp2Bottom.y);
            ctx.closePath();
            ctx.fillStyle = darkerColor;
            ctx.fill();

            // Side faces
            ctx.fillStyle = shadedColor;
            // Face 1: cp1-cp2
            ctx.beginPath();
            ctx.moveTo(cp1Bottom.x, cp1Bottom.y);
            ctx.lineTo(cp1Top.x, cp1Top.y);
            ctx.lineTo(cp2Top.x, cp2Top.y);
            ctx.lineTo(cp2Bottom.x, cp2Bottom.y);
            ctx.closePath();
            ctx.fill();

            // Face 2: cp2-cp4
            ctx.beginPath();
            ctx.moveTo(cp2Bottom.x, cp2Bottom.y);
            ctx.lineTo(cp2Top.x, cp2Top.y);
            ctx.lineTo(cp4Top.x, cp4Top.y);
            ctx.lineTo(cp4Bottom.x, cp4Bottom.y);
            ctx.closePath();
            ctx.fill();

            // Face 3: cp4-cp3
            ctx.beginPath();
            ctx.moveTo(cp4Bottom.x, cp4Bottom.y);
            ctx.lineTo(cp4Top.x, cp4Top.y);
            ctx.lineTo(cp3Top.x, cp3Top.y);
            ctx.lineTo(cp3Bottom.x, cp3Bottom.y);
            ctx.closePath();
            ctx.fill();

            // Face 4: cp3-cp1
            ctx.beginPath();
            ctx.moveTo(cp3Bottom.x, cp3Bottom.y);
            ctx.lineTo(cp3Top.x, cp3Top.y);
            ctx.lineTo(cp1Top.x, cp1Top.y);
            ctx.lineTo(cp1Bottom.x, cp1Bottom.y);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
          }
        }
      }
    }

    // Reset canvas state before rendering walls to ensure no transparency is inherited
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "source-over";
    ctx.setLineDash([]); // Clear any line dash patterns

    // Render all elements together, sorted by depth for proper occlusion
    // This ensures elements closer to camera render on top of elements farther away
    var elementsToRender = [];

    if (transition > 0) {
      for (i = 0; i < state.walls.length; i++) {
        var w = state.walls[i];
        var elementType = w.elementType || "wall";
        var elementBottomZ = 0.01;
        var elementHeight = 2.5; // Default wall height

        // Use correct height and bottom Z based on element type
        if (elementType === "door" || elementType === "doubleDoor") {
          elementHeight = 2.1; // Door height
          elementBottomZ = 0.01; // Doors start at floor
        } else if (elementType === "window") {
          elementHeight = 1.2; // Window height
          elementBottomZ = 0.9; // Window sill height
        } else {
          elementHeight = w.height || 2.5;
          elementBottomZ = 0.01;
        }

        // Calculate depth for proper sorting - use front face depth (closest to camera)
        // For elements with thickness, we need to find the front face
        var p1Bottom_3d = projectToCanvas3D(
          w.p1.x,
          w.p1.y,
          elementBottomZ
        );
        var p2Bottom_3d = projectToCanvas3D(
          w.p2.x,
          w.p2.y,
          elementBottomZ
        );
        var p1Top_3d = projectToCanvas3D(
          w.p1.x,
          w.p1.y,
          elementBottomZ + elementHeight
        );
        var p2Top_3d = projectToCanvas3D(
          w.p2.x,
          w.p2.y,
          elementBottomZ + elementHeight
        );

        // For elements with thickness, calculate front and back face depths
        var frontDepth, backDepth;
        if (elementType === "wall") {
          // Wall has thickness - calculate front and back face
          var wallThickness = 0.15;
          var dx = w.p2.x - w.p1.x;
          var dy = w.p2.y - w.p1.y;
          var len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            var perpX = ((-dy / len) * wallThickness) / 2;
            var perpY = ((dx / len) * wallThickness) / 2;
            var p1Front_3d = projectToCanvas3D(
              w.p1.x + perpX,
              w.p1.y + perpY,
              elementBottomZ
            );
            var p2Front_3d = projectToCanvas3D(
              w.p2.x + perpX,
              w.p2.y + perpY,
              elementBottomZ
            );
            var p1Back_3d = projectToCanvas3D(
              w.p1.x - perpX,
              w.p1.y - perpY,
              elementBottomZ
            );
            var p2Back_3d = projectToCanvas3D(
              w.p2.x - perpX,
              w.p2.y - perpY,
              elementBottomZ
            );
            frontDepth = Math.min(p1Front_3d.depth, p2Front_3d.depth);
            backDepth = Math.max(p1Back_3d.depth, p2Back_3d.depth);
          } else {
            frontDepth = (p1Bottom_3d.depth + p2Bottom_3d.depth) / 2;
            backDepth = frontDepth;
          }
        } else if (
          elementType === "door" ||
          elementType === "doubleDoor"
        ) {
          // Doors have thickness - calculate front face depth
          var angle = Math.atan2(w.p2.y - w.p1.y, w.p2.x - w.p1.x);
          var perpAngle = angle + Math.PI / 2;
          var doorDepth = 0.05; // 5cm door frame thickness
          var depthOffsetX = (Math.cos(perpAngle) * doorDepth) / 2;
          var depthOffsetY = (Math.sin(perpAngle) * doorDepth) / 2;
          var centerX = (w.p1.x + w.p2.x) / 2;
          var centerY = (w.p1.y + w.p2.y) / 2;
          // Use front face (offset in perpendicular direction)
          var frontP1_3d = projectToCanvas3D(
            w.p1.x + depthOffsetX,
            w.p1.y + depthOffsetY,
            elementBottomZ
          );
          var frontP2_3d = projectToCanvas3D(
            w.p2.x + depthOffsetX,
            w.p2.y + depthOffsetY,
            elementBottomZ
          );
          frontDepth = Math.min(frontP1_3d.depth, frontP2_3d.depth);
          backDepth = Math.max(p1Bottom_3d.depth, p2Bottom_3d.depth);
        } else if (elementType === "window") {
          // Windows have thickness - calculate front face depth
          var angle = Math.atan2(w.p2.y - w.p1.y, w.p2.x - w.p1.x);
          var perpAngle = angle + Math.PI / 2;
          var frameDepth = 0.025; // Half of 5cm frame thickness
          var depthOffsetX = Math.cos(perpAngle) * frameDepth;
          var depthOffsetY = Math.sin(perpAngle) * frameDepth;
          var centerX = (w.p1.x + w.p2.x) / 2;
          var centerY = (w.p1.y + w.p2.y) / 2;
          // Use front face (offset in perpendicular direction)
          var frontP1_3d = projectToCanvas3D(
            w.p1.x + depthOffsetX,
            w.p1.y + depthOffsetY,
            elementBottomZ
          );
          var frontP2_3d = projectToCanvas3D(
            w.p2.x + depthOffsetX,
            w.p2.y + depthOffsetY,
              elementBottomZ
            );
            frontDepth = Math.min(frontP1_3d.depth, frontP2_3d.depth);
            backDepth = Math.max(p1Bottom_3d.depth, p2Bottom_3d.depth);
          } else {
            // Default - use center depth
            frontDepth =
              (p1Bottom_3d.depth +
                p2Bottom_3d.depth +
                p1Top_3d.depth +
                p2Top_3d.depth) /
              4;
            backDepth = frontDepth;
          }

          // Use minimum depth (closest to camera) for sorting - elements closer to camera render last (on top)
          // We want to render back to front, so sort by minimum depth (front face)
          var sortDepth = frontDepth;

          // Determine render priority: doors and windows should render on top of walls
          // Priority: walls = 0, doors/windows = 1 (higher priority = render later/on top)
          var priority = 0;
          if (
            elementType === "door" ||
            elementType === "doubleDoor" ||
            elementType === "window"
          ) {
            priority = 1;
            // Small depth bias to help with sorting within priority group
            // The priority system ensures doors/windows render after walls regardless
            sortDepth = frontDepth - 0.01;
          }

          // Add all elements to the same array for proper depth sorting
          elementsToRender.push({
            wall: w,
            depth: sortDepth,
            frontDepth: frontDepth,
            backDepth: backDepth,
            priority: priority,
            elementType: elementType,
          });
        }
        // Sort by depth (back to front - render farthest first, closest last)
        // Use frontDepth for proper sorting - smaller depth = closer to camera = render later
        elementsToRender.sort(function (a, b) {
          // First, sort by priority (doors/windows after walls)
          if (a.priority !== b.priority) {
            return a.priority - b.priority; // Lower priority (walls) render first
          }
          // Then sort by front depth (closest point to camera)
          if (Math.abs(a.frontDepth - b.frontDepth) > 0.01) {
            return b.frontDepth - a.frontDepth; // Farther first
          }
          // Secondary sort by back depth if front depths are similar
          return b.backDepth - a.backDepth;
        });
      } else {
        // 2D view - no sorting needed
        for (i = 0; i < state.walls.length; i++) {
          elementsToRender.push({ wall: state.walls[i], depth: 0 });
        }
      }

      // Render all elements in depth order (back to front)
      // Reset rendering state
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = "source-over";

      for (i = 0; i < elementsToRender.length; i++) {
        ctx.save(); // Save context state for each element
        var w = elementsToRender[i].wall;
        var isSelected =
          w.id === state.selectedWallId ||
          state.selectedWallIds.indexOf(w.id) !== -1;
        var elementType = w.elementType || "wall";
        var wallColor = w.color || "#60a5fa";

        // Determine correct height and bottom Z for each element type
        var elementHeight = 2.5;
        var elementBottomZ = 0.01;

        if (elementType === "door" || elementType === "doubleDoor") {
          elementHeight = 2.1; // Door height
          elementBottomZ = 0.01; // Doors start at floor
        } else if (elementType === "window") {
          elementHeight = 1.2; // Window height
          elementBottomZ = 0.9; // Window sill height
        } else {
          elementHeight = w.height || 2.5;
          elementBottomZ = 0.01;
        }

        if (transition > 0) {
          // Handle polylines (walls with points array) - for doors/windows, use first and last points
          var renderP1, renderP2;
          if (w.points && w.points.length >= 2) {
            renderP1 = w.points[0];
            renderP2 = w.points[w.points.length - 1];
          } else if (w.p1 && w.p2) {
            renderP1 = w.p1;
            renderP2 = w.p2;
          } else {
            continue; // Skip invalid walls
          }

          // Interpolate between 2D and 3D
          // Walls start at z=0.01 (same as floor plane) and go up to wallHeight
          // This ensures walls align with the floor plane surface
          var p1_2d = { x: mx(renderP1.x), y: my(renderP1.y) };
          var p2_2d = { x: mx(renderP2.x), y: my(renderP2.y) };

          var p1Bottom_3d = projectToCanvas3D(
            renderP1.x,
            renderP1.y,
            elementBottomZ
          );
          var p2Bottom_3d = projectToCanvas3D(
            renderP2.x,
            renderP2.y,
            elementBottomZ
          );
          var p1Top_3d = projectToCanvas3D(
            renderP1.x,
            renderP1.y,
            elementBottomZ + elementHeight
          );
          var p2Top_3d = projectToCanvas3D(
            renderP2.x,
            renderP2.y,
            elementBottomZ + elementHeight
          );

          // Interpolate positions
          var p1Bottom = {
            x: p1_2d.x + (p1Bottom_3d.x - p1_2d.x) * transition,
            y: p1_2d.y + (p1Bottom_3d.y - p1_2d.y) * transition,
          };
          var p2Bottom = {
            x: p2_2d.x + (p2Bottom_3d.x - p2_2d.x) * transition,
            y: p2_2d.y + (p2Bottom_3d.y - p2_2d.y) * transition,
          };
          var p1Top = {
            x: p1_2d.x + (p1Top_3d.x - p1_2d.x) * transition,
            y: p1_2d.y + (p1Top_3d.y - p1_2d.y) * transition,
          };
          var p2Top = {
            x: p2_2d.x + (p2Top_3d.x - p2_2d.x) * transition,
            y: p2_2d.y + (p2Top_3d.y - p2_2d.y) * transition,
          };

          // Render element based on type - ensure fully opaque
          ctx.globalAlpha = 1.0; // Ensure all elements are fully opaque
          ctx.globalCompositeOperation = "source-over"; // Ensure opaque rendering

          if (elementType === "door") {
            renderDoor3D(
              ctx,
              w,
              p1Bottom,
              p2Bottom,
              p1Top,
              p2Top,
              transition,
              isSelected
            );
          } else if (elementType === "doubleDoor") {
            renderDoubleDoor3D(
              ctx,
              w,
              p1Bottom,
              p2Bottom,
              p1Top,
              p2Top,
              transition,
              isSelected
            );
          } else if (elementType === "window") {
            renderWindow3D(
              ctx,
              w,
              p1Bottom,
              p2Bottom,
              p1Top,
              p2Top,
              transition,
              isSelected
            );
          } else {
            // Default wall rendering with thickness
            // Handle polylines (walls with points array)
            var wallSegments = [];
            if (w.points && w.points.length >= 2) {
              for (var segIdx = 0; segIdx < w.points.length - 1; segIdx++) {
                wallSegments.push({
                  p1: w.points[segIdx],
                  p2: w.points[segIdx + 1],
                });
              }
            } else if (w.p1 && w.p2) {
              wallSegments.push({ p1: w.p1, p2: w.p2 });
            }

            // Render each segment of the polyline
            for (var segIdx = 0; segIdx < wallSegments.length; segIdx++) {
              var seg = wallSegments[segIdx];

              // Calculate 3D projections for this segment
              var segP1Bottom_3d = projectToCanvas3D(
                seg.p1.x,
                seg.p1.y,
                elementBottomZ
              );
              var segP2Bottom_3d = projectToCanvas3D(
                seg.p2.x,
                seg.p2.y,
                elementBottomZ
              );
              var segP1Top_3d = projectToCanvas3D(
                seg.p1.x,
                seg.p1.y,
                elementBottomZ + elementHeight
              );
              var segP2Top_3d = projectToCanvas3D(
                seg.p2.x,
                seg.p2.y,
                elementBottomZ + elementHeight
              );

              var avgDepth =
                (segP1Bottom_3d.depth +
                  segP2Bottom_3d.depth +
                  segP1Top_3d.depth +
                  segP2Top_3d.depth) /
                4;
              var lightFactor = Math.max(
                0.4,
                Math.min(1.0, 0.7 + avgDepth * 0.01)
              );
              var rgb = hexToRgb(wallColor);
              if (!rgb) {
                rgb = { r: 96, g: 165, b: 250 }; // Default blue if hexToRgb fails
              }
              var shadedColor =
                "rgb(" +
                Math.round(
                  rgb.r *
                  (1 - transition * 0.3 + lightFactor * transition * 0.3)
                ) +
                "," +
                Math.round(
                  rgb.g *
                  (1 - transition * 0.3 + lightFactor * transition * 0.3)
                ) +
                "," +
                Math.round(
                  rgb.b *
                  (1 - transition * 0.3 + lightFactor * transition * 0.3)
                ) +
                ")";

              // Add thickness to walls (0.15m = 15cm, typical wall thickness)
              var wallThickness = 0.15;

              // Calculate perpendicular direction for thickness
              var dx = seg.p2.x - seg.p1.x;
              var dy = seg.p2.y - seg.p1.y;
              var len = Math.sqrt(dx * dx + dy * dy);
              if (len > 0) {
                var perpX = ((-dy / len) * wallThickness) / 2;
                var perpY = ((dx / len) * wallThickness) / 2;

                // Calculate 8 corners of the thick wall (4 on front face, 4 on back face)
                var p1BottomFront_3d = projectToCanvas3D(
                  seg.p1.x + perpX,
                  seg.p1.y + perpY,
                  elementBottomZ
                );
                var p2BottomFront_3d = projectToCanvas3D(
                  seg.p2.x + perpX,
                  seg.p2.y + perpY,
                  elementBottomZ
                );
                var p1TopFront_3d = projectToCanvas3D(
                  seg.p1.x + perpX,
                  seg.p1.y + perpY,
                  elementBottomZ + elementHeight
                );
                var p2TopFront_3d = projectToCanvas3D(
                  seg.p2.x + perpX,
                  seg.p2.y + perpY,
                  elementBottomZ + elementHeight
                );

                var p1BottomBack_3d = projectToCanvas3D(
                  seg.p1.x - perpX,
                  seg.p1.y - perpY,
                  elementBottomZ
                );
                var p2BottomBack_3d = projectToCanvas3D(
                  seg.p2.x - perpX,
                  seg.p2.y - perpY,
                  elementBottomZ
                );
                var p1TopBack_3d = projectToCanvas3D(
                  seg.p1.x - perpX,
                  seg.p1.y - perpY,
                  elementBottomZ + elementHeight
                );
                var p2TopBack_3d = projectToCanvas3D(
                  seg.p2.x - perpX,
                  seg.p2.y - perpY,
                  elementBottomZ + elementHeight
                );

                // Interpolate for transition
                var p1_2d = { x: mx(seg.p1.x), y: my(seg.p1.y) };
                var p2_2d = { x: mx(seg.p2.x), y: my(seg.p2.y) };

                var p1BottomFront = {
                  x: p1_2d.x + (p1BottomFront_3d.x - p1_2d.x) * transition,
                  y: p1_2d.y + (p1BottomFront_3d.y - p1_2d.y) * transition,
                };
                var p2BottomFront = {
                  x: p2_2d.x + (p2BottomFront_3d.x - p2_2d.x) * transition,
                  y: p2_2d.y + (p2BottomFront_3d.y - p2_2d.y) * transition,
                };
                var p1TopFront = {
                  x: p1_2d.x + (p1TopFront_3d.x - p1_2d.x) * transition,
                  y: p1_2d.y + (p1TopFront_3d.y - p1_2d.y) * transition,
                };
                var p2TopFront = {
                  x: p2_2d.x + (p2TopFront_3d.x - p2_2d.x) * transition,
                  y: p2_2d.y + (p2TopFront_3d.y - p2_2d.y) * transition,
                };

                var p1BottomBack = {
                  x: p1_2d.x + (p1BottomBack_3d.x - p1_2d.x) * transition,
                  y: p1_2d.y + (p1BottomBack_3d.y - p1_2d.y) * transition,
                };
                var p2BottomBack = {
                  x: p2_2d.x + (p2BottomBack_3d.x - p2_2d.x) * transition,
                  y: p2_2d.y + (p2BottomBack_3d.y - p2_2d.y) * transition,
                };
                var p1TopBack = {
                  x: p1_2d.x + (p1TopBack_3d.x - p1_2d.x) * transition,
                  y: p1_2d.y + (p1TopBack_3d.y - p1_2d.y) * transition,
                };
                var p2TopBack = {
                  x: p2_2d.x + (p2TopBack_3d.x - p2_2d.x) * transition,
                  y: p2_2d.y + (p2TopBack_3d.y - p2_2d.y) * transition,
                };

                // Darker color for sides
                var darkerColor =
                  "rgb(" +
                  Math.round(rgb.r * lightFactor * 0.7) +
                  "," +
                  Math.round(rgb.g * lightFactor * 0.7) +
                  "," +
                  Math.round(rgb.b * lightFactor * 0.7) +
                  ")";

                // Draw front face
                ctx.beginPath();
                ctx.moveTo(p1TopFront.x, p1TopFront.y);
                ctx.lineTo(p2TopFront.x, p2TopFront.y);
                ctx.lineTo(p2BottomFront.x, p2BottomFront.y);
                ctx.lineTo(p1BottomFront.x, p1BottomFront.y);
                ctx.closePath();
                ctx.fillStyle = shadedColor;
                ctx.fill();

                // Draw back face
                ctx.beginPath();
                ctx.moveTo(p1BottomBack.x, p1BottomBack.y);
                ctx.lineTo(p2BottomBack.x, p2BottomBack.y);
                ctx.lineTo(p2TopBack.x, p2TopBack.y);
                ctx.lineTo(p1TopBack.x, p1TopBack.y);
                ctx.closePath();
                ctx.fillStyle = shadedColor;
                ctx.fill();

                // Draw left side face
                ctx.beginPath();
                ctx.moveTo(p1TopFront.x, p1TopFront.y);
                ctx.lineTo(p1TopBack.x, p1TopBack.y);
                ctx.lineTo(p1BottomBack.x, p1BottomBack.y);
                ctx.lineTo(p1BottomFront.x, p1BottomFront.y);
                ctx.closePath();
                ctx.fillStyle = darkerColor;
                ctx.fill();

                // Draw right side face
                ctx.beginPath();
                ctx.moveTo(p2TopFront.x, p2TopFront.y);
                ctx.lineTo(p2BottomFront.x, p2BottomFront.y);
                ctx.lineTo(p2BottomBack.x, p2BottomBack.y);
                ctx.lineTo(p2TopBack.x, p2TopBack.y);
                ctx.closePath();
                ctx.fillStyle = darkerColor;
                ctx.fill();

                // Draw top face
                ctx.beginPath();
                ctx.moveTo(p1TopFront.x, p1TopFront.y);
                ctx.lineTo(p2TopFront.x, p2TopFront.y);
                ctx.lineTo(p2TopBack.x, p2TopBack.y);
                ctx.lineTo(p1TopBack.x, p1TopBack.y);
                ctx.closePath();
                ctx.fillStyle = darkerColor;
                ctx.fill();

                // Draw bottom face
                ctx.beginPath();
                ctx.moveTo(p1BottomFront.x, p1BottomFront.y);
                ctx.lineTo(p1BottomBack.x, p1BottomBack.y);
                ctx.lineTo(p2BottomBack.x, p2BottomBack.y);
                ctx.lineTo(p2BottomFront.x, p2BottomFront.y);
                ctx.closePath();
                ctx.fillStyle = darkerColor;
                ctx.fill();
              } else {
                // Fallback to simple rendering if wall has zero length
                var segP1_2d = { x: mx(seg.p1.x), y: my(seg.p1.y) };
                var segP2_2d = { x: mx(seg.p2.x), y: my(seg.p2.y) };
                var segP1Bottom = {
                  x:
                    segP1_2d.x +
                    (segP1Bottom_3d.x - segP1_2d.x) * transition,
                  y:
                    segP1_2d.y +
                    (segP1Bottom_3d.y - segP1_2d.y) * transition,
                };
                var segP2Bottom = {
                  x:
                    segP2_2d.x +
                    (segP2Bottom_3d.x - segP2_2d.x) * transition,
                  y:
                    segP2_2d.y +
                    (segP2Bottom_3d.y - segP2_2d.y) * transition,
                };
                var segP1Top = {
                  x: segP1_2d.x + (segP1Top_3d.x - segP1_2d.x) * transition,
                  y: segP1_2d.y + (segP1Top_3d.y - segP1_2d.y) * transition,
                };
                var segP2Top = {
                  x: segP2_2d.x + (segP2Top_3d.x - segP2_2d.x) * transition,
                  y: segP2_2d.y + (segP2Top_3d.y - segP2_2d.y) * transition,
                };
                ctx.beginPath();
                ctx.moveTo(segP1Top.x, segP1Top.y);
                ctx.lineTo(segP2Top.x, segP2Top.y);
                ctx.lineTo(segP2Bottom.x, segP2Bottom.y);
                ctx.lineTo(segP1Bottom.x, segP1Bottom.y);
                ctx.closePath();
                ctx.fillStyle = shadedColor;
                ctx.fill();
              }

              // Draw edges with enhanced glow for selected walls
              if (isSelected) {
                // Outer glow stroke
                ctx.shadowColor = "#0066ff";
                ctx.shadowBlur = 25;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.strokeStyle = "#0066ff";
                ctx.lineWidth = 5 + transition * 2;
                ctx.stroke();
                // Inner bright stroke
                ctx.shadowBlur = 0;
                ctx.strokeStyle = "#3399ff";
                ctx.lineWidth = 3 + transition;
                ctx.stroke();
              } else {
                ctx.strokeStyle =
                  "rgba(0,0,0," + (0.1 + transition * 0.2) + ")";
                ctx.lineWidth = 1 + transition;
                ctx.stroke();
              }

              // Draw top edge if in 3D
              if (transition > 0.5) {
                var segP1_2d = { x: mx(seg.p1.x), y: my(seg.p1.y) };
                var segP2_2d = { x: mx(seg.p2.x), y: my(seg.p2.y) };
                var segP1Top = {
                  x: segP1_2d.x + (segP1Top_3d.x - segP1_2d.x) * transition,
                  y: segP1_2d.y + (segP1Top_3d.y - segP1_2d.y) * transition,
                };
                var segP2Top = {
                  x: segP2_2d.x + (segP2Top_3d.x - segP2_2d.x) * transition,
                  y: segP2_2d.y + (segP2Top_3d.y - segP2_2d.y) * transition,
                };
                ctx.beginPath();
                ctx.moveTo(segP1Top.x, segP1Top.y);
                ctx.lineTo(segP2Top.x, segP2Top.y);
                ctx.strokeStyle =
                  "rgba(255,255,255," + (transition - 0.5) * 1 + ")";
                ctx.lineWidth = 1;
                ctx.stroke();
              }
            } // End of if(len > 0)
          } // End of segment rendering loop
        } else {
          // Pure 2D rendering for all elements
          // Handle polylines (walls with points array)
          var wallPoints = [];
          if (w.points && w.points.length >= 2) {
            wallPoints = w.points;
          } else if (w.p1 && w.p2) {
            wallPoints = [w.p1, w.p2];
          }

          if (isSelected) {
            // Enhanced glow effect for selected walls
            ctx.shadowColor = "#0066ff";
            ctx.shadowBlur = 35;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            // Draw multiple strokes for stronger glow
            ctx.lineWidth = (w.thickness || 3) + 2;
            ctx.strokeStyle = "#0066ff";
            ctx.beginPath();
            if (wallPoints.length > 0) {
              ctx.moveTo(mx(wallPoints[0].x), my(wallPoints[0].y));
              for (var ptIdx = 1; ptIdx < wallPoints.length; ptIdx++) {
                ctx.lineTo(
                  mx(wallPoints[ptIdx].x),
                  my(wallPoints[ptIdx].y)
                );
              }
            }
            ctx.stroke();
            // Draw inner stroke with original color
            ctx.shadowBlur = 0;
            ctx.lineWidth = w.thickness || 3;
            ctx.strokeStyle = wallColor;
            ctx.beginPath();
            if (wallPoints.length > 0) {
              ctx.moveTo(mx(wallPoints[0].x), my(wallPoints[0].y));
              for (var ptIdx = 1; ptIdx < wallPoints.length; ptIdx++) {
                ctx.lineTo(
                  mx(wallPoints[ptIdx].x),
                  my(wallPoints[ptIdx].y)
                );
              }
            }
            ctx.stroke();
          } else {
            ctx.lineWidth = w.thickness || 3;
            ctx.strokeStyle = wallColor;
            ctx.beginPath();
            if (wallPoints.length > 0) {
              ctx.moveTo(mx(wallPoints[0].x), my(wallPoints[0].y));
              for (var ptIdx = 1; ptIdx < wallPoints.length; ptIdx++) {
                ctx.lineTo(
                  mx(wallPoints[ptIdx].x),
                  my(wallPoints[ptIdx].y)
                );
              }
            }
            ctx.stroke();
          }
        }
        ctx.restore(); // Restore context state
      }

      // Render corner pieces for joined walls in 3D
      if (transition > 0) {
        renderWallCorners(ctx, transition);
      }

      // Draw intersection snap points when dragging a wall with snapToGrid enabled
      if (
        state.wallDrag &&
        state.snapToGrid &&
        state.wallSnapPoints &&
        state.wallSnapPoints.length > 0
      ) {
        ctx.fillStyle = "#10b981"; // Green for snap point
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        for (var i = 0; i < state.wallSnapPoints.length; i++) {
          var snap = state.wallSnapPoints[i];
          ctx.beginPath();
          ctx.arc(mx(snap.x), my(snap.y), 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(mx(snap.x), my(snap.y), 10, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Draw selection box
      if (state.selectionBox && state.isSelecting) {
        var box = state.selectionBox;
        var minX = Math.min(box.p1.x, box.p2.x);
        var maxX = Math.max(box.p1.x, box.p2.x);
        var minY = Math.min(box.p1.y, box.p2.y);
        var maxY = Math.max(box.p1.y, box.p2.y);

        ctx.save();
        ctx.strokeStyle = "#3b82f6"; // Blue border
        ctx.fillStyle = "rgba(59, 130, 246, 0.1)"; // Light blue fill
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Dashed line
        ctx.beginPath();
        ctx.rect(
          mx(minX),
          my(minY),
          mx(maxX) - mx(minX),
          my(maxY) - my(minY)
        );
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // temp wall polyline or door/window preview - with transition
      if (
        state.temp &&
        ((state.temp.points && state.temp.points.length > 0) ||
          (state.temp.p1 && state.temp.p2))
      ) {
        var elementType = state.selectedElementType || "wall";
        var wallType = null;

        if (elementType === "wall") {
          wallType =
            wallTypes[state.selectedWallType] || wallTypes["custom"];
          if (state.selectedWallType === "custom") {
            wallType = {
              loss: state.customWallLoss,
              color: "#f59e0b",
              thickness: 3,
              name: "Custom",
            };
          }
        } else {
          var elementDef = elementTypes[elementType];
          if (elementDef) {
            wallType = {
              loss: elementDef.loss,
              color: elementDef.color,
              thickness: 3,
              name: elementDef.name,
            };
          } else {
            wallType = {
              loss: 3,
              color: "#60a5fa",
              thickness: 3,
              name: "Element",
            };
          }
        }

        var transition = state.viewModeTransition;
        var wallHeight = 2.5;

        // Check if this is a door/window (uses p1/p2 structure)
        var isDoorWindow =
          state.selectedElementType === "door" ||
          state.selectedElementType === "doubleDoor" ||
          state.selectedElementType === "window";

        if (isDoorWindow && state.temp.p1 && state.temp.p2) {
          // Draw door/window preview as single segment
          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = wallType.color;
          ctx.lineWidth = wallType.thickness;
          ctx.beginPath();
          ctx.moveTo(mx(state.temp.p1.x), my(state.temp.p1.y));
          ctx.lineTo(mx(state.temp.p2.x), my(state.temp.p2.y));
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw starting dot
          ctx.fillStyle = wallType.color;
          ctx.beginPath();
          ctx.arc(
            mx(state.temp.p1.x),
            my(state.temp.p1.y),
            4,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.strokeStyle = wallType.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(
            mx(state.temp.p1.x),
            my(state.temp.p1.y),
            8,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        } else {
          // Draw polyline preview for regular walls
          var points = state.temp.points;
          var preview = state.temp.preview;

          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = wallType.color;
          ctx.lineWidth = wallType.thickness;
          ctx.beginPath();

          // Draw completed segments
          if (points && points.length > 1) {
            ctx.moveTo(mx(points[0].x), my(points[0].y));
            for (var i = 1; i < points.length; i++) {
              ctx.lineTo(mx(points[i].x), my(points[i].y));
            }
          } else if (points && points.length === 1) {
            ctx.moveTo(mx(points[0].x), my(points[0].y));
          }

          // Draw preview line from last point
          if (preview && points && points.length > 0) {
            var lastPoint = points[points.length - 1];
            ctx.lineTo(mx(preview.x), my(preview.y));
          }

          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw snap indicators
        if (state.wallSnapPoints && state.wallSnapPoints.length > 0) {
          ctx.fillStyle = "#10b981";
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          for (var i = 0; i < state.wallSnapPoints.length; i++) {
            var snap = state.wallSnapPoints[i];
            ctx.beginPath();
            ctx.arc(mx(snap.x), my(snap.y), 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(mx(snap.x), my(snap.y), 8, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // Draw horizontal/vertical snap indicator for preview
        if (preview && points.length > 0) {
          var lastPoint = points[points.length - 1];
          var dx = Math.abs(preview.x - lastPoint.x);
          var dy = Math.abs(preview.y - lastPoint.y);
          if (dx > dy && dx > 0.1) {
            // Horizontal - draw horizontal guide line
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(mx(0), my(lastPoint.y));
            ctx.lineTo(mx(state.w), my(lastPoint.y));
            ctx.stroke();
            ctx.setLineDash([]);
          } else if (dy > dx && dy > 0.1) {
            // Vertical - draw vertical guide line
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(mx(lastPoint.x), my(0));
            ctx.lineTo(mx(lastPoint.x), my(state.h));
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // Draw temp calibration line while drawing (like temp walls)
      if (state.tempCalibration && state.tempCalibration.p1) {
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = "#0e7490"; // a distinct cyan color
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(
          mx(state.tempCalibration.p1.x),
          my(state.tempCalibration.p1.y)
        );
        ctx.lineTo(
          mx(state.tempCalibration.p2.x),
          my(state.tempCalibration.p2.y)
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } // end legacy canvas rendering block (skipped when Three.js is active)

    // Draw final calibration line
    if (state.calibrationLine && state.calibrationLine.p1) {
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = "#0e7490"; // a distinct cyan color
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(
        mx(state.calibrationLine.p1.x),
        my(state.calibrationLine.p1.y)
      );
      ctx.lineTo(
        mx(state.calibrationLine.p2.x),
        my(state.calibrationLine.p2.y)
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Zone mode is handled in colorNumeric function - no need to draw boundaries

    // APs - Skip rendering original antennas when Three.js is active in 3D mode
    var useThree3DForAntennas =
      transition > 0 &&
      state.useThreeJS &&
      state.threeRenderer &&
      state.threeScene;
    if (!useThree3DForAntennas && state.activeSection !== 'xd') {
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "12px sans-serif";
      for (i = 0; i < state.aps.length; i++) {
        var ap2 = state.aps[i];
        // Show disabled antennas but grayed out
        var isDisabled = ap2.enabled === false;
        if (isDisabled) {
          ctx.globalAlpha = 0.3; // Make disabled antennas semi-transparent
        }
        var antennaHeight = ap2.z || 2.5; // Default antenna height 2.5m if not specified
        var coverageHeight = 1.5; // Height of coverage pattern plane

        // Calculate position based on view mode
        var px, py;
        if (transition > 0) {
          // 3D view - project antenna to align with coverage pattern center
          // The coverage pattern is rendered at 1.5m, so we project the antenna's
          // (x, y) position at coverage height to align with the pattern center
          var ap2d = { x: mx(ap2.x), y: my(ap2.y) };
          // Project at coverage height to align with coverage pattern
          var ap3d = projectToCanvas3D(ap2.x, ap2.y, coverageHeight);
          px = ap2d.x + (ap3d.x - ap2d.x) * transition;
          py = ap2d.y + (ap3d.y - ap2d.y) * transition;
        } else {
          // 2D view - use standard 2D coordinates
          px = mx(ap2.x);
          py = my(ap2.y);
        }

        // Draw AP center point with selection highlighting
        // Check if this AP is being dragged - use the drag object directly if it exists
        var isDragged = state.drag && state.drag.id === ap2.id;
        var isSelected = ap2.id === state.selectedApId || isDragged;

        // If being dragged, use the current drag position for rendering
        if (isDragged && state.drag) {
          // Recalculate position using drag position
          if (transition > 0) {
            var dragCoverageHeight = 1.5; // Coverage height for alignment
            var drag2d = { x: mx(state.drag.x), y: my(state.drag.y) };
            var drag3d = projectToCanvas3D(
              state.drag.x,
              state.drag.y,
              dragCoverageHeight
            );
            px = drag2d.x + (drag3d.x - drag2d.x) * transition;
            py = drag2d.y + (drag3d.y - drag2d.y) * transition;
          } else {
            px = mx(state.drag.x);
            py = my(state.drag.y);
          }
        }

        if (isSelected) {
          // Draw glow effect for selected antenna
          ctx.shadowBlur = 15;
          ctx.shadowColor = "#06b6d4"; // Cyan glow
          ctx.fillStyle = "#06b6d4"; // Bright cyan for selected
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#000000"; // Black for unselected
        }

        // Draw Butterfly Shape (Circle with X and opposite quadrants filled)
        var r = isSelected ? 11 : 9;

        // Draw white background circle (to match 3D rendering)
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Set stroke style to match the fill style (which handles selection color)
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1.5;

        // Draw outer circle
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.stroke();

        // Draw filled quadrants (Right and Left)
        ctx.beginPath();
        // Right Quadrant (-45 to 45 degrees)
        ctx.moveTo(px, py);
        ctx.arc(px, py, r, -Math.PI / 4, Math.PI / 4);
        ctx.lineTo(px, py);
        // Left Quadrant (135 to 225 degrees)
        ctx.moveTo(px, py);
        ctx.arc(px, py, r, (3 * Math.PI) / 4, (5 * Math.PI) / 4);
        ctx.lineTo(px, py);
        ctx.fill();

        // Reset shadow for subsequent drawings
        ctx.shadowBlur = 0;

        // Draw azimuth line - use current position (updated if dragging)
        var angle = (((ap2.azimuth || 0) - 90) * Math.PI) / 180; // -90 because 0 degrees is north (up), but canvas 0 radians is east (right)
        var lineLength = 18; // length of the azimuth indicator line (increased from 12)
        var endX = px + lineLength * Math.cos(angle);
        var endY = py + lineLength * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = "#e11d48"; // Use a distinct color for the azimuth line
        ctx.lineWidth = 3; // Increased from 2 for thicker line
        ctx.stroke();

        // Draw arrowhead at the end of the line
        var arrowLength = 8; // Length of arrowhead
        var arrowAngle = Math.PI / 4; // 30 degrees for arrowhead angle
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        // Left side of arrowhead
        ctx.lineTo(
          endX - arrowLength * Math.cos(angle - arrowAngle),
          endY - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.moveTo(endX, endY);
        // Right side of arrowhead
        ctx.lineTo(
          endX - arrowLength * Math.cos(angle + arrowAngle),
          endY - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.strokeStyle = "#e11d48"; // Same color as the line
        ctx.lineWidth = 2; // Same thickness as the line
        ctx.stroke();

        // Draw antenna label - use current position (updated if dragging)
        ctx.fillStyle = "#ffffff";
        ctx.fillText(ap2.id + "(ch" + ap2.ch + ")", px + 8, py - 8);
        ctx.fillStyle = "#e5e7eb";

        // Reset alpha if antenna was disabled
        if (isDisabled) {
          ctx.globalAlpha = 1.0;
        }
      }
    } // End of legacy antenna rendering (skipped when Three.js is active)

    // legends - only show if visualization is enabled
    if (state.showVisualization) {
      if (numericLegend) {
        updateLegendBar();
        var legendMinEl = document.getElementById("legendMin");
        if (legendMinEl) legendMinEl.textContent = state.minVal;
        var legendMaxEl = document.getElementById("legendMax");
        if (legendMaxEl) legendMaxEl.textContent = state.maxVal;
        document.getElementById("catLegend").style.display = "none";
      } else {
        var cat = document.getElementById("catLegend");
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
      document.getElementById("legendBar").style.display = "none";
      document.getElementById("legendMin").style.display = "none";
      document.getElementById("legendMax").style.display = "none";
      document.getElementById("catLegend").style.display = "none";
    }

    var addBtn = document.getElementById("addWall");
    if (!state.selectedElementType) {
      addBtn.style.display = "none";
    } else {
      addBtn.style.display = "";
      if (state.addingWall || state.addingFloorPlane) {
        if (addBtn.className.indexOf("toggled") === -1)
          addBtn.className += " toggled";
        var drawingText = getAddButtonText(true);
        if (addBtn.textContent !== drawingText)
          addBtn.textContent = drawingText;
      } else {
        addBtn.className = addBtn.className.replace(" toggled", "");
        var normalText = getAddButtonText(false);
        if (addBtn.textContent !== normalText)
          addBtn.textContent = normalText;
      }
    }

    var addAPBtn = document.getElementById("addAP");
    if (state.addingAP) {
      if (addAPBtn.className.indexOf("toggled") === -1)
        addAPBtn.className += " toggled";
      if (addAPBtn.textContent !== "Placing...")
        addAPBtn.textContent = "Placing...";
    } else {
      addAPBtn.className = addAPBtn.className.replace(" toggled", "");
      if (addAPBtn.textContent !== "Add Antenna")
        addAPBtn.textContent = "Add Antenna";
    }

    var addFloorPlaneBtn = document.getElementById("addFloorPlane");
    if (addFloorPlaneBtn) {
      if (state.addingFloorPlane) {
        if (addFloorPlaneBtn.className.indexOf("toggled") === -1)
          addFloorPlaneBtn.className += " toggled";
        if (addFloorPlaneBtn.textContent !== "Drawing...")
          addFloorPlaneBtn.textContent = "Drawing...";
      } else {
        addFloorPlaneBtn.className = addFloorPlaneBtn.className.replace(
          " toggled",
          ""
        );
        if (addFloorPlaneBtn.textContent !== "Add Floor Plane")
          addFloorPlaneBtn.textContent = "Add Floor Plane";
      }
    }

    // Update model badge
    var modelNames = {
      p25d: "2.5D",
      // p1238: "P.1238",
      // p1411: "P.1411",
      // frt: "FRT-Lite",
      p525: "P.525",
      // cost231: "COST-231",
      // logd: "Log-Distance",
    };
    // document.getElementById("modelBadge").textContent = "V2.7";

    // Continue smooth transition animation if needed
    if (state.viewMode !== state.viewModeTarget) {
      requestAnimationFrame(draw);
    }
  }

  // Update delete button visibility based on whether image is uploaded
  function updateDeleteImageButton() {
    var deleteBtn = document.getElementById("deleteImageBtn");
    if (deleteBtn) {
      if (state.backgroundImage) {
        deleteBtn.style.display = "flex";
      } else {
        deleteBtn.style.display = "none";
      }
    }
  }

  // Update delete button visibility based on whether DXF is uploaded
  function updateDeleteDxfButton() {
    var deleteBtn = document.getElementById("deleteDxfBtn");
    var dxfLoader = document.getElementById("dxfLoader");
    if (deleteBtn && dxfLoader) {
      if (dxfLoader.files && dxfLoader.files.length > 0) {
        deleteBtn.style.display = "flex";
      } else {
        deleteBtn.style.display = "none";
      }
    }
  }

  // Upload Mode Toggle Logic
  document.querySelectorAll('.upload-mode-btn').forEach(btn => {
    if (btn) btn.addEventListener('click', function () {
      // Toggle Buttons
      document.querySelectorAll('.upload-mode-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      // Toggle Sections
      const mode = this.getAttribute('data-mode');
      if (mode === 'image') {
        document.getElementById("imageUploadSection").classList.remove('hidden');
        document.getElementById("dxfUploadSection").classList.add('hidden');
      } else {
        document.getElementById("imageUploadSection").classList.add('hidden');
        document.getElementById("dxfUploadSection").classList.remove('hidden');
      }
    });
  });

  // Tab Switching Logic for Image Visibility
  document.querySelectorAll('.icon-btn').forEach(function (btn) {
    if (btn) btn.addEventListener('click', function () {
      var section = this.getAttribute('data-section');
      state.activeSection = section; // Track active section for isolation logic

      if (section === 'xd') {
        // When switching to XD tab, show the XD image if available
        if (state.xdImage) {
          state.backgroundImage = state.xdImage;
        } else {
          // If no XD image, we might want to clear the background or keep the floorplan?
          // Usually XD view is specific, so let's clear if no XD image to avoid confusion
          state.backgroundImage = null;
        }
      } else {
        // For all other tabs (floorplan, propagation, etc.), show the Floor Plan image
        state.backgroundImage = state.floorPlanImage || null;
      }

      draw();
      // Update delete buttons visibility based on the new active image
      updateDeleteImageButton();
    });
  });

  // Event Bindings
  if (document.getElementById("imageLoader")) document.getElementById("imageLoader").addEventListener("change", function (e) {
    var reader = new FileReader();
    reader.onload = function (event) {
      var img = new Image();
      img.onload = function () {
        state.backgroundImage = img;
        state.floorPlanImage = img; // Store as floor plan image
        
        // Calculate and store original aspect ratio
        var imgAspectRatio = img.width / img.height;
        var canvasAspectRatio = state.w / state.h;
        
        // Calculate display dimensions that fit within canvas while preserving aspect ratio
        if (imgAspectRatio > canvasAspectRatio) {
          // Image is wider - fit to width
          state.backgroundImageDisplayWidth = state.w;
          state.backgroundImageDisplayHeight = state.w / imgAspectRatio;
        } else {
          // Image is taller - fit to height
          state.backgroundImageDisplayWidth = state.h * imgAspectRatio;
          state.backgroundImageDisplayHeight = state.h;
        }
        state.backgroundImageAspectRatio = imgAspectRatio;
        
        updateDeleteImageButton();
        draw();
      };
      img.src = event.target.result;
    };
    if (e.target.files && e.target.files[0]) {
      reader.readAsDataURL(e.target.files[0]);
    }
  });

  // Delete image button handler
  if (document.getElementById("deleteImageBtn")) document.getElementById("deleteImageBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    NotificationSystem.confirm("This will remove the uploaded floor plan image.", "Delete Image", function (confirmed) {
      if (confirmed) {
      state.backgroundImage = null;
      state.floorPlanImage = null; // Clear floor plan image reference
      state.backgroundImageAspectRatio = null;
      state.backgroundImageDisplayWidth = null;
      state.backgroundImageDisplayHeight = null;
      // Clear the file input
      var imageLoader = document.getElementById("imageLoader");
      if (imageLoader) {
        imageLoader.value = "";
      }
      updateDeleteImageButton();
      draw();
    }
    }, {danger: true, confirmLabel: 'Delete', icon: 'ðŸ—‘'});

  });

  // XD Tab Logic
  function updateDeleteXdImageButton() {
    var deleteBtn = document.getElementById("deleteXdImageBtn");
    if (deleteBtn) {
      if (state.xdImage) {
        deleteBtn.style.display = "flex";
      } else {
        deleteBtn.style.display = "none";
      }
    }
  }

  if (document.getElementById("xdImageLoader")) document.getElementById("xdImageLoader").addEventListener("change", function (e) {
    var reader = new FileReader();
    reader.onload = function (event) {
      var img = new Image();
      img.onload = function () {
        state.xdImage = img;
        state.xdImageBase64 = event.target.result;

        // Display the image on the canvas
        state.backgroundImage = img;
        
        // Calculate and store original aspect ratio
        var imgAspectRatio = img.width / img.height;
        var canvasAspectRatio = state.w / state.h;
        
        // Calculate display dimensions that fit within canvas while preserving aspect ratio
        if (imgAspectRatio > canvasAspectRatio) {
          // Image is wider - fit to width
          state.backgroundImageDisplayWidth = state.w;
          state.backgroundImageDisplayHeight = state.w / imgAspectRatio;
        } else {
          // Image is taller - fit to height
          state.backgroundImageDisplayWidth = state.h * imgAspectRatio;
          state.backgroundImageDisplayHeight = state.h;
        }
        state.backgroundImageAspectRatio = imgAspectRatio;
        
        updateDeleteImageButton(); // Update the other delete button visibility too

        updateDeleteXdImageButton();
        // console.log("XD Image loaded and displayed on canvas");
        draw();
      };
      img.src = event.target.result;
    };
    if (e.target.files && e.target.files[0]) {
      reader.readAsDataURL(e.target.files[0]);
    }
  });

  if (document.getElementById("deleteXdImageBtn")) document.getElementById("deleteXdImageBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    NotificationSystem.confirm("This will remove the uploaded XD floorplan.", "Delete XD Image", function (confirmed) {
      if (confirmed) {
        state.xdImage = null;
        state.xdImageBase64 = null;

        // Clear from canvas if it was the background image
        if (state.backgroundImage === state.xdImage) {
          state.backgroundImage = null;
          state.backgroundImageAspectRatio = null;
          state.backgroundImageDisplayWidth = null;
          state.backgroundImageDisplayHeight = null;
        }
        // Actually, just clear it to be sure if the user intended to delete it from XD
        state.backgroundImage = null;
        state.backgroundImageAspectRatio = null;
        state.backgroundImageDisplayWidth = null;
        state.backgroundImageDisplayHeight = null;

        var xdImageLoader = document.getElementById("xdImageLoader");
        if (xdImageLoader) {
          xdImageLoader.value = "";
        }
        updateDeleteXdImageButton();
        updateDeleteImageButton();
        draw();
      }
    }, {danger: true, confirmLabel: 'Delete', icon: 'ðŸ—‘'});
  });

  if (document.getElementById("xdEnableSahi")) document.getElementById("xdEnableSahi").addEventListener("change", function () {
    var xdSahiOptions = document.getElementById("xdSahiOptions");
    if (xdSahiOptions) {
      xdSahiOptions.style.display = this.checked ? "block" : "none";
    }
  });

  if (document.getElementById("xdAdvancedToggle")) document.getElementById("xdAdvancedToggle").addEventListener("change", function () {
    var container = document.getElementById("xdAdvancedContainer");
    if (container) {
      container.style.display = this.checked ? "block" : "none";
    }
  });

  if (document.getElementById("generateDxfBtn")) document.getElementById("generateDxfBtn").addEventListener("click", function () {
    if (!state.xdImageBase64) {
      NotificationSystem.warning("Please upload a floorplan image first.");
      return;
    }

    var btn = document.getElementById("generateDxfBtn");
    var originalText = btn.textContent;

    // Set loading state on button
    btn.disabled = true;
    btn.style.opacity = "0.7";
    btn.style.cursor = "not-allowed";
    btn.textContent = "GENERATING...";

    // Show loading overlay
    var overlay = document.getElementById("loadingOverlay");
    var loadingText = document.getElementById("loadingText");
    var subtext = document.getElementById("loadingSubtext");
    if (overlay) overlay.style.display = "flex";
    if (loadingText) loadingText.textContent = "Processing Floorplan...";
    if (subtext) subtext.textContent = "Our AI is detecting walls, doors, and windows to generate your DXF.";

    var params = {
      confidence: +document.getElementById("xdConfidence").value,
      splitParts: +document.getElementById("xdSplitParts").value,
      wallRemovalThreshold: +document.getElementById("xdWallRemovalThreshold").value,
      gapFillSize: +document.getElementById("xdGapFillSize").value,
      enableSahi: document.getElementById("xdEnableSahi").checked,
      sahiSliceSize: +document.getElementById("xdSahiSliceSize").value,
      sahiOverlapRatio: +document.getElementById("xdSahiOverlapRatio").value,
      sahiNmsThreshold: +document.getElementById("xdSahiNmsThreshold").value
    };

    // console.log("Requesting DXF generation with params:", params);

    // Send to backend via Anvil
    window.parent.postMessage({
      type: "generate_dxf",
      image: state.xdImageBase64,
      params: params,
      requestId: "dxf_" + Date.now()
    }, "*");

    // Listen for completion
    var dxfListener = function (event) {
      if (!event.data) return;

      // Handle successful generation
      if (event.data.type === "dxf_generated") {
        if (overlay) overlay.style.display = "none";

        // Reset button
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
        btn.textContent = originalText;

        window.removeEventListener("message", dxfListener);

        // If the message contains file data, trigger download
        if (event.data.fileData) {
          triggerFileDownload(event.data.fileData, event.data.fileName || "floorplan.dxf");
        }

        NotificationSystem.success("DXF generated successfully!");
      }

      // Handle errors
      else if (event.data.type === "dxf_error") {
        if (overlay) overlay.style.display = "none";

        // Reset button
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
        btn.textContent = originalText;

        window.removeEventListener("message", dxfListener);
        NotificationSystem.error("Failed to generate DXF.\n" + (event.data.error || "Unknown error"));
      }
    };
    window.addEventListener("message", dxfListener);
  });

  // Bridge for Anvil call_js to trigger the message listener
  window.postHandlerMessage = function (data) {
    window.postMessage(data, "*");
  };

  // Helper to trigger a browser download for returned DXF data
  function triggerFileDownload(base64Data, fileName) {
    try {
      var link = document.createElement('a');
      link.href = base64Data;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to trigger download:", err);
    }
  }

  // DXF Loader Change listener
  if (document.getElementById("dxfLoader")) document.getElementById("dxfLoader").addEventListener("change", function (e) {
    updateDeleteDxfButton();

    if (e.target.files && e.target.files[0]) {
      var file = e.target.files[0];
      // console.log("DXF file selected for parsing:", file.name);

      var reader = new FileReader();
      reader.onload = function (event) {
        // Show loading overlay
        var overlay = document.getElementById("loadingOverlay");
        var loadingText = document.getElementById("loadingText");
        var subtext = document.getElementById("loadingSubtext");
        if (overlay) overlay.style.display = "flex";
        if (loadingText) loadingText.textContent = "Parsing DXF...";
        if (subtext) subtext.textContent = "Extracting walls and structures from your CAD file.";

        // Send to Anvil for parsing
        window.parent.postMessage({
          type: "parse_dxf_request",
          content: event.target.result,
          filename: file.name,
          requestId: "parse_" + Date.now()
        }, "*");
      };
      reader.readAsDataURL(file);
    }
  });

  // Listen for DXF parsing response
  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "dxf_parsed_response") return;

    var overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.style.display = "none";

    if (event.data.success && event.data.data) {
      // console.log("DXF parsed successfully, loading project...");
      loadProjectFromData(event.data.data);
      NotificationSystem.success("DXF loaded successfully!");
    } else {
      console.error("DXF parsing failed:", event.data.error);
      NotificationSystem.error("Failed to parse DXF.\n" + (event.data.error || "Unknown error"));
    }
  });


  // Delete DXF button handler
  if (document.getElementById("deleteDxfBtn")) document.getElementById("deleteDxfBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    NotificationSystem.confirm("This will remove all walls and floor planes from the DXF file.", "Delete DXF", function (confirmed) {
      if (confirmed) {
        // Clear the file input
        var dxfLoader = document.getElementById("dxfLoader");
        if (dxfLoader) {
          dxfLoader.value = "";
        }

        // Clear project data
        state.walls = [];
        state.floorPlanes = [];

        // Update UI
        renderWalls();
        if (typeof renderFloorPlanes === 'function') {
          renderFloorPlanes();
        }
        draw();

        updateDeleteDxfButton();
      }
    }, {danger: true, confirmLabel: 'Delete', icon: 'ðŸ—‘'});
  });

  if (document.getElementById("alphaSlider")) document.getElementById("alphaSlider").addEventListener("input", function (e) {
    var alpha = +e.target.value;
    state.backgroundImageAlpha = alpha;
    var alphaLabel = document.getElementById("alphaLabel");
    if (alphaLabel) {
      alphaLabel.textContent =
        "Image Opacity: " + Math.round(alpha * 100) + "%";
    }
    draw();
  });

  if (document.getElementById("calibrateBtn")) document.getElementById("calibrateBtn").addEventListener("click", function () {
    state.isCalibrating = !state.isCalibrating;
    if (state.isCalibrating) {
      state.addingWall = false; // Turn off wall drawing mode
      state.addingAP = false; // Turn off AP drawing mode
      state.addingFloorPlane = false; // Turn off floor plane drawing mode
      var addAPBtn = document.getElementById("addAP");
      if (addAPBtn) {
        addAPBtn.textContent = "Add Antenna";
      }
      var addBtn = document.getElementById("addWall");
      if (addBtn) {
        addBtn.textContent = getAddButtonText(false);
      }
      var addFloorPlaneBtn = document.getElementById("addFloorPlane");
      if (addFloorPlaneBtn) {
        addFloorPlaneBtn.textContent = "Add Floor Plane";
      }
      document.getElementById("calibrateBtn").textContent = "Cancel Calibration";
      document.getElementById("calibrateBtn").classList.add("toggled");
      document.getElementById("calibrationControls").style.display = "block";
      state.calibrationLine = null;
      state.calibrationPixels = null;
      state.tempCalibration = null;
      state.tempCalibrationPixels = null;

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
      document.getElementById("calibrateBtn").textContent = "Calibrate Scale";
      document.getElementById("calibrateBtn").classList.remove("toggled");
      document.getElementById("calibrationControls").style.display = "none";
      state.calibrationLine = null;
      state.calibrationPixels = null;
      state.tempCalibration = null;
      state.tempCalibrationPixels = null;
    }
    draw();
  });

  if (document.getElementById("applyScaleBtn")) document.getElementById("applyScaleBtn").addEventListener("click", function () {
    var realLength = parseFloat(document.getElementById("realLengthInput").value);
    if (
      realLength > 0 &&
      state.calibrationPixels &&
      state.calibrationPixels.p1 &&
      state.calibrationPixels.p2
    ) {
      var p1 = state.calibrationPixels.p1;
      var p2 = state.calibrationPixels.p2;
      var pixel_dist = hypot(p2.x - p1.x, p2.y - p1.y);

      var pixelsPerMeter = pixel_dist / realLength;

      state.w = (canvas.width - 2 * pad()) / pixelsPerMeter;
      state.h = (canvas.height - 2 * pad()) / pixelsPerMeter;

      // Reset calibration state
      state.isCalibrating = false;
      state.calibrationLine = null;
      state.calibrationPixels = null;
      state.tempCalibration = null;
      state.tempCalibrationPixels = null;
      document.getElementById("calibrateBtn").textContent = "Calibrate Scale";
      document.getElementById("calibrateBtn").classList.remove("toggled");
      document.getElementById("calibrationControls").style.display = "none";

      draw();
    } else {
      NotificationSystem.info("Please draw a calibration line on the map first.");
    }
  });

  // Optimize button - start optimization and poll for updates one by one
  if (document.getElementById("optimizeBtn")) document.getElementById("optimizeBtn").addEventListener("click", function () {
    // console.log("Optimize button clicked - starting optimization process");
    // Guard: require at least one antenna before optimization
    if (!state.aps || state.aps.length === 0) {
      NotificationSystem.warning("Please add at least one antenna before starting optimization.");
      return;
    }


    var optimizeBtn = document.getElementById("optimizeBtn");
    var addAPBtn = document.getElementById("addAP");
    if (optimizeBtn) {
      optimizeBtn.disabled = true;
      optimizeBtn.style.opacity = '0.5';
      optimizeBtn.style.cursor = 'not-allowed';
      optimizeBtn.textContent = 'Running...';
    }
    if (addAPBtn) {
      addAPBtn.disabled = true;
      addAPBtn.style.opacity = '0.5';
      addAPBtn.style.pointerEvents = 'none';
    }

    // Show loading overlay
    // var overlay = document.getElementById('loadingOverlay');
    // var loadingText = document.getElementById('loadingText');
    // var subtext = document.getElementById('loadingSubtext');
    // if (overlay) overlay.style.display = 'flex';
    // if (loadingText) loadingText.textContent = 'Optimization Starting...';
    // if (subtext) subtext.textContent = 'Preparing baseline data and initializing models.';

    // Close left sidebar when Optimize button is clicked
    if (window.iconSidebarData) {
      var sidebar = window.iconSidebarData.sidebar;
      var iconButtons = document.querySelectorAll(".icon-btn");
      if (sidebar && sidebar.classList.contains("expanded")) {
        sidebar.classList.remove("expanded");
        iconButtons.forEach(function (b) {
          b.classList.remove("active");
        });
        window.iconSidebarData.currentSection = null;
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

    // Request to start optimization and begin polling for updates
    window.parent.postMessage(
      {
        type: "start_optimization_and_poll",
        requestId: "optimize_" + Date.now(),
      },
      "*"
    );
  });

  // Global variables for optimization polling
  var optimizationPollingInterval = null;
  var optimizationLastIndex = 0;
  var optimizationBounds = null; // Will store minX, maxX, minY, maxY, scale for coordinate transformation

  function bindNum(id, key) {
    if (document.getElementById(id)) document.getElementById(id).addEventListener("input", function () {
      state[key] = +document.getElementById(id).value;
      draw();
    });
  }

  if (document.getElementById("model")) document.getElementById("model").addEventListener("change", function () {
    state.model = document.getElementById("model").value;
    document.getElementById("N").value = state.N;

    // AI COMMENT: Replaced inline heatmap cache invalidation with helper
    // Model changes require complete regeneration (different path loss calculation)
    invalidateHeatmapCache();

    draw();
  });

  if (document.getElementById("view")) document.getElementById("view").addEventListener("change", function () {
    // Save current min/max values for the previous view mode
    if (state.view && state.viewMinMax[state.view]) {
      state.viewMinMax[state.view].min = state.minVal;
      state.viewMinMax[state.view].max = state.maxVal;
    }

    // Switch to new view mode
    state.view = document.getElementById("view").value;

    // Restore saved min/max values for the new view mode, or use defaults
    if (state.viewMinMax[state.view]) {
      state.minVal = state.viewMinMax[state.view].min;
      state.maxVal = state.viewMinMax[state.view].max;
    } else {
      // Fallback to defaults if view mode not in storage
      if (state.view === "rssi") {
        state.minVal = -100;
        state.maxVal = -30;
      } else if (state.view === "snr") {
        state.minVal = 0;
        state.maxVal = 40;
      } else if (state.view === "sinr") {
        // Typical SINR range in dB
        state.minVal = -10;
        state.maxVal = 40;
      } else if (state.view === "cci") {
        state.minVal = -10;
        state.maxVal = 40;
      } else if (state.view === "thr") {
        state.minVal = 0;
        state.maxVal = 80;
      } else {
        state.minVal = -100;
        state.maxVal = -30;
      }
    }

    document.getElementById("minVal").value = state.minVal;
    document.getElementById("maxVal").value = state.maxVal;
    
    // AI COMMENT: Replaced inline heatmap cache invalidation with helper
    // View mode changes require complete regeneration (different data type)
    invalidateHeatmapCache();
    
    // Draw after starting regeneration - validation will prevent using stale cache
    draw();
  });

  bindNum("freq", "freq");
  bindNum("N", "N");
  bindNum("res", "res");
  bindNum("noise", "noise");

  // Debounced update for minVal and maxVal: redraw after 3 seconds of inactivity or on Enter key
  function scheduleMinMaxValUpdate() {
    // Clear existing timer
    if (minMaxValDebounceTimer) {
      clearTimeout(minMaxValDebounceTimer);
    }
    // Schedule redraw after 3 seconds
    minMaxValDebounceTimer = setTimeout(function () {
      minMaxValDebounceTimer = null;
      
      // AI COMMENT: Replaced inline heatmap cache invalidation with helper
      invalidateHeatmapCache();
      
      requestAnimationFrame(function () {
        draw();
      });
    }, 3000);
  }

  if (document.getElementById("minVal")) document.getElementById("minVal").addEventListener("input", function () {
    state.minVal = +document.getElementById("minVal").value;
    // Save to current view mode's storage
    if (state.view && state.viewMinMax[state.view]) {
      state.viewMinMax[state.view].min = state.minVal;
    }
    // Update immediately but debounce the heatmap redraw
    scheduleMinMaxValUpdate();
  });
  if (document.getElementById("minVal")) document.getElementById("minVal").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      // Trigger immediate redraw on Enter key
      if (minMaxValDebounceTimer) {
        clearTimeout(minMaxValDebounceTimer);
        minMaxValDebounceTimer = null;
      }
      
      // AI COMMENT: Replaced inline heatmap cache invalidation with helper
      invalidateHeatmapCache();
      
      requestAnimationFrame(function () {
        draw();
      });
    }
  });
  if (document.getElementById("maxVal")) document.getElementById("maxVal").addEventListener("input", function () {
    state.maxVal = +document.getElementById("maxVal").value;
    // Save to current view mode's storage
    if (state.view && state.viewMinMax[state.view]) {
      state.viewMinMax[state.view].max = state.maxVal;
    }
    // Update immediately but debounce the heatmap redraw
    scheduleMinMaxValUpdate();
  });
  if (document.getElementById("maxVal")) document.getElementById("maxVal").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      // Trigger immediate redraw on Enter key
      if (minMaxValDebounceTimer) {
        clearTimeout(minMaxValDebounceTimer);
        minMaxValDebounceTimer = null;
      }
      
      // AI COMMENT: Replaced inline heatmap cache invalidation with helper
      invalidateHeatmapCache();
      
      requestAnimationFrame(function () {
        draw();
      });
    }
  });
  if (document.getElementById("complianceThreshold")) document.getElementById("complianceThreshold").addEventListener("input", function () {
    state.complianceThreshold = +document.getElementById("complianceThreshold").value;
    // Update compliance percentage when threshold changes
    updateActiveAntennaStats();
    // Send compliance settings to backend
    window.parent.postMessage({
      type: 'compliance_settings',
      complianceThreshold: state.complianceThreshold,
      compliancePercentage: state.compliancePercentage,
      requestId: 'compliance-' + Date.now()
    }, '*');
  });
  if (document.getElementById("compliancePercentage")) document.getElementById("compliancePercentage").addEventListener("input", function () {
    state.compliancePercentage = +document.getElementById("compliancePercentage").value;
    // Update compliance percentage when percentage changes
    updateActiveAntennaStats();
    // Send compliance settings to backend
    window.parent.postMessage({
      type: 'compliance_settings',
      complianceThreshold: state.complianceThreshold,
      compliancePercentage: state.compliancePercentage,
      requestId: 'compliance-' + Date.now()
    }, '*');
  });

  if (document.getElementById("addWall")) document.getElementById("addWall").addEventListener("click", function () {
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
        // Restore Add Antenna button text
        var addAPBtn = document.getElementById("addAP");
        if (addAPBtn) {
          addAPBtn.textContent = "Add Antenna";
        }

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
      // Restore Add Antenna button text
      var addAPBtn = document.getElementById("addAP");
      if (addAPBtn) {
        addAPBtn.textContent = "Add Antenna";
      }

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

  // Export detailed coverage data handler
  if (document.getElementById("exportCoverageBtn")) document.getElementById("exportCoverageBtn").addEventListener("click", function () {
    if (!state.aps || state.aps.length === 0) {
      NotificationSystem.warning("Please add at least one antenna before exporting coverage data.");
      return;
    }
    DataExportSystem.exportDetailedCoverageData();
  });

  

  if (document.getElementById("showContours")) document.getElementById("showContours").addEventListener("change", function () {
    state.showContours = document.getElementById("showContours").checked;
    
    // AI COMMENT: Replaced inline heatmap cache invalidation with helper
    // Contour mode changes affect color mapping  need to regenerate
    invalidateHeatmapCache();
    
    draw();
  });

  if (document.getElementById("showTooltip")) document.getElementById("showTooltip").addEventListener("change", function () {
    state.showTooltip = document.getElementById("showTooltip").checked;
    var tooltip = document.getElementById("apTooltip");
    if (!state.showTooltip && tooltip) {
      tooltip.classList.remove("visible");
      tooltip.style.display = "none"; // Hide tooltip when unchecked
    }
  });

  if (document.getElementById("showVisualization")) document.getElementById("showVisualization").addEventListener("change", function () {
    state.showVisualization = document.getElementById("showVisualization").checked;
    
    // AI COMMENT: Replaced inline heatmap cache invalidation with helper
    // When enabling: invalidates + regenerates. When disabling: invalidates only (no generate).
    invalidateHeatmapCache();
    
    draw();
  });

  if (document.getElementById("viewModeToggle")) document.getElementById("viewModeToggle").addEventListener("change", function () {
    state.viewModeTarget = document.getElementById("viewModeToggle").checked ? "3d" : "2d";
    // Start smooth transition
    if (state.viewModeTarget === "3d" && state.viewModeTransition === 0) {
      state.viewModeTransition = 0.01; // Start transition
    } else if (
      state.viewModeTarget === "2d" &&
      state.viewModeTransition === 1
    ) {
      state.viewModeTransition = 0.99; // Start transition
    }
    draw();
  });

  // Dark mode toggle
  if (document.getElementById("darkModeToggle")) document.getElementById("darkModeToggle").addEventListener("click", function () {
    state.darkMode = !state.darkMode;
    applyDarkMode();
    saveState();
  });

  function applyDarkMode() {
    if (state.darkMode) {
      document.documentElement.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark-mode");
    }
  }

  if (document.getElementById("elementType")) document.getElementById("elementType").addEventListener("change", function () {
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
      updateFloorPlaneTypeVisibility();
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

  // Walls Help Modal handlers
  if (document.getElementById("wallsHelpIcon")) document.getElementById("wallsHelpIcon").addEventListener("click", function (e) {
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

  if (document.getElementById("closeWallsHelp")) document.getElementById("closeWallsHelp").addEventListener("click", function (e) {
    e.stopPropagation();
    var modal = document.getElementById("wallsHelpModal");
    if (modal) {
      modal.style.display = "none";
    }
  });

  // Close help modal when clicking anywhere outside of it
  function closeWallsHelpModal(e) {
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
  }

  // Add click listener to document
  document.addEventListener("click", closeWallsHelpModal);

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

  // Function to update visibility of inclination controls based on plane type
  function updateFloorPlaneTypeVisibility() {
    if (state.floorPlaneType === "inclined") {
      document.getElementById("floorPlaneInclinationContainer").style.display = "block";
      document.getElementById("floorPlaneInclinationDirectionContainer").style.display = "block";
    } else {
      document.getElementById("floorPlaneInclinationContainer").style.display = "none";
      document.getElementById("floorPlaneInclinationDirectionContainer").style.display = "none";
    }
  }

  // Handle floor plane type change
  if (document.getElementById("floorPlaneType")) document.getElementById("floorPlaneType").addEventListener("change", function () {
    state.floorPlaneType = document.getElementById("floorPlaneType").value;
    updateFloorPlaneTypeVisibility();
  });

  // Handle floor plane height input
  if (document.getElementById("floorPlaneHeight")) document.getElementById("floorPlaneHeight").addEventListener("input", function () {
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
  if (document.getElementById("floorPlaneHeight")) document.getElementById("floorPlaneHeight").addEventListener("blur", function () {
    var val = document.getElementById("floorPlaneHeight").value.trim();
    if (val === "" || val === "-") {
      state.floorPlaneHeight = 0;
      document.getElementById("floorPlaneHeight").value = "0";
    }
  });

  // Handle floor plane inclination input
  if (document.getElementById("floorPlaneInclination")) document.getElementById("floorPlaneInclination").addEventListener("input", function () {
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
  if (document.getElementById("floorPlaneInclination")) document.getElementById("floorPlaneInclination").addEventListener("blur", function () {
    var val = document.getElementById("floorPlaneInclination").value.trim();
    if (val === "" || val === "-") {
      state.floorPlaneInclination = 0;
      document.getElementById("floorPlaneInclination").value = "0";
    }
  });

  // Handle floor plane inclination direction input
  if (document.getElementById("floorPlaneInclinationDirection")) document.getElementById("floorPlaneInclinationDirection").addEventListener("input", function () {
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
  if (document.getElementById("floorPlaneInclinationDirection")) document.getElementById("floorPlaneInclinationDirection").addEventListener("blur", function () {
    var val = document.getElementById("floorPlaneInclinationDirection").value.trim();
    if (val === "" || val === "-") {
      state.floorPlaneInclinationDirection = 0;
      document.getElementById("floorPlaneInclinationDirection").value = "0";
    }
  });

  if (document.getElementById("wallType")) document.getElementById("wallType").addEventListener("change", function () {
    state.selectedWallType = document.getElementById("wallType").value;
    if (state.selectedWallType === "custom") {
      document.getElementById("customWallInput").style.display = "block";
    } else {
      document.getElementById("customWallInput").style.display = "none";
    }
  });

  if (document.getElementById("customWallLoss")) document.getElementById("customWallLoss").addEventListener("input", function () {
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
  if (document.getElementById("customWallLoss")) document.getElementById("customWallLoss").addEventListener("blur", function () {
    var val = document.getElementById("customWallLoss").value.trim();
    if (val === "" || val === "-") {
      state.customWallLoss = 0;
      document.getElementById("customWallLoss").value = "0";
    }
  });

  if (document.getElementById("snapToGridToggle")) document.getElementById("snapToGridToggle").addEventListener("change", function () {
    state.snapToGrid = document.getElementById("snapToGridToggle").checked;
  });

  if (document.getElementById("floorPlaneAttenuation")) document.getElementById("floorPlaneAttenuation").addEventListener("input", function () {
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
  if (document.getElementById("floorPlaneAttenuation")) document.getElementById("floorPlaneAttenuation").addEventListener("blur", function () {
    var val = document.getElementById("floorPlaneAttenuation").value.trim();
    if (val === "" || val === "-") {
      state.floorPlaneAttenuation = 0;
      document.getElementById("floorPlaneAttenuation").value = "0";
    }
  });

  if (document.getElementById("manualWallControlToggle")) document.getElementById("manualWallControlToggle").addEventListener("change", function () {
    state.manualWallControl = document.getElementById("manualWallControlToggle").checked;
    // Clear wall selection when disabling manual control
    if (!state.manualWallControl) {
      state.selectedWallId = null;
      state.selectedWallIds = [];
      state.wallDrag = null;
      draw();
    }
  });

  // Handle antenna pattern upload
  if (document.getElementById("antennaPatternUpload")) document.getElementById("antennaPatternUpload").addEventListener("change", function (e) {
    if (e.target.files && e.target.files[0]) {
      var file = e.target.files[0];
      var reader = new FileReader();

      reader.onload = function (event) {
        try {
          var pattern = parseAntennaPattern(event.target.result);

          // Store file info in pattern
          pattern.fileName = file.name;
          pattern.uploadTime = new Date().toISOString();

          // Check if pattern already exists (by name, frequency, and filename)
          var patternExists = false;
          var existingPatternIndex = -1;
          for (var i = 0; i < state.antennaPatterns.length; i++) {
            var existingPattern = state.antennaPatterns[i];
            // Check by name and frequency (primary check)
            if (existingPattern.name === pattern.name &&
              existingPattern.frequency === pattern.frequency) {
              patternExists = true;
              existingPatternIndex = i;
              break;
            }
          }

          // If pattern already exists, show notification and return
          if (patternExists) {
            var existingPattern = state.antennaPatterns[existingPatternIndex];
            NotificationSystem.warning("Pattern \"" + existingPattern.name + "\" already exists in this project.");

            // Reset file input
            e.target.value = '';
            return;
          }

        var message =
          "Antenna pattern loaded successfully\n\n" +
          "    • Name:      " + pattern.name + "\n" +
          "    • Frequency: " + pattern.frequency + " MHz\n" +
          "    • Gain:      " + pattern.gain + " dBi\n";

          if (state.antennaPatterns.length === 0) {
            message += "\nThis pattern will be set as default and used for all new Antennas.";
          } else {
            message += "\nDo you want to add this pattern to your project?";
          }

          // Request confirmation from Anvil parent
          NotificationSystem.confirm(message, "Confirm Pattern", function (confirmed) {
            if (confirmed) {
              // Trigger upload to Anvil backend
              if (window.parent !== window) {
                window.parent.postMessage({
                  type: 'upload_antenna_pattern',
                  filename: file.name,
                  content: event.target.result
                }, '*');
              }

              // Store file info in pattern
              pattern.fileName = file.name;
              pattern.uploadTime = new Date().toISOString();

              // Add to patterns array
              state.antennaPatterns.push(pattern);

              // If this is the first pattern, set it as default
              if (state.antennaPatterns.length === 1) {
                state.defaultAntennaPatternIndex = 0;
              }

              // Apply default pattern to all existing APs that don't have their own pattern
              var defaultPattern = getDefaultAntennaPattern();
              if (defaultPattern) {
                for (var i = 0; i < state.aps.length; i++) {
                  if (!state.aps[i].antennaPattern) {
                    state.aps[i].antennaPattern = defaultPattern;
                    // Also set the filename from the pattern
                    state.aps[i].antennaPatternFileName = defaultPattern.fileName || (defaultPattern.name ? defaultPattern.name : null);
                  }
                }
              }

              console.log(
                "Antenna pattern added:",
                pattern.name,
                "Frequency:",
                pattern.frequency,
                "MHz",
                "Gain:",
                pattern.gain,
                "dBi"
              );
              console.log("Total patterns:", state.antennaPatterns.length);

              // Update UI
              updateAntennaPatternsList();

              // Redraw to apply new pattern
              draw();

              // Final success notification
              //showAnvilNotification("Pattern added successfully!", "Success", "success");
            } else {
              console.log("User cancelled antenna pattern upload.");
            }
          });
        } catch (err) {
          console.error("Error parsing antenna pattern:", err);
          NotificationSystem.error("Failed to parse pattern file.\n" + err.message);
        }
      };

      reader.onerror = function () {
        NotificationSystem.error("Could not read the antenna pattern file.");
      };

      reader.readAsText(file);

      // Reset file input to allow uploading the same file again
      e.target.value = "";
    }
  });

  // Handle delete button for selected pattern
  if (document.getElementById("deleteSelectedPattern")) document.getElementById("deleteSelectedPattern").addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var select = document.getElementById("defaultAntennaPatternSelect");
    if (select && select.value !== "-1" && select.value !== null && select.value !== "") {
      var patternIndex = parseInt(select.value);
      if (!isNaN(patternIndex) && patternIndex >= 0 && patternIndex < state.antennaPatterns.length) {
        deleteAntennaPattern(patternIndex);
      }
    }
  });

  // Handle default pattern selection change
  if (document.getElementById("defaultAntennaPatternSelect")) document.getElementById("defaultAntennaPatternSelect").addEventListener("change", function (e) {
    var selectedIndex = parseInt(e.target.value);
    state.defaultAntennaPatternIndex = selectedIndex;

    // Update delete button visibility when selection changes
    var deleteButton = document.getElementById("deleteSelectedPattern");
    if (deleteButton) {
      if (selectedIndex !== -1 && !isNaN(selectedIndex)) {
        deleteButton.style.display = "flex";
      } else {
        deleteButton.style.display = "none";
      }
    }

    // Apply default pattern to all existing APs that don't have their own pattern
    // Only if patterns exist and a valid default is selected
    var defaultPattern = getDefaultAntennaPattern();
    if (defaultPattern && state.antennaPatterns.length > 0) {
      for (var i = 0; i < state.aps.length; i++) {
        if (!state.aps[i].antennaPattern) {
          state.aps[i].antennaPattern = defaultPattern;
          // Also set the filename from the pattern
          state.aps[i].antennaPatternFileName = defaultPattern.fileName || (defaultPattern.name ? defaultPattern.name : null);
        }
      }
      draw();
      console.log("Default pattern changed to:", defaultPattern.name);
    } else {
      // No default pattern available - ensure antennas without patterns stay without patterns
      // Don't remove existing patterns from antennas that have them, but don't assign new ones
      draw();
      console.log("No default pattern selected");
    }
  });

  /* AI COMMENT — initIconSidebar + outside-click handler extracted to app.js */

  function pointerPos(ev) {
    var rect = canvas.getBoundingClientRect();
    var x = ev.clientX - rect.left;
    var y = ev.clientY - rect.top;
    return { x: invx(x), y: invy(y) };
  }

  // Hide tooltip when mouse leaves canvas
  if (canvas) canvas.addEventListener("mouseleave", function (e) {
    if (state.showTooltip) {
      var tooltip = document.getElementById("apTooltip");
      if (tooltip) {
        tooltip.classList.remove("visible");
      }
    }
  });

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

   // Initialize view mode toggle (default to 2D)
  state.viewModeTarget = state.viewMode; // Sync target with current mode
  if (document.getElementById("viewModeToggle")) {
    document.getElementById("viewModeToggle").checked = state.viewMode === "3d";
    if (document.getElementById("darkModeToggle")) {
      document.getElementById("darkModeToggle").checked = state.darkMode || false;
      applyDarkMode();
    }
  }
  

  // Initialize after everything is loaded
  function initApp() {
    updateDeleteImageButton();
    updateDeleteXdImageButton();
    updateDeleteDxfButton();
    
    // Only call functions if they've been loaded
    if (typeof initIconSidebar === "function") window.iconSidebarData = initIconSidebar();
    if (typeof initLegendDrag === "function") initLegendDrag();
    if (typeof storeLegendDefaultPosition === "function") storeLegendDefaultPosition();
    if (typeof constrainLegendPosition === "function") setTimeout(constrainLegendPosition, 100);
    if (typeof updateAntennaPatternsList === "function") updateAntennaPatternsList();
    
    if (typeof draw === "function") draw();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
