
/* ========= Core Functions ========= */
  function $(id) {
    return document.getElementById(id);
  }
  function add(el, ev, fn) {
    if (el) el.addEventListener(ev, fn, false);
  }

  // AI COMMENT: All five notification helpers below (setupPremiumAlerts, showAlert,
  // showAnvilNotification, showAnvilConfirm, showBackendMessage) are replaced by the
  // NotificationSystem module  ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢  REFACTORED_MODULES/01-NOTIFICATION-SYSTEM.js
  // Call-site mapping:
  //   setupPremiumAlerts() + setTimeout  ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢  NotificationSystem.init()  (auto-called)
  //   showAlert(msg)                     ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢  NotificationSystem.error(msg)
  //   showAnvilNotification(m,t,"success") ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ NotificationSystem.success(m)
  //   showAnvilConfirm(m,t,cb)           ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢  NotificationSystem.confirm(m,t,cb)
  //   showBackendMessage(m,type,cb)      ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢  NotificationSystem.backend(m,type,type,[ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦])
  /*
  // Premium Alert & Notification System
  function setupPremiumAlerts() {
    const overlay = document.getElementById('customAlertOverlay');
    const messageEl = document.getElementById('customAlertMessage');
    //const headerEl = document.getElementById('customAlertHeader');
    const btn = document.getElementById('customAlertBtn');

    if (!overlay || !messageEl || !btn) return;

    // Shadow native alert with premium modal
    window.alert = function (message, titleOrType) {
      console.log("Alert:", message);
      messageEl.textContent = message;
      overlay.style.display = "flex";

      // Accessibility: focus button
      setTimeout(() => btn.focus(), 50);

      return new Promise((resolve) => {
        const close = (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          overlay.style.display = "none";
          btn.removeEventListener("click", close);
          document.removeEventListener("keydown", handleKey);
          resolve();
        };
        const handleKey = (e) => {
          if (e.key === "Escape" || e.key === "Enter") close();
        };
        btn.addEventListener("click", close);
        document.addEventListener("keydown", handleKey);
      });
    };

    // Redefine showToast to use NotificationSystem (for any leftover calls)
    window.showToast = function (message, type) {
      NotificationSystem.toast(message, type || 'info');
    };

    // Redefine showAnvilNotification to use NotificationSystem (for any leftover calls)
    window.showAnvilNotification = function (message, title, style, timeout) {
      NotificationSystem.toast(message, style || 'info');
    };

    // Redefine showAnvilConfirm to use NotificationSystem (for any leftover calls)
    window.showAnvilConfirm = function (message, title, callback) {
      NotificationSystem.confirm(message, title || "Confirm", callback);
    };
  }

  // Initialize on load
  setTimeout(setupPremiumAlerts, 50);

  function showAlert(message, title) {
    // Only try to communicate with parent if we're in an iframe
    if (window.parent !== window) {
      window.parent.postMessage(
        {
          type: "anvil_alert",
          message: message,
          title: title || "Alert",
        },
        "*"
      );
    } else {
      // Fall back to NotificationSystem
      NotificationSystem.info(message);
    }
  }

  function showAnvilNotification(message, title, style, timeout) {
    // Only try to communicate with parent if we're in an iframe
    if (window.parent !== window) {
      window.parent.postMessage(
        {
          type: "anvil_notification",
          message: message,
          title: title || "Notification",
          style: style || "info",
          timeout: timeout || 3000,
        },
        "*"
      );
    } else {
      // Use NotificationSystem for all styles
      var type = style || 'info';
      if (type === 'success') NotificationSystem.success(message);
      else if (type === 'error') NotificationSystem.error(message);
      else if (type === 'warning') NotificationSystem.warning(message);
      else NotificationSystem.info(message);
    }
  }

  function showAnvilConfirm(message, title, callback) {
    var requestId = 'confirm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    var responded = false;
    var timeoutId;

    var confirmHandler = function (event) {
      if (event.data && event.data.type === 'anvil_confirm_response' && event.data.requestId === requestId) {
        responded = true;
        window.removeEventListener('message', confirmHandler);
        if (timeoutId) clearTimeout(timeoutId);
        if (callback) callback(event.data.confirmed);
      }
    };

    window.addEventListener('message', confirmHandler);

    // Set a timeout to fall back to NotificationSystem if no response from parent
    timeoutId = setTimeout(function () {
      if (!responded) {
        window.removeEventListener('message', confirmHandler);
        // Fall back to NotificationSystem confirm
        NotificationSystem.confirm(message, title || 'Confirm', callback);
      }
    }, 500); // Wait 500ms for Anvil response, then fall back

    // Only try to communicate with parent if we're in an iframe
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'anvil_confirm',
        requestId: requestId,
        message: message,
        title: title || 'Confirm'
      }, '*');
    } else {
      // Not in an iframe, use NotificationSystem confirm
      clearTimeout(timeoutId);
      window.removeEventListener('message', confirmHandler);
      NotificationSystem.confirm(message, title || 'Confirm', callback);
    }
  }

  function showBackendMessage(message, messageType, callback) {
    // messageType determines which buttons to show:
    // 'confirm' -> Accept/Cancel buttons
    // 'info' -> Got It button only
    // 'error' -> Got It button only
    // 'warning' -> Got It button only

    var overlay = document.getElementById('backendMessageOverlay');
    var messageEl = document.getElementById('backendMessageText');
    var acceptBtn = document.getElementById('backendMessageAccept');
    var cancelBtn = document.getElementById('backendMessageCancel');
    var gotItBtn = document.getElementById('backendMessageGotIt');

    if (!overlay || !messageEl) return;

    // Set message
    messageEl.textContent = message;

    // Hide all buttons first
    if (acceptBtn) acceptBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (gotItBtn) gotItBtn.style.display = 'none';

    // Show appropriate buttons based on message type
    if (messageType === 'confirm') {
      if (acceptBtn) {
        acceptBtn.style.display = 'block';
        acceptBtn.onclick = function () {
          overlay.style.display = 'none';
          if (callback) callback(true);
        };
      }
      if (cancelBtn) {
        cancelBtn.style.display = 'block';
        cancelBtn.onclick = function () {
          overlay.style.display = 'none';
          if (callback) callback(false);
        };
      }
    } else {
      // For info, error, warning - just show Got It button
      if (gotItBtn) {
        gotItBtn.style.display = 'block';
        gotItBtn.onclick = function () {
          overlay.style.display = 'none';
          if (callback) callback(true);
        };
      }
    }

    // Show the modal
    overlay.style.display = 'flex';
  }
  */
/*
  function exportFrontendRsrpCsv(fileName, spacing) {
    spacing = spacing || 1.0; // use 1.0 to match backend integer bins
    var rows = ["x,y,rsrp_front"];
    var count = 0;

    // Inclusive loops to match backend [0..30] and [0..20]
    for (var x = 0; x <= state.w + 1e-9; x += spacing) {
      for (var y = 0; y <= state.h + 1e-9; y += spacing) {
        // keep clean integer coordinates when spacing=1
        var xx = Math.round(x * 1000) / 1000;
        var yy = Math.round(y * 1000) / 1000;

        var best = bestApAt(xx, yy);
        var rsrp = (best && best.ap) ? best.rssiDbm : -9999;

        rows.push(xx + "," + yy + "," + rsrp.toFixed(6));
        count++;
      }
    }

    var csv = rows.join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName || "frontend_rsrp_bins.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("Frontend RSRP CSV exported. Points:", count);
  }

  function exportAntennaRsrpCsv(ap, fileName, spacing) {
    if (!ap) {
      console.error("No antenna provided for RSRP export");
      return;
    }
    
    spacing = spacing || 1.0; // use 1.0 to match backend integer bins
    var rows = ["x,y,rsrp"];
    var count = 0;

    // Inclusive loops to match backend [0..w] and [0..h]
    for (var x = 0; x <= state.w + 1e-9; x += spacing) {
      for (var y = 0; y <= state.h + 1e-9; y += spacing) {
        // keep clean integer coordinates when spacing=1
        var xx = Math.round(x * 1000) / 1000;
        var yy = Math.round(y * 1000) / 1000;

        // Calculate RSRP for this specific antenna at this position
        var rsrp = rssiFrom(ap, xx, yy);

        rows.push(xx + "," + yy + "," + rsrp.toFixed(6));
        count++;
      }
    }

    var csv = rows.join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName || (ap.id + "_rsrp.csv");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("RSRP CSV exported for antenna " + ap.id + ". Points:", count);
  }*/

  // AI COMMENT: clamp01, log10, dbmToLin, linToDbm, hypot
  // ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ EXTRACTED to GeometryUtils.js (loaded before this file)
  /*
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
  */

  // AI COMMENT: Duplicate hexToRgb() removed ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â keeping the identical copy at line ~4830
  // (used by the colour / rendering pipeline). Original location: line 296.
  /* HEBA COMMENTS
  // Convert hex color to RGB
  function hexToRgb(hex) {
    var m = /^#?([a-fA-F\d]{2})([a-fA-F\d]{2})([a-fA-F\d]{2})$/.exec(
      hex || ""
    );
    if (!m) return { r: 255, g: 255, b: 255 };
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
    };
  }
  */

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

  var state = {
    w: 30,
    h: 20,
    res: 0.2,
    freq: 2400,
    N: 10,
    refl: 6,
    model: "p25d",
    view: "rssi",
    noise: -92,
    aps: [],
    walls: [],
    floorPlanes: [],
    addingWall: false,
    temp: null,
    drag: null,
    addingAP: false,
    addingFloorPlane: false,
    tempFloorPlane: null,
    selectedApForDetail: null,
    minVal: -100,
    maxVal: -30,
    viewMinMax: {
      // Store min/max values per view mode
      rssi: { min: -100, max: -30 },
      snr: { min: 0, max: 40 },
      cci: { min: -10, max: 40 },
      thr: { min: 0, max: 80 },
      best: { min: -100, max: -30 }, // Not used but for consistency
      servch: { min: -100, max: -30 } // Not used but for consistency
    },
    complianceThreshold: -85, // Threshold for compliance calculation
    compliancePercentage: 80, // Target percentage for compliance
    palette: "custom",
    selectedApId: null,
    highlight: false,
    viewedApId: null, // Temporary viewing state for canvas clicks (shows pattern without selection)
    selectedWallId: null, // Keep for backward compatibility
    selectedWallIds: [], // Array for multi-selection
    wallDrag: null,
    mouseDownPos: null,
    isDragging: false,
    isDraggingAntenna: false, // Track if currently dragging an antenna (for heatmap optimization)
    cachedHeatmap: null, // Cache last heatmap to reuse during dragging
    cachedHeatmapAntennaCount: 0, // Track antenna count when heatmap was cached (for validation)
    heatmapUpdatePending: false, // Track if heatmap update is in progress
    heatmapUpdateRequestId: null, // Request ID for canceling pending updates
    heatmapWorker: null, // Web Worker for heatmap generation
    heatmapWorkerCallback: null, // Callback for worker completion
    threeScene: null, // Three.js scene
    threeRenderer: null, // Three.js WebGL renderer
    threeCamera: null, // Three.js camera
    threeObjects: {}, // Store Three.js objects (walls, antennas, etc.)
    threeGeometryCache: {}, // Cache for reusable geometries
    threeTextureCache: {}, // Cache for reusable textures
    useThreeJS: true, // Flag to enable/disable Three.js rendering
    threeCanvas: null, // Three.js canvas element
    threeRaycaster: null, // Three.js raycaster for mouse interaction
    selectionBox: null, // {p1: {x, y}, p2: {x, y}} for drag selection
    isSelecting: false, // Track if user is dragging to select
    justOpenedApSidebar: false,
    weak: "#ff0000",
    mid: "#ffff00",
    strong: "#00ff00",
    backgroundImage: null,
    backgroundImageAlpha: 0.7,
    backgroundImageAspectRatio: null, // Store original image aspect ratio (width/height)
    backgroundImageDisplayWidth: null, // Display width preserving aspect ratio
    backgroundImageDisplayHeight: null, // Display height preserving aspect ratio
    isCalibrating: false,
    calibrationLine: null,
    calibratingDrag: false,
    calibrationPixels: null,
    showContours: false,
    showTooltip: false,
    showVisualization: true,
    selectedElementType: "", // Selected element type: wall, door, doubleDoor, window
    selectedWallType: "drywall",
    customWallLoss: 15,
    snapToGrid: true,
    snapThreshold: 0.3, // meters - snap if within this distance
    wallSnapPoints: [], // Store snap points for visual feedback
    manualWallControl: false, // Enable manual wall selection and movement
    legendDrag: false, // Track if legend is being dragged
    legendDragStart: null, // Store initial drag position
    legendManuallyMoved: false, // Track if user has manually moved the legend (not used - legend is fixed)
    legendDefaultPosition: null, // Store default position (bottom-right)
    antennaPatterns: [], // Store all uploaded antenna patterns
    defaultAntennaPatternIndex: -1, // Index of the default pattern to use for new antennas
    viewMode: "2d", // 2D or 3D view mode
    viewModeTarget: "2d", // Target view mode for smooth transition
    viewModeTransition: 0, // Transition progress 0-1
    cameraRotationX: -Math.PI / 6, // 3D camera rotation around X axis (vertical) - default -30 degrees for top-down view
    cameraRotationY: 0, // 3D camera rotation around Y axis (horizontal) - default 0 to preserve 2D orientation
    cameraZoom: 1.0, // 3D camera zoom level
    cameraPanX: 0, // 3D camera pan X offset
    cameraPanY: 0, // 3D camera pan Y offset
    isRotating3D: false, // Track if user is rotating 3D view
    isPanning3D: false, // Track if user is panning 3D view
    rotateStartX: 0, // Mouse X position when rotation starts
    rotateStartY: 0, // Mouse Y position when rotation starts
    rotateStartRotX: 0, // Camera rotation X when rotation starts
    rotateStartRotY: 0, // Camera rotation Y when rotation starts
    panStartX: 0, // Mouse X position when panning starts
    panStartY: 0, // Mouse Y position when panning starts
    panStartPanX: 0, // Camera pan X when panning starts
    panStartPanY: 0, // Camera pan Y when panning starts
    groundPlane: {
      enabled: true, // Ground plane is always enabled by default
      attenuation: 3.0, // Ground plane attenuation in dB (typical for concrete/floor materials)
      height: 0, // Ground plane is at z=0
    },
    floorPlaneAttenuation: 3.0, // Default attenuation for drawn floor planes
    floorPlaneHeight: 0.0, // Default height for floor planes (meters)
    floorPlaneType: "horizontal", // 'horizontal' or 'inclined'
    floorPlaneInclination: 0, // Inclination angle in degrees (-90 to 90)
    floorPlaneInclinationDirection: 0, // Direction of inclination in degrees (0-360, 0=North)
    currentProjectFileName: null, // Track the current project filename if loaded
    csvCoverageData: null, // Store CSV coverage data: {points: [{x, y, z, rsrp}], minRsrp, maxRsrp, grid: {...}}
    csvCoverageGrid: null, // Pre-computed grid for fast lookup: {data: Float32Array, cols: number, rows: number, dx: number, dy: number}
    //isOptimizing: false, // Track if optimization is in progress
  };

  // Element type definitions: {loss, material, color, thickness, height, name, shape}
  var elementTypes = {
    wall: {
      drywall: {
        loss: 3,
        material: "drywall",
        color: "#3b82f6",
        thickness: 0.15,
        height: 2.5,
        name: "Drywall",
      },
      brick: {
        loss: 8,
        material: "brick",
        color: "#92400e",
        thickness: 0.2,
        height: 2.5,
        name: "Brick",
      },
      concrete: {
        loss: 14.22,
        material: "concrete",
        color: "#6b7280",
        thickness: 0.25,
        height: 2.5,
        name: "Concrete",
      },
      metal: {
        loss: 20,
        material: "metal",
        color: "#374151",
        thickness: 0.1,
        height: 2.5,
        name: "Metal",
      },
      glass: {
        loss: 4.44,
        material: "glass",
        color: "#60a5fa",
        thickness: 0.05,
        height: 2.5,
        name: "Glass",
      },
      wood: {
        loss: 10.3,
        material: "wood",
        color: "#d97706",
        thickness: 0.1,
        height: 2.5,
        name: "Wood",
      },
      custom: {
        loss: 15,
        material: "custom",
        color: "#f59e0b",
        thickness: 0.15,
        height: 2.5,
        name: "Custom",
      },
    },
    door: {
      loss: 10.3,
      material: "wood",
      color: "#8b4513",
      thickness: 0.05,
      height: 2.1,
      width: 1.2,
      name: "Door",
      shape: "door",
    },
    doubleDoor: {
      loss: 10.3,
      material: "wood",
      color: "#8b4513",
      thickness: 0.05,
      height: 2.1,
      width: 2.4,
      name: "Double Door",
      shape: "doubleDoor",
    },
    window: {
      loss: 4.44,
      material: "glass",
      color: "#87ceeb",
      thickness: 0.05,
      height: 1.2,
      width: 1.5,
      name: "Window",
      shape: "window",
    },
  };

  // Wall type definitions (for backward compatibility and wall-specific types)
  var wallTypes = {
    drywall: { loss: 3, color: "#3b82f6", thickness: 2, name: "Drywall" },
    brick: { loss: 8, color: "#92400e", thickness: 3, name: "Brick" },
    concrete: {
      loss: 14.22,
      color: "#6b7280",
      thickness: 4,
      name: "Concrete",
    },
    metal: { loss: 20, color: "#374151", thickness: 5, name: "Metal" },
    glass: { loss: 4.44, color: "#60a5fa", thickness: 1.5, name: "Glass" },
    wood: { loss: 10.3, color: "#d97706", thickness: 2.5, name: "Wood" },
    custom: { loss: 15, color: "#f59e0b", thickness: 3, name: "Custom" },
  };

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
    var elementName =
      elementNames[state.selectedElementType] || "Add Element";
    return elementName;
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

  var canvas = $("plot"),
    ctx = canvas.getContext("2d");
  // Enable image smoothing for smoother rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // AI COMMENT: pad, mx, my, invx, invy, worldToCanvasPixels -> EXTRACTED to core/CoordinateSystem.js
  /* function pad() { ... } */
  /* function mx(x) { ... } */
  /* function my(y) { ... } */
  /* function invx(px) { ... } */
  /* function invy(py) { ... } */
  /* function worldToCanvasPixels(worldX, worldY) { ... } */

  // AI COMMENT: invalidateHeatmapCache -> EXTRACTED to HeatmapEngine.js (loaded after this file)
  /* function invalidateHeatmapCache() { ... } */

  // AI COMMENT: initHeatmapWorker -> EXTRACTED to HeatmapEngine.js (loaded after this file)
  /* function initHeatmapWorker() { ... } */

  // AI COMMENT: initThreeJS, updateThreeJSCamera, updateThreeCanvasPointerEvents, handleThreeJSWheel, handleThreeJSMouseDown, handleThreeJSMouseMove, handleThreeJSMouseUp, renderThreeJSScene -> EXTRACTED to ThreeJSRenderer.js
  /* function initThreeJS() { ... } */
  /* function updateThreeJSCamera() { ... } */
  /* function updateThreeCanvasPointerEvents() { ... } */
  /* function handleThreeJSWheel(e) { ... } */
  /* function handleThreeJSMouseDown(e) { ... } */
  /* function handleThreeJSMouseMove(e) { ... } */
  /* function handleThreeJSMouseUp(e) { ... } */
  /* function renderThreeJSScene(transition, heatmapCanvas) { ... } */

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

  // AI COMMENT: BackendSync -> EXTRACTED to systems/BackendSync.js
  /* BackendSync functions removed */


  // AI COMMENT: OptimizationSystem -> EXTRACTED to systems/OptimizationSystem.js
  /* OptimizationSystem functions removed */


  // AI COMMENT: orient, onSeg, inter, lineIntersection, snapWallPoint,
  // pointToLineDistance, lineIntersectsWallWithThickness
  // ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ EXTRACTED to GeometryUtils.js (loaded before this file)
  /*
  function orient(p, q, r) {
    return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  }
  function onSeg(p, q, r) {
    return (
      Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) &&
      Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y)
    );
  }
  function inter(a1, a2, b1, b2) { ... }
  function lineIntersection(a1, a2, b1, b2) { ... }
  function snapWallPoint(p, startPoint) { ... }
  function pointToLineDistance(px, py, lx1, ly1, dirX, dirY, len) { ... }
  function lineIntersectsWallWithThickness(lineStart, lineEnd, wallStart, wallEnd, thickness) { ... }
  */

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Propagation Model Bridge ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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

    // wallsLoss ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â kept inline (app-specific door/window/thickness logic below)
  function wallsLoss(ax, ay, bx, by) {
    var i,
      L = 0,
      w;
    var processedSegments = []; // Track which segments we've processed
    var doorWindowSegments = []; // Store door/window segments that intersect the path

    // First pass: collect all doors/windows that intersect the path
    for (i = 0; i < state.walls.length; i++) {
      w = state.walls[i];

      // Handle polylines (walls with points array)
      var wallSegments = [];
      if (w.points && w.points.length >= 2) {
        // Polyline wall - create segments from points
        for (var j = 0; j < w.points.length - 1; j++) {
          wallSegments.push({ p1: w.points[j], p2: w.points[j + 1] });
        }
      } else if (w.p1 && w.p2) {
        // Regular wall - single segment
        wallSegments.push({ p1: w.p1, p2: w.p2 });
      } else {
        continue; // Skip invalid walls
      }

      // Get element thickness for accurate intersection checking
      var elementType = w.elementType || "wall";
      var thickness = 0.15; // Default wall thickness 15cm
      if (elementType === "door" || elementType === "doubleDoor") {
        thickness = 0.05; // Door frame thickness 5cm
      } else if (elementType === "window") {
        thickness = 0.05; // Window frame thickness 5cm
      } else if (elementTypes.wall && w.type && elementTypes.wall[w.type]) {
        thickness = elementTypes.wall[w.type].thickness || 0.15;
      }

      var lineStart = { x: ax, y: ay };
      var lineEnd = { x: bx, y: by };

      // Check each segment of the polyline
      for (var segIdx = 0; segIdx < wallSegments.length; segIdx++) {
        var seg = wallSegments[segIdx];
        if (
          lineIntersectsWallWithThickness(
            lineStart,
            lineEnd,
            seg.p1,
            seg.p2,
            thickness
          )
        ) {
          // Check multiple properties to identify doors/windows
          var isDoorWindow =
            w.elementType === "door" ||
            w.elementType === "doubleDoor" ||
            w.elementType === "window" ||
            w.type === "door" ||
            w.type === "doubleDoor" ||
            w.type === "window" ||
            w.shape === "door" ||
            w.shape === "doubleDoor" ||
            w.shape === "window";
          if (isDoorWindow) {
            doorWindowSegments.push({ wall: w, index: i, segment: seg });
          }
        }
      }
    }

    // Add loss from doors/windows (these replace wall loss)
    for (i = 0; i < doorWindowSegments.length; i++) {
      var dw = doorWindowSegments[i];
      var wall = dw.wall;
      var loss = wall.loss;

      // If loss is not set, try to get it from elementTypes based on elementType/type/shape
      if (loss == null || isNaN(loss) || loss <= 0) {
        var elementType = wall.elementType || wall.type || wall.shape;
        if (
          elementType &&
          elementTypes[elementType] &&
          elementTypes[elementType].loss != null
        ) {
          loss = elementTypes[elementType].loss;
        }
      }

      if (loss != null && !isNaN(loss) && loss > 0) {
        L += loss;
        processedSegments.push(dw.index); // Mark this segment as processed
      }
    }

    // Second pass: add loss from walls that don't overlap with doors/windows
    for (i = 0; i < state.walls.length; i++) {
      w = state.walls[i];
      if (processedSegments.indexOf(i) !== -1) continue; // Skip if already processed as door/window

      // Handle polylines (walls with points array)
      var wallSegments = [];
      if (w.points && w.points.length >= 2) {
        // Polyline wall - create segments from points
        for (var j = 0; j < w.points.length - 1; j++) {
          wallSegments.push({ p1: w.points[j], p2: w.points[j + 1] });
        }
      } else if (w.p1 && w.p2) {
        // Regular wall - single segment
        wallSegments.push({ p1: w.p1, p2: w.p2 });
      } else {
        continue; // Skip invalid walls
      }

      // Get wall thickness for accurate intersection checking
      var elementType = w.elementType || "wall";
      var thickness = 0.15; // Default wall thickness 15cm
      if (elementTypes.wall && w.type && elementTypes.wall[w.type]) {
        thickness = elementTypes.wall[w.type].thickness || 0.15;
      }

      var lineStart = { x: ax, y: ay };
      var lineEnd = { x: bx, y: by };

      // Check each segment of the polyline
      for (var segIdx = 0; segIdx < wallSegments.length; segIdx++) {
        var seg = wallSegments[segIdx];
        if (
          lineIntersectsWallWithThickness(
            lineStart,
            lineEnd,
            seg.p1,
            seg.p2,
            thickness
          )
        ) {
          // Check if this wall segment overlaps with any door/window
          var overlapsDoorWindow = false;
          for (var j = 0; j < doorWindowSegments.length; j++) {
            var dw = doorWindowSegments[j];
            var dwSeg = dw.segment || { p1: dw.wall.p1, p2: dw.wall.p2 };
            // Check if segments overlap (same line or very close)
            if (inter(seg.p1, seg.p2, dwSeg.p1, dwSeg.p2)) {
              // Check for collinearity to detect if door is embedded in wall
              var o1 = orient(seg.p1, seg.p2, dwSeg.p1);
              var o2 = orient(seg.p1, seg.p2, dwSeg.p2);

              if (o1 === 0 && o2 === 0) {
                // They are collinear and overlap
                overlapsDoorWindow = true;
                break;
              }
            }
          }

          // Only add wall loss if it doesn't overlap with a door/window
          if (!overlapsDoorWindow && w.loss != null && !isNaN(w.loss)) {
            L += w.loss;
          }
        }
      }
    }

    return L;
  }

  // AI COMMENT: pointInRect, lineIntersectsFloorPlane
  // ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ EXTRACTED to GeometryUtils.js (loaded before this file)
  /*
  function pointInRect(x, y, rect) { ... }
  function lineIntersectsFloorPlane(ax, ay, bx, by, floorPlane) { ... }
  */

  // Calculate floor plane attenuation along a path
  function floorPlanesLoss(ax, ay, bx, by) {
    var L = 0;
    for (var i = 0; i < state.floorPlanes.length; i++) {
      var fp = state.floorPlanes[i];
      if (lineIntersectsFloorPlane(ax, ay, bx, by, fp)) {
        L += fp.attenuation;
      }
    }
    return L;
  }

  // Calculate ground plane attenuation ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â delegates to PropagationModel25D
  function groundPlaneLoss(ax, ay, x, y) {
    _syncPropModel();
    return _propModel.groundPlaneLoss(
    { x: ax, y: ay },
    { x: x,  y: y  },
    state.groundPlane
    );
    }

    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ fspl / p25d / p525 / modelLoss ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â delegate to PropagationModel25D ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

  function fspl(freqMHz, d) {
    return _propModel.fspl(freqMHz, d);
  }

  function p25d(ax, ay, x, y) {
    _syncPropModel();
    // Use the module's core calculation but inject our richer wallsLoss
    // (which handles thickness / door-window overlay / polylines).
    var d = Math.max(hypot(x - ax, y - ay), 0.5);
    var ref_loss_1m    = _propModel.fspl(state.freq, 1.0);
    var distance_loss  = state.N * _propModel.log10(d);
    var base_loss      = ref_loss_1m + distance_loss;
    var wall_atten     = wallsLoss(ax, ay, x, y);
    var ground_atten   = groundPlaneLoss(ax, ay, x, y);
    var floor_atten    = floorPlanesLoss(ax, ay, x, y);
    var vertical_factor = 2.0;
    return base_loss + wall_atten + ground_atten + floor_atten + vertical_factor;
    }

    function p525(ax, ay, x, y) {
    _syncPropModel();
    var d = Math.max(hypot(x - ax, y - ay), 0.5);
    return _propModel.fspl(state.freq, d) +
    groundPlaneLoss(ax, ay, x, y) +
    floorPlanesLoss(ax, ay, x, y);
    }

    function modelLoss(ax, ay, x, y) {
    switch (state.model) {
    case "p25d":  return p25d(ax, ay, x, y);
    case "p525":  return p525(ax, ay, x, y);
    default:      return p25d(ax, ay, x, y);
    }
    }

    function rssi(tx, gt, L) {
    return _propModel.rssi(tx, gt, L);
  }

  // AI COMMENT: findWallAt, findWallsInSelectionBox, isLineOnWall
  // ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ EXTRACTED to GeometryUtils.js (loaded before this file)
  /*
  function findWallAt(p) { ... }
  function findWallsInSelectionBox(box) { ... }
  function isLineOnWall(lineP1, lineP2) { ... }
  */

  // AI COMMENT: undoStack, MAX_UNDO, saveState, restoreState, updateUndoButton,
  // DOMContentLoaded handler (undo btn, restart btn, Ctrl+Z)
  // ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ EXTRACTED to UndoSystem.js (loaded after this file)
  /*
  var undoStack = [];
  var MAX_UNDO = 50;
  function saveState() { ... }
  function restoreState() { ... }
  function updateUndoButton() { ... }
  document.addEventListener("DOMContentLoaded", function () { ... });
  */

  // AI COMMENT: getDefaultAntennaPattern, deleteAntennaPattern, updateAntennaPatternsList, parseAntennaPattern
  // ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ EXTRACTED to AntennaPatterns.js (loaded before this file)
  /*
  function getDefaultAntennaPattern() { ... }
  function deleteAntennaPattern(patternIndex) { ... }
  function updateAntennaPatternsList() { ... }
  function parseAntennaPattern(fileContent) { ... }
  */

  // NOTE: getGainFromPattern, interpolateGain, getAngleDependentGain remain here
  // because they depend on _propModel (created in this file).

  /* AI COMMENT: Original deleteAntennaPattern below ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â kept commented for reference
  function deleteAntennaPattern(patternIndex) {
    if (patternIndex < 0 || patternIndex >= state.antennaPatterns.length) {
      return;
    }

    var pattern = state.antennaPatterns[patternIndex];
    var patternName = pattern.name || "Unnamed Pattern";

    // Check if pattern is being used by any antennas
    var usedByAntennas = [];
    for (var i = 0; i < state.aps.length; i++) {
      if (state.aps[i].antennaPattern === pattern) {
        usedByAntennas.push(state.aps[i].id || ("AP " + (i + 1)));
      }
    }

    // Build confirmation message
    var message = "Pattern: " + patternName;
    if (usedByAntennas.length > 0) {
      message += "\nUsed by " + usedByAntennas.length + " antenna(s): " + usedByAntennas.join(", ");
      message += "\nThese antennas will lose their pattern assignment.";
    }

    // Request confirmation (destructive action ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ danger style)
    NotificationSystem.confirm(message, "Delete Pattern", function (confirmed) {
      if (confirmed) {
        // Remove pattern from antennas
        for (var i = 0; i < state.aps.length; i++) {
          if (state.aps[i].antennaPattern === pattern) {
            state.aps[i].antennaPattern = null;
            state.aps[i].antennaPatternFileName = null;
          }
        }

        // Remove pattern from array
        state.antennaPatterns.splice(patternIndex, 1);

        // Update default pattern index
        if (state.defaultAntennaPatternIndex === patternIndex) {
          // Deleted pattern was the default
          state.defaultAntennaPatternIndex = -1;
        } else if (state.defaultAntennaPatternIndex > patternIndex) {
          // Default pattern index needs to be decremented
          state.defaultAntennaPatternIndex--;
        }

        // If no patterns left, reset default and remove all patterns from antennas
        if (state.antennaPatterns.length === 0) {
          state.defaultAntennaPatternIndex = -1;
          // Remove all patterns from all antennas when all patterns are deleted
          for (var i = 0; i < state.aps.length; i++) {
            state.aps[i].antennaPattern = null;
            state.aps[i].antennaPatternFileName = null;
          }
        } else if (state.defaultAntennaPatternIndex === -1 && state.antennaPatterns.length > 0) {
          // If default was removed and patterns exist, set first one as default
          state.defaultAntennaPatternIndex = 0;
        }

        // Update UI (this might trigger dropdown change, but getDefaultAntennaPattern will return null)
        updateAntennaPatternsList();

        // Double-check: if no patterns exist, ensure no antennas have patterns assigned
        if (state.antennaPatterns.length === 0) {
          for (var j = 0; j < state.aps.length; j++) {
            if (state.aps[j].antennaPattern !== null) {
              state.aps[j].antennaPattern = null;
              state.aps[j].antennaPatternFileName = null;
            }
          }
        }

        // Cancel any pending heatmap updates and invalidate cache to regenerate heatmap immediately
        if (state.heatmapUpdateRequestId !== null) {
          cancelAnimationFrame(state.heatmapUpdateRequestId);
          state.heatmapUpdateRequestId = null;
        }
        state.heatmapUpdatePending = false;
        state.cachedHeatmap = null; // Invalidate cache to regenerate heatmap immediately

        // Redraw to reflect changes (this will trigger heatmap regeneration)
        draw();

        // Show success notification
        NotificationSystem.success("Pattern deleted successfully!");
      }
    }, {danger: true, confirmLabel: 'Delete', icon: 'ðŸ—‘'});
  }

  // Update the antenna patterns list UI
  function updateAntennaPatternsList() {
    var listContainer = $("antennaPatternsList");
    var select = $("defaultAntennaPatternSelect");

    if (!listContainer || !select) return;

    if (state.antennaPatterns.length === 0) {
      listContainer.style.display = "none";
      return;
    }

    listContainer.style.display = "block";

    // Clear existing options except the first one
    select.innerHTML = '<option value="-1">No default pattern</option>';

    // Add options for each pattern
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

    // Update delete button visibility based on selection
    var deleteButton = $("deleteSelectedPattern");
    if (deleteButton) {
      var selectedValue = select.value;
      if (selectedValue !== "-1" && selectedValue !== null && selectedValue !== "") {
        deleteButton.style.display = "block";
      } else {
        deleteButton.style.display = "none";
      }
    }

    // Update all pattern dropdowns in antenna detail containers
    for (var idx = 0; idx < state.aps.length; idx++) {
      var patternSelectId = "patternSelect_" + idx;
      var patternSelect = document.getElementById(patternSelectId);
      if (patternSelect) {
        // Clear existing options
        patternSelect.innerHTML = '<option value="-1">Select from uploaded patterns...</option>';

        // Add options for each uploaded pattern
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

          // Select current pattern if it matches
          var ap = state.aps[idx];
          if (ap && ap.antennaPattern && ap.antennaPattern === apPattern) {
            apOption.selected = true;
          }
          patternSelect.appendChild(apOption);
        }
      }
    }
  }

  // Parse antenna pattern file
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

      // Parse header
      if (line.startsWith("NAME ")) {
        pattern.name = line.substring(5).trim();
      } else if (line.startsWith("FREQUENCY ")) {
        pattern.frequency = parseFloat(line.substring(10));
      } else if (line.startsWith("H_WIDTH ")) {
        pattern.hWidth = parseFloat(line.substring(8));
      } else if (line.startsWith("GAIN ")) {
        var gainStr = line.substring(5).trim();
        // Handle both dBi and dBd units
        pattern.gain = parseFloat(
          gainStr
            .replace(" dBi.", "")
            .replace(" dBi", "")
            .replace(" dBd.", "")
            .replace(" dBd", "")
        );
      } else if (line.startsWith("HORIZONTAL")) {
        currentSection = "horizontal";
        hData = [];
      } else if (line.startsWith("VERTICAL")) {
        currentSection = "vertical";
        vData = [];
      } else if (currentSection) {
        // Parse data lines (angle value pairs)
        // Handle both integer (0, 1, 2) and decimal (0.0, 1.0, 2.0) angle formats
        var parts = line.split(/\s+/);
        if (parts.length >= 2) {
          var angle = parseFloat(parts[0]); // Use parseFloat to handle decimal angles
          var value = parseFloat(parts[1]);
          if (!isNaN(angle) && !isNaN(value)) {
            // Round angle to nearest integer for lookup, but keep decimal for interpolation
            var angleKey = Math.round(angle);
            if (currentSection === "horizontal") {
            pattern.horizontal[angleKey] = value;
            // MSI stores positive attenuation; some files store negative gain directly
            hData.push({ angle: angle, gain: value > 0 ? -value : value });
            } else if (currentSection === "vertical") {
            pattern.vertical[angleKey] = value;
            vData.push({ angle: angle, gain: value > 0 ? -value : value });
            }
          }
        }
      }
    }

    // Store arrays for interpolation (sort by angle for easier lookup)
    hData.sort(function (a, b) {
      return a.angle - b.angle;
    });
    vData.sort(function (a, b) {
      return a.angle - b.angle;
    });
    pattern.horizontalData = hData;
    pattern.verticalData = vData;

    // Calculate and cache min/max values and find peak angle
    if (hData.length > 0) {

      pattern._maxValue = pattern.gain;
      pattern._minValue = hData.length > 0 ? Math.min(...hData.map(d => d.gain)) : 0;
      pattern._peakAngle = hData.length > 0 ? hData.reduce((a,b) => b.gain > a.gain ? b : a).angle : 0;
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
  */

  // Delegate to PropagationModel25D ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â keeps the same signature
  function getGainFromPattern(pattern, horizontalAngleDeg, verticalAngleDeg) {
    return _propModel.getGainFromPattern(pattern, horizontalAngleDeg, verticalAngleDeg);
    }

    // Delegate to PropagationModel25D ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â keeps the same signature
    function interpolateGain(data, angle) {
    return _propModel.interpolateGain(data, angle);
    }

    // Delegate to PropagationModel25D ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â preserves app-specific default-pattern fallback
    function getAngleDependentGain(ap, x, y) {
    // Resolve default pattern the same way as before
    var effectiveAp = ap;
    if (!ap.antennaPattern && state.antennaPatterns.length > 0) {
    effectiveAp = Object.assign({}, ap, { antennaPattern: getDefaultAntennaPattern() });
    }
    return _propModel.getAngleDependentGain(effectiveAp, { x: x, y: y });
    }

  // AI COMMENT: rssiFrom, bestApAt, cciAt, countInterferingAntennas,
  // snrAt, sinrAt, throughputFromSinr
  // ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ EXTRACTED to SignalCalculations.js (loaded after this file)
  /*
  function rssiFrom(ap, x, y) { ... }
  function bestApAt(x, y) { ... }
  function cciAt(x, y, servingAp) { ... }
  function countInterferingAntennas(x, y, servingAp) { ... }
  function snrAt(rssiDbm) { ... }
  function sinrAt(rssiDbm, cciDbm) { ... }
  function throughputFromSinr(sinr) { ... }
  */

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Initialize standalone modules with dependencies ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  RadioCalculations.init({
    state:                  state,
    modelLoss:              modelLoss,
    getAngleDependentGain:  getAngleDependentGain,
    propModel:              _propModel
  });

  DataExportSystem.init({
    state: state
  });

  // AI COMMENT: hexToRgb, lerp, colorCustom, colorNumeric, colorZone, updateLegendBar
  // ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ EXTRACTED to ColorSystem.js (loaded before this file)
  /*
  function hexToRgb(hex) {
    var m = /^#?([a-fA-F\d]{2})([a-fA-F\d]{2})([a-fA-F\d]{2})$/.exec(
      hex || ""
    );
    if (!m) return { r: 255, g: 255, b: 255 };
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
    };
  }
  function lerp(a, b, t) {
    return Math.round(a + (b - a) * t);
  }
  function colorCustom(val) { ... }
  function colorNumeric(val) { ... }
  function colorZone(val) { ... }
  function updateLegendBar() { ... }
  */

  // AI COMMENT: CSVCoverageSystem -> EXTRACTED to systems/CSVCoverageSystem.js
  /* CSVCoverageSystem functions removed */


  // AI COMMENT: drawContours, drawContourLine
  // ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ EXTRACTED to ContourRenderer.js (loaded after this file)
  /*
  function drawContours() { ... }
  function drawContourLine(cols, rows, dx, dy, threshold, color, lineWidth) { ... }
  */

  // AI COMMENT: hashStr, hslToRgb, getAPColorMap, colorForAP, seededRandom,
  // colorForChannel, colorForCount, channelColorMap, cciColorMap
  // ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ EXTRACTED to ColorSystem.js (loaded before this file)
  /*
  function hashStr(s) { ... }
  function hslToRgb(h, s, l) { ... }
  function getAPColorMap(aps) { ... }
  function colorForAP(id) { ... }
  var channelColorMap = {};
  function seededRandom(seed) { ... }
  function colorForChannel(ch) { ... }
  var cciColorMap = {};
  function colorForCount(count) { ... }
  */

  // AI COMMENT: renderAPs, updateActiveAntennaStats, renderFloorPlanes, renderWalls,
  // scrollToSelectedWall, scrollToSelectedAp, renderApDetails -> EXTRACTED to UIRenderers.js
  /* function renderAPs() { ... }
  function updateActiveAntennaStats() { ... }
  function renderFloorPlanes() { ... }
  function renderWalls() { ... }
  function scrollToSelectedWall() { ... }
  function scrollToSelectedAp() { ... }
  function renderApDetails() { ... }
  */
  void 0; // placeholder Ã¢â‚¬â€ original block commented out above
  /*__UIRenderers_EXTRACTED_START__
  function renderAPs() {
    var list = $("apList");
    list.innerHTML = "";
    for (var i = 0; i < state.aps.length; i++) {
      (function (idx) {
        var a = state.aps[idx];
        var item = document.createElement("div");
        item.className = "list-item";
        item.id = "ap-item-" + a.id; // Add unique ID for scrolling

        // Add selected class if this antenna is selected or viewed
        if (a.id === state.selectedApId || a.id === state.viewedApId) {
          item.classList.add("selected");
        }

        item.onclick = function (e) {
          if (e) {
            e.stopPropagation();
          }

          // While placing antennas, do not change selection or open the right sidebar at all
          if (state && state.addingAP) {
            return;
          }
          // Toggle selection: if already selected, deselect it
          if (a.id === state.selectedApId) {
            // Deselect antenna
            state.selectedApId = null;
            state.highlight = false;
            // Cancel any pending heatmap updates and invalidate cache
            if (state.heatmapUpdateRequestId !== null) {
              cancelAnimationFrame(state.heatmapUpdateRequestId);
              state.heatmapUpdateRequestId = null;
            }
            state.heatmapUpdatePending = false;
            state.cachedHeatmap = null; // Invalidate cache to regenerate heatmap
            state.selectedApForDetail = null;
            $("apDetailSidebar").classList.remove("visible");
          } else {
            // Select antenna and show only its pattern
            state.selectedApId = a.id;
            state.highlight = true; // Enable highlight to show only this antenna's pattern
            // Cancel any pending heatmap updates and invalidate cache
            if (state.heatmapUpdateRequestId !== null) {
              cancelAnimationFrame(state.heatmapUpdateRequestId);
              state.heatmapUpdateRequestId = null;
            }
            state.heatmapUpdatePending = false;
            state.cachedHeatmap = null; // Invalidate cache to regenerate heatmap

            state.selectedApForDetail = a;

            // Don't open right sidebar:
            // - if left sidebar is expanded AND antenna tab is active
            // - OR while antenna placement mode is active
            var mainSidebar = document.getElementById("mainSidebar");
            var isLeftSidebarExpanded = mainSidebar && mainSidebar.classList.contains("expanded");
            var antennaSection = document.querySelector('.section-content[data-section="accesspoints"]');
            var isAntennaTabActive = antennaSection && antennaSection.classList.contains("active");
            var isPlacingAntenna = !!state.addingAP;
            var shouldPreventOpening = (isLeftSidebarExpanded && isAntennaTabActive) || isPlacingAntenna;

            if (!shouldPreventOpening) {
              $("apDetailSidebar").classList.add("visible");
              renderApDetails();
              state.justOpenedApSidebar = true;
              setTimeout(function () {
                state.justOpenedApSidebar = false;
              }, 100);
            }
          }

          renderAPs(); // Update button states
          draw();
        };

        // Create title (antenna name) - displayed first
        var title = document.createElement("div");
        title.className = "list-item-title";
        title.style.fontSize = "14px";
        title.style.fontWeight = "600";
        title.style.marginBottom = "8px";
        title.style.paddingBottom = "8px";
        title.style.borderBottom = "1px solid #e2e8f0";
        title.textContent = a.id;

        // Create button container - displayed below title
        var actions = document.createElement("div");
        actions.className = "list-item-actions";
        actions.style.display = "flex";
        actions.style.gap = "4px";
        actions.style.flexWrap = "wrap";
        actions.style.marginBottom = "8px";

        var selBtn = document.createElement("button");
        // Show green if antenna is selected
        if (a.id === state.selectedApId) {
          selBtn.className = "small toggled";
          selBtn.textContent = "Selected";
        } else {
          selBtn.className = "small secondary";
          selBtn.textContent = "Select";
        }
        selBtn.style.flex = "1";
        selBtn.style.minWidth = "0";
        selBtn.style.fontSize = "13px";
        selBtn.style.padding = "4px 6px";
        selBtn.onclick = function (e) {
          e.stopPropagation();
          e.preventDefault();

          // While placing antennas, do not change selection or open the right sidebar at all
          if (state && state.addingAP) {
            return false;
          }
          // Toggle selection: if already selected, deselect it
          if (a.id === state.selectedApId) {
            // Deselect antenna
            state.selectedApId = null;
            state.highlight = false;
            // Cancel any pending heatmap updates
            // NOTE: Don't clear cache - antenna count hasn't changed, so cache is still valid
            // This allows smooth transition without disappearing
            if (state.heatmapUpdateRequestId !== null) {
              cancelAnimationFrame(state.heatmapUpdateRequestId);
              state.heatmapUpdateRequestId = null;
            }
            state.heatmapUpdatePending = true; // Set to true to trigger regeneration
            state.heatmapWorkerCallback = null; // Clear any pending worker callback
            state.selectedApForDetail = null;
            $("apDetailSidebar").classList.remove("visible");
          } else {
            // Select antenna and show only its pattern
            state.selectedApId = a.id;
            state.viewedApId = null; // Clear viewed state when selecting from sidebar
            state.highlight = true; // Enable highlight to show only this antenna's pattern
            // Cancel any pending heatmap updates
            // NOTE: Don't clear cache - antenna count hasn't changed, so cache is still valid
            // This allows smooth transition without disappearing
            if (state.heatmapUpdateRequestId !== null) {
              cancelAnimationFrame(state.heatmapUpdateRequestId);
              state.heatmapUpdateRequestId = null;
            }
            state.heatmapUpdatePending = true; // Set to true to trigger regeneration
            state.heatmapWorkerCallback = null; // Clear any pending worker callback

            state.selectedApForDetail = a;

            // Don't open right sidebar:
            // - if left sidebar is expanded AND antenna tab is active
            // - OR while antenna placement mode is active
            var mainSidebar = document.getElementById("mainSidebar");
            var isLeftSidebarExpanded = mainSidebar && mainSidebar.classList.contains("expanded");
            var antennaSection = document.querySelector('.section-content[data-section="accesspoints"]');
            var isAntennaTabActive = antennaSection && antennaSection.classList.contains("active");
            var isPlacingAntenna = !!state.addingAP;
            var shouldPreventOpening = (isLeftSidebarExpanded && isAntennaTabActive) || isPlacingAntenna;

            if (!shouldPreventOpening) {
              $("apDetailSidebar").classList.add("visible");
              renderApDetails();
              state.justOpenedApSidebar = true;
              setTimeout(function () {
                state.justOpenedApSidebar = false;
              }, 100);
            }

            // Scroll to selected antenna in sidebar
            scrollToSelectedAp();
          }

          renderAPs(); // Update button states
          
          // Start heatmap regeneration BEFORE draw() to minimize delay and prevent flash
          if (state.showVisualization) {
            generateHeatmapAsync(null, true); // Start with low-res for fast update
          }
          
          // Draw after starting regeneration - validation will prevent using stale cache
          draw();
          return false;
        };

        var patternBtn = document.createElement("button");
        patternBtn.className = "small secondary";
        patternBtn.textContent = "Change Pattern";
        patternBtn.style.flex = "1";
        patternBtn.style.minWidth = "0";
        patternBtn.style.fontSize = "13px";
        patternBtn.style.padding = "4px 6px";
        patternBtn.onclick = function (e) {
          if (e) e.stopPropagation();
          // Toggle pattern upload field for this AP
          var patternUploadId = "patternUpload_" + idx;
          var patternContainerId = "patternContainer_" + idx;
          var patternSelectId = "patternSelect_" + idx;
          var existingContainer =
            document.getElementById(patternContainerId);

          // Function to update pattern dropdown
          function updatePatternDropdown(selectElement) {
            // Clear existing options
            selectElement.innerHTML = '<option value="-1">Select from uploaded patterns...</option>';

            // Add options for each uploaded pattern
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

              // Select current pattern if it matches
              if (a.antennaPattern && a.antennaPattern === pattern) {
                option.selected = true;
              }
              selectElement.appendChild(option);
            }
          }

          if (existingContainer) {
            // Toggle visibility
            existingContainer.style.display =
              existingContainer.style.display === "none" ? "block" : "none";

            // Update dropdown when showing (in case new patterns were added)
            if (existingContainer.style.display === "block") {
              var selectElement = document.getElementById(patternSelectId);
              if (selectElement) {
                updatePatternDropdown(selectElement);
              }
            }
          } else {
            // Create container with upload field and file name display
            var container = document.createElement("div");
            container.id = patternContainerId;
            container.style.marginTop = "8px";
            container.style.padding = "8px";
            container.style.background = "#f8fafc";
            container.style.borderRadius = "6px";
            container.style.border = "1px solid #e2e8f0";

            // Stop event propagation on container to prevent antenna selection
            container.onclick = function (e) {
              if (e) e.stopPropagation();
            };
            container.onmousedown = function (e) {
              if (e) e.stopPropagation();
            };

            var label = document.createElement("label");
            label.style.fontSize = "12px";
            label.style.fontWeight = "500";
            label.style.color = "#64748b";
            label.style.display = "block";
            label.style.marginBottom = "4px";
            label.textContent = "Antenna Pattern File:";

            // Stop event propagation on labels
            label.onclick = function (e) {
              if (e) e.stopPropagation();
            };
            label.onmousedown = function (e) {
              if (e) e.stopPropagation();
            };

            var fileNameDisplay = document.createElement("div");
            fileNameDisplay.id = "patternFileName_" + idx;
            fileNameDisplay.style.fontSize = "11px";
            fileNameDisplay.style.color = "#94a3b8";
            fileNameDisplay.style.marginBottom = "6px";
            if (a.antennaPatternFileName) {
              fileNameDisplay.textContent =
                "Current: " + a.antennaPatternFileName;
              fileNameDisplay.style.color = "#10b981";
            } else {
              fileNameDisplay.textContent = "No file uploaded";
            }

            // Stop event propagation on file name display
            fileNameDisplay.onclick = function (e) {
              if (e) e.stopPropagation();
            };
            fileNameDisplay.onmousedown = function (e) {
              if (e) e.stopPropagation();
            };

            // Create dropdown for selecting from uploaded patterns
            var selectLabel = document.createElement("label");
            selectLabel.style.fontSize = "12px";
            selectLabel.style.fontWeight = "500";
            selectLabel.style.color = "#64748b";
            selectLabel.style.display = "block";
            selectLabel.style.marginBottom = "4px";
            selectLabel.textContent = "Select Pattern:";

            // Stop event propagation on select label
            selectLabel.onclick = function (e) {
              if (e) e.stopPropagation();
            };
            selectLabel.onmousedown = function (e) {
              if (e) e.stopPropagation();
            };

            var patternSelect = document.createElement("select");
            patternSelect.id = patternSelectId;
            patternSelect.style.width = "100%";
            patternSelect.style.padding = "6px";
            patternSelect.style.marginBottom = "8px";
            patternSelect.style.fontSize = "12px";
            patternSelect.style.border = "1px solid #e2e8f0";
            patternSelect.style.borderRadius = "4px";
            patternSelect.style.background = "#ffffff";
            patternSelect.style.color = "#1e293b";

            // Stop event propagation to prevent antenna selection
            patternSelect.onclick = function (e) {
              if (e) e.stopPropagation();
            };
            patternSelect.onmousedown = function (e) {
              if (e) e.stopPropagation();
            };

            // Populate dropdown
            updatePatternDropdown(patternSelect);

            // Handle pattern selection
            patternSelect.onchange = function (e) {
              if (e) e.stopPropagation();
              var selectedIndex = parseInt(e.target.value);
              if (selectedIndex >= 0 && selectedIndex < state.antennaPatterns.length) {
                var selectedPattern = state.antennaPatterns[selectedIndex];
                // Apply pattern to antenna
                a.antennaPattern = selectedPattern;
                a.antennaPatternFileName = selectedPattern.fileName || (selectedPattern.name ? selectedPattern.name : "Selected Pattern");

                // Update file name display
                fileNameDisplay.textContent = "Current: " + a.antennaPatternFileName;
                fileNameDisplay.style.color = "#10b981";

                // Cancel any pending heatmap updates
                // NOTE: Don't clear cache - antenna count hasn't changed, so cache is still valid
                // This allows smooth transition without disappearing or deformed patterns
                if (state.heatmapUpdateRequestId !== null) {
                  cancelAnimationFrame(state.heatmapUpdateRequestId);
                  state.heatmapUpdateRequestId = null;
                }
                state.heatmapUpdatePending = true; // Set to true to trigger regeneration
                state.heatmapWorkerCallback = null; // Clear any pending worker callback

                console.log(
                  "Antenna pattern selected for AP:",
                  a.id,
                  "Pattern:",
                  selectedPattern.name
                );

                // Start heatmap regeneration BEFORE draw() to minimize delay and prevent flash
                if (state.showVisualization) {
                  generateHeatmapAsync(null, true); // Start with low-res for fast update
                }

                // Draw after starting regeneration - validation will prevent using stale cache
                draw();

                // Enqueue antenna after changing pattern
                scheduleAntennaEnqueue(a);
              }
            };

            var uploadField = document.createElement("input");
            uploadField.type = "file";
            uploadField.id = patternUploadId;
            uploadField.accept = ".json,.txt,.csv,.msi";
            uploadField.style.width = "100%";

            // Stop event propagation to prevent antenna selection
            uploadField.onclick = function (e) {
              if (e) e.stopPropagation();
            };
            uploadField.onmousedown = function (e) {
              if (e) e.stopPropagation();
            };

            uploadField.onchange = function (e) {
              if (e) e.stopPropagation();
              if (e.target.files && e.target.files[0]) {
                var file = e.target.files[0];
                var reader = new FileReader();

                reader.onload = function (event) {
                  try {
                    var pattern = parseAntennaPattern(event.target.result);

                    // Store file info in pattern
                    pattern.fileName = file.name;
                    pattern.uploadTime = new Date().toISOString();

                    // Check if pattern already exists in global list (by name, frequency, and filename)
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

                    // If pattern already exists, show duplicate alert (similar to first upload)
                    if (patternExists) {
                      var existingPattern = state.antennaPatterns[existingPatternIndex];
                      NotificationSystem.warning("Pattern \"" + existingPattern.name + "\" already exists in this project.");
                      // Reset file input
                      e.target.value = '';
                      return;
                    }

                    // Prepare success message for confirmation
                    var message =
                      "Name: " + pattern.name +
                      "\nFrequency: " + pattern.frequency + " MHz" +
                      "\nGain: " + pattern.gain + " dBi";

                    if (state.antennaPatterns.length === 0) {
                      message += "\n\nThis will be set as the default pattern for all new antennas.";
                    } else {
                      message += "\n\nAdd this pattern to your project?";
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

                        // Add to global patterns list
                        state.antennaPatterns.push(pattern);

                        // If this is the first pattern, set it as default
                        if (state.antennaPatterns.length === 1) {
                          state.defaultAntennaPatternIndex = 0;
                        }

                        console.log(
                          "Antenna pattern added to global list:",
                          pattern.name,
                          "Frequency:",
                          pattern.frequency,
                          "MHz",
                          "Gain:",
                          pattern.gain,
                          "dBi"
                        );
                        console.log("Total patterns:", state.antennaPatterns.length);

                        // Update UI to show new pattern in all dropdowns
                        updateAntennaPatternsList();

                        // Store parsed pattern in AP object
                        a.antennaPattern = pattern;
                        a.antennaPatternFile = file;
                        a.antennaPatternFileName = file.name;
                        fileNameDisplay.textContent =
                          "Current: " + a.antennaPatternFileName;
                        fileNameDisplay.style.color = "#10b981";

                        // Cancel any pending heatmap updates
                        // NOTE: Don't clear cache - antenna count hasn't changed, so cache is still valid
                        // This allows smooth transition without disappearing or deformed patterns
                        if (state.heatmapUpdateRequestId !== null) {
                          cancelAnimationFrame(state.heatmapUpdateRequestId);
                          state.heatmapUpdateRequestId = null;
                        }
                        state.heatmapUpdatePending = true; // Set to true to trigger regeneration
                        state.heatmapWorkerCallback = null; // Clear any pending worker callback

                        console.log(
                          "Antenna pattern loaded for AP:",
                          a.id,
                          "Pattern:",
                          pattern.name
                        );

                        // Update dropdown to reflect new selection
                        updatePatternDropdown(patternSelect);

                        // Start heatmap regeneration BEFORE draw() to minimize delay and prevent flash
                        if (state.showVisualization) {
                          generateHeatmapAsync(null, true); // Start with low-res for fast update
                        }

                        // Draw after starting regeneration - validation will prevent using stale cache
                        draw();

                        // Enqueue antenna after uploading a new pattern
                        scheduleAntennaEnqueue(a);
                      } else {
                        console.log("User cancelled antenna pattern upload.");
                      }
                    });
                  } catch (err) {
                    console.error("Error parsing antenna pattern:", err);
                    // alert(
                    //   "Error parsing antenna pattern file: " + err.message
                    // );
                    NotificationSystem.error("Failed to parse pattern file.\n" + err.message);

                  }
                };

                reader.onerror = function () {
                  // alert("Error reading antenna pattern file");
                  NotificationSystem.error("Could not read the antenna pattern file.");

                };

                reader.readAsText(file);
              }
            };

            container.appendChild(label);
            container.appendChild(fileNameDisplay);
            container.appendChild(selectLabel);
            container.appendChild(patternSelect);
            container.appendChild(uploadField);

            // Add hint about supported file formats
            var hintText = document.createElement("div");
            hintText.style.fontSize = "11px";
            hintText.style.color = "#64748b";
            hintText.style.marginTop = "4px";
            hintText.style.fontStyle = "italic";
            hintText.textContent =
              "Supported file formats: .txt, .msi";

            // Stop event propagation on hint text
            hintText.onclick = function (e) {
              if (e) e.stopPropagation();
            };
            hintText.onmousedown = function (e) {
              if (e) e.stopPropagation();
            };

            container.appendChild(hintText);

            // Find the content div and append container
            var contentDiv = item.querySelector(".list-item-content");
            if (contentDiv) {
              contentDiv.appendChild(container);
            }
          }
        };

        var toggleBtn = document.createElement("button");
        // Initialize enabled property if not set (default to true)
        if (a.enabled === undefined) a.enabled = true;
        toggleBtn.className = a.enabled
          ? "small secondary"
          : "small danger";
        toggleBtn.textContent = a.enabled ? "Turn Off" : "Turn On";
        toggleBtn.style.flex = "1";
        toggleBtn.style.minWidth = "0";
        toggleBtn.style.fontSize = "13px";
        toggleBtn.style.padding = "4px 6px";
        //toggleBtn.disabled = state.isOptimizing;
        toggleBtn.onclick = function (e) {
          if (e) e.stopPropagation();

          // Prevent toggling during optimization
          //if (state.isOptimizing) {
          //  alert("Cannot change antenna status while optimization is in progress. Please wait for optimization to complete.");
          //  return;
          //}

          // Ensure enabled is always a boolean
          if (a.enabled === undefined) a.enabled = true;
          a.enabled = Boolean(a.enabled);
          var oldEnabled = a.enabled;
          a.enabled = !a.enabled;

          // If this antenna is selected and being disabled, clear selection so pattern disappears and button resets
          if (a.id === state.selectedApId && a.enabled === false) {
            state.selectedApId = null;
            state.highlight = false;
            state.selectedApForDetail = null;
            $("apDetailSidebar").classList.remove("visible");
          }

          // Cancel any pending heatmap updates
          // NOTE: Don't clear cache - antenna count hasn't changed, so cache is still valid
          // This allows smooth transition without disappearing or deformed patterns
          if (state.heatmapUpdateRequestId !== null) {
            cancelAnimationFrame(state.heatmapUpdateRequestId);
            state.heatmapUpdateRequestId = null;
          }
          state.heatmapUpdatePending = true; // Set to true to trigger regeneration
          state.heatmapWorkerCallback = null; // Clear any pending worker callback

          // Log position change with same position but updated enabled status
          // This maintains the position history format instead of overwriting with configs format
          logAntennaPositionChange(a.id, a.id, a.x, a.y, a.x, a.y);

          // Send antenna status update to backend (notification only, not file save)
          sendAntennaStatusUpdate(a);

          renderAPs();
          renderApDetails(); // Update right sidebar if this antenna is selected
          updateActiveAntennaStats(); // Update active antenna stats
          
          // Start heatmap regeneration BEFORE draw() to minimize delay and prevent flash
          if (state.showVisualization) {
            generateHeatmapAsync(null, true); // Start with low-res for fast update
          }
          
          // Draw after starting regeneration - validation will prevent using stale cache
          draw();
        };

        var delBtn = document.createElement("button");
        delBtn.className = "small danger";
        delBtn.textContent = "Delete";
        delBtn.style.flex = "1";
        delBtn.style.minWidth = "0";
        delBtn.style.fontSize = "13px";
        delBtn.style.padding = "4px 6px";
        delBtn.onclick = function (e) {
          if (e) e.stopPropagation();
          state.aps.splice(idx, 1);
          if (state.selectedApId === a.id) {
            state.selectedApId = null;
            state.highlight = false;
          }
          
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
          
          renderAPs();
          updateActiveAntennaStats(); // Update active antenna stats
          
          // Start heatmap regeneration BEFORE draw() to minimize delay
          if (state.showVisualization) {
            generateHeatmapAsync(null, true); // Start with low-res for fast update
          }
          
          // Draw after starting regeneration - validation will prevent using stale cache
          draw();
        };

        actions.appendChild(selBtn);
        actions.appendChild(patternBtn);
        actions.appendChild(toggleBtn);
        actions.appendChild(delBtn);

        // Style disabled antennas differently
        if (!a.enabled) {
          item.style.opacity = "0.5";
          item.style.backgroundColor = "#f3f4f6";
        }

        // Add title first, then buttons, then content
        item.appendChild(title);
        item.appendChild(actions);

        var content = document.createElement("div");
        content.className = "list-item-content";
        //var safeAntennaId = String(a.id)
        //  .replace(/&/g, "&amp;")
        //  .replace(/"/g, "&quot;")
        //  .replace(/</g, "&lt;")
        //  .replace(/>/g, "&gt;");
        content.innerHTML =
          '<input type="text" value="' +
          a.id +
          '" placeholder="ID" title="ANTENNA ID">' +
          '<input type="number" step="0.5" value="' +
          a.tx +
          '" placeholder="Tx" title="Tx Power (dBm)">' +
          '<input type="number" step="0.5" value="' +
          a.gt +
          '" placeholder="Gain" title="Antenna Gain (dBi)">' +
          '<input type="number" step="1" value="' +
          a.ch +
          '" placeholder="Ch" title="Channel">' +
          '<input type="number" step="5" value="' +
          (a.azimuth || 0) +
          '" placeholder="Azimuth" title="Azimuth (degrees)">' +
          '<input type="number" step="5" value="' +
          (a.tilt || 0) +
          '" placeholder="Tilt" title="Tilt (degrees)">';

        var inputs = content.getElementsByTagName("input");
        for (var j = 0; j < inputs.length; j++) {
          inputs[j].onclick = function (e) {
            e.stopPropagation();
          };
          // Disable inputs during optimization
          // inputs[j].disabled = state.isOptimizing;
        }
        inputs[0].oninput = function () {
          //if (state.isOptimizing) return;
          a.id = inputs[0].value;
          title.textContent = a.id;
          // Don't clear cache here - applyInputChange will handle it
          // Schedule debounced update (3 seconds or Enter key)
          scheduleInputChange(a, false, true, false);
        };

        inputs[0].onkeydown = function (e) {
          if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault();
            applyInputChangeImmediately(a.id);
            inputs[0].blur();
          }
        };
        inputs[0].onblur = function () {
          applyInputChangeImmediately(a.id);
        };
        inputs[1].oninput = function () {
          //if (state.isOptimizing) return;
          var val = inputs[1].value.trim();
          if (val === "" || val === "-") {
            // Allow empty during editing, set to 0 in model for calculations
            a.tx = 0;
            // Don't update input field here - let user continue editing
          } else {
            var numVal = +val;
            if (!isNaN(numVal)) {
              a.tx = numVal;
            }
          }
          // Don't clear cache here - antenna count hasn't changed
          // applyInputChange will handle heatmap regeneration properly
          // Schedule debounced update (3 seconds or Enter key)
          scheduleInputChange(a, false, true, true);
        };
        inputs[1].onkeydown = function (e) {
          if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault();
            applyInputChangeImmediately(a.id);
            inputs[1].blur();
          }
        };
        inputs[1].onblur = function () {
          if (
            inputs[1].value.trim() === "" ||
            inputs[1].value.trim() === "-"
          ) {
            a.tx = 0;
            inputs[1].value = "0";
            // Don't clear cache here - applyInputChangeImmediately will handle it
          }
          applyInputChangeImmediately(a.id);
        };
        inputs[2].oninput = function () {
          //if (state.isOptimizing) return;
          var val = inputs[2].value.trim();
          if (val === "" || val === "-") {
            // Allow empty during editing, set to 0 in model for calculations
            a.gt = 5;
            // Don't update input field here - let user continue editing
          } else {
            var numVal = +val;
            if (!isNaN(numVal)) {
              a.gt = numVal;
            }
          }
          // Don't clear cache here - antenna count hasn't changed
          // applyInputChange will handle heatmap regeneration properly
          // Schedule debounced update (3 seconds or Enter key)
          scheduleInputChange(a, false, true, true);
        };
        inputs[2].onkeydown = function (e) {
          if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault();
            applyInputChangeImmediately(a.id);
            inputs[2].blur();
          }
        };
        inputs[2].onblur = function () {
          if (
            inputs[2].value.trim() === "" ||
            inputs[2].value.trim() === "-"
          ) {
            a.gt = 5;
            inputs[2].value = "0";
            // Don't clear cache here - applyInputChangeImmediately will handle it
          }
          applyInputChangeImmediately(a.id);
        };
        inputs[3].oninput = function () {
          //if (state.isOptimizing) return;
          var val = inputs[3].value.trim();
          if (val === "" || val === "-") {
            // Allow empty during editing, set to 0 in model for calculations
            a.ch = 0;
            // Don't update input field here - let user continue editing
          } else {
            var numVal = +val;
            if (!isNaN(numVal)) {
              a.ch = numVal;
            }
          }
          // Don't clear cache here - antenna count hasn't changed
          // applyInputChange will handle heatmap regeneration properly
          // Schedule debounced update (3 seconds or Enter key)
          scheduleInputChange(a, false, true, true);
        };
        inputs[3].onkeydown = function (e) {
          if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault();
            applyInputChangeImmediately(a.id);
            inputs[3].blur();
          }
        };
        inputs[3].onblur = function () {
          if (
            inputs[3].value.trim() === "" ||
            inputs[3].value.trim() === "-"
          ) {
            a.ch = 0;
            inputs[3].value = "0";
            // Don't clear cache here - applyInputChangeImmediately will handle it
          }
          applyInputChangeImmediately(a.id);

        };
        inputs[4].oninput = function () {
          //if (state.isOptimizing) return;
          var val = inputs[4].value.trim();
          if (val === "" || val === "-") {
            // Allow empty during editing, set to 0 in model for calculations
            a.azimuth = 0;
            // Don't update input field here - let user continue editing
          } else {
            var numVal = +val;
            if (!isNaN(numVal)) {
              a.azimuth = numVal;
            }
          }
          // Don't clear cache here - antenna count hasn't changed
          // applyInputChange will handle heatmap regeneration properly
          // Schedule debounced update (3 seconds or Enter key)
          scheduleInputChange(a, false, true, true);
        };
        inputs[4].onkeydown = function (e) {
          if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault();
            applyInputChangeImmediately(a.id);
            inputs[4].blur();
          }
        };
        inputs[4].onblur = function () {
          if (
            inputs[4].value.trim() === "" ||
            inputs[4].value.trim() === "-"
          ) {
            a.azimuth = 0;
            inputs[4].value = "0";
            // Don't clear cache here - applyInputChangeImmediately will handle it
          }
          applyInputChangeImmediately(a.id);

        };
        inputs[5].oninput = function () {
          // if (state.isOptimizing) return;
          var val = inputs[5].value.trim();
          if (val === "" || val === "-") {
            // Allow empty during editing, set to 0 in model for calculations
            a.tilt = 0;
            // Don't update input field here - let user continue editing
          } else {
            var numVal = +val;
            if (!isNaN(numVal)) {
              a.tilt = numVal;
            }
          }
          // Don't clear cache here - antenna count hasn't changed
          // applyInputChange will handle heatmap regeneration properly
          // Schedule debounced update (3 seconds or Enter key)
          scheduleInputChange(a, false, true, true);
        };
        inputs[5].onkeydown = function (e) {
          if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault();
            applyInputChangeImmediately(a.id);
            inputs[5].blur();
          }
        };
        inputs[5].onblur = function () {
          if (
            inputs[5].value.trim() === "" ||
            inputs[5].value.trim() === "-"
          ) {
            a.tilt = 0;
            inputs[5].value = "0";
            // Don't clear cache here - applyInputChangeImmediately will handle it
          }
          applyInputChangeImmediately(a.id);

        };

        item.appendChild(content);
        list.appendChild(item);
      })(i);
    }
    $("apCount").textContent = state.aps.length;
    updateActiveAntennaStats();
  }

  // Update active antenna count and compliance percentage
  function updateActiveAntennaStats() {
    // Count active antennas (enabled !== false)
    var activeCount = 0;
    for (var i = 0; i < state.aps.length; i++) {
      if (state.aps[i].enabled !== false) {
        activeCount++;
      }
    }

    // Update active antenna count
    var activeAntennaCountEl = $("activeAntennaCount");
    if (activeAntennaCountEl) {
      activeAntennaCountEl.textContent = activeCount;
    }

    // Calculate compliance percentage
    // Compliance is based on coverage area that meets the threshold value
    // Sample coverage points across the canvas for efficiency
    var compliancePercent = 0;
    if (state.aps.length > 0 && activeCount > 0) {
      // Use larger sample spacing for performance (sample every 3 meters)
      var sampleSpacing = 1.0;
      var compliantPoints = 0;
      var totalPoints = 0;
      var threshold = state.complianceThreshold !== undefined ? state.complianceThreshold : state.minVal;

      // Generate sample points (skip edges to avoid wall interference)
      for (var x = 0; x <= state.w; x += sampleSpacing) {
        for (var y = 0; y <= state.h; y += sampleSpacing) {
          totalPoints++;
          // Check if point has coverage above threshold
          var best = bestApAt(x, y);
          if (best && best.ap && best.rssiDbm >= threshold) {
            compliantPoints++;
          }
        }
      }

      if (totalPoints > 0) {
        compliancePercent = Math.round((compliantPoints / totalPoints) * 100);
      }
    } else if (state.aps.length === 0) {
      compliancePercent = 0;
    }

    // Update compliance percentage only if backend hasn't provided a value
    // If backend has provided a value, it should take precedence (handled in handleOptimizationUpdate)
    if (state.compliancePercentFromBackend === null || state.compliancePercentFromBackend === undefined) {
      var compliancePercentEl = $("compliancePercent");
      if (compliancePercentEl) {
        compliancePercentEl.textContent = compliancePercent;
      }
    } else {
      // Backend value exists, don't override it with HTML calculation
      console.log("[HTML] Skipping HTML compliance calculation, using backend value:", state.compliancePercentFromBackend);
    }
  }

  function renderFloorPlanes() {
    var list = $("floorPlaneList");
    if (!list) return;
    list.innerHTML = "";
    for (var i = 0; i < state.floorPlanes.length; i++) {
      (function (idx) {
        var fp = state.floorPlanes[idx];
        var item = document.createElement("div");
        item.className = "list-item";

        var header = document.createElement("div");
        header.className = "list-item-header";
        var title = document.createElement("input");
        title.type = "text";
        title.className = "list-item-title";
        title.value = fp.name || "Floor Plane " + (idx + 1);
        title.oninput = function () {
          fp.name = title.value;
        };

        var delBtn = document.createElement("button");
        delBtn.className = "small danger";
        delBtn.textContent = "Delete";
        delBtn.onclick = function (e) {
          if (e) e.stopPropagation();
          state.floorPlanes.splice(idx, 1);
          renderFloorPlanes();
          draw();
        };

        header.appendChild(title);
        header.appendChild(delBtn);

        var content = document.createElement("div");
        content.className = "list-item-content";
        var height = fp.height !== undefined ? fp.height : 0;
        var planeType = fp.type || "horizontal";
        var inclination = fp.inclination !== undefined ? fp.inclination : 0;
        var inclinationDir =
          fp.inclinationDirection !== undefined
            ? fp.inclinationDirection
            : 0;

        content.innerHTML =
          '<label style="font-size:12px; margin-top:4px;">Attenuation (dB):</label>' +
          '<input type="number" step="0.5" value="' +
          fp.attenuation +
          '" title="Attenuation (dB)" style="margin-bottom:8px;">' +
          '<label style="font-size:12px; margin-top:4px;">Height (m):</label>' +
          '<input type="number" step="0.1" value="' +
          height +
          '" title="Height in meters" style="margin-bottom:8px;">' +
          '<label style="font-size:12px; margin-top:4px;">Type:</label>' +
          '<select style="margin-bottom:8px;"><option value="horizontal"' +
          (planeType === "horizontal" ? " selected" : "") +
          '>Horizontal</option><option value="inclined"' +
          (planeType === "inclined" ? " selected" : "") +
          ">Inclined</option></select>" +
          (planeType === "inclined"
            ? '<label style="font-size:12px; margin-top:4px;">Inclination (Ãƒâ€šÃ‚Â°):</label>' +
            '<input type="number" step="1" value="' +
            inclination +
            '" title="Inclination angle" style="margin-bottom:8px;">' +
            '<label style="font-size:12px; margin-top:4px;">Direction (Ãƒâ€šÃ‚Â°):</label>' +
            '<input type="number" step="1" value="' +
            inclinationDir +
            '" title="Inclination direction">'
            : "");

        var inputs = content.getElementsByTagName("input");
        var selects = content.getElementsByTagName("select");
        if (inputs[0]) {
          inputs[0].oninput = function () {
            var val = inputs[0].value.trim();
            if (val === "" || val === "-") {
              // Allow empty during editing, set to 0 in model for calculations
              fp.attenuation = 0;
            } else {
              var numVal = +val;
              if (!isNaN(numVal)) {
                fp.attenuation = numVal;
              }
            }
            draw();
          };
          inputs[0].onblur = function () {
            var val = inputs[0].value.trim();
            if (val === "" || val === "-") {
              fp.attenuation = 0;
              inputs[0].value = "0";
            }
          };
        }
        if (inputs[1]) {
          inputs[1].oninput = function () {
            var val = inputs[1].value.trim();
            if (val === "" || val === "-") {
              // Allow empty during editing, set to 0 in model for calculations
              fp.height = 0;
            } else {
              var numVal = +val;
              if (!isNaN(numVal)) {
                fp.height = numVal;
              }
            }
            draw();
          };
          inputs[1].onblur = function () {
            var val = inputs[1].value.trim();
            if (val === "" || val === "-") {
              fp.height = 0;
              inputs[1].value = "0";
            }
          };
        }
        if (selects[0]) {
          selects[0].onchange = function () {
            fp.type = selects[0].value;
            if (fp.type === "inclined") {
              if (!fp.inclination) fp.inclination = 0;
              if (!fp.inclinationDirection) fp.inclinationDirection = 0;
            }
            renderFloorPlanes();
            draw();
          };
        }
        if (inputs[2]) {
          inputs[2].oninput = function () {
            var val = inputs[2].value.trim();
            if (val === "" || val === "-") {
              // Allow empty during editing, set to 0 in model for calculations
              fp.inclination = 0;
            } else {
              var numVal = +val;
              if (!isNaN(numVal)) {
                fp.inclination = numVal;
              }
            }
            draw();
          };
          inputs[2].onblur = function () {
            var val = inputs[2].value.trim();
            if (val === "" || val === "-") {
              fp.inclination = 0;
              inputs[2].value = "0";
            }
          };
        }
        if (inputs[3]) {
          inputs[3].oninput = function () {
            var val = inputs[3].value.trim();
            if (val === "" || val === "-") {
              // Allow empty during editing, set to 0 in model for calculations
              fp.inclinationDirection = 0;
            } else {
              var numVal = +val;
              if (!isNaN(numVal)) {
                fp.inclinationDirection = numVal;
              }
            }
            draw();
          };
          inputs[3].onblur = function () {
            var val = inputs[3].value.trim();
            if (val === "" || val === "-") {
              fp.inclinationDirection = 0;
              inputs[3].value = "0";
            }
          };
        }

        item.appendChild(header);
        item.appendChild(content);
        list.appendChild(item);
      })(i);
    }
  }

  function renderWalls() {
    var list = $("wallList");
    list.innerHTML = "";
    for (var i = 0; i < state.walls.length; i++) {
      (function (idx) {
        var w = state.walls[idx];
        var item = document.createElement("div");
        item.className = "list-item";
        item.id = "wall-item-" + w.id; // Add unique ID for scrolling
        var isSelected =
          w.id === state.selectedWallId ||
          state.selectedWallIds.indexOf(w.id) !== -1;
        if (isSelected) {
          item.style.border = "2px solid #00f";
          item.style.backgroundColor = "#f0f9ff"; // Light blue background for selected
        } else {
          item.style.backgroundColor = ""; // Reset to default background
        }
        item.onclick = function (e) {
          if (e) e.stopPropagation();
          // Toggle selection - if already selected, deselect; otherwise select
          if (isSelected) {
            // Remove from selection
            state.selectedWallIds = state.selectedWallIds.filter(function (
              id
            ) {
              return id !== w.id;
            });
            if (state.selectedWallId === w.id) {
              state.selectedWallId =
                state.selectedWallIds.length > 0
                  ? state.selectedWallIds[0]
                  : null;
            }
          } else {
            // Add to selection
            if (state.selectedWallIds.indexOf(w.id) === -1) {
              state.selectedWallIds.push(w.id);
            }
            state.selectedWallId = w.id; // For backward compatibility
          }
          renderWalls();
          scrollToSelectedWall();
          draw();
        };

        var header = document.createElement("div");
        header.className = "list-item-header";
        var title = document.createElement("input");
        title.type = "text";
        title.className = "list-item-title";
        var typeLabel = "Wall";
        if (w.elementType && w.elementType !== "wall") {
          // Convert camelCase to Title Case (e.g. doubleDoor -> Double Door)
          typeLabel = w.elementType.replace(/([A-Z])/g, ' $1').replace(/^./, function (str) { return str.toUpperCase(); });
        }
        title.value = w.name || typeLabel + " " + (idx + 1);
        // Prevent click from closing sidebar
        title.onclick = function (e) {
          if (e) e.stopPropagation();
        };
        title.onmousedown = function (e) {
          if (e) e.stopPropagation();
        };
        title.oninput = function () {
          w.name = title.value;
        };

        var delBtn = document.createElement("button");
        delBtn.className = "small danger";
        delBtn.textContent = "Delete";
        delBtn.onclick = function (e) {
          if (e) e.stopPropagation();
          state.walls.splice(idx, 1);
          renderWalls();
          draw();
        };

        header.appendChild(title);
        header.appendChild(delBtn);

        var content = document.createElement("div");
        content.className = "list-item-content";
        var typeName = w.name || (w.elementType && w.elementType !== "wall" ? typeLabel : (w.type ? wallTypes[w.type].name : "Wall"));

        // Build content HTML based on element type
        var contentHTML =
          '<label style="font-size:12px;">Type: <span style="color:' +
          (w.color || "#60a5fa") +
          '; font-weight:bold;">' +
          typeName +
          "</span></label>";

        // For doors and windows, add width input
        if (
          w.elementType === "door" ||
          w.elementType === "doubleDoor" ||
          w.elementType === "window"
        ) {
          // Initialize width if not set
          if (!w.width) {
            w.width =
              w.elementType === "window"
                ? 1.5
                : w.elementType === "doubleDoor"
                  ? 2.4
                  : 1.2;
          }
          var currentWidth = w.width;
          contentHTML +=
            '<label style="font-size:12px; margin-top:4px; display:block;">Width (m):</label>' +
            '<input type="number" id="widthInput_' +
            idx +
            '" step="0.1" min="0.1" value="' +
            currentWidth +
            '" title="Width in meters" style="margin-bottom:8px;">';
        }

        contentHTML +=
          '<label style="font-size:12px; margin-top:4px;">Loss (dB):</label>' +
          '<input type="number" step="1" value="' +
          w.loss +
          '" title="Attenuation (dB)">';

        content.innerHTML = contentHTML;

        // Handle width input for doors/windows
        if (
          w.elementType === "door" ||
          w.elementType === "doubleDoor" ||
          w.elementType === "window"
        ) {
          var widthInput = content.querySelector("#widthInput_" + idx);
          if (widthInput) {
            // Prevent click from closing sidebar
            widthInput.onclick = function (e) {
              if (e) e.stopPropagation();
            };
            widthInput.onmousedown = function (e) {
              if (e) e.stopPropagation();
            };
            widthInput.oninput = function () {
              var newWidth = +widthInput.value;
              if (newWidth > 0) {
                // Store width
                w.width = newWidth;

                // Recalculate endpoints to maintain center position
                var centerX = (w.p1.x + w.p2.x) / 2;
                var centerY = (w.p1.y + w.p2.y) / 2;
                var wallDx = w.p2.x - w.p1.x;
                var wallDy = w.p2.y - w.p1.y;
                var wallLength = hypot(wallDx, wallDy);

                if (wallLength > 0) {
                  var wallDirX = wallDx / wallLength;
                  var wallDirY = wallDy / wallLength;
                  var halfWidth = newWidth / 2;

                  w.p1 = {
                    x: centerX - wallDirX * halfWidth,
                    y: centerY - wallDirY * halfWidth,
                  };
                  w.p2 = {
                    x: centerX + wallDirX * halfWidth,
                    y: centerY + wallDirY * halfWidth,
                  };
                }

                draw();
              }
            };
          }
        }

        var inp = content.getElementsByTagName("input");
        // Find the loss input (last input if width exists, or first input if not)
        var lossInput =
          w.elementType === "door" ||
            w.elementType === "doubleDoor" ||
            w.elementType === "window"
            ? inp[inp.length - 1]
            : inp[0];
        if (lossInput) {
          // Prevent click from closing sidebar
          lossInput.onclick = function (e) {
            if (e) e.stopPropagation();
          };
          lossInput.onmousedown = function (e) {
            if (e) e.stopPropagation();
          };
          lossInput.oninput = function () {
            var val = lossInput.value.trim();
            if (val === "" || val === "-") {
              // Allow empty during editing, set to 0 in model for calculations
              w.loss = 0;
            } else {
              var numVal = +val;
              if (!isNaN(numVal)) {
                w.loss = numVal;
              }
            }

            // Cancel any pending heatmap updates and invalidate cache to regenerate heatmap immediately
            if (state.heatmapUpdateRequestId !== null) {
              cancelAnimationFrame(state.heatmapUpdateRequestId);
              state.heatmapUpdateRequestId = null;
            }
            state.heatmapUpdatePending = false;
            state.cachedHeatmap = null; // Invalidate cache to regenerate heatmap immediately

            draw();

            // Trigger instant heatmap update if visualization is enabled
            if (state.showVisualization) {
              requestAnimationFrame(function () {
                generateHeatmapAsync(null, true); // Start with low-res for fast update
              });
            }
          };
          lossInput.onblur = function () {
            var val = lossInput.value.trim();
            if (val === "" || val === "-") {
              w.loss = 0;
              lossInput.value = "0";
            }
          };
        }

        item.appendChild(header);
        item.appendChild(content);
        list.appendChild(item);
      })(i);
    }
    $("wallCount").textContent = state.walls.length;
  }

  // Scroll the selected wall item into view in the sidebar
  function scrollToSelectedWall() {
    if (state.selectedWallId) {
      var selectedItem = document.getElementById(
        "wall-item-" + state.selectedWallId
      );
      if (selectedItem) {
        // Use setTimeout to ensure DOM is updated
        setTimeout(function () {
          selectedItem.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 10);
      }
    }
  }

  function scrollToSelectedAp() {
    // Check both selectedApId and viewedApId
    var apId = state.selectedApId || state.viewedApId;
    if (apId) {
      var selectedItem = document.getElementById("ap-item-" + apId);
      if (selectedItem) {
        // Use setTimeout to ensure DOM is updated
        setTimeout(function () {
          // Scroll to top of the container (like walls do)
          selectedItem.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 10);
      }
    }
  }

  function renderApDetails() {
    var ap = state.selectedApForDetail;
    var content = $("apDetailContent");

    console.log("renderApDetails called", { ap: ap, content: content });

    if (!ap || !content) {
      console.warn("Missing AP or content element", {
        ap: !!ap,
        content: !!content,
      });
      if (content) {
        var noApBg = state.darkMode ? "rgba(15, 23, 42, 0.8)" : "white";
        var noApText = state.darkMode ? "#e2e8f0" : "#1e293b";
        var noApLabel = state.darkMode ? "#94a3b8" : "#64748b";
        content.innerHTML =
          '<div class="card" style="background: ' +
          noApBg +
          "; color: " +
          noApText +
          '; padding: 20px;"><p style="color: ' +
          noApLabel +
          '; text-align: center;">No AP selected</p></div>';
      }
      if ($("apDetailTitle")) {
        $("apDetailTitle").textContent = "AP Details";
      }
      return;
    }

    if ($("apDetailTitle")) {
      $("apDetailTitle").textContent = "Details for " + ap.id;
    }

    // Ensure content is visible and has proper styling
    // Check for dark mode and set appropriate colors
    if (state.darkMode) {
      content.style.background = "rgba(30, 41, 59, 0.95)";
      content.style.color = "#e2e8f0";
    } else {
      content.style.background = "white";
      content.style.color = "#1e293b";
    }
    content.style.opacity = "1";
    content.style.visibility = "visible";

    // Build HTML string with explicit inline styles to ensure visibility
    // Use dark mode colors if enabled
    var bgColor = state.darkMode ? "rgba(15, 23, 42, 0.8)" : "white";
    var textColor = state.darkMode ? "#e2e8f0" : "#1e293b";
    var labelColor = state.darkMode ? "#94a3b8" : "#64748b";
    var borderColor = state.darkMode ? "#334155" : "#e2e8f0";
    var inputBg = state.darkMode ? "rgba(15, 23, 42, 0.8)" : "#f8fafc";
    var shadowColor = state.darkMode
      ? "rgba(0, 0, 0, 0.3)"
      : "rgba(0, 0, 0, 0.06)";

    var html =
      '<div style="background: ' +
      bgColor +
      " !important; color: " +
      textColor +
      " !important; padding: 16px; border-radius: 12px; margin-bottom: 16px; box-shadow: 0 2px 8px " +
      shadowColor +
      "; border: 1px solid " +
      borderColor +
      ';">' +
      '<h3 style="font-size: 16px; font-weight: 600; color: ' +
      textColor +
      ' !important; margin: 0 0 12px 0; display: block;">Configuration</h3>' +
      '<div style="margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px;">' +
      '<label style="font-size: 12px; font-weight: 500; color: ' +
      labelColor +
      ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block;">ANTENNA ID</label>' +
      '<input type="text" id="apDetailId" value="' +
      (ap.id || "") +
      '"' + (state.isOptimizing ? ' disabled' : '') +
      ' style="background: ' +
      inputBg +
      "; border: 2px solid " +
      borderColor +
      "; border-radius: 8px; padding: 8px 12px; font-size: 14px; color: " +
      textColor +
      ' !important; font-family: inherit; width: 100%; box-sizing: border-box;">' +
      "</div>" +
      '<div style="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 12px;">' +
      '<div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 100px;">' +
      '<label style="font-size: 12px; font-weight: 500; color: ' +
      labelColor +
      ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Tx Power (dBm)</label>' +
      '<input type="number" id="apDetailTx" step="0.5" value="' +
      (ap.tx || 15) +
      '"' + (state.isOptimizing ? ' disabled' : '') +
      ' style="background: ' +
      inputBg +
      "; border: 2px solid " +
      borderColor +
      "; border-radius: 8px; padding: 8px 12px; font-size: 14px; color: " +
      textColor +
      ' !important; font-family: inherit; width: 100%; box-sizing: border-box;">' +
      "</div>" +
      '<div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 100px;">' +
      '<label style="font-size: 12px; font-weight: 500; color: ' +
      labelColor +
      ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Antenna Gain (dBi)</label>' +
      '<input type="number" id="apDetailGt" step="0.5" value="' +
      (ap.gt || 2) +
      '"' + (state.isOptimizing ? ' disabled' : '') +
      ' style="background: ' +
      inputBg +
      "; border: 2px solid " +
      borderColor +
      "; border-radius: 8px; padding: 8px 12px; font-size: 14px; color: " +
      textColor +
      ' !important; font-family: inherit; width: 100%; box-sizing: border-box;">' +
      "</div>" +
      "</div>" +
      '<div style="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 12px;">' +
      '<div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 100px;">' +
      '<label style="font-size: 12px; font-weight: 500; color: ' +
      labelColor +
      ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Channel</label>' +
      '<input type="number" id="apDetailCh" step="1" value="' +
      (ap.ch || 1) +
      '"' + (state.isOptimizing ? ' disabled' : '') +
      ' style="background: ' +
      inputBg +
      "; border: 2px solid " +
      borderColor +
      "; border-radius: 8px; padding: 8px 12px; font-size: 14px; color: " +
      textColor +
      ' !important; font-family: inherit; width: 100%; box-sizing: border-box;">' +
      "</div>" +
      "</div>" +
      '<h3 style="font-size: 16px; font-weight: 600; color: ' +
      textColor +
      ' !important; margin: 20px 0 12px 0; display: block;">Antenna Orientation</h3>' +
      '<div style="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 12px;">' +
      '<div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 100px;">' +
      '<label style="font-size: 12px; font-weight: 500; color: ' +
      labelColor +
      ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Azimuth (Ãƒâ€šÃ‚Â°)</label>' +
      '<input type="number" id="apDetailAzimuth" step="5" value="' +
      (ap.azimuth || 0) +
      '"' + (state.isOptimizing ? ' disabled' : '') +
      ' style="background: ' +
      inputBg +
      "; border: 2px solid " +
      borderColor +
      "; border-radius: 8px; padding: 8px 12px; font-size: 14px; color: " +
      textColor +
      ' !important; font-family: inherit; width: 100%; box-sizing: border-box;">' +
      "</div>" +
      '<div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 100px;">' +
      '<label style="font-size: 12px; font-weight: 500; color: ' +
      labelColor +
      ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Tilt (Ãƒâ€šÃ‚Â°)</label>' +
      '<input type="number" id="apDetailTilt" step="5" value="' +
      (ap.tilt || 0) +
      '"' + (state.isOptimizing ? ' disabled' : '') +
      ' style="background: ' +
      inputBg +
      "; border: 2px solid " +
      borderColor +
      "; border-radius: 8px; padding: 8px 12px; font-size: 14px; color: " +
      textColor +
      ' !important; font-family: inherit; width: 100%; box-sizing: border-box;">' +
      "</div>" +
      "</div>" +
      '<h3 style="font-size: 16px; font-weight: 600; color: ' +
      textColor +
      ' !important; margin: 20px 0 12px 0; display: block;">Position</h3>' +
      '<div style="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 12px;">' +
      '<div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 100px;">' +
      '<label style="font-size: 12px; font-weight: 500; color: ' +
      labelColor +
      ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block;">X Position (m)</label>' +
      '<input type="number" id="apDetailX" step="0.1" value="' +
      (ap.x || 0).toFixed(2) +
      '"' + (state.isOptimizing ? ' disabled' : '') +
      ' style="background: ' +
      inputBg +
      "; border: 2px solid " +
      borderColor +
      "; border-radius: 8px; padding: 8px 12px; font-size: 14px; color: " +
      textColor +
      ' !important; font-family: inherit; width: 100%; box-sizing: border-box;">' +
      "</div>" +
      '<div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 100px;">' +
      '<label style="font-size: 12px; font-weight: 500; color: ' +
      labelColor +
      ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Y Position (m)</label>' +
      '<input type="number" id="apDetailY" step="0.1" value="' +
      (ap.y || 0).toFixed(2) +
      '"' + (state.isOptimizing ? ' disabled' : '') +
      ' style="background: ' +
      inputBg +
      "; border: 2px solid " +
      borderColor +
      "; border-radius: 8px; padding: 8px 12px; font-size: 14px; color: " +
      textColor +
      ' !important; font-family: inherit; width: 100%; box-sizing: border-box;">' +
      "</div>" +
      "</div>" +
      '<h3 style="font-size: 16px; font-weight: 600; color: ' +
      textColor +
      ' !important; margin: 20px 0 12px 0; display: block;">Antenna Pattern</h3>' +
      (function () {
        // Only use pattern if antenna has one assigned - don't fall back to default if no patterns exist
        var pattern = ap.antennaPattern || (state.antennaPatterns.length > 0 ? getDefaultAntennaPattern() : null);
        var isCustom = !!ap.antennaPattern;
        var patternInfo = "";

        if (pattern) {
          patternInfo =
            '<div style="background: ' +
            inputBg +
            "; border: 2px solid " +
            borderColor +
            '; border-radius: 8px; padding: 12px; margin-bottom: 12px;">' +
            '<div style="margin-bottom: 8px;">' +
            '<label style="font-size: 11px; font-weight: 500; color: ' +
            labelColor +
            ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Pattern Type</label>' +
            '<div style="font-size: 13px; color: ' +
            textColor +
            ' !important; font-weight: 500;">' +
            (isCustom ? "Custom Pattern" : "Global Pattern") +
            "</div>" +
            "</div>" +
            '<div style="margin-bottom: 8px;">' +
            '<label style="font-size: 11px; font-weight: 500; color: ' +
            labelColor +
            ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Pattern Name</label>' +
            '<div style="font-size: 13px; color: ' +
            textColor +
            ' !important;">' +
            (pattern.name || "N/A") +
            "</div>" +
            "</div>" +
            '<div style="display: flex; gap: 10px; margin-bottom: 8px;">' +
            '<div style="flex: 1;">' +
            '<label style="font-size: 11px; font-weight: 500; color: ' +
            labelColor +
            ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Frequency</label>' +
            '<div style="font-size: 13px; color: ' +
            textColor +
            ' !important;">' +
            (pattern.frequency || "N/A") +
            " MHz</div>" +
            "</div>" +
            '<div style="flex: 1;">' +
            '<label style="font-size: 11px; font-weight: 500; color: ' +
            labelColor +
            ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Peak Gain</label>' +
            '<div style="font-size: 13px; color: ' +
            textColor +
            ' !important;">' +
            (pattern.gain || "N/A") +
            " dBi</div>" +
            "</div>" +
            "</div>" +
            '<div style="display: flex; gap: 10px;">' +
            '<div style="flex: 1;">' +
            '<label style="font-size: 11px; font-weight: 500; color: ' +
            labelColor +
            ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Horizontal Points</label>' +
            '<div style="font-size: 13px; color: ' +
            textColor +
            ' !important;">' +
            (pattern.horizontalData ? pattern.horizontalData.length : 0) +
            "</div>" +
            "</div>" +
            '<div style="flex: 1;">' +
            '<label style="font-size: 11px; font-weight: 500; color: ' +
            labelColor +
            ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Vertical Points</label>' +
            '<div style="font-size: 13px; color: ' +
            textColor +
            ' !important;">' +
            (pattern.verticalData ? pattern.verticalData.length : 0) +
            "</div>" +
            "</div>" +
            "</div>" +
            (ap.antennaPatternFileName
              ? '<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">' +
              '<label style="font-size: 11px; font-weight: 500; color: #64748b !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">File Name</label>' +
              '<div style="font-size: 12px; color: #10b981 !important; font-weight: 500;">' +
              ap.antennaPatternFileName +
              "</div>" +
              "</div>"
              : "") +
            "</div>";
        } else {
          patternInfo =
            '<div style="background: #fef2f2; border: 2px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 12px;">' +
            '<div style="font-size: 13px; color: #dc2626 !important; text-align: center;">No antenna pattern loaded</div>' +
            "</div>";
        }
        return patternInfo;
      })() +
      '<h3 style="font-size: 16px; font-weight: 600; color: ' +
      textColor +
      ' !important; margin: 20px 0 12px 0; display: block;">Status</h3>' +
      '<div style="margin-bottom: 12px;">' +
      '<button id="apDetailSelect" style="background: ' +
      (ap.id === state.selectedApId ? "#10b981" : "#e2e8f0") +
      '; color: ' +
      (ap.id === state.selectedApId ? "white" : "#64748b") +
      '; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; transition: background 0.2s; margin-bottom: 8px;">' +
      (ap.id === state.selectedApId ? "ÃƒÂ¢Ã…â€œSelected" : "Select") +
      "</button>" +
      '<button id="apDetailToggle" style="background: ' +
      (ap.enabled !== false ? "#ef4444" : "#10b981") +
      '; color: white; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; transition: background 0.2s; margin-bottom: 8px;">' +
      (ap.enabled !== false ? "Turn Off" : "Turn On") +
      "</button>" +
      '<button id="apDetailDownloadRsrp" style="background: #3b82f6; color: white; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; transition: background 0.2s;">' +
      "Download RSRP" +
      "</button>" +
      "</div>" +
      "</div>";

    // Clear and set content
    content.innerHTML = "";
    content.innerHTML = html;

    console.log("Content set, innerHTML length:", content.innerHTML.length);

    // Bind event listeners after DOM is updated
    setTimeout(function () {
      function bindApDetail(inputId, key, isNumeric) {
        var input = $(inputId);
        if (!input) {
          console.warn("Input not found:", inputId);
          return;
        }
        // Disable input during optimization
        //input.disabled = state.isOptimizing;
        add(input, "input", function () {
          // if (state.isOptimizing) return;
          var value = input.value.trim();
          var originalId = ap.id;

          // Handle empty values for numeric fields - allow empty during editing, set to 0 when empty
          if (isNumeric && (value === "" || value === "-")) {
            // Allow empty during editing, but set to 0 in the model for calculations
            var numericKeys = [
              "tx",
              "gt",
              "ch",
              "azimuth",
              "tilt",
              "x",
              "y",
            ];
            if (numericKeys.indexOf(key) !== -1) {
              // Set to 0 for calculations but don't update input field yet (let user continue editing)
              ap[key] = 0;
              // Invalidate heatmap cache
              if (
                key === "tx" ||
                key === "gt" ||
                key === "ch" ||
                key === "azimuth" ||
                key === "tilt" ||
                key === "x" ||
                key === "y"
              ) {
                state.cachedHeatmap = null;
                state.heatmapUpdatePending = false;
              }
              // Schedule debounced update (3 seconds or Enter key)
              scheduleInputChange(ap, true, true, true);
            }
            return; // Don't process further if empty
          }

          // Track position changes for x and y coordinates
          if ((key === "x" || key === "y") && isNumeric) {
            var oldX = ap.x;
            var oldY = ap.y;
            var newValue = isNumeric ? +value : value;
            if (!isNaN(newValue) || !isNumeric) {
              ap[key] = newValue;
            }
            var newX = ap.x;
            var newY = ap.y;
            // Only log if position actually changed
            var threshold = 0.01;
            if (
              Math.abs(oldX - newX) > threshold ||
              Math.abs(oldY - newY) > threshold
            ) {
              logAntennaPositionChange(
                ap.id,
                ap.id,
                oldX,
                oldY,
                newX,
                newY
              );
            }
          } else {
            if (isNumeric) {
              var numVal = +value;
              if (!isNaN(numVal)) {
                ap[key] = numVal;
              }
            } else {
              ap[key] = value;
            }
          }

          // Property changes don't change antenna count, so don't clear cache
          // The applyInputChange function will handle heatmap regeneration properly
          // This prevents deformed pattern flash while allowing smooth transition

          if (key === "id") {
            if ($("apDetailTitle")) {
              $("apDetailTitle").textContent = "Details for " + value;
            }
            if (state.selectedApId === originalId) {
              state.selectedApId = value;
            }
          }

          // Schedule debounced update (3 seconds or Enter key) instead of immediate update
          scheduleInputChange(ap, true, true, true);
        });

        // Handle Enter key for immediate apply
        add(input, "keydown", function (e) {
          if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault();
            applyInputChangeImmediately(ap.id);
            input.blur(); // Remove focus after applying
          }
        });

        // Handle blur event to set empty numeric fields to 0
        if (
          isNumeric &&
          (key === "tx" ||
            key === "gt" ||
            key === "ch" ||
            key === "azimuth" ||
            key === "tilt")
        ) {
          add(input, "blur", function () {
            var value = input.value.trim();
            if (value === "" || value === "-") {
              ap[key] = 0;
              input.value = "0";
              // Don't clear cache here - applyInputChangeImmediately will handle it
              // Apply changes immediately on blur (user finished editing)
              applyInputChangeImmediately(ap.id);
            } else {
              // Apply any pending changes when user leaves the field
              applyInputChangeImmediately(ap.id);
            }
          });
        } else {
          // For non-numeric fields, apply changes on blur
          add(input, "blur", function () {
            applyInputChangeImmediately(ap.id);
          });
        }
      }

      bindApDetail("apDetailId", "id", false);
      bindApDetail("apDetailTx", "tx", true);
      bindApDetail("apDetailGt", "gt", true);
      bindApDetail("apDetailCh", "ch", true);
      bindApDetail("apDetailAzimuth", "azimuth", true);
      bindApDetail("apDetailTilt", "tilt", true);
      bindApDetail("apDetailX", "x", true);
      bindApDetail("apDetailY", "y", true);

      // Bind toggle button
      var toggleBtn = $("apDetailToggle");
      if (toggleBtn) {
        // Disable toggle button during optimization
        toggleBtn.disabled = state.isOptimizing;

        // Remove any existing event listeners by cloning and replacing
        var newToggleBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

        // Re-apply disabled state after cloning
        //newToggleBtn.disabled = state.isOptimizing;
        add(newToggleBtn, "click", function (e) {
          e.preventDefault();
          e.stopPropagation();

          // Prevent toggling during optimization
          //if (state.isOptimizing) {
          //  alert("Cannot change antenna status while optimization is in progress. Please wait for optimization to complete.");
          //  return;
          //}

          // Initialize enabled property if not set (default to true)
          if (ap.enabled === undefined) ap.enabled = true;
          // Ensure enabled is always a boolean before toggling
          ap.enabled = Boolean(ap.enabled);
          var oldEnabled = ap.enabled;
          ap.enabled = !ap.enabled;

          // If this antenna is selected and being disabled, clear selection so pattern disappears and button resets
          if (ap.id === state.selectedApId && ap.enabled === false) {
            state.selectedApId = null;
            state.highlight = false;
            state.selectedApForDetail = null;
            $("apDetailSidebar").classList.remove("visible");
          }

          // Cancel any pending heatmap updates
          // NOTE: Don't clear cache - antenna count hasn't changed, so cache is still valid
          // This allows smooth transition without disappearing or deformed patterns
          if (state.heatmapUpdateRequestId !== null) {
            cancelAnimationFrame(state.heatmapUpdateRequestId);
            state.heatmapUpdateRequestId = null;
          }
          state.heatmapUpdatePending = true; // Set to true to trigger regeneration
          state.heatmapWorkerCallback = null; // Clear any pending worker callback

          // Log position change with same position but updated enabled status
          // This maintains the position history format instead of overwriting with configs format
          logAntennaPositionChange(ap.id, ap.id, ap.x, ap.y, ap.x, ap.y);

          // Send antenna status update to backend (notification only, not file save)
          sendAntennaStatusUpdate(ap);

          renderAPs();
          renderApDetails();
          
          // Start heatmap regeneration BEFORE draw() to minimize delay and prevent flash
          if (state.showVisualization) {
            generateHeatmapAsync(null, true); // Start with low-res for fast update
          }
          
          // Draw after starting regeneration - validation will prevent using stale cache
          draw();
        });
      }
      // Bind select button
      var selectBtn = $("apDetailSelect");
      if (selectBtn) {
        // Disable select button during optimization
        selectBtn.disabled = state.isOptimizing;

        // Remove any existing event listeners by cloning and replacing
        var newSelectBtn = selectBtn.cloneNode(true);
        selectBtn.parentNode.replaceChild(newSelectBtn, selectBtn);

        // Re-apply disabled state after cloning
        newSelectBtn.disabled = state.isOptimizing;

        add(newSelectBtn, "click", function (e) {
          e.preventDefault();
          e.stopPropagation();

          // Prevent selecting during optimization
          if (state.isOptimizing) {
            NotificationSystem.warning("Optimization in progress. Please wait before selecting antennas.");
            return;
          }

          // Toggle selection: if already selected, deselect it
          if (ap.id === state.selectedApId) {
            // Deselect antenna
            state.selectedApId = null;
            state.highlight = false;
            // Cancel any pending heatmap updates
            // NOTE: Don't clear cache - antenna count hasn't changed, so cache is still valid
            // This allows smooth transition without disappearing
            if (state.heatmapUpdateRequestId !== null) {
              cancelAnimationFrame(state.heatmapUpdateRequestId);
              state.heatmapUpdateRequestId = null;
            }
            state.heatmapUpdatePending = true; // Set to true to trigger regeneration
            state.heatmapWorkerCallback = null; // Clear any pending worker callback
            state.selectedApForDetail = null;
            $("apDetailSidebar").classList.remove("visible");
          } else {
            // Select antenna and show only its pattern
            state.selectedApId = ap.id;
            state.highlight = true; // Enable highlight to show only this antenna's pattern
            // Cancel any pending heatmap updates
            // NOTE: Don't clear cache - antenna count hasn't changed, so cache is still valid
            // This allows smooth transition without disappearing
            if (state.heatmapUpdateRequestId !== null) {
              cancelAnimationFrame(state.heatmapUpdateRequestId);
              state.heatmapUpdateRequestId = null;
            }
            state.heatmapUpdatePending = true; // Set to true to trigger regeneration
            state.heatmapWorkerCallback = null; // Clear any pending worker callback

            state.selectedApForDetail = ap;

            // Don't open right sidebar only if left sidebar is expanded AND antenna tab is active
            var mainSidebar = document.getElementById("mainSidebar");
            var isLeftSidebarExpanded = mainSidebar && mainSidebar.classList.contains("expanded");
            var antennaSection = document.querySelector('.section-content[data-section="accesspoints"]');
            var isAntennaTabActive = antennaSection && antennaSection.classList.contains("active");
            var shouldPreventOpening = isLeftSidebarExpanded && isAntennaTabActive;

            if (!shouldPreventOpening) {
              $("apDetailSidebar").classList.add("visible");
              renderApDetails();
              state.justOpenedApSidebar = true;
              setTimeout(function () {
                state.justOpenedApSidebar = false;
              }, 100);
            }
          }

          renderAPs(); // Update button states
          renderApDetails(); // Update the select button state
          
          // Start heatmap regeneration BEFORE draw() to minimize delay and prevent flash
          if (state.showVisualization) {
            generateHeatmapAsync(null, true); // Start with low-res for fast update
          }
          
          // Draw after starting regeneration - validation will prevent using stale cache
          draw();
        });
      }
      // Bind download RSRP button
      var downloadRsrpBtn = $("apDetailDownloadRsrp");
      if (downloadRsrpBtn) {
        // Remove any existing event listeners by cloning and replacing
        var newDownloadBtn = downloadRsrpBtn.cloneNode(true);
        downloadRsrpBtn.parentNode.replaceChild(newDownloadBtn, downloadRsrpBtn);

        add(newDownloadBtn, "click", function (e) {
          e.preventDefault();
          e.stopPropagation();

          // Export RSRP for this specific antenna
          var fileName = ap.id + "_rsrp.csv";
          // bug 1
          DataExportSystem.exportAntennaRsrp(ap, fileName, 1.0);
        });
      }
    }, 50);
  }
  __UIRenderers_EXTRACTED_END__*/

  // AI COMMENT: renderDoor3D, renderWindow3D, renderDoubleDoor3D -> EXTRACTED to ThreeJSRenderer.js
  /* function renderDoor3D(ctx, w, p1Bottom, p2Bottom, p1Top, p2Top, transition, isSelected) { ... } */
  /* function renderWindow3D(ctx, w, p1Bottom, p2Bottom, p1Top, p2Top, transition, isSelected) { ... } */
  /* function renderDoubleDoor3D(ctx, w, p1Bottom, p2Bottom, p1Top, p2Top, transition, isSelected) { ... } */

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

  // Removed: 3D pattern rendering function - all code removed

  // AI COMMENT: generateHeatmapAsync ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ EXTRACTED to HeatmapEngine.js (loaded after this file)
  /* function generateHeatmapAsync(callback, useLowRes) { ... } */

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
      var forcedSidebar = $("apDetailSidebar");
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

    $("legendUnit").textContent = unit;
    $("modeName").textContent = modeName;
    $("legendBar").style.display = numericLegend ? "block" : "none";
    $("legendMin").style.display = numericLegend ? "inline" : "none";
    $("legendMax").style.display = numericLegend ? "inline" : "none";

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
                var p = rssi(
                  ap.tx,
                  getAngleDependentGain(ap, x, y),
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
                    best.rssiDbm = rssi(
                      selectedAP.tx,
                      getAngleDependentGain(selectedAP, x, y),
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
                    bestN.rssiDbm = rssi(
                      selectedAP.tx,
                      getAngleDependentGain(selectedAP, x, y),
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
        var legendMinEl = $("legendMin");
        if (legendMinEl) legendMinEl.textContent = state.minVal;
        var legendMaxEl = $("legendMax");
        if (legendMaxEl) legendMaxEl.textContent = state.maxVal;
        $("catLegend").style.display = "none";
      } else {
        var cat = $("catLegend");
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
      $("legendBar").style.display = "none";
      $("legendMin").style.display = "none";
      $("legendMax").style.display = "none";
      $("catLegend").style.display = "none";
    }

    var addBtn = $("addWall");
    // Check for both addingWall and addingFloorPlane since they use the same button
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

    var addAPBtn = $("addAP");
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

    var addFloorPlaneBtn = $("addFloorPlane");
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
    // $("modelBadge").textContent = "V2.7";

    // Continue smooth transition animation if needed
    if (state.viewMode !== state.viewModeTarget) {
      requestAnimationFrame(draw);
    }
  }

  // Update delete button visibility based on whether image is uploaded
  function updateDeleteImageButton() {
    var deleteBtn = $("deleteImageBtn");
    if (deleteBtn) {
      if (state.backgroundImage) {
        deleteBtn.style.display = "block";
      } else {
        deleteBtn.style.display = "none";
      }
    }
  }

  // Update delete button visibility based on whether DXF is uploaded
  function updateDeleteDxfButton() {
    var deleteBtn = $("deleteDxfBtn");
    var dxfLoader = $("dxfLoader");
    if (deleteBtn && dxfLoader) {
      if (dxfLoader.files && dxfLoader.files.length > 0) {
        deleteBtn.style.display = "block";
      } else {
        deleteBtn.style.display = "none";
      }
    }
  }

  // Upload Mode Toggle Logic
  document.querySelectorAll('.upload-mode-btn').forEach(btn => {
    add(btn, 'click', function () {
      // Toggle Buttons
      document.querySelectorAll('.upload-mode-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      // Toggle Sections
      const mode = this.getAttribute('data-mode');
      if (mode === 'image') {
        $("imageUploadSection").classList.remove('hidden');
        $("dxfUploadSection").classList.add('hidden');
      } else {
        $("imageUploadSection").classList.add('hidden');
        $("dxfUploadSection").classList.remove('hidden');
      }
    });
  });

  // Tab Switching Logic for Image Visibility
  document.querySelectorAll('.icon-btn').forEach(function (btn) {
    add(btn, 'click', function () {
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
  add($("imageLoader"), "change", function (e) {
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
  add($("deleteImageBtn"), "click", function (e) {
    e.stopPropagation();
    NotificationSystem.confirm("This will remove the uploaded floor plan image.", "Delete Image", function (confirmed) {
      if (confirmed) {
      state.backgroundImage = null;
      state.floorPlanImage = null; // Clear floor plan image reference
      state.backgroundImageAspectRatio = null;
      state.backgroundImageDisplayWidth = null;
      state.backgroundImageDisplayHeight = null;
      // Clear the file input
      var imageLoader = $("imageLoader");
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
    var deleteBtn = $("deleteXdImageBtn");
    if (deleteBtn) {
      if (state.xdImage) {
        deleteBtn.style.display = "block";
      } else {
        deleteBtn.style.display = "none";
      }
    }
  }

  add($("xdImageLoader"), "change", function (e) {
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
        console.log("XD Image loaded and displayed on canvas");
        draw();
      };
      img.src = event.target.result;
    };
    if (e.target.files && e.target.files[0]) {
      reader.readAsDataURL(e.target.files[0]);
    }
  });

  add($("deleteXdImageBtn"), "click", function (e) {
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

        var xdImageLoader = $("xdImageLoader");
        if (xdImageLoader) {
          xdImageLoader.value = "";
        }
        updateDeleteXdImageButton();
        updateDeleteImageButton();
        draw();
      }
    }, {danger: true, confirmLabel: 'Delete', icon: 'ðŸ—‘'});
  });

  add($("xdEnableSahi"), "change", function () {
    var xdSahiOptions = $("xdSahiOptions");
    if (xdSahiOptions) {
      xdSahiOptions.style.display = this.checked ? "block" : "none";
    }
  });

  add($("xdAdvancedToggle"), "change", function () {
    var container = $("xdAdvancedContainer");
    if (container) {
      container.style.display = this.checked ? "block" : "none";
    }
  });

  add($("generateDxfBtn"), "click", function () {
    if (!state.xdImageBase64) {
      NotificationSystem.warning("Please upload a floorplan image first.");
      return;
    }

    var btn = $("generateDxfBtn");
    var originalText = btn.textContent;

    // Set loading state on button
    btn.disabled = true;
    btn.style.opacity = "0.7";
    btn.style.cursor = "not-allowed";
    btn.textContent = "ÃƒÂ¢Ã…â€™Ã¢â‚¬Âº GENERATING...";

    // Show loading overlay
    var overlay = $("loadingOverlay");
    var loadingText = $("loadingText");
    var subtext = $("loadingSubtext");
    if (overlay) overlay.style.display = "flex";
    if (loadingText) loadingText.textContent = "Processing Floorplan...";
    if (subtext) subtext.textContent = "Our AI is detecting walls, doors, and windows to generate your DXF.";

    var params = {
      confidence: +$("xdConfidence").value,
      splitParts: +$("xdSplitParts").value,
      wallRemovalThreshold: +$("xdWallRemovalThreshold").value,
      gapFillSize: +$("xdGapFillSize").value,
      enableSahi: $("xdEnableSahi").checked,
      sahiSliceSize: +$("xdSahiSliceSize").value,
      sahiOverlapRatio: +$("xdSahiOverlapRatio").value,
      sahiNmsThreshold: +$("xdSahiNmsThreshold").value
    };

    console.log("Requesting DXF generation with params:", params);

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
  add($("dxfLoader"), "change", function (e) {
    updateDeleteDxfButton();

    if (e.target.files && e.target.files[0]) {
      var file = e.target.files[0];
      console.log("DXF file selected for parsing:", file.name);

      var reader = new FileReader();
      reader.onload = function (event) {
        // Show loading overlay
        var overlay = $("loadingOverlay");
        var loadingText = $("loadingText");
        var subtext = $("loadingSubtext");
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
  add(window, "message", function (event) {
    if (!event.data || event.data.type !== "dxf_parsed_response") return;

    var overlay = $("loadingOverlay");
    if (overlay) overlay.style.display = "none";

    if (event.data.success && event.data.data) {
      console.log("DXF parsed successfully, loading project...");
      loadProjectFromData(event.data.data);
      NotificationSystem.success("DXF loaded successfully!");
    } else {
      console.error("DXF parsing failed:", event.data.error);
      NotificationSystem.error("Failed to parse DXF.\n" + (event.data.error || "Unknown error"));
    }
  });

  // AI COMMENT: loadProjectFromData Ã¢â€ â€™ EXTRACTED to ProjectIO.js
  /* function loadProjectFromData(projectData) { ... } */

  // Delete DXF button handler
  add($("deleteDxfBtn"), "click", function (e) {
    e.stopPropagation();
    NotificationSystem.confirm("This will remove all walls and floor planes from the DXF file.", "Delete DXF", function (confirmed) {
      if (confirmed) {
        // Clear the file input
        var dxfLoader = $("dxfLoader");
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

  add($("alphaSlider"), "input", function (e) {
    var alpha = +e.target.value;
    state.backgroundImageAlpha = alpha;
    var alphaLabel = $("alphaLabel");
    if (alphaLabel) {
      alphaLabel.textContent =
        "Image Opacity: " + Math.round(alpha * 100) + "%";
    }
    draw();
  });

  add($("calibrateBtn"), "click", function () {
    state.isCalibrating = !state.isCalibrating;
    if (state.isCalibrating) {
      state.addingWall = false; // Turn off wall drawing mode
      state.addingAP = false; // Turn off AP drawing mode
      state.addingFloorPlane = false; // Turn off floor plane drawing mode
      var addAPBtn = $("addAP");
      if (addAPBtn) {
        addAPBtn.textContent = "Add Antenna";
      }
      var addBtn = $("addWall");
      if (addBtn) {
        addBtn.textContent = getAddButtonText(false);
      }
      var addFloorPlaneBtn = $("addFloorPlane");
      if (addFloorPlaneBtn) {
        addFloorPlaneBtn.textContent = "Add Floor Plane";
      }
      $("calibrateBtn").textContent = "Cancel Calibration";
      $("calibrateBtn").classList.add("toggled");
      $("calibrationControls").style.display = "block";
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
        if (iconSidebarData) {
          iconSidebarData.currentSection = null;
        }
        // Restore legend to default position after sidebar collapse
        setTimeout(function () {
          if (typeof constrainLegendPosition === "function") {
            constrainLegendPosition(true);
          }
        }, 350);
      }
    } else {
      $("calibrateBtn").textContent = "Calibrate Scale";
      $("calibrateBtn").classList.remove("toggled");
      $("calibrationControls").style.display = "none";
      state.calibrationLine = null;
      state.calibrationPixels = null;
      state.tempCalibration = null;
      state.tempCalibrationPixels = null;
    }
    draw();
  });

  add($("applyScaleBtn"), "click", function () {
    var realLength = parseFloat($("realLengthInput").value);
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
      $("calibrateBtn").textContent = "Calibrate Scale";
      $("calibrateBtn").classList.remove("toggled");
      $("calibrationControls").style.display = "none";

      draw();
    } else {
      NotificationSystem.info("Please draw a calibration line on the map first.");
    }
  });

  // Optimize button - start optimization and poll for updates one by one
  add($("optimizeBtn"), "click", function () {
    console.log("Optimize button clicked - starting optimization process");
    // Guard: require at least one antenna before optimization
    if (!state.aps || state.aps.length === 0) {
      NotificationSystem.warning("Please add at least one antenna before starting optimization.");
      return;
    }

    // Set optimization state
    // state.isOptimizing = true;
    // Update button text and disable it
    //var optimizeBtn = $("optimizeBtn");
    //optimizeBtn.textContent = "Optimizing";
    //optimizeBtn.disabled = true;
    // Dim buttons during optimization
    var optimizeBtn = $("optimizeBtn");
    var addAPBtn = $("addAP");
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
    add($(id), "input", function () {
      state[key] = +$(id).value;
      draw();
    });
  }

  add($("model"), "change", function () {
    state.model = $("model").value;
    $("N").value = state.N;

    // AI COMMENT: Replaced inline heatmap cache invalidation with helper
    // Model changes require complete regeneration (different path loss calculation)
    invalidateHeatmapCache();

    draw();
  });

  add($("view"), "change", function () {
    // Save current min/max values for the previous view mode
    if (state.view && state.viewMinMax[state.view]) {
      state.viewMinMax[state.view].min = state.minVal;
      state.viewMinMax[state.view].max = state.maxVal;
    }

    // Switch to new view mode
    state.view = $("view").value;

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

    $("minVal").value = state.minVal;
    $("maxVal").value = state.maxVal;
    
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

  add($("minVal"), "input", function () {
    state.minVal = +$("minVal").value;
    // Save to current view mode's storage
    if (state.view && state.viewMinMax[state.view]) {
      state.viewMinMax[state.view].min = state.minVal;
    }
    // Update immediately but debounce the heatmap redraw
    scheduleMinMaxValUpdate();
  });
  add($("minVal"), "keydown", function (e) {
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
  add($("maxVal"), "input", function () {
    state.maxVal = +$("maxVal").value;
    // Save to current view mode's storage
    if (state.view && state.viewMinMax[state.view]) {
      state.viewMinMax[state.view].max = state.maxVal;
    }
    // Update immediately but debounce the heatmap redraw
    scheduleMinMaxValUpdate();
  });
  add($("maxVal"), "keydown", function (e) {
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
  add($("complianceThreshold"), "input", function () {
    state.complianceThreshold = +$("complianceThreshold").value;
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
  add($("compliancePercentage"), "input", function () {
    state.compliancePercentage = +$("compliancePercentage").value;
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

  add($("addWall"), "click", function () {
    // Validation: Prevent adding if no element is selected
    // The user must visually select an element type (icon) first
    if (!state.selectedElementType) {
      NotificationSystem.info("Please select an element type from the list first.");
      return;
    }

    // Handle floorPlane separately
    if (state.selectedElementType === "floorPlane") {
      state.addingFloorPlane = !state.addingFloorPlane;
      var addBtn = $("addWall");
      if (state.addingFloorPlane) {
        state.addingAP = false;
        state.addingWall = false;
        state.isCalibrating = false;
        addBtn.textContent = getAddButtonText(true);
        // Restore Add Antenna button text
        var addAPBtn = $("addAP");
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
          if (iconSidebarData) {
            iconSidebarData.currentSection = null;
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
    var addBtn = $("addWall");
    if (state.addingWall) {
      state.addingAP = false;
      state.addingFloorPlane = false;
      state.isCalibrating = false;
      addBtn.textContent = getAddButtonText(true);
      // Restore Add Antenna button text
      var addAPBtn = $("addAP");
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
        if (iconSidebarData) {
          iconSidebarData.currentSection = null;
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

  /* AI COMMENT: exitAntennaPlacementMode, addAP handler, isPointFree, sampleFreeAreas, calculateTotalValue, findGridAntennaPositions, findOptimalAntennaPositions, findOptimalAntennaPositionsFallback, findValidAntennaPositions Ã¢â‚¬â€ moved to AntennaPlacement.js
  // Helper function to exit antenna placement mode
  function exitAntennaPlacementMode() {
    state.addingAP = false;
    var addAPBtn = $("addAP");
    var canvas = $("plot");
    if (addAPBtn) {
      addAPBtn.textContent = "Add Antenna";
    }
    // Reset cursor to default when exiting placement mode
    if (canvas) {
      canvas.style.cursor = "default";
    }
    draw();
  }

  add($("addAP"), "click", function () {
    // Prevent adding antennas during optimization
    // if (state.isOptimizing) {
    //   alert("Cannot add antennas while optimization is in progress. Please wait for optimization to complete.");
    //   return;
    // }
    // Check if antenna pattern is uploaded before allowing AP placement
    if (!getDefaultAntennaPattern() && !state.addingAP) {
      NotificationSystem.warning("Please upload an antenna pattern first before adding antennas.");
      return;
    }

    state.addingAP = !state.addingAP;
    var addAPBtn = $("addAP");
    var canvas = $("plot");
    if (state.addingAP) {
      state.addingWall = false;
      state.addingFloorPlane = false;
      state.isCalibrating = false;
      addAPBtn.textContent = "Placing...";
      // Set cursor to crosshair for placement mode
      if (canvas) {
        canvas.style.cursor = "crosshair";
      }
      // Restore other button texts
      var addFloorPlaneBtn = $("addFloorPlane");
      if (addFloorPlaneBtn) {
        addFloorPlaneBtn.textContent = "Add Floor Plane";
      }
      var addWallBtn = $("addWall");
      if (addWallBtn) {
        addWallBtn.textContent = getAddButtonText(false);
      }

      // Collapse sidebar
      var sidebar = document.getElementById("mainSidebar");
      if (sidebar && sidebar.classList.contains("expanded")) {
        sidebar.classList.remove("expanded");
        var iconButtons = document.querySelectorAll(".icon-btn");
        iconButtons.forEach(function (b) {
          b.classList.remove("active");
        });
        if (iconSidebarData) {
          iconSidebarData.currentSection = null;
        }
        // Restore legend to default position after sidebar collapse
        setTimeout(function () {
          if (typeof constrainLegendPosition === "function") {
            constrainLegendPosition(true);
          }
        }, 350);
      }
    } else {
      exitAntennaPlacementMode();
    }
    draw();
  });

  // Check if a point is in a free area (not on walls/windows/doors and not too close to existing antennas)
  function isPointFree(
    x,
    y,
    minDistanceFromWalls,
    minDistanceFromAntennas
  ) {
    minDistanceFromWalls = minDistanceFromWalls || 0.5; // Default 0.5 meters from walls
    minDistanceFromAntennas = minDistanceFromAntennas || 2.0; // Default 2 meters from other antennas

    // Check if point is within canvas bounds (with some padding)
    var padding = 1.0; // 1 meter padding from edges
    if (
      x < padding ||
      x > state.w - padding ||
      y < padding ||
      y > state.h - padding
    ) {
      return false;
    }

    // Check distance to walls, windows, and doors
    var point = { x: x, y: y };
    for (var i = 0; i < state.walls.length; i++) {
      var wall = state.walls[i];

      // Handle polylines (walls with points array)
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

      // Get element thickness
      var elementType = wall.elementType || "wall";
      var thickness = 0.15; // Default wall thickness
      if (elementType === "door" || elementType === "doubleDoor") {
        thickness = 0.05;
      } else if (elementType === "window") {
        thickness = 0.05;
      } else if (
        elementTypes.wall &&
        wall.type &&
        elementTypes.wall[wall.type]
      ) {
        thickness = elementTypes.wall[wall.type].thickness || 0.15;
      }

      // Check distance to each segment
      for (var j = 0; j < wallSegments.length; j++) {
        var seg = wallSegments[j];
        var p1 = seg.p1;
        var p2 = seg.p2;

        var dx = p2.x - p1.x;
        var dy = p2.y - p1.y;

        if (dx === 0 && dy === 0) continue;

        // Project point onto line segment
        var t = ((x - p1.x) * dx + (y - p1.y) * dy) / (dx * dx + dy * dy);

        var closestPoint;
        if (t < 0) {
          closestPoint = p1;
        } else if (t > 1) {
          closestPoint = p2;
        } else {
          closestPoint = { x: p1.x + t * dx, y: p1.y + t * dy };
        }

        var dist = hypot(x - closestPoint.x, y - closestPoint.y);
        var requiredDist = minDistanceFromWalls + thickness / 2;

        if (dist < requiredDist) {
          return false;
        }
      }
    }

    // Check distance to existing antennas
    for (var i = 0; i < state.aps.length; i++) {
      var ap = state.aps[i];
      var dist = hypot(x - ap.x, y - ap.y);
      if (dist < minDistanceFromAntennas) {
        return false;
      }
    }

    return true;
  }

  // Sample free areas of the canvas for optimization
  function sampleFreeAreas(sampleSpacing) {
    sampleSpacing = sampleSpacing || 1.0; // Default 1 meter spacing for sampling
    var minDistanceFromWalls = 0.5;
    var minDistanceFromAntennas = 0.0; // Don't exclude existing antennas for sampling

    var samplePoints = [];

    // Generate sample points across the canvas
    for (var x = 0; x <= state.w; x += sampleSpacing) {
      for (var y = 0; y <= state.h; y += sampleSpacing) {
        // Only sample free areas (not on walls/windows/doors)
        if (
          isPointFree(x, y, minDistanceFromWalls, minDistanceFromAntennas)
        ) {
          samplePoints.push({ x: x, y: y });
        }
      }
    }

    return samplePoints;
  }

  // Calculate total value across sample points for a given set of antennas
  function calculateTotalValue(samplePoints, testAntennas) {
    if (samplePoints.length === 0) return 0;

    // Temporarily replace state.aps with test antennas
    var originalAps = state.aps.slice(); // Copy original array
    state.aps = testAntennas.slice(); // Use test antennas (which already include existing + new)

    var totalValue = 0;
    var count = 0;

    // Calculate value at each sample point
    for (var i = 0; i < samplePoints.length; i++) {
      var point = samplePoints[i];
      var value = getValueAt(point.x, point.y);

      // For some view modes, we want to maximize (rssi, snr, thr)
      // For others (cci), higher is better too
      // Handle NaN and invalid values
      if (!isNaN(value) && isFinite(value)) {
        totalValue += value;
        count++;
      }
    }

    // Restore original antennas
    state.aps = originalAps;

    // Return total value (higher is better for all view modes)
    return count > 0 ? totalValue : -Infinity;
  }

  // Find grid-based positions for automatic antenna placement
  // Places antennas equally distributed: even numbers form a grid, odd numbers have center antenna
  function findGridAntennaPositions(count) {
    var positions = [];
    var margin = 1.0; // 1 meter margin from walls

    // Calculate available area
    var minX = margin;
    var maxX = state.w - margin;
    var minY = margin;
    var maxY = state.h - margin;

    var availableWidth = maxX - minX;
    var availableHeight = maxY - minY;

    if (count === 1) {
      // Single antenna at center
      positions.push({
        x: state.w / 2,
        y: state.h / 2
      });
      return positions;
    }

    // For even numbers: create a grid
    // Calculate grid dimensions (rows and cols)
    var cols = Math.ceil(Math.sqrt(count));
    var rows = Math.ceil(count / cols);

    // Adjust to ensure we have enough cells for the count
    while (cols * rows < count) {
      if (cols <= rows) {
        cols++;
      } else {
        rows++;
      }
    }

    // Check if we can form a more square grid
    // For 4 antennas, prefer 2x2 instead of 4x1
    // For 6 antennas, prefer 2x3 instead of 6x1 or 3x2
    if (count === 2) {
      cols = 2;
      rows = 1;
    } else if (count === 4) {
      cols = 2;
      rows = 2;
    } else if (count === 6) {
      cols = 3;
      rows = 2;
    } else if (count === 8) {
      cols = 4;
      rows = 2;
    }

    // Calculate spacing
    var spacingX = availableWidth / (cols + 1);
    var spacingY = availableHeight / (rows + 1);

    // For even count that's a perfect square (4, 9, 16...), center them
    var isPerfectSquare = Math.sqrt(count) % 1 === 0;

    if (isPerfectSquare && count > 1) {
      // Perfect square grid centered
      var sideLength = Math.sqrt(count);
      cols = sideLength;
      rows = sideLength;
      spacingX = availableWidth / (cols + 1);
      spacingY = availableHeight / (rows + 1);
    }

    // For even numbers that are not perfect squares, try to make it as square as possible
    if (count % 2 === 0 && !isPerfectSquare) {
      // Try to make cols and rows as close as possible
      var sqrtCount = Math.sqrt(count);
      var preferredCols = Math.round(sqrtCount);
      var preferredRows = Math.ceil(count / preferredCols);

      if (preferredCols * preferredRows >= count) {
        cols = preferredCols;
        rows = preferredRows;
        spacingX = availableWidth / (cols + 1);
        spacingY = availableHeight / (rows + 1);
      }
    }

    // If odd number, place one at center and distribute others
    if (count % 2 === 1 && count > 1) {
      // Place center antenna first
      positions.push({
        x: state.w / 2,
        y: state.h / 2
      });

      // Remaining antennas to place
      var remaining = count - 1;

      // Create a grid for remaining antennas around the center
      var remainingCols = Math.ceil(Math.sqrt(remaining));
      var remainingRows = Math.ceil(remaining / remainingCols);

      // For 3 antennas: 1 center + 2 on opposite sides
      if (remaining === 2) {
        remainingCols = 2;
        remainingRows = 1;
      }

      var remSpacingX = availableWidth / (remainingCols + 1);
      var remSpacingY = availableHeight / (remainingRows + 1);

      // Calculate offsets from center
      var antennaIndex = 0;
      for (var r = 0; r < remainingRows; r++) {
        for (var c = 0; c < remainingCols; c++) {
          if (antennaIndex >= remaining) break;

          // Calculate position in the surrounding grid
          var gridX = minX + remSpacingX * (c + 1);
          var gridY = minY + remSpacingY * (r + 1);

          // Skip if this would be at the center (where we already placed an antenna)
          var distFromCenter = hypot(gridX - state.w / 2, gridY - state.h / 2);
          if (distFromCenter < 2.0) {
            // Find a different position for this antenna
            // Try positions around the center
            var offsets = [
              { x: -3, y: 0 }, { x: 3, y: 0 },
              { x: 0, y: -3 }, { x: 0, y: 3 },
              { x: -3, y: -3 }, { x: 3, y: 3 },
              { x: -3, y: 3 }, { x: 3, y: -3 }
            ];

            for (var o = 0; o < offsets.length; o++) {
              var testX = state.w / 2 + offsets[o].x;
              var testY = state.h / 2 + offsets[o].y;

              // Check if within bounds
              if (testX >= minX && testX <= maxX && testY >= minY && testY <= maxY) {
                // Check if not too close to existing positions
                var tooClose = false;
                for (var existingIdx = 0; existingIdx < positions.length; existingIdx++) {
                  var dist = hypot(testX - positions[existingIdx].x, testY - positions[existingIdx].y);
                  if (dist < 2.0) {
                    tooClose = true;
                    break;
                  }
                }

                if (!tooClose) {
                  positions.push({ x: testX, y: testY });
                  antennaIndex++;
                  break;
                }
              }
            }
          } else {
            positions.push({ x: gridX, y: gridY });
            antennaIndex++;
          }
        }
      }
    } else {
      // Even number - distribute in grid pattern
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (positions.length >= count) break;

          var x = minX + spacingX * (c + 1);
          var y = minY + spacingY * (r + 1);

          positions.push({ x: x, y: y });
        }
      }
    }

    // If we still don't have enough positions (due to odd number logic), add more
    while (positions.length < count) {
      // Try to add antennas around the perimeter
      var perimeterPoints = [
        { x: minX + 2, y: minY + 2 },
        { x: maxX - 2, y: minY + 2 },
        { x: minX + 2, y: maxY - 2 },
        { x: maxX - 2, y: maxY - 2 },
        { x: state.w / 2, y: minY + 2 },
        { x: state.w / 2, y: maxY - 2 },
        { x: minX + 2, y: state.h / 2 },
        { x: maxX - 2, y: state.h / 2 }
      ];

      for (var i = 0; i < perimeterPoints.length && positions.length < count; i++) {
        var point = perimeterPoints[i];

        // Check if not too close to existing positions
        var tooClose = false;
        for (var existingIdx = 0; existingIdx < positions.length; existingIdx++) {
          var dist = hypot(point.x - positions[existingIdx].x, point.y - positions[existingIdx].y);
          if (dist < 2.0) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose) {
          positions.push(point);
        }
      }

      // If still not enough, add at center as last resort
      if (positions.length < count) {
        var centerX = state.w / 2;
        var centerY = state.h / 2;

        // Check if center is already taken
        var centerTaken = false;
        for (var existingIdx = 0; existingIdx < positions.length; existingIdx++) {
          if (positions[existingIdx].x === centerX && positions[existingIdx].y === centerY) {
            centerTaken = true;
            break;
          }
        }

        if (!centerTaken) {
          positions.push({ x: centerX, y: centerY });
        }
      }
    }

    return positions.slice(0, count);
  }

  // Find optimal positions for automatic antenna placement to maximize view mode values
  // with good spatial distribution across the canvas
  function findOptimalAntennaPositions(count, gridSpacing) {
    gridSpacing = gridSpacing || 2.0; // Default 2 meters between candidate positions
    var minDistanceFromWalls = 0.5;

    // Calculate minimum distance between antennas based on canvas size
    // Ensure antennas are spread across the canvas
    var canvasDiagonal = hypot(state.w, state.h);
    var minDistanceFromAntennas = Math.max(
      (canvasDiagonal / (count + 1)) * 0.7, // At least 70% of ideal spacing
      (Math.min(state.w, state.h) / Math.max(count, 2)) * 0.8, // Or 80% of smaller dimension divided by count
      3.0 // But at least 3 meters
    );

    // Sample free areas for optimization
    var samplePoints = sampleFreeAreas(1.0); // Sample every 1 meter

    if (samplePoints.length === 0) {
      return [];
    }

    // Get default antenna pattern for new antennas
    var defaultPattern = getDefaultAntennaPattern();
    var defaultTx = 15;
    var defaultGt = 5;
    var defaultCh = 1;

    // Divide canvas into regions - one per antenna to force distribution
    var cols = Math.ceil(Math.sqrt(count * (state.w / state.h)));
    var rows = Math.ceil(count / cols);
    var regionWidth = state.w / cols;
    var regionHeight = state.h / rows;

    // Generate candidate positions in each region
    var regionCandidates = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var regionMinX = c * regionWidth;
        var regionMaxX = (c + 1) * regionWidth;
        var regionMinY = r * regionHeight;
        var regionMaxY = (r + 1) * regionHeight;

        var candidates = [];
        for (
          var x = regionMinX + 1.0;
          x < regionMaxX - 1.0;
          x += gridSpacing
        ) {
          for (
            var y = regionMinY + 1.0;
            y < regionMaxY - 1.0;
            y += gridSpacing
          ) {
            if (isPointFree(x, y, minDistanceFromWalls, 0)) {
              // Don't check existing antennas here
              candidates.push({ x: x, y: y, region: r * cols + c });
            }
          }
        }
        if (candidates.length > 0) {
          regionCandidates.push(candidates);
        }
      }
    }

    if (regionCandidates.length === 0) {
      // Fallback: try without region division
      return findOptimalAntennaPositionsFallback(count, gridSpacing);
    }

    // Two-phase approach: First ensure distribution, then optimize
    var selectedPositions = [];
    var currentAps = state.aps.slice();
    var regionUsage = new Array(regionCandidates.length).fill(0);
    var usedRegions = new Set();

    // Phase 1: Place one antenna per region to ensure distribution
    // Shuffle regions to randomize which regions get antennas first
    var regionIndices = [];
    for (var i = 0; i < regionCandidates.length; i++) {
      regionIndices.push(i);
    }
    // Shuffle
    for (var i = regionIndices.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = regionIndices[i];
      regionIndices[i] = regionIndices[j];
      regionIndices[j] = temp;
    }

    // Place antennas ensuring each goes to a different region first
    for (var antennaIndex = 0; antennaIndex < count; antennaIndex++) {
      var bestPosition = null;
      var bestValue = -Infinity;
      var bestRegionIndex = -1;

      // First, try to place in an unused region
      var foundInUnusedRegion = false;
      for (var idx = 0; idx < regionIndices.length; idx++) {
        var regionIdx = regionIndices[idx];
        if (usedRegions.has(regionIdx)) continue;

        var candidates = regionCandidates[regionIdx];
        if (candidates.length === 0) continue;

        // Try candidates in this unused region
        for (var i = 0; i < candidates.length; i++) {
          var candidate = candidates[i];

          // Check minimum distance from all selected positions
          var tooClose = false;
          for (var j = 0; j < selectedPositions.length; j++) {
            var dist = hypot(
              candidate.x - selectedPositions[j].x,
              candidate.y - selectedPositions[j].y
            );
            if (dist < minDistanceFromAntennas) {
              tooClose = true;
              break;
            }
          }
          if (tooClose) continue;

          // Create test antenna
          var testAp = {
            id: "TEST",
            x: candidate.x,
            y: candidate.y,
            tx: defaultTx,
            gt: 5,
            ch: defaultCh,
            azimuth: 0,
            tilt: 0,
            enabled: true,
          };

          if (defaultPattern) {
            testAp.antennaPattern = defaultPattern;
          }

          // Calculate value
          var testAntennas = currentAps.concat([testAp]);
          var totalValue = calculateTotalValue(samplePoints, testAntennas);

          if (totalValue > bestValue) {
            bestValue = totalValue;
            bestPosition = candidate;
            bestRegionIndex = regionIdx;
            foundInUnusedRegion = true;
          }
        }

        if (foundInUnusedRegion) break; // Found in unused region, use it
      }

      // If no unused region available or no valid position found, try all regions
      if (!foundInUnusedRegion) {
        for (
          var regionIdx = 0;
          regionIdx < regionCandidates.length;
          regionIdx++
        ) {
          var candidates = regionCandidates[regionIdx];
          if (candidates.length === 0) continue;

          for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i];

            // Check minimum distance
            var tooClose = false;
            for (var j = 0; j < selectedPositions.length; j++) {
              var dist = hypot(
                candidate.x - selectedPositions[j].x,
                candidate.y - selectedPositions[j].y
              );
              if (dist < minDistanceFromAntennas) {
                tooClose = true;
                break;
              }
            }
            if (tooClose) continue;

            // Create test antenna
            var testAp = {
              id: "TEST",
              x: candidate.x,
              y: candidate.y,
              tx: defaultTx,
              gt: 5,
              ch: defaultCh,
              azimuth: 0,
              tilt: 0,
              enabled: true,
            };

            if (defaultPattern) {
              testAp.antennaPattern = defaultPattern;
            }

            var testAntennas = currentAps.concat([testAp]);
            var totalValue = calculateTotalValue(
              samplePoints,
              testAntennas
            );

            // Penalize already-used regions
            var penalty = usedRegions.has(regionIdx) ? 0.8 : 1.0;
            var adjustedValue = totalValue * penalty;

            if (adjustedValue > bestValue) {
              bestValue = adjustedValue;
              bestPosition = candidate;
              bestRegionIndex = regionIdx;
            }
          }
        }
      }

      // Add the best position found
      if (bestPosition && bestRegionIndex >= 0) {
        selectedPositions.push(bestPosition);
        usedRegions.add(bestRegionIndex);
        regionUsage[bestRegionIndex]++;

        // Add to current antennas
        var newAp = {
          id: "TEMP",
          x: bestPosition.x,
          y: bestPosition.y,
          tx: defaultTx,
          gt: 5,
          ch: defaultCh,
          azimuth: 0,
          tilt: 0,
          enabled: true,
        };
        if (defaultPattern) {
          newAp.antennaPattern = defaultPattern;
        }
        currentAps.push(newAp);
      } else {
        // No valid position found
        if (selectedPositions.length === 0) {
          return findOptimalAntennaPositionsFallback(count, gridSpacing);
        }
        break;
      }
    }

    return selectedPositions;
  }

  // Fallback algorithm without region division (if region division fails)
  function findOptimalAntennaPositionsFallback(count, gridSpacing) {
    gridSpacing = gridSpacing || 2.0;
    var minDistanceFromWalls = 0.5;
    var minDistanceFromAntennas = 2.0;

    // Sample free areas for optimization
    var samplePoints = sampleFreeAreas(1.0);

    if (samplePoints.length === 0) {
      return [];
    }

    // Generate candidate positions
    var candidatePositions = [];
    for (var x = 1.0; x < state.w - 1.0; x += gridSpacing) {
      for (var y = 1.0; y < state.h - 1.0; y += gridSpacing) {
        if (
          isPointFree(x, y, minDistanceFromWalls, minDistanceFromAntennas)
        ) {
          candidatePositions.push({ x: x, y: y });
        }
      }
    }

    if (candidatePositions.length === 0) {
      if (gridSpacing > 1.0) {
        return findOptimalAntennaPositionsFallback(
          count,
          gridSpacing * 0.7
        );
      }
      return [];
    }

    // Get default antenna pattern
    var defaultPattern = getDefaultAntennaPattern();
    var defaultTx = 15;
    var defaultGt = 5;
    var defaultCh = 1;

    // Greedy algorithm with minimum distance enforcement
    var selectedPositions = [];
    var currentAps = state.aps.slice();

    // Calculate minimum spacing to ensure distribution (same as main function)
    var canvasDiagonal = hypot(state.w, state.h);
    var minSpacing = Math.max(
      (canvasDiagonal / (count + 1)) * 0.7, // At least 70% of ideal spacing
      (Math.min(state.w, state.h) / Math.max(count, 2)) * 0.8, // Or 80% of smaller dimension divided by count
      3.0 // But at least 3 meters
    );

    for (var antennaIndex = 0; antennaIndex < count; antennaIndex++) {
      var bestPosition = null;
      var bestValue = -Infinity;

      for (var i = 0; i < candidatePositions.length; i++) {
        var candidate = candidatePositions[i];

        // Check minimum spacing from selected positions
        var tooClose = false;
        for (var j = 0; j < selectedPositions.length; j++) {
          var dist = hypot(
            candidate.x - selectedPositions[j].x,
            candidate.y - selectedPositions[j].y
          );
          if (dist < minSpacing) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        // Create test antenna
        var testAp = {
          id: "TEST",
          x: candidate.x,
          y: candidate.y,
          tx: defaultTx,
          gt: 5,
          ch: defaultCh,
          azimuth: 0,
          tilt: 0,
          enabled: true,
        };

        if (defaultPattern) {
          testAp.antennaPattern = defaultPattern;
        }

        // Calculate value
        var testAntennas = currentAps.concat([testAp]);
        var totalValue = calculateTotalValue(samplePoints, testAntennas);

        if (totalValue > bestValue) {
          bestValue = totalValue;
          bestPosition = candidate;
        }
      }

      if (bestPosition) {
        selectedPositions.push(bestPosition);

        var newAp = {
          id: "TEMP",
          x: bestPosition.x,
          y: bestPosition.y,
          tx: defaultTx,
          gt: 5,
          ch: defaultCh,
          azimuth: 0,
          tilt: 0,
          enabled: true,
        };
        if (defaultPattern) {
          newAp.antennaPattern = defaultPattern;
        }
        currentAps.push(newAp);
      } else {
        break;
      }
    }

    return selectedPositions;
  }

  // Find valid positions for automatic antenna placement (fallback - simple grid)
  function findValidAntennaPositions(count, gridSpacing) {
    gridSpacing = gridSpacing || 3.0; // Default 3 meters between grid points
    var minDistanceFromWalls = 0.5;
    var minDistanceFromAntennas = 2.0;

    var validPositions = [];
    var gridPoints = [];

    // Generate grid points
    for (var x = 1.0; x < state.w - 1.0; x += gridSpacing) {
      for (var y = 1.0; y < state.h - 1.0; y += gridSpacing) {
        gridPoints.push({ x: x, y: y });
      }
    }

    // Shuffle grid points for more random distribution
    for (var i = gridPoints.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = gridPoints[i];
      gridPoints[i] = gridPoints[j];
      gridPoints[j] = temp;
    }

    // Find valid positions
    for (
      var i = 0;
      i < gridPoints.length && validPositions.length < count;
      i++
    ) {
      var point = gridPoints[i];
      if (
        isPointFree(
          point.x,
          point.y,
          minDistanceFromWalls,
          minDistanceFromAntennas
        )
      ) {
        validPositions.push(point);
      }
    }

    // If we don't have enough positions, try with smaller grid spacing
    if (validPositions.length < count && gridSpacing > 1.0) {
      var additionalPositions = findValidAntennaPositions(
        count - validPositions.length,
        gridSpacing * 0.7
      );
      validPositions = validPositions.concat(additionalPositions);
    }

    return validPositions.slice(0, count);
  }
  AI COMMENT END */

  // Export detailed coverage data handler
  add($("exportCoverageBtn"), "click", function () {
    if (!state.aps || state.aps.length === 0) {
      NotificationSystem.warning("Please add at least one antenna before exporting coverage data.");
      return;
    }
    DataExportSystem.exportDetailedCoverageData();
  });

  /* AI COMMENT: autoPlaceAntennas handler, performAutoPlacement, confirmAutoPlace, cancelAutoPlace, autoPlaceCount handlers Ã¢â‚¬â€ moved to AntennaPlacement.js
  // Automatic antenna placement handler
  add($("autoPlaceAntennas"), "click", function () {
    // Prevent automatic placement during optimization
    // if (state.isOptimizing) {
    //   alert("Cannot place antennas automatically while optimization is in progress. Please wait for optimization to complete.");
    //   return;
    // }

    // Check if antenna pattern is uploaded before allowing automatic placement
    if (!getDefaultAntennaPattern()) {
      NotificationSystem.warning("Please upload an antenna pattern first before using automatic placement.");

      return;
    }

    var inputContainer = $("autoPlaceInputContainer");
    if (inputContainer.style.display === "none") {
      inputContainer.style.display = "block";
      $("autoPlaceCount").focus();
      $("autoPlaceCount").value = "";
    } else {
      inputContainer.style.display = "none";
    }
  });

  // Function to perform automatic placement
  function performAutoPlacement() {
    var countInput = $("autoPlaceCount");
    var count = parseInt(countInput.value);

    if (isNaN(count) || count < 1 || count > 100) {
      alert("Please enter a valid number between 1 and 100.");
      return;
    }

    // Check if antenna pattern is uploaded
    if (!getDefaultAntennaPattern()) {
      alert(
        'Please upload an antenna pattern file first using "UPLOAD ANTENNA\'S PATTERN" field.'
      );
      return;
    }

    // Show optimization message
    var viewModeName =
      state.view === "rssi"
        ? "RSSI"
        : state.view === "snr"
          ? "SNR"
          : state.view === "cci"
            ? "CCI Count"
            : state.view === "thr"
              ? "Throughput"
              : "Signal";
    console.log("Placing " + count + " antenna(s) in grid pattern...");

    // Clear existing antennas before placing new ones
    state.aps = [];

    // Find grid-based positions for antenna placement
    var positions = findGridAntennaPositions(count);

    if (positions.length === 0) {
      NotificationSystem.warning("Could not find any free areas to place antennas.\nPlease check your canvas layout.");
      return;
    }

    if (positions.length < count) {
      NotificationSystem.warning("Only found " + positions.length + " valid positions out of " + count + " requested.");

    }

    console.log("Placed " + positions.length + " antenna(s) in grid pattern.");

    // Place antennas
    var defaultPattern = getDefaultAntennaPattern();
    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      var id = "ANT" + (state.aps.length + 1);
      var ap = {
        id: id,
        x: pos.x,
        y: pos.y,
        tx: 15,
        gt: 5,//(defaultPattern ? defaultPattern.gain : defaultGt),
        ch: 1,
        azimuth: 0,
        tilt: 0,
        antennaPatternFile: null,
        antennaPatternFileName: null,
      };

      if (defaultPattern) {
        ap.antennaPattern = defaultPattern;
        // Set the filename from the pattern's fileName property
        ap.antennaPatternFileName = (defaultPattern && defaultPattern.name) ? defaultPattern.name : null
        //ap.antennaPatternFileName = defaultPattern.fileName || (defaultPattern.name ? defaultPattern.name : null);
      }

      state.aps.push(ap);
      logAntennaPositionChange(ap.id, ap.id, ap.x, ap.y, ap.x, ap.y);
      // Keep old cache - don't invalidate it yet
    }
    // Generate a unique request ID
    var requestId = "antennas_batch_status_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    console.log("Sending antennas batch status update to backend:", state.aps);

    // Send message to parent window (Anvil app)
    window.parent.postMessage(
      {
        type: "antennas_batch_status_update",
        requestId: requestId,
        antennas: state.aps,
      },
      "*"
    );

    saveState();
    renderAPs();
    // Mark update as pending BEFORE draw() to prevent synchronous generation
    // Keep the old cache until the new one is ready - don't invalidate it yet!
    // This ensures the previous heatmap stays visible while the new one is being calculated
    state.heatmapUpdatePending = true;
    // Draw immediately with old cache to show antenna placement instantly
    draw();
    // Use requestAnimationFrame to defer async generation slightly
    // This ensures the immediate draw() completes first
    requestAnimationFrame(function () {
      if (state.showVisualization) {
        generateHeatmapAsync(null, true); // Start with low-res for fast update
      } else {
        state.heatmapUpdatePending = false;
      }
    });

    // Hide input container
    $("autoPlaceInputContainer").style.display = "none";
    countInput.value = "";

    //showAnvilNotification("Successfully placed " + positions.length + " antenna(s)!", "Success", "success");

    // Export frontend RSRP bins after auto placement
    setTimeout(function () {
 
      // Auto-download RSRP for each placed antenna (staggered to avoid browser blocking)
      // state.aps.forEach(function (ap, idx) {
      //   setTimeout(function () {
      //     DataExportSystem.exportAntennaRsrp(ap, ap.id + "_rsrp.csv", 1.0);
      //   }, (idx + 1) * 500);
      // });
    }, 300);
  }

  // Confirm automatic placement
  add($("confirmAutoPlace"), "click", performAutoPlacement);

  // Cancel automatic placement
  add($("cancelAutoPlace"), "click", function () {
    $("autoPlaceInputContainer").style.display = "none";
    $("autoPlaceCount").value = "";
  });

  // Allow Enter key to confirm placement
  add($("autoPlaceCount"), "keydown", function (e) {
    if (e.key === "Enter") {
      performAutoPlacement();
    }
  });
  AI COMMENT END */

  // Manual send button for antenna positions
  /*
  add($("saveAntennaPositions"), "click", function () {
    // Prevent saving during optimization
    if (state.isOptimizing) {
      NotificationSystem.warning("Optimization in progress. Please wait before saving antenna positions.");
      return;
    }

    // Send JSON data immediately
    sendAntennaDataJson();
  });
  */

  add($("showContours"), "change", function () {
    state.showContours = $("showContours").checked;
    
    // AI COMMENT: Replaced inline heatmap cache invalidation with helper
    // Contour mode changes affect color mapping ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â need to regenerate
    invalidateHeatmapCache();
    
    draw();
  });

  add($("showTooltip"), "change", function () {
    state.showTooltip = $("showTooltip").checked;
    var tooltip = $("apTooltip");
    if (!state.showTooltip && tooltip) {
      tooltip.classList.remove("visible");
      tooltip.style.display = "none"; // Hide tooltip when unchecked
    }
  });

  add($("showVisualization"), "change", function () {
    state.showVisualization = $("showVisualization").checked;
    
    // AI COMMENT: Replaced inline heatmap cache invalidation with helper
    // When enabling: invalidates + regenerates. When disabling: invalidates only (no generate).
    invalidateHeatmapCache();
    
    draw();
  });

  add($("viewModeToggle"), "change", function () {
    state.viewModeTarget = $("viewModeToggle").checked ? "3d" : "2d";
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
  add($("darkModeToggle"), "click", function () {
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

  add($("elementType"), "change", function () {
    state.selectedElementType = $("elementType").value;
    // Show wall type dropdown only when wall is selected
    if (state.selectedElementType === "wall") {
      $("wallTypeContainer").style.display = "block";
      $("floorPlaneAttenuationContainer").style.display = "none";
      $("floorPlaneHeightContainer").style.display = "none";
      $("floorPlaneTypeContainer").style.display = "none";
      $("floorPlaneInclinationContainer").style.display = "none";
      $("floorPlaneInclinationDirectionContainer").style.display = "none";
    } else if (state.selectedElementType === "floorPlane") {
      $("wallTypeContainer").style.display = "none";
      $("customWallInput").style.display = "none";
      $("floorPlaneAttenuationContainer").style.display = "block";
      $("floorPlaneHeightContainer").style.display = "block";
      $("floorPlaneTypeContainer").style.display = "block";
      updateFloorPlaneTypeVisibility();
    } else {
      $("wallTypeContainer").style.display = "none";
      $("customWallInput").style.display = "none";
      $("floorPlaneAttenuationContainer").style.display = "none";
      $("floorPlaneHeightContainer").style.display = "none";
      $("floorPlaneTypeContainer").style.display = "none";
      $("floorPlaneInclinationContainer").style.display = "none";
      $("floorPlaneInclinationDirectionContainer").style.display = "none";
    }
    // Update button text based on selected element type
    var addBtn = $("addWall");
    if (addBtn && !state.addingWall && !state.addingFloorPlane) {
      addBtn.textContent = getAddButtonText(false);
    }
  });

  // Walls Help Modal handlers
  add($("wallsHelpIcon"), "click", function (e) {
    e.stopPropagation();
    var modal = $("wallsHelpModal");
    var icon = $("wallsHelpIcon");
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

  add($("closeWallsHelp"), "click", function (e) {
    e.stopPropagation();
    var modal = $("wallsHelpModal");
    if (modal) {
      modal.style.display = "none";
    }
  });

  // Close help modal when clicking anywhere outside of it
  function closeWallsHelpModal(e) {
    var modal = $("wallsHelpModal");
    var icon = $("wallsHelpIcon");
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
  add(document, "click", function (e) {
    var modal = $("wallsHelpModal");
    var icon = $("wallsHelpIcon");
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
      $("floorPlaneInclinationContainer").style.display = "block";
      $("floorPlaneInclinationDirectionContainer").style.display = "block";
    } else {
      $("floorPlaneInclinationContainer").style.display = "none";
      $("floorPlaneInclinationDirectionContainer").style.display = "none";
    }
  }

  // Handle floor plane type change
  add($("floorPlaneType"), "change", function () {
    state.floorPlaneType = $("floorPlaneType").value;
    updateFloorPlaneTypeVisibility();
  });

  // Handle floor plane height input
  add($("floorPlaneHeight"), "input", function () {
    var val = $("floorPlaneHeight").value.trim();
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
  add($("floorPlaneHeight"), "blur", function () {
    var val = $("floorPlaneHeight").value.trim();
    if (val === "" || val === "-") {
      state.floorPlaneHeight = 0;
      $("floorPlaneHeight").value = "0";
    }
  });

  // Handle floor plane inclination input
  add($("floorPlaneInclination"), "input", function () {
    var val = $("floorPlaneInclination").value.trim();
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
  add($("floorPlaneInclination"), "blur", function () {
    var val = $("floorPlaneInclination").value.trim();
    if (val === "" || val === "-") {
      state.floorPlaneInclination = 0;
      $("floorPlaneInclination").value = "0";
    }
  });

  // Handle floor plane inclination direction input
  add($("floorPlaneInclinationDirection"), "input", function () {
    var val = $("floorPlaneInclinationDirection").value.trim();
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
  add($("floorPlaneInclinationDirection"), "blur", function () {
    var val = $("floorPlaneInclinationDirection").value.trim();
    if (val === "" || val === "-") {
      state.floorPlaneInclinationDirection = 0;
      $("floorPlaneInclinationDirection").value = "0";
    }
  });

  add($("wallType"), "change", function () {
    state.selectedWallType = $("wallType").value;
    if (state.selectedWallType === "custom") {
      $("customWallInput").style.display = "block";
    } else {
      $("customWallInput").style.display = "none";
    }
  });

  add($("customWallLoss"), "input", function () {
    var val = $("customWallLoss").value.trim();
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
  add($("customWallLoss"), "blur", function () {
    var val = $("customWallLoss").value.trim();
    if (val === "" || val === "-") {
      state.customWallLoss = 0;
      $("customWallLoss").value = "0";
    }
  });

  add($("snapToGridToggle"), "change", function () {
    state.snapToGrid = $("snapToGridToggle").checked;
  });

  add($("floorPlaneAttenuation"), "input", function () {
    var val = $("floorPlaneAttenuation").value.trim();
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
  add($("floorPlaneAttenuation"), "blur", function () {
    var val = $("floorPlaneAttenuation").value.trim();
    if (val === "" || val === "-") {
      state.floorPlaneAttenuation = 0;
      $("floorPlaneAttenuation").value = "0";
    }
  });

  add($("manualWallControlToggle"), "change", function () {
    state.manualWallControl = $("manualWallControlToggle").checked;
    // Clear wall selection when disabling manual control
    if (!state.manualWallControl) {
      state.selectedWallId = null;
      state.selectedWallIds = [];
      state.wallDrag = null;
      draw();
    }
  });

  // Handle antenna pattern upload
  add($("antennaPatternUpload"), "change", function (e) {
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
  add($("deleteSelectedPattern"), "click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var select = $("defaultAntennaPatternSelect");
    if (select && select.value !== "-1" && select.value !== null && select.value !== "") {
      var patternIndex = parseInt(select.value);
      if (!isNaN(patternIndex) && patternIndex >= 0 && patternIndex < state.antennaPatterns.length) {
        deleteAntennaPattern(patternIndex);
      }
    }
  });

  // Handle default pattern selection change
  add($("defaultAntennaPatternSelect"), "change", function (e) {
    var selectedIndex = parseInt(e.target.value);
    state.defaultAntennaPatternIndex = selectedIndex;

    // Update delete button visibility when selection changes
    var deleteButton = $("deleteSelectedPattern");
    if (deleteButton) {
      if (selectedIndex !== -1 && !isNaN(selectedIndex)) {
        deleteButton.style.display = "block";
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

  // Icon sidebar functionality
  function initIconSidebar() {
    var iconButtons = document.querySelectorAll(".icon-btn");
    var currentSection = "floorplan";
    var sidebar = document.getElementById("mainSidebar");

    if (!sidebar) {
      console.error("Sidebar not found");
      return null;
    }

    if (iconButtons.length === 0) {
      console.error("Icon buttons not found");
      return null;
    }

    console.log(
      "Initializing icon sidebar with",
      iconButtons.length,
      "buttons"
    );

    iconButtons.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        // Close help modal if open when clicking any sidebar icon
        var modal = $("wallsHelpModal");
        if (modal && modal.style.display === "block") {
          modal.style.display = "none";
        }

        e.preventDefault();
        e.stopPropagation();

        var section = this.getAttribute("data-section");
        if (!section) {
          console.error("No data-section attribute found");
          return;
        }

        console.log("Icon clicked:", section);

        // Toggle if clicking the same section
        if (
          section === currentSection &&
          sidebar.classList.contains("expanded")
        ) {
          sidebar.classList.remove("expanded");
          currentSection = null;
          iconButtons.forEach(function (b) {
            b.classList.remove("active");
          });
          // Restore legend to default position after sidebar collapse (if not manually moved)
          setTimeout(function () {
            constrainLegendPosition(true); // Restore default if not manually moved
          }, 350); // Wait for transition to complete
          return;
        }

        // Update active icon
        iconButtons.forEach(function (b) {
          b.classList.remove("active");
        });
        this.classList.add("active");
        currentSection = section;

        // Hide all sections
        var sections = document.querySelectorAll(".section-content");
        sections.forEach(function (s) {
          s.classList.remove("active");
        });

        // Show selected section
        var selectedSection = document.querySelector(
          '.section-content[data-section="' + section + '"]'
        );
        if (selectedSection) {
          selectedSection.classList.add("active");
          var headerTitle = $("sidebarHeaderTitle");
          if (headerTitle) {
            var cardTitle = selectedSection.querySelector(".card-title");
            headerTitle.textContent = cardTitle ? cardTitle.textContent.trim() : section;
          }
          console.log("Showing section:", section);

          // Right panel stays open regardless of which left tab is selected
          // The left sidebar list and right detail panel are complementary views
        } else {
          console.error("Section not found:", section);
        }

        // Expand sidebar
        sidebar.classList.add("expanded");
        console.log("Sidebar expanded");
        // Constrain legend position after sidebar expansion
        setTimeout(constrainLegendPosition, 350); // Wait for transition to complete
      });
    });

    return { sidebar: sidebar, currentSection: currentSection };
  }

  // Global variable to store sidebar data
  var iconSidebarData = null;

  // Close sidebar when clicking outside (but not on canvas or other interactive elements)
  document.addEventListener("click", function (e) {
    // Handle left sidebar
    // Never close sidebars when clicking on a notification modal (confirmation dialogs, etc.)
    var clickedOnModal = e.target.closest(".notif-modal-overlay") || e.target.closest(".notif-modal");
    if (clickedOnModal) return;

    if (iconSidebarData) {
      var sidebar = iconSidebarData.sidebar;
      var iconButtons = document.querySelectorAll(".icon-btn");

      // Don't close if clicking inside sidebar or icon bar
      var clickedInsideSidebar =
        sidebar &&
        (sidebar.contains(e.target) || e.target.closest(".icon-sidebar"));
      var clickedOnSidebarButton =
        e.target.closest(".list-item") || e.target.closest("button.small");

      if (clickedInsideSidebar || clickedOnSidebarButton) {
        // Click is inside sidebar, don't close it
      } else if (
        !e.target.closest(".canvas-container") &&
        e.target.id !== "plot"
      ) {
        // Close left sidebar if clicking elsewhere (but not on canvas)
        if (sidebar && sidebar.classList.contains("expanded")) {
          sidebar.classList.remove("expanded");
          iconButtons.forEach(function (b) {
            b.classList.remove("active");
          });
          iconSidebarData.currentSection = null;
          setTimeout(function () {
            constrainLegendPosition(true);
          }, 350);
        }
      }
    }

    // Handle right sidebar (AP detail sidebar) - close when clicking anywhere outside it
    var apDetailSidebar = $("apDetailSidebar");
    if (apDetailSidebar && apDetailSidebar.classList.contains("visible")) {
      if (apDetailSidebar.contains(e.target)) {
        return;
      }
      if (state.justOpenedApSidebar) {
        return;
      }
      apDetailSidebar.classList.remove("visible");
      state.selectedApForDetail = null;
    }
  });

  function pointerPos(ev) {
    var rect = canvas.getBoundingClientRect();
    var x = ev.clientX - rect.left;
    var y = ev.clientY - rect.top;
    return { x: invx(x), y: invy(y) };
  }

  // Hide tooltip when mouse leaves canvas
  add(canvas, "mouseleave", function (e) {
    if (state.showTooltip) {
      var tooltip = $("apTooltip");
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

  add(canvas, "mousedown", function (e) {
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
            alert("Please click ON a wall to place a door or window.");
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
          var addAPBtn = $("addAP");
          if (addAPBtn) {
            addAPBtn.className = addAPBtn.className.replace(" toggled", "");
            addAPBtn.textContent = "Add Antenna";
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
        var apDetailSidebar = $("apDetailSidebar");
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

  add(window, "mousemove", function (e) {
    var p = pointerPos(e);

    // Update tooltip position - keep mouse pointer at left bottom of tooltip
    var tooltip = $("apTooltip");
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

  add(window, "mouseup", function (e) {
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

      $("apDetailSidebar").classList.add("visible");
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

  // Keyboard event handler for ESC key (deselect and exit placement modes)
  add(document, "keydown", function (e) {
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
      var apDetailSidebar = $("apDetailSidebar");
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
        var apList = $("apList");
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

  // Mouse wheel zoom for 3D view only
  add(canvas, "wheel", function (e) {
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
  add(canvas, "contextmenu", function (e) {
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

  add(window, "resize", function () {
    draw();
    // Constrain legend position when window resizes
    constrainLegendPosition();
  });

  
  // AI ADD: Ensure canvas renders once all resources (CSS, images) are loaded
  add(window, "load", function () {
    draw();
  });

  // Store default legend position (kept for compatibility; actual positioning is CSS-driven)
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

  // Update legend position on mouse move (only horizontal and vertical movement)
  add(window, "mousemove", function (e) {
    // Handle AP tooltip (only if not in drawing mode)
    if (
      state.showTooltip &&
      !state.addingWall &&
      !state.addingAP &&
      !state.isCalibrating
    ) {
      var tooltip = $("apTooltip");
      var canvas = $("plot");
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

          // YOUSEF COMMENT CSV
          // Check if CSV coverage data is available and view is RSSI
          // var csvValue = null;
          // if (
          //   state.csvCoverageData &&
          //   state.csvCoverageGrid &&
          //   state.view === "rssi"
          // ) {
          //   csvValue = interpolateRsrpFromCsv(worldX, worldY);
          // }

          // Get best AP at cursor tip location
          var best = bestApAt(worldX, worldY);

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
      var tooltip = $("apTooltip");
      if (tooltip) {
        tooltip.classList.remove("visible");
      }
    }

    // Legend dragging disabled - legend is fixed in bottom-left corner
  });

  // ESC key handler to terminate wall drawing
  add(window, "keydown", function (e) {
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
            var apDetailSidebar = $("apDetailSidebar");
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
      var addBtn = $("addWall");
      if (addBtn) {
        addBtn.className = addBtn.className.replace(" toggled", "");
        addBtn.textContent = getAddButtonText(false);
      }
      draw();
    } else if ((e.keyCode === 27 || e.key === "Escape") && state.addingAP) {
      // Terminate antenna placement
      state.addingAP = false;
      // Update button appearance
      var addAPBtn = $("addAP");
      if (addAPBtn) {
        addAPBtn.className = addAPBtn.className.replace(" toggled", "");
        addAPBtn.textContent = "Add Antenna";
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
      var addFloorPlaneBtn = $("addFloorPlane");
      if (addFloorPlaneBtn) {
        addFloorPlaneBtn.className = addFloorPlaneBtn.className.replace(
          " toggled",
          ""
        );
        addFloorPlaneBtn.textContent = "Add Floor Plane";
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
      var apDetailSidebar = $("apDetailSidebar");
      if (apDetailSidebar) apDetailSidebar.classList.remove("visible");
      renderAPs(); // Update button states

      // Reset scrolling to the very top of the antenna list
      setTimeout(function () {
        var apList = $("apList");
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

  // Resizer functionality disabled

  // AI COMMENT: init calls moved to UIRenderers.js (loaded after monolith)
  // renderAPs();
  // renderWalls();
  // renderFloorPlanes();
  // Initialize view mode toggle (default to 2D)
  state.viewModeTarget = state.viewMode; // Sync target with current mode
  if ($("viewModeToggle")) {
    $("viewModeToggle").checked = state.viewMode === "3d";
    if ($("darkModeToggle")) {
      $("darkModeToggle").checked = state.darkMode || false;
      applyDarkMode();
    }
  }
  // AI COMMENT: imageToBase64, base64ToImage, saveProject, downloadProject,
  // loadProject, and save/load button handlers ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ EXTRACTED to ProjectIO.js
  /*
  function imageToBase64(img) { ... }
  function base64ToImage(base64) { ... }
  function saveProject() { ... }
  function downloadProject(blob, fileName) { ... }
  function loadProject(file) { ... }
  add($("saveProjectBtn"), "click", function () { ... });
  add($("loadProjectBtn"), "click", function () { ... });
  add($("loadProjectFile"), "change", function (e) { ... });
  */

  // Initialize after everything is loaded
  function initApp() {
    updateDeleteImageButton();
    updateDeleteXdImageButton();
    updateDeleteDxfButton();
    
    // Only call functions if they've been loaded
    if (typeof initIconSidebar === "function") iconSidebarData = initIconSidebar();
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
