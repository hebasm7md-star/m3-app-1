// AppUIEvents.js
// Handles global UI event bindings (upload, view mode toggles, sliders, optimization).

(function () {
  // Update delete button visibility based on whether image is uploaded
  function updateDeleteImageButton() {
    var deleteBtn = document.getElementById("deleteImageBtn");
    if (deleteBtn) {
      if (window.state.backgroundImage) {
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

  // ── Section-change side-effects (image swap, draw, delete-btn visibility) ──
  // AppOrchestrator owns the icon-btn click listeners and fires this callback
  // after updating sidebar state, so we never attach a second set of listeners.
  AppOrchestrator.onSectionChange(function (section) {
    window.state.activeSection = section;

    if (section === "xd") {
      window.state.backgroundImage = window.state.xdImage || null;
    } else {
      window.state.backgroundImage = window.state.floorPlanImage || null;
    }

    window.draw();
    updateDeleteImageButton();
  });

  // Event Bindings
  var imgLoader = document.getElementById("imageLoader");
  if (imgLoader) imgLoader.addEventListener("change", function (e) {
    var reader = new FileReader();
    reader.onload = function (event) {
      var img = new Image();
      img.onload = function () {
        window.state.backgroundImage = img;
        window.state.floorPlanImage = img; // Store as floor plan image
        
        var imgAspectRatio = img.width / img.height;
        var canvasAspectRatio = window.state.w / window.state.h;
        
        if (imgAspectRatio > canvasAspectRatio) {
          window.state.backgroundImageDisplayWidth = window.state.w;
          window.state.backgroundImageDisplayHeight = window.state.w / imgAspectRatio;
        } else {
          window.state.backgroundImageDisplayWidth = window.state.h * imgAspectRatio;
          window.state.backgroundImageDisplayHeight = window.state.h;
        }
        window.state.backgroundImageAspectRatio = imgAspectRatio;
        
        updateDeleteImageButton();
        window.draw();
      };
      img.src = event.target.result;
    };
    if (e.target.files && e.target.files[0]) {
      reader.readAsDataURL(e.target.files[0]);
    }
  });

  var delImgBtn = document.getElementById("deleteImageBtn");
  if (delImgBtn) delImgBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    NotificationSystem.confirm("This will remove the uploaded floor plan image.", "Delete Image", function (confirmed) {
      if (confirmed) {
        window.state.backgroundImage = null;
        window.state.floorPlanImage = null;
        window.state.backgroundImageAspectRatio = null;
        window.state.backgroundImageDisplayWidth = null;
        window.state.backgroundImageDisplayHeight = null;
        var imageLoader = document.getElementById("imageLoader");
        if (imageLoader) imageLoader.value = "";
        updateDeleteImageButton();
        window.draw();
      }
    }, {danger: true, confirmLabel: 'Delete', icon: '🗑️'});
  });

  // XD Tab Logic
  function updateDeleteXdImageButton() {
    var deleteBtn = document.getElementById("deleteXdImageBtn");
    if (deleteBtn) {
      if (window.state.xdImage) {
        deleteBtn.style.display = "flex";
      } else {
        deleteBtn.style.display = "none";
      }
    }
  }

  var xdLoader = document.getElementById("xdImageLoader");
  if (xdLoader) xdLoader.addEventListener("change", function (e) {
    clearXdPreview();
    var reader = new FileReader();
    reader.onload = function (event) {
      var img = new Image();
      img.onload = function () {
        window.state.xdImage = img;
        window.state.xdImageBase64 = event.target.result;

        window.state.backgroundImage = img;
        
        var imgAspectRatio = img.width / img.height;
        var canvasAspectRatio = window.state.w / window.state.h;
        
        if (imgAspectRatio > canvasAspectRatio) {
          window.state.backgroundImageDisplayWidth = window.state.w;
          window.state.backgroundImageDisplayHeight = window.state.w / imgAspectRatio;
        } else {
          window.state.backgroundImageDisplayWidth = window.state.h * imgAspectRatio;
          window.state.backgroundImageDisplayHeight = window.state.h;
        }
        window.state.backgroundImageAspectRatio = imgAspectRatio;
        
        updateDeleteImageButton(); 
        updateDeleteXdImageButton();
        window.draw();
      };
      img.src = event.target.result;
    };
    if (e.target.files && e.target.files[0]) {
      reader.readAsDataURL(e.target.files[0]);
    }
  });

  var delXdBtn = document.getElementById("deleteXdImageBtn");
  if (delXdBtn) delXdBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    NotificationSystem.confirm("This will remove the uploaded XD floorplan.", "Delete XD Image", function (confirmed) {
      if (confirmed) {
        clearXdPreview();
        window.state.xdImage = null;
        window.state.xdImageBase64 = null;

        if (window.state.backgroundImage === window.state.xdImage) {
          window.state.backgroundImage = null;
          window.state.backgroundImageAspectRatio = null;
          window.state.backgroundImageDisplayWidth = null;
          window.state.backgroundImageDisplayHeight = null;
        }
        window.state.backgroundImage = null;
        window.state.backgroundImageAspectRatio = null;
        window.state.backgroundImageDisplayWidth = null;
        window.state.backgroundImageDisplayHeight = null;

        var xdImageLoader = document.getElementById("xdImageLoader");
        if (xdImageLoader) xdImageLoader.value = "";
        updateDeleteXdImageButton();
        updateDeleteImageButton();
        window.draw();
      }
    }, {danger: true, confirmLabel: 'Delete', icon: '🗑️'});
  });

  var xdInferenceMode = document.getElementById("xdInferenceMode");
  if (xdInferenceMode) xdInferenceMode.addEventListener("change", function () {
    var mode = this.value;
    var xdSahiOptions = document.getElementById("xdSahiOptions");
    var xdSplitOptions = document.getElementById("xdSplitOptions");
    var showSahi = mode === "sahi" || mode === "split+sahi";
    var showSplit = mode === "split" || mode === "split+sahi";
    if (xdSahiOptions) xdSahiOptions.style.display = showSahi ? "block" : "none";
    if (xdSplitOptions) xdSplitOptions.style.display = showSplit ? "block" : "none";
  });
  if (xdInferenceMode) xdInferenceMode.dispatchEvent(new Event("change"));

  var xdAdvToggle = document.getElementById("xdAdvancedToggle");
  if (xdAdvToggle) xdAdvToggle.addEventListener("change", function () {
    var container = document.getElementById("xdAdvancedContainer");
    if (container) container.style.display = this.checked ? "block" : "none";
  });

  function getXdParams() {
    return {
      confidence: +document.getElementById("xdConfidence").value,
      inferenceMode: document.getElementById("xdInferenceMode").value,
      sliceSize: +document.getElementById("xdSliceSize").value,
      overlapRatio: +document.getElementById("xdOverlapRatio").value,
      nmsIou: +document.getElementById("xdNmsIou").value,
      splitCols: +document.getElementById("xdSplitCols").value,
      splitRows: +document.getElementById("xdSplitRows").value,
      wallHeight: +document.getElementById("xdWallHeight").value,
      doorHeight: +document.getElementById("xdDoorHeight").value
    };
  }

  function clearXdPreview() {
    window.state.xdPendingPredictions = null;
    window.state.xdPendingImageHeight = null;
    var container = document.getElementById("xdPreviewContainer");
    if (container) container.style.display = "none";
    var genBtn = document.getElementById("generateDxfBtn");
    if (genBtn) genBtn.disabled = true;
    if (window.state.activeSection === "xd" && window.state.xdImage) {
      window.state.backgroundImage = window.state.xdImage;
      window.draw();
    }
  }

  // Preview Detection button
  var previewBtn = document.getElementById("previewDxfBtn");
  if (previewBtn) previewBtn.addEventListener("click", function () {
    if (!window.state.xdImageBase64) {
      NotificationSystem.warning("Please upload a floorplan image first.");
      return;
    }

    var btn = document.getElementById("previewDxfBtn");
    btn.disabled = true;
    btn.style.opacity = "0.7";
    btn.textContent = "DETECTING...";

    var overlay = document.getElementById("loadingOverlay");
    var loadingText = document.getElementById("loadingText");
    var subtext = document.getElementById("loadingSubtext");
    if (overlay) overlay.style.display = "flex";
    if (loadingText) loadingText.textContent = "Detecting Floorplan...";
    if (subtext) subtext.textContent = "Our AI is detecting walls, doors, and windows. You can review the results before generating the DXF.";

    window.parent.postMessage({
      type: "preview_dxf",
      image: window.state.xdImageBase64,
      params: getXdParams(),
      requestId: "preview_" + Date.now()
    }, "*");

    var previewListener = function (event) {
      if (!event.data) return;

      if (event.data.type === "dxf_preview_result") {
        if (overlay) overlay.style.display = "none";
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.textContent = "Preview Detection";
        window.removeEventListener("message", previewListener);

        window.state.xdPendingPredictions = event.data.predictions;
        window.state.xdPendingImageHeight = event.data.imageHeight;

        var container = document.getElementById("xdPreviewContainer");
        var statsEl = document.getElementById("xdPreviewStats");
        var genBtn = document.getElementById("generateDxfBtn");

        if (container) container.style.display = "block";
        if (genBtn) genBtn.disabled = false;

        if (statsEl && event.data.counts) {
          var c = event.data.counts;
          statsEl.innerHTML =
            '<span class="xd-stat-item"><span class="xd-stat-count">' + c.walls + '</span> Walls</span>' +
            '<span class="xd-stat-item"><span class="xd-stat-count">' + c.doors + '</span> Doors</span>' +
            '<span class="xd-stat-item"><span class="xd-stat-count">' + c.windows + '</span> Windows</span>' +
            '<span class="xd-stat-item"><span class="xd-stat-count">' + c.total + '</span> Total</span>';
        }

        if (event.data.vizImage) {
          var vizImg = new Image();
          vizImg.onload = function () {
            window.state.backgroundImage = vizImg;
            var imgAspectRatio = vizImg.width / vizImg.height;
            var canvasAspectRatio = window.state.w / window.state.h;
            if (imgAspectRatio > canvasAspectRatio) {
              window.state.backgroundImageDisplayWidth = window.state.w;
              window.state.backgroundImageDisplayHeight = window.state.w / imgAspectRatio;
            } else {
              window.state.backgroundImageDisplayWidth = window.state.h * imgAspectRatio;
              window.state.backgroundImageDisplayHeight = window.state.h;
            }
            window.state.backgroundImageAspectRatio = imgAspectRatio;
            window.draw();
          };
          vizImg.src = event.data.vizImage;
        }

        NotificationSystem.success("Detection complete! Review the canvas, then click Generate DXF.");
      }
      else if (event.data.type === "dxf_preview_error") {
        if (overlay) overlay.style.display = "none";
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.textContent = "Preview Detection";
        window.removeEventListener("message", previewListener);
        NotificationSystem.error("Preview failed.\n" + (event.data.error || "Unknown error"));
      }
    };
    window.addEventListener("message", previewListener);
  });

  // Generate DXF button (uses cached predictions when available)
  var genDxfBtn = document.getElementById("generateDxfBtn");
  if (genDxfBtn) genDxfBtn.addEventListener("click", function () {
    if (!window.state.xdImageBase64 && !window.state.xdPendingPredictions) {
      NotificationSystem.warning("Please run Preview Detection first.");
      return;
    }

    var btn = document.getElementById("generateDxfBtn");
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.style.opacity = "0.7";
    btn.textContent = "GENERATING...";

    var overlay = document.getElementById("loadingOverlay");
    var loadingText = document.getElementById("loadingText");
    var subtext = document.getElementById("loadingSubtext");
    if (overlay) overlay.style.display = "flex";
    if (loadingText) loadingText.textContent = "Generating DXF...";
    if (subtext) subtext.textContent = "Exporting your floorplan to DXF format.";

    var payload = {
      type: "generate_dxf",
      image: window.state.xdImageBase64,
      params: getXdParams(),
      requestId: "dxf_" + Date.now()
    };

    if (window.state.xdPendingPredictions) {
      payload.predictions = window.state.xdPendingPredictions;
      payload.imageHeight = window.state.xdPendingImageHeight;
    }

    window.parent.postMessage(payload, "*");

    var dxfListener = function (event) {
      if (!event.data) return;

      if (event.data.type === "dxf_generated") {
        if (overlay) overlay.style.display = "none";
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.textContent = originalText;
        window.removeEventListener("message", dxfListener);

        if (event.data.fileData) {
          triggerFileDownload(event.data.fileData, event.data.fileName || "floorplan.dxf");
        }
        NotificationSystem.success("DXF generated successfully!");
      }
      else if (event.data.type === "dxf_error") {
        if (overlay) overlay.style.display = "none";
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.textContent = originalText;
        window.removeEventListener("message", dxfListener);
        NotificationSystem.error("Failed to generate DXF.\n" + (event.data.error || "Unknown error"));
      }
    };
    window.addEventListener("message", dxfListener);
  });

  window.postHandlerMessage = function (data) {
    window.postMessage(data, "*");
  };

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

  function sendParseDxfRequest(content, filename) {
    var targetW = document.getElementById("dxfTargetWidthM");
    var targetH = document.getElementById("dxfTargetHeightM");
    var overlay = document.getElementById("loadingOverlay");
    var loadingText = document.getElementById("loadingText");
    var subtext = document.getElementById("loadingSubtext");
    if (overlay) overlay.style.display = "flex";
    if (loadingText) loadingText.textContent = "Parsing DXF...";
    if (subtext) subtext.textContent = "Extracting walls and structures from your CAD file.";

    var payload = {
      type: "parse_dxf_request",
      content: content,
      filename: filename,
      requestId: "parse_" + Date.now()
    };
    if (targetW && targetH && targetW.value && targetH.value) {
      payload.targetWidthM = +targetW.value;
      payload.targetHeightM = +targetH.value;
    }
    window.parent.postMessage(payload, "*");
  }

  var dxfLdr = document.getElementById("dxfLoader");
  if (dxfLdr) dxfLdr.addEventListener("change", function (e) {
    updateDeleteDxfButton();

    if (e.target.files && e.target.files[0]) {
      var file = e.target.files[0];
      var reader = new FileReader();
      reader.onload = function (event) {
        window.state.dxfFileContent = event.target.result;
        window.state.dxfFileName = file.name;
        sendParseDxfRequest(event.target.result, file.name);
      };
      reader.readAsDataURL(file);
    } else {
      window.state.dxfFileContent = null;
      window.state.dxfFileName = null;
    }
  });

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "dxf_parsed_response") return;

    var overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.style.display = "none";

    if (event.data.success && event.data.data) {
      if (typeof window.loadProjectFromData === "function") {
        window.loadProjectFromData(event.data.data);
      }
      NotificationSystem.success("DXF loaded successfully!");
    } else {
      console.error("DXF parsing failed:", event.data.error);
      NotificationSystem.error("Failed to parse DXF.\n" + (event.data.error || "Unknown error"));
    }
  });

  var dxfCalibrateBtn = document.getElementById("dxfCalibrateScaleBtn");
  if (dxfCalibrateBtn) dxfCalibrateBtn.addEventListener("click", function () {
    if (!window.state.dxfFileContent || !window.state.dxfFileName) {
      NotificationSystem.warning("Please upload a DXF file first.");
      return;
    }
    sendParseDxfRequest(window.state.dxfFileContent, window.state.dxfFileName);
  });

  var delDxfBtn = document.getElementById("deleteDxfBtn");
  if (delDxfBtn) delDxfBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    NotificationSystem.confirm("This will remove all walls and floor planes from the DXF file.", "Delete DXF", function (confirmed) {
      if (confirmed) {
        var dxfLoader = document.getElementById("dxfLoader");
        if (dxfLoader) dxfLoader.value = "";

        window.state.dxfFileContent = null;
        window.state.dxfFileName = null;
        window.state.walls = [];
        window.state.floorPlanes = [];

        if (typeof window.renderWalls === 'function') window.renderWalls();
        if (typeof window.renderFloorPlanes === 'function') window.renderFloorPlanes();
        window.draw();

        updateDeleteDxfButton();
      }
    }, {danger: true, confirmLabel: 'Delete', icon: '🗑️'});
  });

  var alphaSld = document.getElementById("alphaSlider");
  if (alphaSld) alphaSld.addEventListener("input", function (e) {
    var alpha = +e.target.value;
    window.state.backgroundImageAlpha = alpha;
    var alphaLabel = document.getElementById("alphaLabel");
    if (alphaLabel) alphaLabel.textContent = "Image Opacity: " + Math.round(alpha * 100) + "%";
    window.draw();
  });

  var calibBtn = document.getElementById("calibrateBtn");
  if (calibBtn) calibBtn.addEventListener("click", function () {
    window.state.isCalibrating = !window.state.isCalibrating;
    if (window.state.isCalibrating) {
      window.state.addingWall = false;
      window.state.addingAP = false;
      window.state.addingFloorPlane = false;
      
      var addAPBtn = document.getElementById("addAP");
      if (addAPBtn) {
        var label = addAPBtn.querySelector("#addAPBtnLabel");
        if (label) label.textContent = "Place Antenna Manually"; else addAPBtn.textContent = "Place Antenna Manually";
      }

      var addBtn = document.getElementById("addWall");
      if (addBtn) addBtn.textContent = "Add Wall";
      
      var addFloorPlaneBtn = document.getElementById("addFloorPlane");
      if (addFloorPlaneBtn) addFloorPlaneBtn.textContent = "Add Floor Plane";
      
      document.getElementById("calibrateBtn").textContent = "Cancel Calibration";
      document.getElementById("calibrateBtn").classList.add("toggled");
      document.getElementById("calibrationControls").style.display = "block";
      window.state.calibrationLine = null;
      window.state.calibrationPixels = null;
      window.state.tempCalibration = null;
      window.state.tempCalibrationPixels = null;

      var sidebar = document.getElementById("mainSidebar");
      if (sidebar && sidebar.classList.contains("expanded")) {
        sidebar.classList.remove("expanded");
        var iconButtons = document.querySelectorAll(".icon-btn");
        iconButtons.forEach(function (b) { b.classList.remove("active"); });
        if (window.iconSidebarData) window.iconSidebarData.currentSection = null;
        setTimeout(function () {
          if (typeof window.constrainLegendPosition === "function") {
            window.constrainLegendPosition(true);
          }
        }, 350);
      }
    } else {
      document.getElementById("calibrateBtn").textContent = "Calibrate Scale";
      document.getElementById("calibrateBtn").classList.remove("toggled");
      document.getElementById("calibrationControls").style.display = "none";
      window.state.calibrationLine = null;
      window.state.calibrationPixels = null;
      window.state.tempCalibration = null;
      window.state.tempCalibrationPixels = null;
    }
    window.draw();
  });

  var appScaleBtn = document.getElementById("applyScaleBtn");
  if (appScaleBtn) appScaleBtn.addEventListener("click", function () {
    var realLength = parseFloat(document.getElementById("realLengthInput").value);
    if (realLength > 0 && window.state.calibrationPixels && window.state.calibrationPixels.p1 && window.state.calibrationPixels.p2) {
      var p1 = window.state.calibrationPixels.p1;
      var p2 = window.state.calibrationPixels.p2;
      var pixel_dist = window.hypot(p2.x - p1.x, p2.y - p1.y);

      var pixelsPerMeter = pixel_dist / realLength;

      window.state.w = (window.canvas.width - 2 * window.pad()) / pixelsPerMeter;
      window.state.h = (window.canvas.height - 2 * window.pad()) / pixelsPerMeter;

      window.state.isCalibrating = false;
      window.state.calibrationLine = null;
      window.state.calibrationPixels = null;
      window.state.tempCalibration = null;
      window.state.tempCalibrationPixels = null;
      document.getElementById("calibrateBtn").textContent = "Calibrate Scale";
      document.getElementById("calibrateBtn").classList.remove("toggled");
      document.getElementById("calibrationControls").style.display = "none";

      window.draw();
    } else {
      NotificationSystem.info("Please draw a calibration line on the map first.");
    }
  });

  var optBtn = document.getElementById("optimizeBtn");
  if (optBtn) optBtn.addEventListener("click", function () {
    if (!window.state.aps || window.state.aps.length === 0) {
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

    if (window.iconSidebarData) {
      var sidebar = window.iconSidebarData.sidebar;
      var iconButtons = document.querySelectorAll(".icon-btn");
      if (sidebar && sidebar.classList.contains("expanded")) {
        sidebar.classList.remove("expanded");
        iconButtons.forEach(function (b) { b.classList.remove("active"); });
        window.iconSidebarData.currentSection = null;
        var sections = document.querySelectorAll(".section-content");
        sections.forEach(function (s) { s.classList.remove("active"); });
        setTimeout(function () {
          if (typeof window.constrainLegendPosition === "function") window.constrainLegendPosition(true);
        }, 350);
      }
    }

    var overlay = document.getElementById("loadingOverlay");
    var loadingText = document.getElementById("loadingText");
    var subtext = document.getElementById("loadingSubtext");
    if (overlay) overlay.style.display = "flex";
    if (loadingText) loadingText.textContent = "Optimizing...";
    if (subtext) subtext.textContent = "AI is tuning antenna parameters. This may take a moment.";

    window.parent.postMessage({
      type: "start_optimization_and_poll",
      requestId: "optimize_" + Date.now()
    }, "*");
  });

  var calculateBaselineBtn = document.getElementById("calculateBaselineBtn");
  if (calculateBaselineBtn) calculateBaselineBtn.addEventListener("click", function () {
    var overlay = document.getElementById("loadingOverlay");
    var loadingText = document.getElementById("loadingText");
    var subtext = document.getElementById("loadingSubtext");
    if (overlay) overlay.style.display = "flex";
    if (loadingText) loadingText.textContent = "Calculating Accurate Baseline...";
    if (subtext) subtext.textContent = "Processing antenna configurations with the accurate engine. This may take a moment.";

    window.parent.postMessage({
      type: "start_accurate_baseline",
      requestId: "baseline_" + Date.now()
    }, "*");
  });

  function bindNum(id, key) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", function () {
      window.state[key] = +document.getElementById(id).value;
      window.draw();
    });
  }

  var VIEW_OPTIONS_ALL = [
    { value: "rssi", label: "RSSI (Signal Strength)" },
    { value: "snr", label: "SNR (Signal-to-Noise)" },
    { value: "sinr", label: "SINR (Signal-to-Interference+Noise)" },
    { value: "cci", label: "CCI (Co-Channel Interference)" },
    { value: "thr", label: "Throughput (Mbps)" },
    { value: "best", label: "Best Server" },
    { value: "servch", label: "Serving Channel" }
  ];

  function updateViewModeForEngine(model) {
    var viewEl = document.getElementById("view");
    if (!viewEl) return;
    if (model === "accurateEngine") {
      viewEl.innerHTML = '<option value="rssi">RSSI (Signal Strength)</option>';
      viewEl.value = "rssi";
      if (window.state) window.state.view = "rssi";
    } else {
      viewEl.innerHTML = VIEW_OPTIONS_ALL.map(function (o) {
        return '<option value="' + o.value + '">' + o.label + '</option>';
      }).join("");
      var v = (window.state && window.state.view) || "rssi";
      if (VIEW_OPTIONS_ALL.some(function (o) { return o.value === v; })) viewEl.value = v;
      else viewEl.value = "rssi";
    }
  }

  function syncLiveRsrpFromModel() {
    var model = (window.state && window.state.model) || (document.getElementById("model") || {}).value || "p25d";
    var enabled = model === "accurateEngine";
    if (!enabled && typeof window.clearBackendRsrpCache === "function") window.clearBackendRsrpCache();
    // only rssi map is supported for accurate engine
    updateViewModeForEngine(model);
    if (window.parent !== window) {
      window.parent.postMessage({ type: "set_send_live_rsrp", enabled: enabled }, "*");
      console.log("[RSRP] Accurate Engine:", enabled ? "ON" : "OFF", "| model:", model);
      if (enabled && typeof window.requestRsrpForCurrentConfigs === "function") {
        window.requestRsrpForCurrentConfigs();
      }
    }
  }
  window.syncLiveRsrpFromModel = syncLiveRsrpFromModel;

  var mdl = document.getElementById("model");
  if (mdl) {
    mdl.addEventListener("change", function () {
      window.state.model = mdl.value;
      var nel = document.getElementById("N");
      if (nel) nel.value = window.state.N;
      var isBackendModel = mdl.value !== "accurateEngine";
      if (isBackendModel && typeof window.resetHeatmapForLocalModel === "function") {
        window.resetHeatmapForLocalModel();
      } else {
        if (typeof window.clearBackendRsrpCache === "function") window.clearBackendRsrpCache(true);
        window.state.cachedHeatmap = null;
        window.state.heatmapUpdatePending = false;
        if (typeof window.invalidateHeatmapCache === "function") window.invalidateHeatmapCache();
        window.draw();
      }
      syncLiveRsrpFromModel();
    });
    syncLiveRsrpFromModel();
  }

  window.updateViewModeForEngine = updateViewModeForEngine;

  var vw = document.getElementById("view");
  if (vw) vw.addEventListener("change", function () {
    if (window.state.view && window.state.viewMinMax[window.state.view]) {
      window.state.viewMinMax[window.state.view].min = window.state.minVal;
      window.state.viewMinMax[window.state.view].max = window.state.maxVal;
    }

    window.state.view = document.getElementById("view").value;

    if (window.state.viewMinMax[window.state.view]) {
      window.state.minVal = window.state.viewMinMax[window.state.view].min;
      window.state.maxVal = window.state.viewMinMax[window.state.view].max;
    } else {
      if (window.state.view === "rssi") {
        window.state.minVal = -100;
        window.state.maxVal = -30;
      } else if (window.state.view === "snr") {
        window.state.minVal = 0;
        window.state.maxVal = 40;
      } else if (window.state.view === "sinr") {
        window.state.minVal = -10;
        window.state.maxVal = 40;
      } else if (window.state.view === "cci") {
        window.state.minVal = -10;
        window.state.maxVal = 40;
      } else if (window.state.view === "thr") {
        window.state.minVal = 0;
        window.state.maxVal = 80;
      } else {
        window.state.minVal = -100;
        window.state.maxVal = -30;
      }
    }

    var minEl = document.getElementById("minVal");
    var maxEl = document.getElementById("maxVal");
    if (minEl) minEl.value = window.state.minVal;
    if (maxEl) maxEl.value = window.state.maxVal;
    
    if (typeof window.invalidateHeatmapCache === "function") window.invalidateHeatmapCache();
    window.draw();
  });

  bindNum("freq", "freq");
  bindNum("N", "N");
  bindNum("res", "res");
  bindNum("noise", "noise");

  var minMaxValDebounceTimer = null;
  function scheduleMinMaxValUpdate() {
    if (minMaxValDebounceTimer) clearTimeout(minMaxValDebounceTimer);
    minMaxValDebounceTimer = setTimeout(function () {
      minMaxValDebounceTimer = null;
      if (typeof window.invalidateHeatmapCache === "function") window.invalidateHeatmapCache();
      requestAnimationFrame(function () { window.draw(); });
    }, 3000);
  }

  var minV = document.getElementById("minVal");
  if (minV) {
    minV.addEventListener("input", function () {
      window.state.minVal = +document.getElementById("minVal").value;
      if (window.state.view && window.state.viewMinMax[window.state.view]) {
        window.state.viewMinMax[window.state.view].min = window.state.minVal;
      }
      scheduleMinMaxValUpdate();
    });
    minV.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        if (minMaxValDebounceTimer) { clearTimeout(minMaxValDebounceTimer); minMaxValDebounceTimer = null; }
        if (typeof window.invalidateHeatmapCache === "function") window.invalidateHeatmapCache();
        requestAnimationFrame(function () { window.draw(); });
      }
    });
  }

  var maxV = document.getElementById("maxVal");
  if (maxV) {
    maxV.addEventListener("input", function () {
      window.state.maxVal = +document.getElementById("maxVal").value;
      if (window.state.view && window.state.viewMinMax[window.state.view]) {
        window.state.viewMinMax[window.state.view].max = window.state.maxVal;
      }
      scheduleMinMaxValUpdate();
    });
    maxV.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        if (minMaxValDebounceTimer) { clearTimeout(minMaxValDebounceTimer); minMaxValDebounceTimer = null; }
        if (typeof window.invalidateHeatmapCache === "function") window.invalidateHeatmapCache();
        requestAnimationFrame(function () { window.draw(); });
      }
    });
  }

  var ct = document.getElementById("complianceThreshold");
  if (ct) ct.addEventListener("input", function () {
    window.state.complianceThreshold = +document.getElementById("complianceThreshold").value;
    if (typeof window.updateActiveAntennaStats === "function") window.updateActiveAntennaStats();
    window.parent.postMessage({
      type: 'compliance_settings',
      complianceThreshold: window.state.complianceThreshold,
      compliancePercentage: window.state.compliancePercentage,
      requestId: 'compliance-' + Date.now()
    }, '*');
  });

  var cp = document.getElementById("compliancePercentage");
  if (cp) cp.addEventListener("input", function () {
    window.state.compliancePercentage = +document.getElementById("compliancePercentage").value;
    if (typeof window.updateActiveAntennaStats === "function") window.updateActiveAntennaStats();
    window.parent.postMessage({
      type: 'compliance_settings',
      complianceThreshold: window.state.complianceThreshold,
      compliancePercentage: window.state.compliancePercentage,
      requestId: 'compliance-' + Date.now()
    }, '*');
  });

  // Optimization Weight Params Toggle
  var optWeightToggle = document.getElementById("optWeightParamsToggle");
  if (optWeightToggle) optWeightToggle.addEventListener("change", function () {
    var container = document.getElementById("optWeightParamsContainer");
    if (container) container.style.display = this.checked ? "block" : "none";
  });

  // Optimization Algorithm Params Toggle
  var optOptimizationToggle = document.getElementById("optOptimizationParamsToggle");
  if (optOptimizationToggle) optOptimizationToggle.addEventListener("change", function () {
    var container = document.getElementById("optOptimizationParamsContainer");
    if (container) container.style.display = this.checked ? "block" : "none";
  });

  function sendWeightParams() {
    var weight_params = {
      financial_cost_weight: window.state.optFinancialCostWeight,
      rsrp_weight: window.state.optRsrpWeight,
      homogeneity_weight: window.state.optHomogeneityWeight,
      distribution_weight: window.state.optDistributionWeight,
      cci_weight: window.state.optCciWeight
    };
    window.parent.postMessage({
      type: "set_weight_params",
      weight_params: weight_params,
      requestId: "opt-" + Date.now()
    }, "*");
  }

  function sendOptimizationParams() {
    var opt_params = {
      num_trials: window.state.optNumTrials,
      max_changes: window.state.optMaxChanges,
      temp: window.state.optTemp,
      minimum_temp: window.state.optMinimumTemp
    };
    window.parent.postMessage({
      type: "set_optimization_params",
      opt_params: opt_params,
      requestId: "opt-" + Date.now()
    }, "*");
  }
  window.sendOptimizationParams = sendOptimizationParams;

  var optParamIds = ["optFinancialCostWeight", "optRsrpWeight", "optHomogeneityWeight", "optDistributionWeight", "optCciWeight", "optNumTrials", "optMaxChanges", "optTemp", "optMinimumTemp"];
  optParamIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", function () {
      var val = id === "optNumTrials" || id === "optMaxChanges" ? parseInt(this.value, 10) : parseFloat(this.value);
      if (isNaN(val)) return;
      window.state[id] = val;
    });
  });

  function collectAndSendWeightParams() {
    window.state.optFinancialCostWeight = parseFloat(document.getElementById("optFinancialCostWeight").value) || window.state.optFinancialCostWeight;
    window.state.optRsrpWeight = parseFloat(document.getElementById("optRsrpWeight").value) || window.state.optRsrpWeight;
    window.state.optHomogeneityWeight = parseFloat(document.getElementById("optHomogeneityWeight").value) || window.state.optHomogeneityWeight;
    window.state.optDistributionWeight = parseFloat(document.getElementById("optDistributionWeight").value) || window.state.optDistributionWeight;
    window.state.optCciWeight = parseFloat(document.getElementById("optCciWeight").value) || window.state.optCciWeight;
    sendWeightParams();

    // Collapse container
    var toggle = document.getElementById("optWeightParamsToggle");
    if (toggle) toggle.checked = false;
    var container = document.getElementById("optWeightParamsContainer");
    if (container) container.style.display = "none";
    
    if (typeof NotificationSystem !== "undefined") NotificationSystem.success("Weight parameters saved successfully");
  }

  function collectAndSendOptParams() {
    window.state.optNumTrials = parseInt(document.getElementById("optNumTrials").value, 10) || window.state.optNumTrials;
    window.state.optMaxChanges = parseInt(document.getElementById("optMaxChanges").value, 10) || window.state.optMaxChanges;
    window.state.optTemp = parseFloat(document.getElementById("optTemp").value) || window.state.optTemp;
    window.state.optMinimumTemp = parseFloat(document.getElementById("optMinimumTemp").value) || window.state.optMinimumTemp;
    sendOptimizationParams();

    // Collapse container
    var toggle = document.getElementById("optOptimizationParamsToggle");
    if (toggle) toggle.checked = false;
    var container = document.getElementById("optOptimizationParamsContainer");
    if (container) container.style.display = "none";
    
    if (typeof NotificationSystem !== "undefined") NotificationSystem.success("Optimization parameters saved successfully");
  }

  var optWeightSaveBtn = document.getElementById("optWeightParamsSaveBtn");
  if (optWeightSaveBtn) optWeightSaveBtn.addEventListener("click", collectAndSendWeightParams);

  var optOptimizationSaveBtn = document.getElementById("optOptimizationParamsSaveBtn");
  if (optOptimizationSaveBtn) optOptimizationSaveBtn.addEventListener("click", collectAndSendOptParams);

  var sc = document.getElementById("showContours");
  if (sc) sc.addEventListener("change", function () {
    window.state.showContours = document.getElementById("showContours").checked;
    if (typeof window.invalidateHeatmapCache === "function") window.invalidateHeatmapCache();
    window.draw();
  });

  var st = document.getElementById("showTooltip");
  if (st) st.addEventListener("change", function () {
    window.state.showTooltip = document.getElementById("showTooltip").checked;
    var tooltip = document.getElementById("apTooltip");
    if (!window.state.showTooltip && tooltip) {
      tooltip.classList.remove("visible");
      tooltip.style.display = "none";
    }
  });

  var sv = document.getElementById("showVisualization");
  if (sv) sv.addEventListener("change", function () {
    window.state.showVisualization = document.getElementById("showVisualization").checked;
    if (typeof window.invalidateHeatmapCache === "function") window.invalidateHeatmapCache();
    window.draw();
  });

  var vmt = document.getElementById("viewModeToggle");
  if (vmt) vmt.addEventListener("change", function () {
    window.state.viewModeTarget = document.getElementById("viewModeToggle").checked ? "3d" : "2d";
    if (window.state.viewModeTarget === "3d" && window.state.viewModeTransition === 0) {
      window.state.viewModeTransition = 0.01;
    } else if (window.state.viewModeTarget === "2d" && window.state.viewModeTransition === 1) {
      window.state.viewModeTransition = 0.99;
    }
    window.draw();
  });

  var dmt = document.getElementById("darkModeToggle");
  if (dmt) dmt.addEventListener("click", function () {
    window.state.darkMode = !window.state.darkMode;
    if (window.state.darkMode) {
      document.documentElement.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark-mode");
    }
    if (typeof window.saveState === "function") window.saveState();
  });

  function applyDarkMode() {
    if (window.state.darkMode) {
      document.documentElement.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark-mode");
    }
  }
  window.applyDarkMode = applyDarkMode;

  var stgt = document.getElementById("snapToGridToggle");
  if (stgt) stgt.addEventListener("change", function () {
    window.state.snapToGrid = document.getElementById("snapToGridToggle").checked;
  });

  var mwct = document.getElementById("manualWallControlToggle");
  if (mwct) mwct.addEventListener("change", function () {
    window.state.manualWallControl = document.getElementById("manualWallControlToggle").checked;
    if (!window.state.manualWallControl) {
      window.state.selectedWallId = null;
      window.state.selectedWallIds = [];
      window.state.wallDrag = null;
      window.draw();
    }
  });

  if (window.canvas) {
    window.canvas.addEventListener("mouseleave", function (e) {
      if (window.state.showTooltip) {
        var tooltip = document.getElementById("apTooltip");
        if (tooltip) {
          tooltip.classList.remove("visible");
        }
      }
    });
  }

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
  
    function setAddAPBtnText(text) {
      var addAPBtn = document.getElementById("addAP");
      if (!addAPBtn) return;
      var label = addAPBtn.querySelector("#addAPBtnLabel");
      if (label) label.textContent = text; else addAPBtn.textContent = text;
    }

  function updateEditorButtonsUI() {
    var state = window.state;
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
      setAddAPBtnText("Placing...");
    } else {
      addAPBtn.className = addAPBtn.className.replace(" toggled", "");
      setAddAPBtnText("Place Antenna Manually");
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

  }

  // Export coverage handler directly
  var csvBtn = document.getElementById("exportCoverageBtn");
  if (csvBtn) csvBtn.addEventListener("click", function () {
    if (typeof window.DataExportSystem !== 'undefined') {
      window.DataExportSystem.exportDetailedCoverageData(null, 1.0);
    } else {
      if (typeof window.NotificationSystem !== 'undefined') {
        window.NotificationSystem.error("Export module not found.");
      }
    }
  });

  // Export functions for global access
  window.updateDeleteImageButton = updateDeleteImageButton;
  window.updateDeleteDxfButton = updateDeleteDxfButton;
  window.updateDeleteXdImageButton = updateDeleteXdImageButton;
  window.updateEditorButtonsUI = updateEditorButtonsUI;
  window.getAddButtonText = getAddButtonText;
  window.setAddAPBtnText = setAddAPBtnText;
  window.clearXdPreview = clearXdPreview;

})();