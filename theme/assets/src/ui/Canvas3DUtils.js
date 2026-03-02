// Canvas3DUtils.js
// Handles legacy 2.5D/3D projection and drawing on the 2D canvas.

var Canvas3DUtils = (function () {

  // Draw image mapped to four corners using triangle-based texture mapping
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
    var tempCanvas = document.createElement("canvas");
    tempCanvas.width = srcWidth;
    tempCanvas.height = srcHeight;
    var tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, srcWidth, srcHeight);

    var MAX_DEPTH = 3;

    function mid(p1, p2) {
      return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }

    function subdivide(wP1, wP2, wP3, wP4, sP1, sP2, sP3, sP4, depth) {
      if (depth >= MAX_DEPTH) {
        var dP1 = projector(wP1);
        var dP2 = projector(wP2);
        var dP3 = projector(wP3);
        var dP4 = projector(wP4);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(dP1.x, dP1.y);
        ctx.lineTo(dP2.x, dP2.y);
        ctx.lineTo(dP3.x, dP3.y);
        ctx.closePath();
        ctx.clip();
        drawTriangleTexture(ctx, tempCanvas, sP1, sP2, sP3, dP1, dP2, dP3);
        ctx.restore();

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

      var wM12 = mid(wP1, wP2);
      var wM23 = mid(wP2, wP3);
      var wM34 = mid(wP3, wP4);
      var wM41 = mid(wP4, wP1);
      var wCenter = mid(wM12, wM34);

      var sM12 = mid(sP1, sP2);
      var sM23 = mid(sP2, sP3);
      var sM34 = mid(sP3, sP4);
      var sM41 = mid(sP4, sP1);
      var sCenter = mid(sM12, sM34);

      subdivide(wP1, wM12, wCenter, wM41, sP1, sM12, sCenter, sM41, depth + 1);
      subdivide(wM12, wP2, wM23, wCenter, sM12, sP2, sM23, sCenter, depth + 1);
      subdivide(wCenter, wM23, wP3, wM34, sCenter, sM23, sP3, sM34, depth + 1);
      subdivide(wM41, wCenter, wM34, wP4, sM41, sCenter, sM34, sP4, depth + 1);
    }

    var sP1 = { x: 0, y: 0 };
    var sP2 = { x: srcWidth, y: 0 };
    var sP3 = { x: srcWidth, y: srcHeight };
    var sP4 = { x: 0, y: srcHeight };

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

  function drawTriangleTexture(ctx, img, srcP1, srcP2, srcP3, dstP1, dstP2, dstP3) {
    var ux = srcP2.x - srcP1.x;
    var uy = srcP2.y - srcP1.y;
    var vx = srcP3.x - srcP1.x;
    var vy = srcP3.y - srcP1.y;

    var dux = dstP2.x - dstP1.x;
    var duy = dstP2.y - dstP1.y;
    var dvx = dstP3.x - dstP1.x;
    var dvy = dstP3.y - dstP1.y;

    var det = ux * vy - uy * vx;
    if (Math.abs(det) < 1e-10) return;

    var a = (dux * vy - dvx * uy) / det;
    var b = (duy * vy - dvy * uy) / det;
    var c = (dvx * ux - dux * vx) / det;
    var d = (dvy * ux - duy * vx) / det;
    var e = dstP1.x - a * srcP1.x - c * srcP1.y;
    var f = dstP1.y - b * srcP1.x - d * srcP1.y;

    ctx.save();
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function renderCoveragePlane3D(ctx, heatmapCanvas, transition) {
    if (transition <= 0) return;

    var displayHeight = 0;
    var corners = [
      { x: 0, y: 0, z: displayHeight },
      { x: window.state.w, y: 0, z: displayHeight },
      { x: window.state.w, y: window.state.h, z: displayHeight },
      { x: 0, y: window.state.h, z: displayHeight },
    ];

    var p1_3d = projectToCanvas3D(corners[0].x, corners[0].y, corners[0].z);
    var p2_3d = projectToCanvas3D(corners[1].x, corners[1].y, corners[1].z);
    var p3_3d = projectToCanvas3D(corners[2].x, corners[2].y, corners[2].z);
    var p4_3d = projectToCanvas3D(corners[3].x, corners[3].y, corners[3].z);

    var p1_2d = { x: window.mx(0), y: window.my(0) };
    var p2_2d = { x: window.mx(window.state.w), y: window.my(0) };
    var p3_2d = { x: window.mx(window.state.w), y: window.my(window.state.h) };
    var p4_2d = { x: window.mx(0), y: window.my(window.state.h) };

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

    ctx.save();
    ctx.globalAlpha = 0.85;

    var wP1 = { x: 0, y: window.state.h };
    var wP2 = { x: window.state.w, y: window.state.h };
    var wP3 = { x: window.state.w, y: 0 };
    var wP4 = { x: 0, y: 0 };

    var projector = function (p) {
      var p2d = { x: window.mx(p.x), y: window.my(p.y) };
      var p3d = projectToCanvas3D(p.x, p.y, 0);
      return {
        x: p2d.x + (p3d.x - p2d.x) * transition,
        y: p2d.y + (p3d.y - p2d.y) * transition,
      };
    };

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

  function projectToCanvas3D(worldX, worldY, height) {
    var x = worldX - window.state.w / 2;
    var z = (worldY - window.state.h / 2);
    var y = height;

    var rotX = window.state.cameraRotationX;
    var rotY = window.state.cameraRotationY;

    var cosY = Math.cos(rotY);
    var sinY = Math.sin(rotY);
    var x1 = x * cosY - z * sinY;
    var z1 = x * sinY + z * cosY;
    var y1 = y;

    var cosX = Math.cos(rotX);
    var sinX = Math.sin(rotX);
    var x2 = x1;
    var y2 = y1 * cosX - z1 * sinX;
    var z2 = y1 * sinX + z1 * cosX;

    var zoom = window.state.cameraZoom;
    x2 *= zoom;
    y2 *= zoom;
    z2 *= zoom;

    var distance = Math.max(z2 + 20, 1);
    var fov = 500;
    var scale = fov / distance;

    x2 += window.state.cameraPanX;
    z2 += window.state.cameraPanY;

    var screenX = x2 * scale;
    var screenY = -(z2 * scale + y2 * scale);

    var padding = typeof window.pad === "function" ? window.pad() : window.pad;
    var baseScale =
      (Math.min(window.canvas.width, window.canvas.height) / Math.max(window.state.w, window.state.h)) *
      0.8;
    var canvasX =
      padding +
      ((window.state.w / 2 + (screenX * baseScale) / fov) *
        (window.canvas.width - 2 * padding)) /
      window.state.w;
    var canvasY =
      padding +
      ((window.state.h / 2 + (screenY * baseScale) / fov) *
        (window.canvas.height - 2 * padding)) /
      window.state.h;

    return { x: canvasX, y: canvasY, depth: z2 };
  }

  return {
    drawProjectedImage: drawProjectedImage,
    drawTriangleTexture: drawTriangleTexture,
    renderCoveragePlane3D: renderCoveragePlane3D,
    projectToCanvas3D: projectToCanvas3D
  };
})();

// Expose to window for global scope usage
window.drawProjectedImage = Canvas3DUtils.drawProjectedImage;
window.drawTriangleTexture = Canvas3DUtils.drawTriangleTexture;
window.renderCoveragePlane3D = Canvas3DUtils.renderCoveragePlane3D;
window.projectToCanvas3D = Canvas3DUtils.projectToCanvas3D;
