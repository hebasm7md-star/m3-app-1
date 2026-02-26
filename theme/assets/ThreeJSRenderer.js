//
// ThreeJSRenderer.js
// Sets up and manages the Three.js 3D scene - camera, lights, wall/floor/
// antenna meshes, and 3D mouse interaction (pan, rotate, zoom, select).
//
// All functions are exposed on window for global access.
//
// Depends on: Three.js CDN library, global state, canvas, draw,
//             hexToRgb (ColorSystem), renderAPs/renderApDetails (monolith)
//
// Called by:
//   window.load/setTimeout - initThreeJS
//   draw                   - renderThreeJSScene, updateThreeJSCamera, updateThreeCanvasPointerEvents
//   Internal mouse events  - handleThreeJSMouse* (registered by initThreeJS)
//

(function () {

  // Initialize Three.js scene for 3D rendering
  function initThreeJS() {
    if (!window.THREE || !state.useThreeJS) {
      return;
    }

    try {
      var parent = canvas.parentNode;
      var width = parent.clientWidth - 4;
      var height = parent.clientHeight - 4;

      // Create Three.js renderer (WebGLRenderer creates its own canvas)
      state.threeRenderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      state.threeRenderer.setSize(width, height);
      state.threeRenderer.setPixelRatio(window.devicePixelRatio);

      // Get the canvas element created by Three.js and position it
      state.threeCanvas = state.threeRenderer.domElement;
      state.threeCanvas.style.position = "absolute";
      state.threeCanvas.style.top = "0";
      state.threeCanvas.style.left = "0";
      state.threeCanvas.style.pointerEvents = "none";
      state.threeCanvas.style.zIndex = "1";
      canvas.parentNode.appendChild(state.threeCanvas);
      state.threeRenderer.setSize(width, height);
      state.threeRenderer.setPixelRatio(window.devicePixelRatio);

      // Create scene
      state.threeScene = new THREE.Scene();

      // Create camera (perspective camera matching current 3D view)
      var fov = 50;
      var aspect = width / height;
      var near = 0.1;
      var far = 1000;
      state.threeCamera = new THREE.PerspectiveCamera(
        fov,
        aspect,
        near,
        far
      );

      // Set initial camera position to match current 3D view
      updateThreeJSCamera();

      // Add ambient light
      var ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      state.threeScene.add(ambientLight);

      // Add directional light
      var directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
      directionalLight.position.set(10, 10, 10);
      state.threeScene.add(directionalLight);

      // Initialize raycaster for mouse interaction
      state.threeRaycaster = new THREE.Raycaster();

      // Make Three.js canvas receive mouse events ONLY in 3D mode
      // In 2D mode, pointer-events should be 'none' to allow main canvas interactions
      updateThreeCanvasPointerEvents();

      // Add mouse event handlers for Three.js canvas antenna interaction
      state.threeCanvas.addEventListener(
        "mousedown",
        handleThreeJSMouseDown
      );
      state.threeCanvas.addEventListener(
        "mousemove",
        handleThreeJSMouseMove
      );
      state.threeCanvas.addEventListener("mouseup", handleThreeJSMouseUp);
      state.threeCanvas.addEventListener("wheel", handleThreeJSWheel);

      // Prevent context menu on right click in 3D mode (especially during rotation)
      state.threeCanvas.addEventListener("contextmenu", function (e) {
        if (
          state.viewMode === "3d" ||
          state.viewModeTransition > 0.5 ||
          state.isRotating3D
        ) {
          e.preventDefault();
        }
      });

      console.log("Three.js initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Three.js:", error);
      state.useThreeJS = false;
    }
  }

  // Update Three.js camera to match current 3D view settings
  function updateThreeJSCamera() {
    if (!state.threeCamera || !state.threeRenderer) return;

    var parent = canvas.parentNode;
    var width = parent.clientWidth - 4;
    var height = parent.clientHeight - 4;

    // Match the legacy 3D projection used by projectToCanvas3D
    // Legacy 3D space (before projection) is:
    //   X = worldX - w/2  (centered)
    //   Z = (worldY - h/2)  (centered, flipped on y-axis)
    //   Y = height
    var zoom = state.cameraZoom || 1;
    var panX = state.cameraPanX || 0;
    var panY = state.cameraPanY || 0;
    var rotX = state.cameraRotationX || 0;
    var rotY = state.cameraRotationY || 0;

    // Zoom behavior: legacy multiplies coordinates by zoom (bigger zoom = zoom IN)
    // For camera, that means moving CLOSER when zoom increases
    var distance = 20 / Math.max(zoom, 0.01);

    // In legacy projection, pan is applied AFTER rotation but BEFORE projection
    // So panX/Y are in rotated space, not world space
    // We need to apply pan in the rotated coordinate system

    // Start camera on +Z axis (looking down), then rotate around center
    var cam = new THREE.Vector3(0, 0, distance);
    cam.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    cam.applyAxisAngle(new THREE.Vector3(1, 0, 0), rotX);

    // Lift camera a bit to match legacy view
    cam.y += 10;

    // Apply pan in rotated space (after rotation, matching projectToCanvas3D)
    // panX affects X axis, panY affects Z axis in rotated space
    // Create pan vector in rotated space
    var panVec = new THREE.Vector3(panX, 0, panY); // panY matches flipped y-axis
    // Rotate pan vector to match camera rotation
    panVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    panVec.applyAxisAngle(new THREE.Vector3(1, 0, 0), rotX);

    // Apply pan to camera position
    cam.add(panVec);

    // Look-at point also needs pan applied in rotated space
    var lookAt = new THREE.Vector3(0, 0, 0);
    lookAt.add(panVec);

    state.threeCamera.position.copy(cam);
    state.threeCamera.up.set(0, 1, 0);
    state.threeCamera.lookAt(lookAt);

    // Update renderer size
    state.threeRenderer.setSize(width, height);
    state.threeCamera.aspect = width / height;
    state.threeCamera.updateProjectionMatrix();
  }

  // Update Three.js canvas pointer-events and visibility based on view mode
  function updateThreeCanvasPointerEvents() {
    if (!state.threeCanvas) return;

    var transition = state.viewModeTransition || 0;

    // Use opacity for smooth transition between 2D and 3D
    // transition: 0 = 2D, 1 = 3D
    if (transition > 0 && state.useThreeJS && state.activeSection !== 'xd') {
      // Fade in Three.js canvas as transition increases
      state.threeCanvas.style.opacity = transition;
      state.threeCanvas.style.display = "block";

      // Only capture pointer events when transition is significant (> 0.5)
      // This prevents interference with 2D interactions during early transition
      if (transition > 0.5) {
        state.threeCanvas.style.pointerEvents = "auto";
      } else {
        state.threeCanvas.style.pointerEvents = "none";
      }
    } else {
      // Fully hidden in pure 2D mode
      state.threeCanvas.style.opacity = 0;
      state.threeCanvas.style.pointerEvents = "none";
      // Keep display: block so opacity transitions work smoothly
      state.threeCanvas.style.display = "block";
    }
  }

  // Handle wheel events on Three.js canvas - forward to main canvas
  function handleThreeJSWheel(e) {
    // Forward wheel events to main canvas for zoom
    var mainEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: e.clientX,
      clientY: e.clientY,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
      deltaMode: e.deltaMode,
    });
    canvas.dispatchEvent(mainEvent);
  }

  // Handle mouse down on Three.js canvas for antenna interaction
  function handleThreeJSMouseDown(e) {
    // Only handle if in 3D mode and Three.js is active
    if (
      !state.useThreeJS ||
      !state.threeRenderer ||
      !state.threeScene ||
      state.viewModeTransition <= 0.5 ||
      state.addingAP ||
      state.addingWall
    ) {
      return; // Let main canvas handle it
    }

    // Camera controls - always let these pass through to main canvas
    if (e.button === 1 || e.button === 2) {
      // Prevent context menu on right click in 3D mode
      if (e.button === 2) {
        e.preventDefault();
      }
      // Forward to main canvas for camera controls
      var mainEvent = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: e.clientX,
        clientY: e.clientY,
        button: e.button,
        buttons: e.buttons,
      });
      canvas.dispatchEvent(mainEvent);
      return;
    }

    // Also skip if camera controls are active
    if (state.isPanning3D || state.isRotating3D) {
      return;
    }

    // Get mouse position relative to Three.js canvas
    var rect = state.threeCanvas.getBoundingClientRect();
    var mouse = new THREE.Vector2();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast to find clicked antenna
    state.threeRaycaster.setFromCamera(mouse, state.threeCamera);
    var antennaMeshes = [];
    for (var key in state.threeObjects) {
      if (key.startsWith("antenna_")) {
        antennaMeshes.push(state.threeObjects[key]);
      }
    }
    var intersects = state.threeRaycaster.intersectObjects(antennaMeshes);

    if (intersects.length > 0) {
      var hitMesh = intersects[0].object;
      var ap = hitMesh.userData.antenna;

      if (ap) {
        // Store for drag - create a copy to avoid modifying original
        saveState();
        state.drag = {
          id: ap.id,
          x: ap.x,
          y: ap.y,
          z: ap.z || 2.5,
          tx: ap.tx,
          gt: ap.gt,
          ch: ap.ch,
          enabled: ap.enabled,
          azimuth: ap.azimuth,
          tilt: ap.tilt,
          antennaPattern: ap.antennaPattern,
        };
        // Prevent dragging during optimization
        /*if (state.isOptimizing) {
        alert("Cannot move antennas while optimization is in progress. Please wait for optimization to complete.");
        return;
        }*/

        state.dragStartWorld = { x: ap.x, y: ap.y };
        state.dragStartScreen = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        state.isDraggingAntenna = true;
        
        // Invalidate cached heatmap IMMEDIATELY when drag starts to prevent deformed pattern flash
        // The heatmap will be recalculated in real-time during drag in the draw() function
        if (state.heatmapUpdateRequestId !== null) {
          cancelAnimationFrame(state.heatmapUpdateRequestId);
          state.heatmapUpdateRequestId = null;
        }
        state.cachedHeatmap = null; // Clear cache to prevent using stale heatmap with old positions
        state.cachedHeatmapAntennaCount = 0; // Reset validation count
        state.heatmapUpdatePending = true; // Set pending to prevent using any stale cache
        state.heatmapWorkerCallback = null; // Clear any pending worker callback
        
        e.preventDefault();
        e.stopPropagation();
        return; // Don't let event propagate
      }
    }

    // If no antenna was clicked, let the event pass through to main canvas for camera controls
    // Don't prevent default or stop propagation - let main canvas handle it
  }

  // Handle mouse move on Three.js canvas for antenna dragging
  function handleThreeJSMouseMove(e) {
    // If camera controls are active, let main canvas handle it
    if (state.isPanning3D || state.isRotating3D) {
      var mainEvent = new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        clientX: e.clientX,
        clientY: e.clientY,
        buttons: e.buttons,
      });
      canvas.dispatchEvent(mainEvent);
      return;
    }

    if (!state.drag || !state.isDraggingAntenna || !state.useThreeJS) {
      return;
    }

    // Convert mouse position to world coordinates
    var rect = state.threeCanvas.getBoundingClientRect();
    var mouse = new THREE.Vector2();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast to ground plane (z=0) to get world position
    state.threeRaycaster.setFromCamera(mouse, state.threeCamera);
    var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    var intersectPoint = new THREE.Vector3();
    state.threeRaycaster.ray.intersectPlane(groundPlane, intersectPoint);

    // Convert from legacy centered space back to world coordinates
    var worldX = intersectPoint.x + state.w / 2;
    var worldY = intersectPoint.z + state.h / 2; // Flip y-axis back

    // Update antenna position in drag state
    state.drag.x = Math.max(0, Math.min(state.w, worldX));
    state.drag.y = Math.max(0, Math.min(state.h, worldY));

    // Also update the antenna in state.aps for consistency
    for (var i = 0; i < state.aps.length; i++) {
      if (state.aps[i].id === state.drag.id) {
        state.aps[i].x = state.drag.x;
        state.aps[i].y = state.drag.y;
        break;
      }
    }

    // DON'T invalidate heatmap cache during drag - keep using cached heatmap for smooth movement
    // Cache will be invalidated when drag ends (in mouseup handler)

    // draw() will call renderThreeJSScene() which will use state.drag position
    draw();
    e.preventDefault();
    e.stopPropagation();
  }

  // Handle mouse up on Three.js canvas
  function handleThreeJSMouseUp(e) {
    // If camera controls are active, forward to main canvas
    if (
      state.isPanning3D ||
      state.isRotating3D ||
      e.button === 1 ||
      e.button === 2
    ) {
      var mainEvent = new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        clientX: e.clientX,
        clientY: e.clientY,
        button: e.button,
        buttons: e.buttons,
      });
      canvas.dispatchEvent(mainEvent);
      return;
    }

    if (state.drag && state.isDraggingAntenna) {
      // Select antenna on click (if it was a click, not a drag)
      var wasClick =
        state.mouseDownPos &&
        Math.abs(e.clientX - state.mouseDownPos.x) < 5 &&
        Math.abs(e.clientY - state.mouseDownPos.y) < 5;

      if (wasClick) {
        state.selectedApId = state.drag.id;
        renderAPs();
        renderApDetails();
      }

      // Enqueue antenna after drag ends in 3D
      for (var i = 0; i < state.aps.length; i++) {
        if (state.aps[i].id === state.drag.id) {
          scheduleAntennaEnqueue(state.aps[i]);
          break;
        }
      }

      state.isDraggingAntenna = false;
      // Trigger async heatmap update immediately - start with low-res for fast feedback
      // Cancel any pending updates and invalidate cache IMMEDIATELY to prevent deformed pattern flash
      if (state.heatmapUpdateRequestId !== null) {
        cancelAnimationFrame(state.heatmapUpdateRequestId);
        state.heatmapUpdateRequestId = null;
      }
      state.cachedHeatmap = null; // Invalidate cache
      state.cachedHeatmapAntennaCount = 0; // Reset validation count
      state.heatmapUpdatePending = true; // Set pending to prevent using stale cache
      state.heatmapWorkerCallback = null; // Clear any pending worker callback
      // Use setTimeout with 0 delay to ensure it runs after current execution
      // Start with low-res for immediate visual feedback, then refine
      setTimeout(function () {
        generateHeatmapAsync(null, true); // true = use low-res first
      }, 0);
      state.drag = null;
      draw();
    }
  }

  // Render 3D scene with Three.js (called from draw() when transition > 0)
  function renderThreeJSScene(transition, heatmapCanvas) {
    if (
      !state.useThreeJS ||
      !state.threeScene ||
      !state.threeRenderer ||
      !state.threeCamera
    ) {
      return;
    }

    // Optimization: During antenna dragging, update antenna positions AND heatmap texture in real-time
    var isDraggingAntenna = state.isDraggingAntenna && state.drag;
    if (isDraggingAntenna) {
      // Check if meshes exist - if not, fall through to full rebuild
      var hasMeshes = false;
      for (var i = 0; i < state.aps.length; i++) {
        var ap = state.aps[i];
        if (ap.enabled === false) continue;
        var antennaKey = "antenna_" + ap.id;
        if (state.threeObjects[antennaKey]) {
          hasMeshes = true;
          break;
        }
      }

      if (hasMeshes) {
        // Update antenna positions during drag
        for (var i = 0; i < state.aps.length; i++) {
          var ap = state.aps[i];
          if (ap.enabled === false) continue;

          var antennaKey = "antenna_" + ap.id;
          var mesh = state.threeObjects[antennaKey];
          if (mesh) {
            var isDragged = state.drag && state.drag.id === ap.id;
            var renderAp = isDragged ? state.drag : ap;

            if (renderAp && renderAp.x !== undefined && renderAp.y !== undefined) {
              var antennaHeight = renderAp.z || 2.5;
              var legacyX = renderAp.x - state.w / 2;
              var legacyZ = (renderAp.y - state.h / 2); // Flip on y-axis
              var legacyY = antennaHeight;
              mesh.position.set(legacyX, legacyY, legacyZ);
            }
          }
        }

        // CRITICAL: Update heatmap texture during drag for real-time pattern movement
        if (heatmapCanvas && state.showVisualization && state.threeObjects.heatmap) {
          var heatmapMesh = state.threeObjects.heatmap;
          if (heatmapMesh.material && heatmapMesh.material.map) {
            // Update existing texture with new heatmap canvas
            heatmapMesh.material.map.image = heatmapCanvas;
            heatmapMesh.material.map.needsUpdate = true;
          } else {
            // Create new texture if it doesn't exist
            var texture = new THREE.CanvasTexture(heatmapCanvas);
            texture.flipY = true; // Flip texture vertically to fix upside-down display
            texture.needsUpdate = true;
            if (heatmapMesh.material) {
              heatmapMesh.material.map = texture;
              heatmapMesh.material.needsUpdate = true;
            }
          }
        } else if (heatmapCanvas && state.showVisualization && !state.threeObjects.heatmap) {
          // Heatmap doesn't exist yet, create it
          var texture = new THREE.CanvasTexture(heatmapCanvas);
          texture.flipY = true; // Flip texture vertically to fix upside-down display
          texture.needsUpdate = true;
          var geometry = new THREE.PlaneGeometry(state.w, state.h);
          var material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
          });
          var plane = new THREE.Mesh(geometry, material);
          plane.rotation.x = -Math.PI / 2;
          plane.scale.z = 1;
          // Render at 0m (ground) but heatmap is calculated at 1.5m
          plane.position.set(0, 0, 0);
          state.threeScene.add(plane);
          state.threeObjects.heatmap = plane;
        }

        // Render with updated positions and heatmap
        state.threeRenderer.render(state.threeScene, state.threeCamera);
        return;
      }
      // If meshes don't exist yet, fall through to full rebuild
    }

    // Clear previous objects (we'll rebuild each frame for now)
    // In production, you'd want to update objects instead of clearing
    var keys = Object.keys(state.threeObjects);
    for (var i = 0; i < keys.length; i++) {
      state.threeScene.remove(state.threeObjects[keys[i]]);
      // Don't dispose cached geometries and textures
      if (state.threeObjects[keys[i]].geometry && !state.threeObjects[keys[i]]._isCached) {
        state.threeObjects[keys[i]].geometry.dispose();
      }
      if (state.threeObjects[keys[i]].material) {
        // Don't dispose cached textures
        if (state.threeObjects[keys[i]].material.map && !state.threeObjects[keys[i]].material.map._isCached) {
          state.threeObjects[keys[i]].material.map.dispose();
        }
        state.threeObjects[keys[i]].material.dispose();
      }
    }
    state.threeObjects = {};

    // Render heatmap as texture plane at ground level (0m)
    // Note: Heatmap is calculated at 1.5m but displayed at 0m
    // IMPORTANT: Use the SAME centered + inverted-Z space as projectToCanvas3D:
    //   X = worldX - w/2
    //   Z = -(worldY - h/2)
    //   Y = height
    if (heatmapCanvas && state.showVisualization) {
      var texture = new THREE.CanvasTexture(heatmapCanvas);
      texture.needsUpdate = true;

      // Create plane geometry matching world dimensions
      var geometry = new THREE.PlaneGeometry(state.w, state.h);

      // Flip texture vertically to fix upside-down display
      texture.flipY = true;

      var material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      });
      var plane = new THREE.Mesh(geometry, material);

      // Rotate to horizontal (lying flat on XZ plane)
      plane.rotation.x = -Math.PI / 2;
      // No flip needed - texture orientation matches 3D plane
      plane.scale.z = 1;

      // Centered world origin in legacy space is (0,0,0) at (w/2,h/2) on the 2D plan
      // Render at 0m (ground) but heatmap is calculated at 1.5m
      plane.position.set(0, 0, 0);

      state.threeScene.add(plane);
      state.threeObjects.heatmap = plane;
    }

    // Render floor planes
    for (var i = 0; i < state.floorPlanes.length; i++) {
      var fp = state.floorPlanes[i];
      var baseHeight = fp.height || 0;
      var planeType = fp.type || "horizontal";

      // Calculate Z for each corner
      var getZForPoint = function (x, y) {
        if (planeType === "horizontal") {
          return baseHeight;
        } else {
          var inclination = ((fp.inclination || 0) * Math.PI) / 180;
          var direction = ((fp.inclinationDirection || 0) * Math.PI) / 180;
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

      // Convert floor plane coordinates to legacy centered space
      var convertToLegacy = function (worldX, worldY, height) {
        return {
          x: worldX - state.w / 2,
          z: (worldY - state.h / 2), // Flip on y-axis
          y: height,
        };
      };

      var p1 = convertToLegacy(fp.p1.x, fp.p1.y, z1);
      var p2 = convertToLegacy(fp.p2.x, fp.p2.y, z2);
      var p3 = convertToLegacy(fp.p3.x, fp.p3.y, z3);
      var p4 = convertToLegacy(fp.p4.x, fp.p4.y, z4);

      var geometry = new THREE.BufferGeometry();
      var vertices = new Float32Array([
        p1.x,
        p1.y,
        p1.z,
        p2.x,
        p2.y,
        p2.z,
        p3.x,
        p3.y,
        p3.z,
        p1.x,
        p1.y,
        p1.z,
        p3.x,
        p3.y,
        p3.z,
        p4.x,
        p4.y,
        p4.z,
      ]);
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(vertices, 3)
      );

      var material = new THREE.MeshBasicMaterial({
        color: 0x8b8b8b,
        side: THREE.DoubleSide,
      });
      var mesh = new THREE.Mesh(geometry, material);
      state.threeScene.add(mesh);
      state.threeObjects["floorPlane_" + i] = mesh;
    }

    // Render walls
    var wallHeight = state.wallHeight || 2.5;

    // First pass: render regular walls (skip doors/windows for now)
    for (var i = 0; i < state.walls.length; i++) {
      var w = state.walls[i];

      // Skip doors and windows in first pass - they'll be rendered embedded in parent walls
      if (
        w.elementType === "door" ||
        w.elementType === "doubleDoor" ||
        w.elementType === "window"
      ) {
        continue;
      }

      // Get wall color from wall object or elementTypes (do this once per wall)
      var wallColor = w.color; // Try direct color property first

      // If no direct color, try to get from elementTypes based on type/elementType
      if (!wallColor) {
        if (
          w.elementType === "wall" &&
          w.type &&
          elementTypes.wall &&
          elementTypes.wall[w.type]
        ) {
          wallColor = elementTypes.wall[w.type].color;
        } else if (w.elementType && elementTypes[w.elementType]) {
          wallColor = elementTypes[w.elementType].color;
        } else if (
          w.type &&
          elementTypes.wall &&
          elementTypes.wall[w.type]
        ) {
          wallColor = elementTypes.wall[w.type].color;
        } else if (w.type && wallTypes[w.type]) {
          wallColor = wallTypes[w.type].color;
        }
      }

      // Default to gray if still no color found
      if (!wallColor) {
        wallColor = "#cccccc";
      }

      // Convert hex color to Three.js color (0xRRGGBB format)
      var threeColor = 0xcccccc; // Default gray
      if (
        wallColor &&
        typeof wallColor === "string" &&
        wallColor.startsWith("#")
      ) {
        threeColor = parseInt(wallColor.substring(1), 16);
      } else if (wallColor && typeof wallColor === "number") {
        threeColor = wallColor;
      }

      // Use blue for selected walls, otherwise use material color
      var finalColor = w.selected ? 0x0066ff : threeColor;

      var material = new THREE.MeshBasicMaterial({
        color: finalColor,
      });

      var wallThickness = 0.1;
      var segmentPairs = [];

      // Determine which point pairs to render
      if (w.points && w.points.length >= 2) {
        // For continuous polyline walls, render each consecutive segment
        for (var segIdx = 0; segIdx < w.points.length - 1; segIdx++) {
          segmentPairs.push({
            p1: w.points[segIdx],
            p2: w.points[segIdx + 1]
          });
        }
      } else if (w.p1 && w.p2) {
        // Single segment wall
        segmentPairs.push({
          p1: w.p1,
          p2: w.p2
        });
      } else {
        continue;
      }

      // Render each segment
      for (var segIdx = 0; segIdx < segmentPairs.length; segIdx++) {
        var renderP1 = segmentPairs[segIdx].p1;
        var renderP2 = segmentPairs[segIdx].p2;

        var geometry = new THREE.BoxGeometry(
          Math.hypot(renderP2.x - renderP1.x, renderP2.y - renderP1.y),
          wallHeight,
          wallThickness
        );

        var mesh = new THREE.Mesh(geometry, material);

        // Convert wall coordinates to legacy centered space
        var centerWorldX = (renderP1.x + renderP2.x) / 2;
        var centerWorldY = (renderP1.y + renderP2.y) / 2;
        var centerLegacyX = centerWorldX - state.w / 2;
        var centerLegacyZ = (centerWorldY - state.h / 2); // Flip on y-axis
        var centerLegacyY = wallHeight / 2;

        var angle = Math.atan2(
          renderP2.y - renderP1.y,
          renderP2.x - renderP1.x
        );

        mesh.position.set(centerLegacyX, centerLegacyY, centerLegacyZ);
        mesh.rotation.y = angle;

        state.threeScene.add(mesh);
        
        // Store mesh with segment index for multi-segment walls
        var objectKey = segmentPairs.length > 1 
          ? "wall_" + i + "_seg_" + segIdx 
          : "wall_" + i;
        state.threeObjects[objectKey] = mesh;
      }
    }

    // Second pass: render doors and windows embedded in their parent walls
    for (var i = 0; i < state.walls.length; i++) {
      var w = state.walls[i];

      // Only process doors and windows
      if (
        w.elementType !== "door" &&
        w.elementType !== "doubleDoor" &&
        w.elementType !== "window"
      ) {
        continue;
      }

      var renderP1, renderP2;
      if (w.p1 && w.p2) {
        renderP1 = w.p1;
        renderP2 = w.p2;
      } else {
        continue;
      }

      // Find the parent wall that this door/window is on
      // Check which wall segment the door/window's center point is closest to
      var doorCenterX = (renderP1.x + renderP2.x) / 2;
      var doorCenterY = (renderP1.y + renderP2.y) / 2;

      // Calculate door angle for alignment check
      var doorDx = renderP2.x - renderP1.x;
      var doorDy = renderP2.y - renderP1.y;
      var doorAngle = Math.atan2(doorDy, doorDx);

      var parentWall = null;
      var closestSeg = null;
      var minDist = Infinity;

      // Reduced threshold from 5 to 0.5 to prevent snapping to far walls
      // and added angle alignment check to prevent snapping to perpendicular walls
      var snapThreshold = 0.5;

      for (var j = 0; j < state.walls.length; j++) {
        var wall = state.walls[j];
        // Skip doors/windows when looking for parent wall
        if (
          wall.elementType === "door" ||
          wall.elementType === "doubleDoor" ||
          wall.elementType === "window"
        ) {
          continue;
        }

        // Get segments for this wall
        var wallSegments = [];
        if (wall.points && wall.points.length >= 2) {
          for (var k = 0; k < wall.points.length - 1; k++) {
            wallSegments.push({
              p1: wall.points[k],
              p2: wall.points[k + 1],
            });
          }
        } else if (wall.p1 && wall.p2) {
          wallSegments.push({ p1: wall.p1, p2: wall.p2 });
        }

        // Find distance from door center to each wall segment
        for (var k = 0; k < wallSegments.length; k++) {
          var seg = wallSegments[k];
          var dx = seg.p2.x - seg.p1.x;
          var dy = seg.p2.y - seg.p1.y;

          // Check angular alignment - must be roughly parallel
          // We use sin(diff) because sin(0) = 0 and sin(PI) = 0 (parallel)
          // sin(PI/2) = 1 (perpendicular)
          var wallAngle = Math.atan2(dy, dx);
          var parallelFactor = Math.abs(Math.sin(doorAngle - wallAngle));

          // Allow ~15 degrees deviation (sin(15deg) ~= 0.26)
          if (parallelFactor > 0.26) continue;

          var l2 = dx * dx + dy * dy;
          if (l2 > 0) {
            var t =
              ((doorCenterX - seg.p1.x) * dx +
                (doorCenterY - seg.p1.y) * dy) /
              l2;
            t = Math.max(0, Math.min(1, t));
            var projX = seg.p1.x + t * dx;
            var projY = seg.p1.y + t * dy;
            var dist = Math.sqrt(
              (doorCenterX - projX) * (doorCenterX - projX) +
              (doorCenterY - projY) * (doorCenterY - projY)
            );

            if (dist < minDist && dist < snapThreshold) {
              minDist = dist;
              parentWall = wall;
              closestSeg = seg;
            }
          }
        }
      }

      // Apply result
      var wallP1, wallP2;

      if (parentWall && closestSeg) {
        wallP1 = closestSeg.p1;
        wallP2 = closestSeg.p2;
      } else {
        // No suitable parent wall found (too far or wrong angle)
        // Fallback to door's own coordinates
        wallP1 = renderP1;
        wallP2 = renderP2;
      }

      // Get element-specific properties
      var elementHeight =
        w.height ||
        (w.elementType === "door" || w.elementType === "doubleDoor"
          ? 2.1
          : 1.2);
      var elementBottomZ = w.elementType === "window" ? 0.9 : 0.01;

      // Calculate wall direction using parent wall segment or door's own coordinates
      var dx = wallP2.x - wallP1.x;
      var dy = wallP2.y - wallP1.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      // Use door/window's own length, but parent wall's angle
      var doorLen = Math.sqrt(
        (renderP2.x - renderP1.x) * (renderP2.x - renderP1.x) +
        (renderP2.y - renderP1.y) * (renderP2.y - renderP1.y)
      );

      // Doors and windows should be embedded in the wall, so use same thickness as wall
      var wallThickness = 0.1;

      // Create geometry for door/window - same thickness as wall to embed properly
      var geometry = new THREE.BoxGeometry(
        doorLen,
        elementHeight,
        wallThickness
      );

      // Get color for door/window
      var wallColor = w.color;
      if (!wallColor && w.elementType && elementTypes[w.elementType]) {
        wallColor = elementTypes[w.elementType].color;
      }
      if (!wallColor) {
        wallColor =
          w.elementType === "door" || w.elementType === "doubleDoor"
            ? "#8b4513"
            : "#87ceeb";
      }

      // Convert hex color to Three.js color
      var threeColor = 0xcccccc;
      if (
        wallColor &&
        typeof wallColor === "string" &&
        wallColor.startsWith("#")
      ) {
        threeColor = parseInt(wallColor.substring(1), 16);
      }

      var finalColor = w.selected ? 0x0066ff : threeColor;

      var material = new THREE.MeshBasicMaterial({
        color: finalColor,
      });

      var mesh = new THREE.Mesh(geometry, material);

      // Position door/window at its own center point (where it was placed on the wall)
      // But use the parent wall's exact angle to ensure it's aligned with the wall
      var doorCenterWorldX = (renderP1.x + renderP2.x) / 2;
      var doorCenterWorldY = (renderP1.y + renderP2.y) / 2;
      var centerLegacyX = doorCenterWorldX - state.w / 2;
      var centerLegacyZ = (doorCenterWorldY - state.h / 2); // Flip on y-axis
      var centerLegacyY = elementBottomZ + elementHeight / 2;

      // Use parent wall's exact angle to ensure perfect alignment with the wall
      var angle = Math.atan2(wallP2.y - wallP1.y, wallP2.x - wallP1.x);

      // Position at door/window's center, but with wall's angle
      // This embeds the door/window inside the wall since it's on the same line
      mesh.position.set(centerLegacyX, centerLegacyY, centerLegacyZ);
      mesh.rotation.y = angle;

      // Make door/window slightly thicker than wall to ensure it's visible and embedded
      // This makes it protrude slightly from both sides, clearly showing it's inside the wall
      mesh.scale.z = 1.2; // 20% thicker to ensure it's clearly visible inside the wall

      state.threeScene.add(mesh);
      state.threeObjects["doorWindow_" + i] = mesh;
    }

    // Render antennas
    // IMPORTANT: Convert to legacy centered coordinate system to match projectToCanvas3D:
    //   X = worldX - w/2
    //   Z = (worldY - h/2)  (flipped on y-axis)
    //   Y = height (use actual antenna height, not coverage height)
    for (var i = 0; i < state.aps.length; i++) {
      var ap = state.aps[i];
      if (ap.enabled === false) continue;

      // Check if this antenna is being dragged - use drag position if available
      var isDragged =
        state.drag && state.drag.id === ap.id && state.isDraggingAntenna;
      var renderAp = isDragged ? state.drag : ap;

      // Ensure we have valid position
      if (
        !renderAp ||
        renderAp.x === undefined ||
        renderAp.y === undefined
      ) {
        continue; // Skip invalid antennas
      }

      // Use actual antenna height (not coverage height 1.5)
      var antennaHeight = renderAp.z || 2.5;

      // Convert world coordinates to legacy centered space
      var legacyX = renderAp.x - state.w / 2;
      var legacyZ = (renderAp.y - state.h / 2); // Flip on y-axis
      var legacyY = antennaHeight;

      // Helper to create or get cached antenna texture
      function getAntennaTexture(color, highlight) {
        var cacheKey = "stripe_" + color + "_" + (highlight ? "1" : "0");
        if (!state.threeTextureCache[cacheKey]) {
          var canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          var ctx = canvas.getContext('2d');
          var w = 64;
          var h = 64;

          // Fill background with white (replaces transparency)
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);

          // Style
          ctx.fillStyle = color;

          // Draw Vertical Stripes (Equirectangular projection of sectors)
          // Sector 1: -45 to 45 degrees (Center 0) -> Wraps [315, 360] and [0, 45]
          // 360 deg = width 64. 45 deg = 8 pixels.

          // Left part of Sector 1 (0 to 45)
          ctx.fillRect(0, 0, 8, h);
          // Right part of Sector 1 (315 to 360) -> 64-8 = 56
          ctx.fillRect(56, 0, 8, h);

          // Sector 2: 135 to 225 degrees (Center 180)
          // Start: 135/360 * 64 = 24. Width: 90/360 * 64 = 16.
          ctx.fillRect(24, 0, 16, h);

          // Glow if highlighted
          if (highlight) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = color;
            // Redraw to apply shadow
            ctx.fillRect(0, 0, 8, h);
            ctx.fillRect(56, 0, 8, h);
            ctx.fillRect(24, 0, 16, h);
          }

          var texture = new THREE.CanvasTexture(canvas);
          texture._isCached = true; // Mark as cached
          state.threeTextureCache[cacheKey] = texture;
        }
        return state.threeTextureCache[cacheKey];
      }

      var isSelected = ap.id === state.selectedApId;

      // Use mesh material with custom texture for flat orientation
      var color = (isSelected || isDragged) ? '#06b6d4' : '#ff0000';
      var renderColor = (isSelected || isDragged) ? '#06b6d4' : '#000000';

      // Get or create cached texture
      var texture = getAntennaTexture(renderColor, isSelected || isDragged);
      var material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });

      // Use cached SphereGeometry (create once, reuse)
      var geometryCacheKey = "antenna_sphere";
      if (!state.threeGeometryCache[geometryCacheKey]) {
        var geometry = new THREE.SphereGeometry(0.5, 32, 16);
        geometry._isCached = true; // Mark as cached
        state.threeGeometryCache[geometryCacheKey] = geometry;
      }
      var geometry = state.threeGeometryCache[geometryCacheKey];
      var mesh = new THREE.Mesh(geometry, material);

      // Rotate Y 90 degrees to align stripes East-West (matching 2D icon)
      // Default Sphere maps U=0 to +Z (South). We want Stripe 1 at +X (East).
      // +Z -> +X requires -90 (or +270) or +90 rotation?
      // If we rotate +90 around Y: +Z moves to +X.
      mesh.rotation.x = 0;
      mesh.rotation.z = 0;
      mesh.rotation.y = Math.PI / 2;

      mesh.position.set(legacyX, legacyY, legacyZ);
      mesh.userData = { antennaId: ap.id, antenna: renderAp }; // Store current antenna (with drag position if dragging)

      state.threeScene.add(mesh);
      state.threeObjects["antenna_" + ap.id] = mesh;
    }

    // Render the scene
    state.threeRenderer.render(state.threeScene, state.threeCamera);
  }

  // Render a door in 3D
  function renderDoor3D(
    ctx,
    w,
    p1Bottom,
    p2Bottom,
    p1Top,
    p2Top,
    transition,
    isSelected
  ) {
    ctx.globalAlpha = 1.0; // Ensure doors are fully opaque
    var length = hypot(w.p2.x - w.p1.x, w.p2.y - w.p1.y);
    var doorWidth = w.width || 1.2; // Use stored width or default
    var doorHeight = 2.1; // Standard door height in meters
    var frameThickness = 0.1; // Door frame thickness
    var doorDepth = 0.05; // Thickness/depth of the door in 3D (5cm)

    // Calculate door center and direction - door should be aligned with wall
    var centerX = (w.p1.x + w.p2.x) / 2;
    var centerY = (w.p1.y + w.p2.y) / 2;
    var angle = Math.atan2(w.p2.y - w.p1.y, w.p2.x - w.p1.x);
    var perpAngle = angle + Math.PI / 2;

    // Calculate perpendicular offset for thickness
    var depthOffsetX = (Math.cos(perpAngle) * doorDepth) / 2;
    var depthOffsetY = (Math.sin(perpAngle) * doorDepth) / 2;

    // Door frame corners - positioned along the wall line (using angle, not perpAngle)
    var halfWidth = doorWidth / 2;
    // Door extends along the wall direction
    var frameP1 = {
      x: centerX + Math.cos(angle) * halfWidth,
      y: centerY + Math.sin(angle) * halfWidth,
    };
    var frameP2 = {
      x: centerX - Math.cos(angle) * halfWidth,
      y: centerY - Math.sin(angle) * halfWidth,
    };

    // Project frame to 3D
    var frameP1Bottom = projectToCanvas3D(frameP1.x, frameP1.y, 0);
    var frameP2Bottom = projectToCanvas3D(frameP2.x, frameP2.y, 0);
    var frameP1Top = projectToCanvas3D(frameP1.x, frameP1.y, doorHeight);
    var frameP2Top = projectToCanvas3D(frameP2.x, frameP2.y, doorHeight);

    // Interpolate for transition
    var frameP1Bottom_2d = { x: mx(frameP1.x), y: my(frameP1.y) };
    var frameP2Bottom_2d = { x: mx(frameP2.x), y: my(frameP2.y) };
    var frameP1Top_2d = { x: mx(frameP1.x), y: my(frameP1.y) };
    var frameP2Top_2d = { x: mx(frameP2.x), y: my(frameP2.y) };

    var f1b = {
      x:
        frameP1Bottom_2d.x +
        (frameP1Bottom.x - frameP1Bottom_2d.x) * transition,
      y:
        frameP1Bottom_2d.y +
        (frameP1Bottom.y - frameP1Bottom_2d.y) * transition,
    };
    var f2b = {
      x:
        frameP2Bottom_2d.x +
        (frameP2Bottom.x - frameP2Bottom_2d.x) * transition,
      y:
        frameP2Bottom_2d.y +
        (frameP2Bottom.y - frameP2Bottom_2d.y) * transition,
    };
    var f1t = {
      x: frameP1Top_2d.x + (frameP1Top.x - frameP1Top_2d.x) * transition,
      y: frameP1Top_2d.y + (frameP1Top.y - frameP1Top_2d.y) * transition,
    };
    var f2t = {
      x: frameP2Top_2d.x + (frameP2Top.x - frameP2Top_2d.x) * transition,
      y: frameP2Top_2d.y + (frameP2Top.y - frameP2Top_2d.y) * transition,
    };

    // Draw door frame (wood, darker) WITH THICKNESS
    var frameColor = "#654321"; // Dark brown wood
    var rgb = hexToRgb(frameColor);
    var avgDepth =
      (frameP1Bottom.depth +
        frameP2Bottom.depth +
        frameP1Top.depth +
        frameP2Top.depth) /
      4;
    var lightFactor = Math.max(0.4, Math.min(1.0, 0.7 + avgDepth * 0.01));
    var shadedFrameColor =
      "rgb(" +
      Math.round(rgb.r * lightFactor) +
      "," +
      Math.round(rgb.g * lightFactor) +
      "," +
      Math.round(rgb.b * lightFactor) +
      ")";
    var darkerFrameColor =
      "rgb(" +
      Math.round(rgb.r * lightFactor * 0.7) +
      "," +
      Math.round(rgb.g * lightFactor * 0.7) +
      "," +
      Math.round(rgb.b * lightFactor * 0.7) +
      ")";

    // Add thickness to door frame (5cm)
    var frameDepth = 0.05;

    // Calculate front and back positions using perpendicular offset
    var frameP1Front = {
      x: frameP1.x + depthOffsetX,
      y: frameP1.y + depthOffsetY,
    };
    var frameP2Front = {
      x: frameP2.x + depthOffsetX,
      y: frameP2.y + depthOffsetY,
    };
    var frameP1Back = {
      x: frameP1.x - depthOffsetX,
      y: frameP1.y - depthOffsetY,
    };
    var frameP2Back = {
      x: frameP2.x - depthOffsetX,
      y: frameP2.y - depthOffsetY,
    };

    // Project all 8 corners (4 at bottom, 4 at top, front and back for each)
    var fp1bFront_3d = projectToCanvas3D(frameP1Front.x, frameP1Front.y, 0);
    var fp2bFront_3d = projectToCanvas3D(frameP2Front.x, frameP2Front.y, 0);
    var fp1tFront_3d = projectToCanvas3D(
      frameP1Front.x,
      frameP1Front.y,
      doorHeight
    );
    var fp2tFront_3d = projectToCanvas3D(
      frameP2Front.x,
      frameP2Front.y,
      doorHeight
    );

    var fp1bBack_3d = projectToCanvas3D(frameP1Back.x, frameP1Back.y, 0);
    var fp2bBack_3d = projectToCanvas3D(frameP2Back.x, frameP2Back.y, 0);
    var fp1tBack_3d = projectToCanvas3D(
      frameP1Back.x,
      frameP1Back.y,
      doorHeight
    );
    var fp2tBack_3d = projectToCanvas3D(
      frameP2Back.x,
      frameP2Back.y,
      doorHeight
    );

    // Interpolate for transition (2D positions)
    var fp1_2d = { x: mx(frameP1.x), y: my(frameP1.y) };
    var fp2_2d = { x: mx(frameP2.x), y: my(frameP2.y) };

    // Front face corners
    var f1bFront = {
      x: fp1_2d.x + (fp1bFront_3d.x - fp1_2d.x) * transition,
      y: fp1_2d.y + (fp1bFront_3d.y - fp1_2d.y) * transition,
    };
    var f2bFront = {
      x: fp2_2d.x + (fp2bFront_3d.x - fp2_2d.x) * transition,
      y: fp2_2d.y + (fp2bFront_3d.y - fp2_2d.y) * transition,
    };
    var f1tFront = {
      x: fp1_2d.x + (fp1tFront_3d.x - fp1_2d.x) * transition,
      y: fp1_2d.y + (fp1tFront_3d.y - fp1_2d.y) * transition,
    };
    var f2tFront = {
      x: fp2_2d.x + (fp2tFront_3d.x - fp2_2d.x) * transition,
      y: fp2_2d.y + (fp2tFront_3d.y - fp2_2d.y) * transition,
    };

    // Back face corners
    var f1bBack = {
      x: fp1_2d.x + (fp1bBack_3d.x - fp1_2d.x) * transition,
      y: fp1_2d.y + (fp1bBack_3d.y - fp1_2d.y) * transition,
    };
    var f2bBack = {
      x: fp2_2d.x + (fp2bBack_3d.x - fp2_2d.x) * transition,
      y: fp2_2d.y + (fp2bBack_3d.y - fp2_2d.y) * transition,
    };
    var f1tBack = {
      x: fp1_2d.x + (fp1tBack_3d.x - fp1_2d.x) * transition,
      y: fp1_2d.y + (fp1tBack_3d.y - fp1_2d.y) * transition,
    };
    var f2tBack = {
      x: fp2_2d.x + (fp2tBack_3d.x - fp2_2d.x) * transition,
      y: fp2_2d.y + (fp2tBack_3d.y - fp2_2d.y) * transition,
    };

    // Draw frame - all 6 faces for complete 3D volume
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "source-over";

    // Front face
    ctx.beginPath();
    ctx.moveTo(f1tFront.x, f1tFront.y);
    ctx.lineTo(f2tFront.x, f2tFront.y);
    ctx.lineTo(f2bFront.x, f2bFront.y);
    ctx.lineTo(f1bFront.x, f1bFront.y);
    ctx.closePath();
    ctx.fillStyle = shadedFrameColor;
    ctx.fill();

    // Back face
    ctx.beginPath();
    ctx.moveTo(f1bBack.x, f1bBack.y);
    ctx.lineTo(f2bBack.x, f2bBack.y);
    ctx.lineTo(f2tBack.x, f2tBack.y);
    ctx.lineTo(f1tBack.x, f1tBack.y);
    ctx.closePath();
    ctx.fillStyle = shadedFrameColor;
    ctx.fill();

    // Left side face
    ctx.beginPath();
    ctx.moveTo(f1tFront.x, f1tFront.y);
    ctx.lineTo(f1tBack.x, f1tBack.y);
    ctx.lineTo(f1bBack.x, f1bBack.y);
    ctx.lineTo(f1bFront.x, f1bFront.y);
    ctx.closePath();
    ctx.fillStyle = darkerFrameColor;
    ctx.fill();

    // Right side face
    ctx.beginPath();
    ctx.moveTo(f2tFront.x, f2tFront.y);
    ctx.lineTo(f2bFront.x, f2bFront.y);
    ctx.lineTo(f2bBack.x, f2bBack.y);
    ctx.lineTo(f2tBack.x, f2tBack.y);
    ctx.closePath();
    ctx.fillStyle = darkerFrameColor;
    ctx.fill();

    // Top face
    ctx.beginPath();
    ctx.moveTo(f1tFront.x, f1tFront.y);
    ctx.lineTo(f2tFront.x, f2tFront.y);
    ctx.lineTo(f2tBack.x, f2tBack.y);
    ctx.lineTo(f1tBack.x, f1tBack.y);
    ctx.closePath();
    ctx.fillStyle = darkerFrameColor;
    ctx.fill();

    // Bottom face
    ctx.beginPath();
    ctx.moveTo(f1bFront.x, f1bFront.y);
    ctx.lineTo(f1bBack.x, f1bBack.y);
    ctx.lineTo(f2bBack.x, f2bBack.y);
    ctx.lineTo(f2bFront.x, f2bFront.y);
    ctx.closePath();
    ctx.fillStyle = darkerFrameColor;
    ctx.fill();

    ctx.restore();

    // Draw door panel (lighter wood) WITH THICKNESS
    var doorColor = "#8b4513"; // Saddle brown
    var doorRgb = hexToRgb(doorColor);
    var shadedDoorColor =
      "rgb(" +
      Math.round(doorRgb.r * lightFactor * 1.1) +
      "," +
      Math.round(doorRgb.g * lightFactor * 1.1) +
      "," +
      Math.round(doorRgb.b * lightFactor * 1.1) +
      ")";
    var darkerDoorColor =
      "rgb(" +
      Math.round(doorRgb.r * lightFactor * 0.8) +
      "," +
      Math.round(doorRgb.g * lightFactor * 0.8) +
      "," +
      Math.round(doorRgb.b * lightFactor * 0.8) +
      ")";

    // Door panel is slightly inset from frame
    var inset = 0.02;
    var doorP1 = {
      x: frameP1.x - Math.cos(angle) * inset,
      y: frameP1.y - Math.sin(angle) * inset,
    };
    var doorP2 = {
      x: frameP2.x + Math.cos(angle) * inset,
      y: frameP2.y + Math.sin(angle) * inset,
    };

    // Door panel thickness (3cm)
    var panelDepthOffset = 0.015; // half of 3cm
    var pdOffsetX = Math.cos(perpAngle) * panelDepthOffset;
    var pdOffsetY = Math.sin(perpAngle) * panelDepthOffset;

    // Front and back positions for panel
    var dpBottomFront_3d = projectToCanvas3D(
      doorP1.x + pdOffsetX,
      doorP1.y + pdOffsetY,
      0.05
    );
    var dpBottomBack_3d = projectToCanvas3D(
      doorP1.x - pdOffsetX,
      doorP1.y - pdOffsetY,
      0.05
    );
    // wait, p2 too
    var dp1bFront_3d = projectToCanvas3D(
      doorP1.x + pdOffsetX,
      doorP1.y + pdOffsetY,
      0.05
    );
    var dp2bFront_3d = projectToCanvas3D(
      doorP2.x + pdOffsetX,
      doorP2.y + pdOffsetY,
      0.05
    );
    var dp1tFront_3d = projectToCanvas3D(
      doorP1.x + pdOffsetX,
      doorP1.y + pdOffsetY,
      doorHeight - 0.05
    );
    var dp2tFront_3d = projectToCanvas3D(
      doorP2.x + pdOffsetX,
      doorP2.y + pdOffsetY,
      doorHeight - 0.05
    );

    var dp1bBack_3d = projectToCanvas3D(
      doorP1.x - pdOffsetX,
      doorP1.y - pdOffsetY,
      0.05
    );
    var dp2bBack_3d = projectToCanvas3D(
      doorP2.x - pdOffsetX,
      doorP2.y - pdOffsetY,
      0.05
    );
    var dp1tBack_3d = projectToCanvas3D(
      doorP1.x - pdOffsetX,
      doorP1.y - pdOffsetY,
      doorHeight - 0.05
    );
    var dp2tBack_3d = projectToCanvas3D(
      doorP2.x - pdOffsetX,
      doorP2.y - pdOffsetY,
      doorHeight - 0.05
    );

    var d1_2d = { x: mx(doorP1.x), y: my(doorP1.y) };
    var d2_2d = { x: mx(doorP2.x), y: my(doorP2.y) };

    // Interpolated front corners
    var d1bF = {
      x: d1_2d.x + (dp1bFront_3d.x - d1_2d.x) * transition,
      y: d1_2d.y + (dp1bFront_3d.y - d1_2d.y) * transition,
    };
    var d2bF = {
      x: d2_2d.x + (dp2bFront_3d.x - d2_2d.x) * transition,
      y: d2_2d.y + (dp2bFront_3d.y - d2_2d.y) * transition,
    };
    var d1tF = {
      x: d1_2d.x + (dp1tFront_3d.x - d1_2d.x) * transition,
      y: d1_2d.y + (dp1tFront_3d.y - d1_2d.y) * transition,
    };
    var d2tF = {
      x: d2_2d.x + (dp2tFront_3d.x - d2_2d.x) * transition,
      y: d2_2d.y + (dp2tFront_3d.y - d2_2d.y) * transition,
    };

    // Interpolated back corners
    var d1bB = {
      x: d1_2d.x + (dp1bBack_3d.x - d1_2d.x) * transition,
      y: d1_2d.y + (dp1bBack_3d.y - d1_2d.y) * transition,
    };
    var d2bB = {
      x: d2_2d.x + (dp2bBack_3d.x - d2_2d.x) * transition,
      y: d2_2d.y + (dp2bBack_3d.y - d2_2d.y) * transition,
    };
    var d1tB = {
      x: d1_2d.x + (dp1tBack_3d.x - d1_2d.x) * transition,
      y: d1_2d.y + (dp1tBack_3d.y - d1_2d.y) * transition,
    };
    var d2tB = {
      x: d2_2d.x + (dp2tBack_3d.x - d2_2d.x) * transition,
      y: d2_2d.y + (dp2tBack_3d.y - d2_2d.y) * transition,
    };

    // Draw door panel - all faces for 3D thickness
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "source-over";

    // Front face
    ctx.beginPath();
    ctx.moveTo(d1tF.x, d1tF.y);
    ctx.lineTo(d2tF.x, d2tF.y);
    ctx.lineTo(d2bF.x, d2bF.y);
    ctx.lineTo(d1bF.x, d1bF.y);
    ctx.closePath();
    ctx.fillStyle = shadedDoorColor;
    ctx.fill();

    // Back face
    ctx.beginPath();
    ctx.moveTo(d1bB.x, d1bB.y);
    ctx.lineTo(d2bB.x, d2bB.y);
    ctx.lineTo(d2tB.x, d2tB.y);
    ctx.lineTo(d1tB.x, d1tB.y);
    ctx.closePath();
    ctx.fillStyle = shadedDoorColor;
    ctx.fill();

    // Left side face
    ctx.beginPath();
    ctx.moveTo(d1tF.x, d1tF.y);
    ctx.lineTo(d1tB.x, d1tB.y);
    ctx.lineTo(d1bB.x, d1bB.y);
    ctx.lineTo(d1bF.x, d1bF.y);
    ctx.closePath();
    ctx.fillStyle = darkerDoorColor;
    ctx.fill();

    // Right side face
    ctx.beginPath();
    ctx.moveTo(d2tF.x, d2tF.y);
    ctx.lineTo(d2bF.x, d2bF.y);
    ctx.lineTo(d2bB.x, d2bB.y);
    ctx.lineTo(d2tB.x, d2tB.y);
    ctx.closePath();
    ctx.fillStyle = darkerDoorColor;
    ctx.fill();

    // Top face
    ctx.beginPath();
    ctx.moveTo(d1tF.x, d1tF.y);
    ctx.lineTo(d2tF.x, d2tF.y);
    ctx.lineTo(d2tB.x, d2tB.y);
    ctx.lineTo(d1tB.x, d1tB.y);
    ctx.closePath();
    ctx.fillStyle = darkerDoorColor;
    ctx.fill();

    // Bottom face
    ctx.beginPath();
    ctx.moveTo(d1bF.x, d1bF.y);
    ctx.lineTo(d1bB.x, d1bB.y);
    ctx.lineTo(d2bB.x, d2bB.y);
    ctx.lineTo(d2bF.x, d2bF.y);
    ctx.closePath();
    ctx.fillStyle = darkerDoorColor;
    ctx.fill();

    ctx.restore();

    // Draw door handle (small circle) - positioned along the door edge
    var handleX = centerX + Math.cos(angle) * (doorWidth / 2 - 0.1);
    var handleY = centerY + Math.sin(angle) * (doorWidth / 2 - 0.1);
    var handleZ = doorHeight / 2;
    var handle3D = projectToCanvas3D(handleX, handleY, handleZ);
    var handle2D = { x: mx(handleX), y: my(handleY) };
    var handle = {
      x: handle2D.x + (handle3D.x - handle2D.x) * transition,
      y: handle2D.y + (handle3D.y - handle2D.y) * transition,
    };

    // Only draw handle in 3D mode
    if (transition > 0.5) {
      ctx.save();
      ctx.shadowBlur = 0; // Clear any shadow
      ctx.fillStyle = "#c0c0c0"; // Silver handle
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 3, 0, Math.PI * 2); // Fixed 3px radius
      ctx.fill();
      ctx.restore();
    }

    // Draw edges with enhanced glow for selected doors
    if (isSelected) {
      ctx.save();
      // Define the door outline path for stroking
      ctx.beginPath();
      ctx.moveTo(d1t.x, d1t.y);
      ctx.lineTo(d2t.x, d2t.y);
      ctx.lineTo(d2b.x, d2b.y);
      ctx.lineTo(d1b.x, d1b.y);
      ctx.closePath();

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
      ctx.restore();
    }
  }

  // Render a window in 3D
  function renderWindow3D(
    ctx,
    w,
    p1Bottom,
    p2Bottom,
    p1Top,
    p2Top,
    transition,
    isSelected
  ) {
    ctx.globalAlpha = 1.0; // Ensure window frames are fully opaque (glass will be set separately)
    var length = hypot(w.p2.x - w.p1.x, w.p2.y - w.p1.y);
    var windowWidth = w.width || 1.5; // Use stored width or default
    var windowHeight = 1.2; // Standard window height
    var sillHeight = 0.9; // Window sill height from floor

    // Calculate window center and direction - window should be aligned with wall
    var centerX = (w.p1.x + w.p2.x) / 2;
    var centerY = (w.p1.y + w.p2.y) / 2;
    var angle = Math.atan2(w.p2.y - w.p1.y, w.p2.x - w.p1.x);
    var perpAngle = angle + Math.PI / 2;

    // Window frame corners - positioned along the wall line (using angle, not perpAngle)
    var halfWidth = windowWidth / 2;
    // Window extends along the wall direction
    var frameP1 = {
      x: centerX + Math.cos(angle) * halfWidth,
      y: centerY + Math.sin(angle) * halfWidth,
    };
    var frameP2 = {
      x: centerX - Math.cos(angle) * halfWidth,
      y: centerY - Math.sin(angle) * halfWidth,
    };

    // Project frame to 3D
    var frameP1Bottom = projectToCanvas3D(frameP1.x, frameP1.y, sillHeight);
    var frameP2Bottom = projectToCanvas3D(frameP2.x, frameP2.y, sillHeight);
    var frameP1Top = projectToCanvas3D(
      frameP1.x,
      frameP1.y,
      sillHeight + windowHeight
    );
    var frameP2Top = projectToCanvas3D(
      frameP2.x,
      frameP2.y,
      sillHeight + windowHeight
    );

    // Interpolate for transition
    var frameP1Bottom_2d = { x: mx(frameP1.x), y: my(frameP1.y) };
    var frameP2Bottom_2d = { x: mx(frameP2.x), y: my(frameP2.y) };
    var frameP1Top_2d = { x: mx(frameP1.x), y: my(frameP1.y) };
    var frameP2Top_2d = { x: mx(frameP2.x), y: my(frameP2.y) };

    var f1b = {
      x:
        frameP1Bottom_2d.x +
        (frameP1Bottom.x - frameP1Bottom_2d.x) * transition,
      y:
        frameP1Bottom_2d.y +
        (frameP1Bottom.y - frameP1Bottom_2d.y) * transition,
    };
    var f2b = {
      x:
        frameP2Bottom_2d.x +
        (frameP2Bottom.x - frameP2Bottom_2d.x) * transition,
      y:
        frameP2Bottom_2d.y +
        (frameP2Bottom.y - frameP2Bottom_2d.y) * transition,
    };
    var f1t = {
      x: frameP1Top_2d.x + (frameP1Top.x - frameP1Top_2d.x) * transition,
      y: frameP1Top_2d.y + (frameP1Top.y - frameP1Top_2d.y) * transition,
    };
    var f2t = {
      x: frameP2Top_2d.x + (frameP2Top.x - frameP2Top_2d.x) * transition,
      y: frameP2Top_2d.y + (frameP2Top.y - frameP2Top_2d.y) * transition,
    };

    // Draw window frame (white/light colored) WITH THICKNESS
    var frameColor = "#f5f5dc"; // Beige/white frame
    var rgb = hexToRgb(frameColor);
    var avgDepth =
      (frameP1Bottom.depth +
        frameP2Bottom.depth +
        frameP1Top.depth +
        frameP2Top.depth) /
      4;
    var lightFactor = Math.max(0.4, Math.min(1.0, 0.7 + avgDepth * 0.01));
    var shadedFrameColor =
      "rgb(" +
      Math.round(rgb.r * lightFactor) +
      "," +
      Math.round(rgb.g * lightFactor) +
      "," +
      Math.round(rgb.b * lightFactor) +
      ")";
    var darkerFrameColor =
      "rgb(" +
      Math.round(rgb.r * lightFactor * 0.7) +
      "," +
      Math.round(rgb.g * lightFactor * 0.7) +
      "," +
      Math.round(rgb.b * lightFactor * 0.7) +
      ")";

    // Add thickness to window frame (5cm)
    var frameDepth = 0.025; // half depth
    var depthOffsetX = Math.cos(perpAngle) * frameDepth;
    var depthOffsetY = Math.sin(perpAngle) * frameDepth;

    // Frame corners front and back
    var fp1bFront_3d = projectToCanvas3D(
      frameP1.x + depthOffsetX,
      frameP1.y + depthOffsetY,
      sillHeight
    );
    var fp2bFront_3d = projectToCanvas3D(
      frameP2.x + depthOffsetX,
      frameP2.y + depthOffsetY,
      sillHeight
    );
    var fp1tFront_3d = projectToCanvas3D(
      frameP1.x + depthOffsetX,
      frameP1.y + depthOffsetY,
      sillHeight + windowHeight
    );
    var fp2tFront_3d = projectToCanvas3D(
      frameP2.x + depthOffsetX,
      frameP2.y + depthOffsetY,
      sillHeight + windowHeight
    );

    var fp1bBack_3d = projectToCanvas3D(
      frameP1.x - depthOffsetX,
      frameP1.y - depthOffsetY,
      sillHeight
    );
    var fp2bBack_3d = projectToCanvas3D(
      frameP2.x - depthOffsetX,
      frameP2.y - depthOffsetY,
      sillHeight
    );
    var fp1tBack_3d = projectToCanvas3D(
      frameP1.x - depthOffsetX,
      frameP1.y - depthOffsetY,
      sillHeight + windowHeight
    );
    var fp2tBack_3d = projectToCanvas3D(
      frameP2.x - depthOffsetX,
      frameP2.y - depthOffsetY,
      sillHeight + windowHeight
    );

    var f1_2d = { x: mx(frameP1.x), y: my(frameP1.y) };
    var f2_2d = { x: mx(frameP2.x), y: my(frameP2.y) };

    // Interpolated front corners
    var f1bF = {
      x: f1_2d.x + (fp1bFront_3d.x - f1_2d.x) * transition,
      y: f1_2d.y + (fp1bFront_3d.y - f1_2d.y) * transition,
    };
    var f2bF = {
      x: f2_2d.x + (fp2bFront_3d.x - f2_2d.x) * transition,
      y: f2_2d.y + (fp2bFront_3d.y - f2_2d.y) * transition,
    };
    var f1tF = {
      x: f1_2d.x + (fp1tFront_3d.x - f1_2d.x) * transition,
      y: f1_2d.y + (fp1tFront_3d.y - f1_2d.y) * transition,
    };
    var f2tF = {
      x: f2_2d.x + (fp2tFront_3d.x - f2_2d.x) * transition,
      y: f2_2d.y + (fp2tFront_3d.y - f2_2d.y) * transition,
    };

    // Interpolated back corners
    var f1bB = {
      x: f1_2d.x + (fp1bBack_3d.x - f1_2d.x) * transition,
      y: f1_2d.y + (fp1bBack_3d.y - f1_2d.y) * transition,
    };
    var f2bB = {
      x: f2_2d.x + (fp2bBack_3d.x - f2_2d.x) * transition,
      y: f2_2d.y + (fp2bBack_3d.y - f2_2d.y) * transition,
    };
    var f1tB = {
      x: f1_2d.x + (fp1tBack_3d.x - f1_2d.x) * transition,
      y: f1_2d.y + (fp1tBack_3d.y - f1_2d.y) * transition,
    };
    var f2tB = {
      x: f2_2d.x + (fp2tBack_3d.x - f2_2d.x) * transition,
      y: f2_2d.y + (fp2tBack_3d.y - f2_2d.y) * transition,
    };

    // Draw window frame - both faces for visibility
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "source-over";

    // Front face
    ctx.beginPath();
    ctx.moveTo(f1tF.x, f1tF.y);
    ctx.lineTo(f2tF.x, f2tF.y);
    ctx.lineTo(f2bF.x, f2bF.y);
    ctx.lineTo(f1bF.x, f1bF.y);
    ctx.closePath();
    ctx.fillStyle = shadedFrameColor;
    ctx.fill();

    // Back face
    ctx.beginPath();
    ctx.moveTo(f1bB.x, f1bB.y);
    ctx.lineTo(f2bB.x, f2bB.y);
    ctx.lineTo(f2tB.x, f2tB.y);
    ctx.lineTo(f1tB.x, f1tB.y);
    ctx.closePath();
    ctx.fillStyle = shadedFrameColor;
    ctx.fill();

    // Side faces
    ctx.fillStyle = darkerFrameColor;
    // Left
    ctx.beginPath();
    ctx.moveTo(f1tF.x, f1tF.y);
    ctx.lineTo(f1tB.x, f1tB.y);
    ctx.lineTo(f1bB.x, f1bB.y);
    ctx.lineTo(f1bF.x, f1bF.y);
    ctx.closePath();
    ctx.fill();
    // Right
    ctx.beginPath();
    ctx.moveTo(f2tF.x, f2tF.y);
    ctx.lineTo(f2tB.x, f2tB.y);
    ctx.lineTo(f2bB.x, f2bB.y);
    ctx.lineTo(f2bF.x, f2bF.y);
    ctx.closePath();
    ctx.fill();
    // Top
    ctx.beginPath();
    ctx.moveTo(f1tF.x, f1tF.y);
    ctx.lineTo(f2tF.x, f2tF.y);
    ctx.lineTo(f2tB.x, f2tB.y);
    ctx.lineTo(f1tB.x, f1tB.y);
    ctx.closePath();
    ctx.fill();
    // Bottom
    ctx.beginPath();
    ctx.moveTo(f1bF.x, f1bF.y);
    ctx.lineTo(f1bB.x, f1bB.y);
    ctx.lineTo(f2bB.x, f2bB.y);
    ctx.lineTo(f2bF.x, f2bF.y);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Draw glass pane (transparent with slight blue tint) WITH THICKNESS
    var glassP1 = {
      x: frameP1.x - Math.cos(angle) * 0.02,
      y: frameP1.y - Math.sin(angle) * 0.02,
    };
    var glassP2 = {
      x: frameP2.x + Math.cos(angle) * 0.02,
      y: frameP2.y + Math.sin(angle) * 0.02,
    };

    var glassDepth = 0.01; // 1cm glass thickness
    var gDepthOffsetX = Math.cos(perpAngle) * glassDepth;
    var gDepthOffsetY = Math.sin(perpAngle) * glassDepth;

    var gp1bFront_3d = projectToCanvas3D(
      glassP1.x + gDepthOffsetX,
      glassP1.y + gDepthOffsetY,
      sillHeight + 0.05
    );
    var gp2bFront_3d = projectToCanvas3D(
      glassP2.x + gDepthOffsetX,
      glassP2.y + gDepthOffsetY,
      sillHeight + 0.05
    );
    var gp1tFront_3d = projectToCanvas3D(
      glassP1.x + gDepthOffsetX,
      glassP1.y + gDepthOffsetY,
      sillHeight + windowHeight - 0.05
    );
    var gp2tFront_3d = projectToCanvas3D(
      glassP2.x + gDepthOffsetX,
      glassP2.y + gDepthOffsetY,
      sillHeight + windowHeight - 0.05
    );

    var gp1bBack_3d = projectToCanvas3D(
      glassP1.x - gDepthOffsetX,
      glassP1.y - gDepthOffsetY,
      sillHeight + 0.05
    );
    var gp2bBack_3d = projectToCanvas3D(
      glassP2.x - gDepthOffsetX,
      glassP2.y - gDepthOffsetY,
      sillHeight + 0.05
    );
    var gp1tBack_3d = projectToCanvas3D(
      glassP1.x - gDepthOffsetX,
      glassP1.y - gDepthOffsetY,
      sillHeight + windowHeight - 0.05
    );
    var gp2tBack_3d = projectToCanvas3D(
      glassP2.x - gDepthOffsetX,
      glassP2.y - gDepthOffsetY,
      sillHeight + windowHeight - 0.05
    );

    var g1_2d = { x: mx(glassP1.x), y: my(glassP1.y) };
    var g2_2d = { x: mx(glassP2.x), y: my(glassP2.y) };

    var g1bF = {
      x: g1_2d.x + (gp1bFront_3d.x - g1_2d.x) * transition,
      y: g1_2d.y + (gp1bFront_3d.y - g1_2d.y) * transition,
    };
    var g2bF = {
      x: g2_2d.x + (gp2bFront_3d.x - g2_2d.x) * transition,
      y: g2_2d.y + (gp2bFront_3d.y - g2_2d.y) * transition,
    };
    var g1tF = {
      x: g1_2d.x + (gp1tFront_3d.x - g1_2d.x) * transition,
      y: g1_2d.y + (gp1tFront_3d.y - g1_2d.y) * transition,
    };
    var g2tF = {
      x: g2_2d.x + (gp2tFront_3d.x - g2_2d.x) * transition,
      y: g2_2d.y + (gp2tFront_3d.y - g2_2d.y) * transition,
    };

    var g1bB = {
      x: g1_2d.x + (gp1bBack_3d.x - g1_2d.x) * transition,
      y: g1_2d.y + (gp1bBack_3d.y - g1_2d.y) * transition,
    };
    var g2bB = {
      x: g2_2d.x + (gp2bBack_3d.x - g2_2d.x) * transition,
      y: g2_2d.y + (gp2bBack_3d.y - g2_2d.y) * transition,
    };
    var g1tB = {
      x: g1_2d.x + (gp1tBack_3d.x - g1_2d.x) * transition,
      y: g1_2d.y + (gp1tBack_3d.y - g1_2d.y) * transition,
    };
    var g2tB = {
      x: g2_2d.x + (gp2tBack_3d.x - g2_2d.x) * transition,
      y: g2_2d.y + (gp2tBack_3d.y - g2_2d.y) * transition,
    };

    // Draw glass
    ctx.save();
    ctx.globalAlpha = 0.3; // Semi-transparent glass
    ctx.globalCompositeOperation = "source-over";

    // Front and Back faces
    ctx.fillStyle = "#87ceeb";
    ctx.beginPath();
    ctx.moveTo(g1tF.x, g1tF.y);
    ctx.lineTo(g2tF.x, g2tF.y);
    ctx.lineTo(g2bF.x, g2bF.y);
    ctx.lineTo(g1bF.x, g1bF.y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(g1bB.x, g1bB.y);
    ctx.lineTo(g2bB.x, g2bB.y);
    ctx.lineTo(g2tB.x, g2tB.y);
    ctx.lineTo(g1tB.x, g1tB.y);
    ctx.closePath();
    ctx.fill();

    // Side faces
    ctx.fillStyle = "#6bb6ff"; // Slightly darker for edges
    // Left
    ctx.beginPath();
    ctx.moveTo(g1tF.x, g1tF.y);
    ctx.lineTo(g1tB.x, g1tB.y);
    ctx.lineTo(g1bB.x, g1bB.y);
    ctx.lineTo(g1bF.x, g1bF.y);
    ctx.closePath();
    ctx.fill();
    // Right
    ctx.beginPath();
    ctx.moveTo(g2tF.x, g2tF.y);
    ctx.lineTo(g2tB.x, g2tB.y);
    ctx.lineTo(g2bB.x, g2bB.y);
    ctx.lineTo(g2bF.x, g2bF.y);
    ctx.closePath();
    ctx.fill();
    // Top
    ctx.beginPath();
    ctx.moveTo(g1tF.x, g1tF.y);
    ctx.lineTo(g2tF.x, g2tF.y);
    ctx.lineTo(g2tB.x, g2tB.y);
    ctx.lineTo(g1tB.x, g1tB.y);
    ctx.closePath();
    ctx.fill();
    // Bottom
    ctx.beginPath();
    ctx.moveTo(g1bF.x, g1bF.y);
    ctx.lineTo(g1bB.x, g1bB.y);
    ctx.lineTo(g2bB.x, g2bB.y);
    ctx.lineTo(g2bF.x, g2bF.y);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Draw window cross (mullions) using front face corners
    var midX = (g1tF.x + g2tF.x) / 2;
    var midY = (g1tF.y + g2tF.y) / 2;
    var midB = {
      x: (g1bF.x + g2bF.x) / 2,
      y: (g1bF.y + g2bF.y) / 2,
    };

    ctx.save();
    ctx.strokeStyle = shadedFrameColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(midB.x, midB.y);
    ctx.stroke();
    ctx.restore();

    // Draw edges with enhanced glow for selected windows
    if (isSelected) {
      ctx.save();
      // Define the window outline path for stroking (using front face)
      ctx.beginPath();
      ctx.moveTo(f1tF.x, f1tF.y);
      ctx.lineTo(f2tF.x, f2tF.y);
      ctx.lineTo(f2bF.x, f2bF.y);
      ctx.lineTo(f1bF.x, f1bF.y);
      ctx.closePath();

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
      ctx.restore();
    }
  }

  // Render a double door in 3D
  function renderDoubleDoor3D(
    ctx,
    w,
    p1Bottom,
    p2Bottom,
    p1Top,
    p2Top,
    transition,
    isSelected
  ) {
    ctx.globalAlpha = 1.0; // Ensure double doors are fully opaque
    // Similar to single door but with two panels
    var length = hypot(w.p2.x - w.p1.x, w.p2.y - w.p1.y);
    var totalWidth = w.width || 2.4; // Use stored width or default
    var doorWidth = totalWidth / 2; // Width per door panel
    var doorHeight = 2.1;

    // Calculate door center and direction - double door should be aligned with wall
    var centerX = (w.p1.x + w.p2.x) / 2;
    var centerY = (w.p1.y + w.p2.y) / 2;
    var angle = Math.atan2(w.p2.y - w.p1.y, w.p2.x - w.p1.x);
    var perpAngle = angle + Math.PI / 2;

    // Double door frame - positioned along the wall line (using angle, not perpAngle)
    var halfWidth = totalWidth / 2;
    // Door extends along the wall direction
    var frameP1 = {
      x: centerX + Math.cos(angle) * halfWidth,
      y: centerY + Math.sin(angle) * halfWidth,
    };
    var frameP2 = {
      x: centerX - Math.cos(angle) * halfWidth,
      y: centerY - Math.sin(angle) * halfWidth,
    };

    // Project and render similar to single door but wider
    var frameP1Bottom = projectToCanvas3D(frameP1.x, frameP1.y, 0);
    var frameP2Bottom = projectToCanvas3D(frameP2.x, frameP2.y, 0);
    var frameP1Top = projectToCanvas3D(frameP1.x, frameP1.y, doorHeight);
    var frameP2Top = projectToCanvas3D(frameP2.x, frameP2.y, doorHeight);

    var frameP1Bottom_2d = { x: mx(frameP1.x), y: my(frameP1.y) };
    var frameP2Bottom_2d = { x: mx(frameP2.x), y: my(frameP2.y) };
    var frameP1Top_2d = { x: mx(frameP1.x), y: my(frameP1.y) };
    var frameP2Top_2d = { x: mx(frameP2.x), y: my(frameP2.y) };

    var f1b = {
      x:
        frameP1Bottom_2d.x +
        (frameP1Bottom.x - frameP1Bottom_2d.x) * transition,
      y:
        frameP1Bottom_2d.y +
        (frameP1Bottom.y - frameP1Bottom_2d.y) * transition,
    };
    var f2b = {
      x:
        frameP2Bottom_2d.x +
        (frameP2Bottom.x - frameP2Bottom_2d.x) * transition,
      y:
        frameP2Bottom_2d.y +
        (frameP2Bottom.y - frameP2Bottom_2d.y) * transition,
    };
    var f1t = {
      x: frameP1Top_2d.x + (frameP1Top.x - frameP1Top_2d.x) * transition,
      y: frameP1Top_2d.y + (frameP1Top.y - frameP1Top_2d.y) * transition,
    };
    var f2t = {
      x: frameP2Top_2d.x + (frameP2Top.x - frameP2Top_2d.x) * transition,
      y: frameP2Top_2d.y + (frameP2Top.y - frameP2Top_2d.y) * transition,
    };

    // Double door frame - WITH THICKNESS
    var frameColor = "#654321";
    var rgb = hexToRgb(frameColor);
    var avgDepth =
      (frameP1Bottom.depth +
        frameP2Bottom.depth +
        frameP1Top.depth +
        frameP2Top.depth) /
      4;
    var lightFactor = Math.max(0.4, Math.min(1.0, 0.7 + avgDepth * 0.01));
    var shadedFrameColor =
      "rgb(" +
      Math.round(rgb.r * lightFactor) +
      "," +
      Math.round(rgb.g * lightFactor) +
      "," +
      Math.round(rgb.b * lightFactor) +
      ")";
    var darkerFrameColor =
      "rgb(" +
      Math.round(rgb.r * lightFactor * 0.7) +
      "," +
      Math.round(rgb.g * lightFactor * 0.7) +
      "," +
      Math.round(rgb.b * lightFactor * 0.7) +
      ")";

    // Add thickness to frame (5cm)
    var frameDepth = 0.025; // half depth
    var fdepthOffsetX = Math.cos(perpAngle) * frameDepth;
    var fdepthOffsetY = Math.sin(perpAngle) * frameDepth;

    // Frame corners front and back
    var fp1bFront_3d = projectToCanvas3D(
      frameP1.x + fdepthOffsetX,
      frameP1.y + fdepthOffsetY,
      0
    );
    var fp2bFront_3d = projectToCanvas3D(
      frameP2.x + fdepthOffsetX,
      frameP2.y + fdepthOffsetY,
      0
    );
    var fp1tFront_3d = projectToCanvas3D(
      frameP1.x + fdepthOffsetX,
      frameP1.y + fdepthOffsetY,
      doorHeight
    );
    var fp2tFront_3d = projectToCanvas3D(
      frameP2.x + fdepthOffsetX,
      frameP2.y + fdepthOffsetY,
      doorHeight
    );

    var fp1bBack_3d = projectToCanvas3D(
      frameP1.x - fdepthOffsetX,
      frameP1.y - fdepthOffsetY,
      0
    );
    var fp2bBack_3d = projectToCanvas3D(
      frameP2.x - fdepthOffsetX,
      frameP2.y - fdepthOffsetY,
      0
    );
    var fp1tBack_3d = projectToCanvas3D(
      frameP1.x - fdepthOffsetX,
      frameP1.y - fdepthOffsetY,
      doorHeight
    );
    var fp2tBack_3d = projectToCanvas3D(
      frameP2.x - fdepthOffsetX,
      frameP2.y - fdepthOffsetY,
      doorHeight
    );

    var f1_2d = { x: mx(frameP1.x), y: my(frameP1.y) };
    var f2_2d = { x: mx(frameP2.x), y: my(frameP2.y) };

    // Interpolated corners
    var f1bF = {
      x: f1_2d.x + (fp1bFront_3d.x - f1_2d.x) * transition,
      y: f1_2d.y + (fp1bFront_3d.y - f1_2d.y) * transition,
    };
    var f2bF = {
      x: f2_2d.x + (fp2bFront_3d.x - f2_2d.x) * transition,
      y: f2_2d.y + (fp2bFront_3d.y - f2_2d.y) * transition,
    };
    var f1tF = {
      x: f1_2d.x + (fp1tFront_3d.x - f1_2d.x) * transition,
      y: f1_2d.y + (fp1tFront_3d.y - f1_2d.y) * transition,
    };
    var f2tF = {
      x: f2_2d.x + (fp2tFront_3d.x - f2_2d.x) * transition,
      y: f2_2d.y + (fp2tFront_3d.y - f2_2d.y) * transition,
    };

    var f1bB = {
      x: f1_2d.x + (fp1bBack_3d.x - f1_2d.x) * transition,
      y: f1_2d.y + (fp1bBack_3d.y - f1_2d.y) * transition,
    };
    var f2bB = {
      x: f2_2d.x + (fp2bBack_3d.x - f2_2d.x) * transition,
      y: f2_2d.y + (fp2bBack_3d.y - f2_2d.y) * transition,
    };
    var f1tB = {
      x: f1_2d.x + (fp1tBack_3d.x - f1_2d.x) * transition,
      y: f1_2d.y + (fp1tBack_3d.y - f1_2d.y) * transition,
    };
    var f2tB = {
      x: f2_2d.x + (fp2tBack_3d.x - f2_2d.x) * transition,
      y: f2_2d.y + (fp2tBack_3d.y - f2_2d.y) * transition,
    };

    // Draw frame
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "source-over";

    // Front and Back
    ctx.fillStyle = shadedFrameColor;
    ctx.beginPath();
    ctx.moveTo(f1tF.x, f1tF.y);
    ctx.lineTo(f2tF.x, f2tF.y);
    ctx.lineTo(f2bF.x, f2bF.y);
    ctx.lineTo(f1bF.x, f1bF.y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(f1bB.x, f1bB.y);
    ctx.lineTo(f2bB.x, f2bB.y);
    ctx.lineTo(f2tB.x, f2tB.y);
    ctx.lineTo(f1tB.x, f1tB.y);
    ctx.closePath();
    ctx.fill();

    // Sides
    ctx.fillStyle = darkerFrameColor;
    // Left
    ctx.beginPath();
    ctx.moveTo(f1tF.x, f1tF.y);
    ctx.lineTo(f1tB.x, f1tB.y);
    ctx.lineTo(f1bB.x, f1bB.y);
    ctx.lineTo(f1bF.x, f1bF.y);
    ctx.closePath();
    ctx.fill();
    // Right
    ctx.beginPath();
    ctx.moveTo(f2tF.x, f2tF.y);
    ctx.lineTo(f2tB.x, f2tB.y);
    ctx.lineTo(f2bB.x, f2bB.y);
    ctx.lineTo(f2bF.x, f2bF.y);
    ctx.closePath();
    ctx.fill();
    // Top
    ctx.beginPath();
    ctx.moveTo(f1tF.x, f1tF.y);
    ctx.lineTo(f2tF.x, f2tF.y);
    ctx.lineTo(f2tB.x, f2tB.y);
    ctx.lineTo(f1tB.x, f1tB.y);
    ctx.closePath();
    ctx.fill();
    // Bottom
    ctx.beginPath();
    ctx.moveTo(f1bF.x, f1bF.y);
    ctx.lineTo(f1bB.x, f1bB.y);
    ctx.lineTo(f2bB.x, f2bB.y);
    ctx.lineTo(f2bF.x, f2bF.y);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Draw door panels (two separate panels) WITH THICKNESS
    var doorColor = "#8b4513";
    var doorRgb = hexToRgb(doorColor);
    var shadedDoorColor =
      "rgb(" +
      Math.round(doorRgb.r * lightFactor * 1.1) +
      "," +
      Math.round(doorRgb.g * lightFactor * 1.1) +
      "," +
      Math.round(doorRgb.b * lightFactor * 1.1) +
      ")";
    var darkerDoorColor =
      "rgb(" +
      Math.round(doorRgb.r * lightFactor * 0.8) +
      "," +
      Math.round(doorRgb.g * lightFactor * 0.8) +
      "," +
      Math.round(doorRgb.b * lightFactor * 0.8) +
      ")";

    // Calculate door panel positions (inset from frame)
    var panelInset = 0.02;
    var leftPanelP1 = {
      x: centerX - Math.cos(angle) * (halfWidth - panelInset),
      y: centerY - Math.sin(angle) * (halfWidth - panelInset),
    };
    var leftPanelP2 = {
      x: centerX - Math.cos(angle) * panelInset,
      y: centerY - Math.sin(angle) * panelInset,
    };
    var rightPanelP1 = {
      x: centerX + Math.cos(angle) * panelInset,
      y: centerY + Math.sin(angle) * panelInset,
    };
    var rightPanelP2 = {
      x: centerX + Math.cos(angle) * (halfWidth - panelInset),
      y: centerY + Math.sin(angle) * (halfWidth - panelInset),
    };

    // Door panel thickness (3cm)
    var panelDepthOffset = 0.015; // half depth
    var pdOffsetX = Math.cos(perpAngle) * panelDepthOffset;
    var pdOffsetY = Math.sin(perpAngle) * panelDepthOffset;

    // Project door panels to 3D with thickness
    // LEFT PANEL
    var lp1bF_3d = projectToCanvas3D(
      leftPanelP1.x + pdOffsetX,
      leftPanelP1.y + pdOffsetY,
      0.05
    );
    var lp2bF_3d = projectToCanvas3D(
      leftPanelP2.x + pdOffsetX,
      leftPanelP2.y + pdOffsetY,
      0.05
    );
    var lp1tF_3d = projectToCanvas3D(
      leftPanelP1.x + pdOffsetX,
      leftPanelP1.y + pdOffsetY,
      doorHeight - 0.05
    );
    var lp2tF_3d = projectToCanvas3D(
      leftPanelP2.x + pdOffsetX,
      leftPanelP2.y + pdOffsetY,
      doorHeight - 0.05
    );

    var lp1bB_3d = projectToCanvas3D(
      leftPanelP1.x - pdOffsetX,
      leftPanelP1.y - pdOffsetY,
      0.05
    );
    var lp2bB_3d = projectToCanvas3D(
      leftPanelP2.x - pdOffsetX,
      leftPanelP2.y - pdOffsetY,
      0.05
    );
    var lp1tB_3d = projectToCanvas3D(
      leftPanelP1.x - pdOffsetX,
      leftPanelP1.y - pdOffsetY,
      doorHeight - 0.05
    );
    var lp2tB_3d = projectToCanvas3D(
      leftPanelP2.x - pdOffsetX,
      leftPanelP2.y - pdOffsetY,
      doorHeight - 0.05
    );

    // RIGHT PANEL
    var rp1bF_3d = projectToCanvas3D(
      rightPanelP1.x + pdOffsetX,
      rightPanelP1.y + pdOffsetY,
      0.05
    );
    var rp2bF_3d = projectToCanvas3D(
      rightPanelP2.x + pdOffsetX,
      rightPanelP2.y + pdOffsetY,
      0.05
    );
    var rp1tF_3d = projectToCanvas3D(
      rightPanelP1.x + pdOffsetX,
      rightPanelP1.y + pdOffsetY,
      doorHeight - 0.05
    );
    var rp2tF_3d = projectToCanvas3D(
      rightPanelP2.x + pdOffsetX,
      rightPanelP2.y + pdOffsetY,
      doorHeight - 0.05
    );

    var rp1bB_3d = projectToCanvas3D(
      rightPanelP1.x - pdOffsetX,
      rightPanelP1.y - pdOffsetY,
      0.05
    );
    var rp2bB_3d = projectToCanvas3D(
      rightPanelP2.x - pdOffsetX,
      rightPanelP2.y - pdOffsetY,
      doorHeight - 0.05
    ); // wait, fixed below
    var rp1tB_3d = projectToCanvas3D(
      rightPanelP1.x - pdOffsetX,
      rightPanelP1.y - pdOffsetY,
      doorHeight - 0.05
    );
    var rp2tB_3d = projectToCanvas3D(
      rightPanelP2.x - pdOffsetX,
      rightPanelP2.y - pdOffsetY,
      doorHeight - 0.05
    );

    // Fix typo in rp2bB_3d
    rp2bB_3d = projectToCanvas3D(
      rightPanelP2.x - pdOffsetX,
      rightPanelP2.y - pdOffsetY,
      0.05
    );

    // 2D positions for interpolation
    var lp1_2d = { x: mx(leftPanelP1.x), y: my(leftPanelP1.y) };
    var lp2_2d = { x: mx(leftPanelP2.x), y: my(leftPanelP2.y) };
    var rp1_2d = { x: mx(rightPanelP1.x), y: my(rightPanelP1.y) };
    var rp2_2d = { x: mx(rightPanelP2.x), y: my(rightPanelP2.y) };

    // Interpolated LEFT PANEL corners
    var lp1bF = {
      x: lp1_2d.x + (lp1bF_3d.x - lp1_2d.x) * transition,
      y: lp1_2d.y + (lp1bF_3d.y - lp1_2d.y) * transition,
    };
    var lp2bF = {
      x: lp2_2d.x + (lp2bF_3d.x - lp2_2d.x) * transition,
      y: lp2_2d.y + (lp2bF_3d.y - lp2_2d.y) * transition,
    };
    var lp1tF = {
      x: lp1_2d.x + (lp1tF_3d.x - lp1_2d.x) * transition,
      y: lp1_2d.y + (lp1tF_3d.y - lp1_2d.y) * transition,
    };
    var lp2tF = {
      x: lp2_2d.x + (lp2tF_3d.x - lp2_2d.x) * transition,
      y: lp2_2d.y + (lp2tF_3d.y - lp2_2d.y) * transition,
    };

    var lp1bB = {
      x: lp1_2d.x + (lp1bB_3d.x - lp1_2d.x) * transition,
      y: lp1_2d.y + (lp1bB_3d.y - lp1_2d.y) * transition,
    };
    var lp2bB = {
      x: lp2_2d.x + (lp2bB_3d.x - lp2_2d.x) * transition,
      y: lp2_2d.y + (lp2bB_3d.y - lp2_2d.y) * transition,
    };
    var lp1tB = {
      x: lp1_2d.x + (lp1tB_3d.x - lp1_2d.x) * transition,
      y: lp1_2d.y + (lp1tB_3d.y - lp1_2d.y) * transition,
    };
    var lp2tB = {
      x: lp2_2d.x + (lp2tB_3d.x - lp2_2d.x) * transition,
      y: lp2_2d.y + (lp2tB_3d.y - lp2_2d.y) * transition,
    };

    // Interpolated RIGHT PANEL corners
    var rp1bF = {
      x: rp1_2d.x + (rp1bF_3d.x - rp1_2d.x) * transition,
      y: rp1_2d.y + (rp1bF_3d.y - rp1_2d.y) * transition,
    };
    var rp2bF = {
      x: rp2_2d.x + (rp2bF_3d.x - rp2_2d.x) * transition,
      y: rp2_2d.y + (rp2bF_3d.y - rp2_2d.y) * transition,
    };
    var rp1tF = {
      x: rp1_2d.x + (rp1tF_3d.x - rp1_2d.x) * transition,
      y: rp1_2d.y + (rp1tF_3d.y - rp1_2d.y) * transition,
    };
    var rp2tF = {
      x: rp2_2d.x + (rp2tF_3d.x - rp2_2d.x) * transition,
      y: rp2_2d.y + (rp2tF_3d.y - rp2_2d.y) * transition,
    };

    var rp1bB = {
      x: rp1_2d.x + (rp1bB_3d.x - rp1_2d.x) * transition,
      y: rp1_2d.y + (rp1bB_3d.y - rp1_2d.y) * transition,
    };
    var rp2bB = {
      x: rp2_2d.x + (rp2bB_3d.x - rp2_2d.x) * transition,
      y: rp2_2d.y + (rp2bB_3d.y - rp2_2d.y) * transition,
    };
    var rp1tB = {
      x: rp1_2d.x + (rp1tB_3d.x - rp1_2d.x) * transition,
      y: rp1_2d.y + (rp1tB_3d.y - rp1_2d.y) * transition,
    };
    var rp2tB = {
      x: rp2_2d.x + (rp2tB_3d.x - rp2_2d.x) * transition,
      y: rp2_2d.y + (rp2tB_3d.y - rp2_2d.y) * transition,
    };

    // Draw door panels
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "source-over";

    // Left Panel Front and Back
    ctx.fillStyle = shadedDoorColor;
    ctx.beginPath();
    ctx.moveTo(lp1tF.x, lp1tF.y);
    ctx.lineTo(lp2tF.x, lp2tF.y);
    ctx.lineTo(lp2bF.x, lp2bF.y);
    ctx.lineTo(lp1bF.x, lp1bF.y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(lp1bB.x, lp1bB.y);
    ctx.lineTo(lp2bB.x, lp2bB.y);
    ctx.lineTo(lp2tB.x, lp2tB.y);
    ctx.lineTo(lp1tB.x, lp1tB.y);
    ctx.closePath();
    ctx.fill();

    // Right Panel Front and Back
    ctx.beginPath();
    ctx.moveTo(rp1tF.x, rp1tF.y);
    ctx.lineTo(rp2tF.x, rp2tF.y);
    ctx.lineTo(rp2bF.x, rp2bF.y);
    ctx.lineTo(rp1bF.x, rp1bF.y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(rp1bB.x, rp1bB.y);
    ctx.lineTo(rp2bB.x, rp2bB.y);
    ctx.lineTo(rp2tB.x, rp2tB.y);
    ctx.lineTo(rp1tB.x, rp1tB.y);
    ctx.closePath();
    ctx.fill();

    // Side faces
    ctx.fillStyle = darkerDoorColor;
    // Left panel sides
    ctx.beginPath();
    ctx.moveTo(lp1tF.x, lp1tF.y);
    ctx.lineTo(lp1tB.x, lp1tB.y);
    ctx.lineTo(lp1bB.x, lp1bB.y);
    ctx.lineTo(lp1bF.x, lp1bF.y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(lp2tF.x, lp2tF.y);
    ctx.lineTo(lp2tB.x, lp2tB.y);
    ctx.lineTo(lp2bB.x, lp2bB.y);
    ctx.lineTo(lp2bF.x, lp2bF.y);
    ctx.closePath();
    ctx.fill();
    // Right panel sides
    ctx.beginPath();
    ctx.moveTo(rp1tF.x, rp1tF.y);
    ctx.lineTo(rp1tB.x, rp1tB.y);
    ctx.lineTo(rp1bB.x, rp1bB.y);
    ctx.lineTo(rp1bF.x, rp1bF.y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(rp2tF.x, rp2tF.y);
    ctx.lineTo(rp2tB.x, rp2tB.y);
    ctx.lineTo(rp2bB.x, rp2bB.y);
    ctx.lineTo(rp2bF.x, rp2bF.y);
    ctx.closePath();
    ctx.fill();

    // Top and bottom faces for both panels
    // Left panel top
    ctx.beginPath();
    ctx.moveTo(lp1tF.x, lp1tF.y);
    ctx.lineTo(lp2tF.x, lp2tF.y);
    ctx.lineTo(lp2tB.x, lp2tB.y);
    ctx.lineTo(lp1tB.x, lp1tB.y);
    ctx.closePath();
    ctx.fill();
    // Left panel bottom
    ctx.beginPath();
    ctx.moveTo(lp1bF.x, lp1bF.y);
    ctx.lineTo(lp1bB.x, lp1bB.y);
    ctx.lineTo(lp2bB.x, lp2bB.y);
    ctx.lineTo(lp2bF.x, lp2bF.y);
    ctx.closePath();
    ctx.fill();
    // Right panel top
    ctx.beginPath();
    ctx.moveTo(rp1tF.x, rp1tF.y);
    ctx.lineTo(rp2tF.x, rp2tF.y);
    ctx.lineTo(rp2tB.x, rp2tB.y);
    ctx.lineTo(rp1tB.x, rp1tB.y);
    ctx.closePath();
    ctx.fill();
    // Right panel bottom
    ctx.beginPath();
    ctx.moveTo(rp1bF.x, rp1bF.y);
    ctx.lineTo(rp1bB.x, rp1bB.y);
    ctx.lineTo(rp2bB.x, rp2bB.y);
    ctx.lineTo(rp2bF.x, rp2bF.y);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Center divider
    var centerDivider = projectToCanvas3D(centerX, centerY, 0);
    var centerDividerTop = projectToCanvas3D(centerX, centerY, doorHeight);
    var centerDivider_2d = { x: mx(centerX), y: my(centerY) };
    var cd_b = {
      x:
        centerDivider_2d.x +
        (centerDivider.x - centerDivider_2d.x) * transition,
      y:
        centerDivider_2d.y +
        (centerDivider.y - centerDivider_2d.y) * transition,
    };
    var cd_t = {
      x:
        centerDivider_2d.x +
        (centerDividerTop.x - centerDivider_2d.x) * transition,
      y:
        centerDivider_2d.y +
        (centerDividerTop.y - centerDivider_2d.y) * transition,
    };

    // Draw center divider line
    ctx.strokeStyle = shadedFrameColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cd_b.x, cd_b.y);
    ctx.lineTo(cd_t.x, cd_t.y);
    ctx.stroke();

    // Draw two handles - positioned along the door edges (along wall direction) WITH FIXED SIZE
    var handleOffset = totalWidth / 4;
    var leftHandleX = centerX - Math.cos(angle) * handleOffset;
    var leftHandleY = centerY - Math.sin(angle) * handleOffset;
    var rightHandleX = centerX + Math.cos(angle) * handleOffset;
    var rightHandleY = centerY + Math.sin(angle) * handleOffset;

    var leftHandle3D = projectToCanvas3D(
      leftHandleX,
      leftHandleY,
      doorHeight / 2
    );
    var rightHandle3D = projectToCanvas3D(
      rightHandleX,
      rightHandleY,
      doorHeight / 2
    );
    var leftHandle2D = { x: mx(leftHandleX), y: my(leftHandleY) };
    var rightHandle2D = { x: mx(rightHandleX), y: my(rightHandleY) };

    var lh = {
      x: leftHandle2D.x + (leftHandle3D.x - leftHandle2D.x) * transition,
      y: leftHandle2D.y + (leftHandle3D.y - leftHandle2D.y) * transition,
    };
    var rh = {
      x: rightHandle2D.x + (rightHandle3D.x - rightHandle2D.x) * transition,
      y: rightHandle2D.y + (rightHandle3D.y - rightHandle2D.y) * transition,
    };

    // Only draw handles in 3D mode
    if (transition > 0.5) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#c0c0c0";
      ctx.beginPath();
      ctx.arc(lh.x, lh.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rh.x, rh.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw edges with enhanced glow for selected double doors
    if (isSelected) {
      ctx.save();
      // Use front face corners for selection glow
      ctx.beginPath();
      ctx.moveTo(f1tF.x, f1tF.y);
      ctx.lineTo(f2tF.x, f2tF.y);
      ctx.lineTo(f2bF.x, f2bF.y);
      ctx.lineTo(f1bF.x, f1bF.y);
      ctx.closePath();

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
      ctx.restore();
    }
  }

  // Expose all functions on window for global access
  window.initThreeJS = initThreeJS;
  window.updateThreeJSCamera = updateThreeJSCamera;
  window.updateThreeCanvasPointerEvents = updateThreeCanvasPointerEvents;
  window.handleThreeJSWheel = handleThreeJSWheel;
  window.handleThreeJSMouseDown = handleThreeJSMouseDown;
  window.handleThreeJSMouseMove = handleThreeJSMouseMove;
  window.handleThreeJSMouseUp = handleThreeJSMouseUp;
  window.renderThreeJSScene = renderThreeJSScene;
  window.renderDoor3D = renderDoor3D;
  window.renderWindow3D = renderWindow3D;
  window.renderDoubleDoor3D = renderDoubleDoor3D;
})();
