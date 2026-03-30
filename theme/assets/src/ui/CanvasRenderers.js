// CanvasRenderers.js
// Handles rendering of geometry (ground plane, floor planes, walls, antennas) on the HTML5 canvas

var CanvasRenderers = (function () {

  // Helper function to safely get pad() value
  function getPad() {
    return typeof window.pad === "function" ? window.pad() : window.pad;
  }

  // Render ground plane with uploaded image as texture
  function renderGroundPlane(ctx, transition) {
    if (!window.state.groundPlane || !window.state.groundPlane.enabled) return;

    var is3D = transition > 0;

    var corners;
    if (window.state.backgroundImage && window.state.backgroundImageAspectRatio && 
        window.state.backgroundImageDisplayWidth && window.state.backgroundImageDisplayHeight) {
      var offsetX = (window.state.w - window.state.backgroundImageDisplayWidth) / 2;
      var offsetY = (window.state.h - window.state.backgroundImageDisplayHeight) / 2;
      
      corners = [
        { x: offsetX, y: offsetY, z: 0 },
        { x: offsetX + window.state.backgroundImageDisplayWidth, y: offsetY, z: 0 },
        { x: offsetX + window.state.backgroundImageDisplayWidth, y: offsetY + window.state.backgroundImageDisplayHeight, z: 0 },
        { x: offsetX, y: offsetY + window.state.backgroundImageDisplayHeight, z: 0 },
      ];
    } else {
      corners = [
        { x: 0, y: 0, z: 0 },
        { x: window.state.w, y: 0, z: 0 },
        { x: window.state.w, y: window.state.h, z: 0 },
        { x: 0, y: window.state.h, z: 0 },
      ];
    }

    var corners2D;
    if (window.state.backgroundImage && window.state.backgroundImageAspectRatio && 
        window.state.backgroundImageDisplayWidth && window.state.backgroundImageDisplayHeight) {
      var offsetX = (window.state.w - window.state.backgroundImageDisplayWidth) / 2;
      var offsetY = (window.state.h - window.state.backgroundImageDisplayHeight) / 2;
      corners2D = [
        { x: window.mx(offsetX), y: window.my(offsetY) },
        { x: window.mx(offsetX + window.state.backgroundImageDisplayWidth), y: window.my(offsetY) },
        { x: window.mx(offsetX + window.state.backgroundImageDisplayWidth), y: window.my(offsetY + window.state.backgroundImageDisplayHeight) },
        { x: window.mx(offsetX), y: window.my(offsetY + window.state.backgroundImageDisplayHeight) },
      ];
    } else {
      corners2D = [
        { x: window.mx(0), y: window.my(0) },
        { x: window.mx(window.state.w), y: window.my(0) },
        { x: window.mx(window.state.w), y: window.my(window.state.h) },
        { x: window.mx(0), y: window.my(window.state.h) },
      ];
    }

    var finalCorners = [];
    if (is3D) {
      var projectedCorners = [];
      for (var i = 0; i < corners.length; i++) {
        projectedCorners.push(window.projectToCanvas3D(corners[i].x, corners[i].y, corners[i].z));
      }
      for (var i = 0; i < corners.length; i++) {
        finalCorners.push({
          x: corners2D[i].x + (projectedCorners[i].x - corners2D[i].x) * transition,
          y: corners2D[i].y + (projectedCorners[i].y - corners2D[i].y) * transition,
        });
      }
    } else {
      finalCorners = corners2D;
    }

    ctx.save();

    // Grey background
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = "#b8b8b8";
    var fullCanvasCorners = [
      { x: window.mx(0), y: window.my(0) },
      { x: window.mx(window.state.w), y: window.my(0) },
      { x: window.mx(window.state.w), y: window.my(window.state.h) },
      { x: window.mx(0), y: window.my(window.state.h) },
    ];
    if (is3D) {
      var fullCorners = [
        { x: 0, y: 0, z: 0 },
        { x: window.state.w, y: 0, z: 0 },
        { x: window.state.w, y: window.state.h, z: 0 },
        { x: 0, y: window.state.h, z: 0 },
      ];
      var fullCanvasCorners3D = [];
      for (var i = 0; i < fullCorners.length; i++) {
        fullCanvasCorners3D.push(window.projectToCanvas3D(fullCorners[i].x, fullCorners[i].y, fullCorners[i].z));
      }
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

    if (window.state.backgroundImage) {
      ctx.globalAlpha = window.state.backgroundImageAlpha;
      ctx.globalCompositeOperation = "source-over";

      var projector = function (p) {
        var p2d = { x: window.mx(p.x), y: window.my(p.y) };
        var p3d = window.projectToCanvas3D(p.x, p.y, 0);
        return {
          x: p2d.x + (p3d.x - p2d.x) * transition,
          y: p2d.y + (p3d.y - p2d.y) * transition,
        };
      };

      window.drawProjectedImage(
        ctx,
        window.state.backgroundImage,
        0,
        0,
        window.state.backgroundImage.width,
        window.state.backgroundImage.height,
        corners[0],
        corners[1],
        corners[2],
        corners[3],
        projector
      );
    }

    ctx.restore();
  }

  function renderFloorPlanesOnCanvas(ctx, transition) {
    var state = window.state;
    var mx = window.mx;
    var my = window.my;
    var projectToCanvas3D = window.projectToCanvas3D;
    var drawProjectedImage = window.drawProjectedImage;

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
    for (var i = 0; i < floorPlanesToRender.length; i++) {
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
  }

  function renderWallsOnCanvas(ctx, transition) {
    var state = window.state;
    var mx = window.mx;
    var my = window.my;
    var projectToCanvas3D = window.projectToCanvas3D;
    var drawProjectedImage = window.drawProjectedImage;
    var hypot = window.hypot;
    var hexToRgb = window.hexToRgb;
    var renderDoor3D = window.renderDoor3D;
    var renderDoubleDoor3D = window.renderDoubleDoor3D;
    var renderWindow3D = window.renderWindow3D;
    var wallTypes = window.wallTypes;
    var elementTypes = window.elementTypes;

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
        for (var i = 0; i < state.walls.length; i++) {
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


  }

  function renderAntennasOnCanvas(ctx, transition) {
    var state = window.state;
    var mx = window.mx;
    var my = window.my;
    var projectToCanvas3D = window.projectToCanvas3D;

    // APs - Skip rendering original antennas when Three.js is active in 3D mode
    var useThree3DForAntennas =
      transition > 0 &&
      state.useThreeJS &&
      state.threeRenderer &&
      state.threeScene;
    if (!useThree3DForAntennas && state.activeSection !== 'xd') {
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "12px sans-serif";
      for (var i = 0; i < state.aps.length; i++) {
        var ap2 = state.aps[i];
        // Show disabled antennas but grayed out
        var isDisabled = ap2.enabled === false;
        if (isDisabled) {
          ctx.globalAlpha = 0.3; // Make disabled antennas semi-transparent
        } else {
          ctx.globalAlpha = 1.0;
        }
        var antennaHeight = ap2.z || 2.5; // Default antenna height 2.5m if not specified
        var coverageHeight = antennaHeight; // Render AP icon at its actual physical height

        // Calculate position based on view mode
        var px, py;
        if (transition > 0) {
          // 3D view - project antenna to align with coverage pattern center
          var ap2d = { x: mx(ap2.x), y: my(ap2.y) };
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
            var dragCoverageHeight = coverageHeight; // Use same height as this antenna
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

        // Draw antenna label with a small dark background block
        var labelName = ap2.id;
        var labelCh   = "ch " + ap2.ch;
        var textX = px + r + 5;   // offset from circle edge
        var textY = py - 4;

        var lineHeight   = 13;
        var nameFontSize = 11;
        var chFontSize   = 10;
        var pad2         = 3;

        // Measure both lines for the background pill
        ctx.font = "bold " + nameFontSize + "px Arial";
        var nameWidth = ctx.measureText(labelName).width;
        ctx.font = chFontSize + "px Arial";
        var chWidth   = ctx.measureText(labelCh).width;
        var bgWidth   = Math.max(nameWidth, chWidth) + pad2 * 2;
        var bgHeight  = lineHeight * 2 + pad2 * 2;

        // Rounded-rect background pill
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        var bx = textX - pad2;
        var by = textY - nameFontSize - pad2;
        var br = 3; // corner radius
        ctx.beginPath();
        ctx.moveTo(bx + br, by);
        ctx.lineTo(bx + bgWidth - br, by);
        ctx.quadraticCurveTo(bx + bgWidth, by, bx + bgWidth, by + br);
        ctx.lineTo(bx + bgWidth, by + bgHeight - br);
        ctx.quadraticCurveTo(bx + bgWidth, by + bgHeight, bx + bgWidth - br, by + bgHeight);
        ctx.lineTo(bx + br, by + bgHeight);
        ctx.quadraticCurveTo(bx, by + bgHeight, bx, by + bgHeight - br);
        ctx.lineTo(bx, by + br);
        ctx.quadraticCurveTo(bx, by, bx + br, by);
        ctx.closePath();
        ctx.fill();

        // Line 1 — AP name, bold white
        ctx.font = "bold " + nameFontSize + "px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(labelName, textX, textY);

        // Line 2 — channel, smaller muted cyan
        ctx.font = nameFontSize + "px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(labelCh, textX, textY + lineHeight);

        ctx.fillStyle = "#e5e7eb"; // restore default fill
        ctx.globalAlpha = 1.0; // restore global alpha
      }
    } // End of legacy antenna rendering (skipped when Three.js is active)


  }

  
  return {
    renderGroundPlane: renderGroundPlane,
    renderFloorPlanesOnCanvas: renderFloorPlanesOnCanvas,
    renderWallsOnCanvas: renderWallsOnCanvas,
    renderAntennasOnCanvas: renderAntennasOnCanvas
  };
})();

window.renderGroundPlane = CanvasRenderers.renderGroundPlane;
window.renderFloorPlanesOnCanvas = CanvasRenderers.renderFloorPlanesOnCanvas;
window.renderWallsOnCanvas = CanvasRenderers.renderWallsOnCanvas;
window.renderAntennasOnCanvas = CanvasRenderers.renderAntennasOnCanvas;