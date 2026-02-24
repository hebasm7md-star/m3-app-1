//
// ProjectIO.js
// Serializes the entire project state to/from JSON for save/load,
// handles background image serialization, and DXF import/export.
//
// All functions are exposed on window for global access.
//
// Depends on: global state, draw(), renderAPs(), renderWalls(),
//             invalidateHeatmapCache(), updateAntennaPatternsList(),
//             $() and add() helpers
//
// Called by:
//   Save Project button — saveProject()
//   Load Project file input — loadProject()
//   DXF buttons — DXF-related functions
//

(function () {

  function imageToBase64(img) {
    if (!img) return null;
    var canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  }

  function base64ToImage(base64) {
    return new Promise(function (resolve, reject) {
      if (!base64) {
        resolve(null);
        return;
      }
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error("Failed to load image"));
      };
      img.src = base64;
    });
  }

  function saveProject() {
    try {
      // Create a copy of state with serializable data
      var projectData = {
        version: "1.0",
        savedAt: new Date().toISOString(),
        // Core dimensions
        w: state.w,
        h: state.h,
        res: state.res,
        // Propagation model settings
        model: state.model,
        freq: state.freq,
        N: state.N,
        refl: state.refl,
        noise: state.noise,
        // View settings
        view: state.view,
        viewMode: state.viewMode,
        viewModeTarget: state.viewModeTarget,
        minVal: state.minVal,
        maxVal: state.maxVal,
        complianceThreshold: state.complianceThreshold,
        compliancePercentage: state.compliancePercentage,
        weak: state.weak,
        mid: state.mid,
        strong: state.strong,
        showContours: state.showContours,
        showTooltip: state.showTooltip,
        showVisualization: state.showVisualization,
        // Background image (as base64)
        backgroundImage: state.backgroundImage
          ? imageToBase64(state.backgroundImage)
          : null,
        backgroundImageAlpha: state.backgroundImageAlpha,
        // Antennas
        aps: state.aps.map(function (ap) {
          var apData = {
            id: ap.id,
            x: ap.x,
            y: ap.y,
            z: ap.z,
            tx: ap.tx,
            gt: ap.gt,
            ch: ap.ch,
            azimuth: ap.azimuth,
            tilt: ap.tilt,
            enabled: ap.enabled !== undefined ? ap.enabled : true,
          };
          if (ap.antennaPattern && ap.antennaPatternFileName) {
            apData.antennaPattern = ap.antennaPattern;
            apData.antennaPatternFileName = ap.antennaPatternFileName;
          }
          return apData;
        }),
        // Walls
        walls: state.walls.map(function (w) {
          var wallData = {
            id: w.id,
            loss: w.loss,
            color: w.color,
            thickness: w.thickness,
            height: w.height,
            elementType: w.elementType,
            width: w.width,
          };
          if (w.points && Array.isArray(w.points) && w.points.length >= 2) {
            wallData.points = w.points.map(function(p) {
              return { x: p.x, y: p.y };
            });
          } else if (w.p1 && w.p2) {
            wallData.p1 = { x: w.p1.x, y: w.p1.y };
            wallData.p2 = { x: w.p2.x, y: w.p2.y };
          }
          return wallData;
        }),
        // Floor planes
        floorPlanes: state.floorPlanes.map(function (fp) {
          return {
            p1: { x: fp.p1.x, y: fp.p1.y },
            p2: { x: fp.p2.x, y: fp.p2.y },
            p3: { x: fp.p3.x, y: fp.p3.y },
            p4: { x: fp.p4.x, y: fp.p4.y },
            attenuation: fp.attenuation,
            height: fp.height,
            type: fp.type,
            inclination: fp.inclination,
            inclinationDirection: fp.inclinationDirection,
            imgP1: fp.imgP1 ? { x: fp.imgP1.x, y: fp.imgP1.y } : null,
            imgP2: fp.imgP2 ? { x: fp.imgP2.x, y: fp.imgP2.y } : null,
            imgP3: fp.imgP3 ? { x: fp.imgP3.x, y: fp.imgP3.y } : null,
            imgP4: fp.imgP4 ? { x: fp.imgP4.x, y: fp.imgP4.y } : null,
          };
        }),
        // Antenna patterns
        antennaPatterns: state.antennaPatterns,
        defaultAntennaPatternIndex: state.defaultAntennaPatternIndex,
        // Ground plane settings
        groundPlane: state.groundPlane,
        // 3D view settings
        cameraRotationX: state.cameraRotationX,
        cameraRotationY: state.cameraRotationY,
        cameraZoom: state.cameraZoom,
        cameraPanX: state.cameraPanX,
        cameraPanY: state.cameraPanY,
        // CSV coverage data
        csvCoverageData: state.csvCoverageData,
      };

      var json = JSON.stringify(projectData, null, 2);
      var blob = new Blob([json], { type: "application/json" });

      // Determine default filename
      var defaultFileName =
        state.currentProjectFileName ||
        "ips-project-" + new Date().toISOString().slice(0, 10) + ".json";
      if (defaultFileName.endsWith(".ipsproject")) {
        defaultFileName = defaultFileName.replace(".ipsproject", ".json");
      } else if (!defaultFileName.endsWith(".json")) {
        defaultFileName =
          defaultFileName.replace(/\.[^/.]+$/, "") + ".json";
      }

      // Try to use File System Access API if available (allows choosing location)
      if ("showSaveFilePicker" in window) {
        var fileHandle = null;
        window
          .showSaveFilePicker({
            suggestedName: defaultFileName,
            types: [
              {
                description: "IPS Studio Project",
                accept: {
                  "application/json": [".json"],
                },
              },
            ],
          })
          .then(function (handle) {
            fileHandle = handle;
            return handle.createWritable();
          })
          .then(function (writable) {
            return writable.write(blob).then(function () {
              return writable.close();
            });
          })
          .then(function () {
            if (fileHandle && fileHandle.name) {
              state.currentProjectFileName = fileHandle.name;
            } else {
              state.currentProjectFileName = defaultFileName;
            }
            NotificationSystem.success("Project saved successfully!");
          })
          .catch(function (error) {
            if (error.name !== "AbortError") {
              console.error("Error saving project:", error);
              downloadProject(blob, defaultFileName);
            }
          });
      } else {
        var fileName = prompt(
          "Enter filename:",
          defaultFileName.replace(".json", "")
        );
        if (fileName !== null) {
          if (!fileName.endsWith(".json")) {
            fileName = fileName + ".json";
          }
          downloadProject(blob, fileName);
        }
      }
    } catch (error) {
      console.error("Error saving project:", error);
      NotificationSystem.error("Failed to save project.\n" + error.message);
    }
  }

  function downloadProject(blob, fileName) {
    state.currentProjectFileName = fileName;
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    NotificationSystem.success("Project saved successfully!");
  }

  function loadProject(file) {
    state.currentProjectFileName = file.name;
    currentAntennaDataFileName = null;
    antennaPositionHistory = [];

    var reader = new FileReader();
    reader.onload = function (event) {
      try {
        var projectData = JSON.parse(event.target.result);

        if (!projectData.version) {
          NotificationSystem.error("Invalid project file format.");
          return;
        }

        // Restore core dimensions
        // For JSON/DXF files, preserve original aspect ratio instead of forcing 30:20
        var offsetX = 0;
        var offsetY = 0;
        
        if (projectData.w && projectData.h) {
          var originalAspectRatio = projectData.w / projectData.h;
          var canvasAspectRatio = 30 / 20;
          
          var p = (typeof pad === 'function') ? pad() : 50;
          var availW = canvas.width - 2 * p;
          var availH = canvas.height - 2 * p;
          var canvasAR = availW / availH;
          
          if (originalAspectRatio > canvasAspectRatio) {
              state.w = projectData.w;
              state.h = state.w / canvasAR;
          } else {
              state.h = projectData.h;
              state.w = state.h * canvasAR;
          }

          offsetX = (state.w - projectData.w) / 2;
          offsetY = (state.h - projectData.h) / 2;

          state.backgroundImageAspectRatio = originalAspectRatio;
          state.backgroundImageDisplayWidth = state.w;
          state.backgroundImageDisplayHeight = state.h;
        } else {
          if (projectData.w) state.w = projectData.w;
          if (projectData.h) state.h = projectData.h;
        }
        if (projectData.res) state.res = projectData.res;



        // Restore propagation model
        if (projectData.model) state.model = projectData.model;
        if (projectData.freq !== undefined) state.freq = projectData.freq;
        if (projectData.N !== undefined) state.N = projectData.N;
        if (projectData.refl !== undefined) state.refl = projectData.refl;
        if (projectData.noise !== undefined)
          state.noise = projectData.noise;

        // Restore view settings
        if (projectData.view) state.view = projectData.view;
        if (projectData.viewMode) state.viewMode = projectData.viewMode;
        if (projectData.viewModeTarget)
          state.viewModeTarget = projectData.viewModeTarget;
        if (projectData.minVal !== undefined)
          state.minVal = projectData.minVal;
        if (projectData.maxVal !== undefined)
          state.maxVal = projectData.maxVal;
        if (projectData.complianceThreshold !== undefined)
          state.complianceThreshold = projectData.complianceThreshold;
        if (projectData.compliancePercentage !== undefined)
          state.compliancePercentage = projectData.compliancePercentage;
        if (projectData.weak) state.weak = projectData.weak;
        if (projectData.mid) state.mid = projectData.mid;
        if (projectData.strong) state.strong = projectData.strong;
        if (projectData.showContours !== undefined)
          state.showContours = projectData.showContours;
        if (projectData.showTooltip !== undefined)
          state.showTooltip = projectData.showTooltip;
        if (projectData.showVisualization !== undefined)
          state.showVisualization = projectData.showVisualization;

        // Restore background image
        if (projectData.backgroundImage) {
          base64ToImage(projectData.backgroundImage)
            .then(function (img) {
              state.backgroundImage = img;
              state.floorPlanImage = img;
              if (projectData.backgroundImageAlpha !== undefined) {
                state.backgroundImageAlpha =
                  projectData.backgroundImageAlpha;
              }
              
              var imgAspectRatio = img.width / img.height;
              var canvasAspectRatio = state.w / state.h;
              
              if (imgAspectRatio > canvasAspectRatio) {
                state.backgroundImageDisplayWidth = state.w;
                state.backgroundImageDisplayHeight = state.w / imgAspectRatio;
              } else {
                state.backgroundImageDisplayWidth = state.h * imgAspectRatio;
                state.backgroundImageDisplayHeight = state.h;
              }
              state.backgroundImageAspectRatio = imgAspectRatio;
              
              updateDeleteImageButton();
              draw();
            })
            .catch(function (error) {
              console.error("Error loading image:", error);
              alert("Warning: Could not load background image.");
            });
        } else {
          state.backgroundImage = null;
          state.floorPlanImage = null;
          state.backgroundImageAspectRatio = null;
          state.backgroundImageDisplayWidth = null;
          state.backgroundImageDisplayHeight = null;
          updateDeleteImageButton();
        }

        // Restore antennas
        state.aps = [];
        if (projectData.aps && Array.isArray(projectData.aps)) {
          projectData.aps.forEach(function (apData) {
            var ap = {
              id: apData.id || "AP" + (state.aps.length + 1),
              x: (apData.x || 0) + offsetX,
              y: (apData.y || 0) + offsetY,
              z: apData.z,
              tx: apData.tx || 10,
              gt: apData.gt || 5,
              ch: apData.ch || 1,
              azimuth: apData.azimuth || 0,
              tilt: apData.tilt || 0,
              enabled: apData.enabled !== undefined ? apData.enabled : true,
            };
            if (apData.antennaPattern) {
              var patternStr = JSON.stringify(apData.antennaPattern);
              ap.antennaPattern = JSON.parse(patternStr);
              
              if (!ap.antennaPattern.horizontalData || !Array.isArray(ap.antennaPattern.horizontalData)) {
                ap.antennaPattern.horizontalData = [];
              }
              if (!ap.antennaPattern.verticalData || !Array.isArray(ap.antennaPattern.verticalData)) {
                ap.antennaPattern.verticalData = [];
              }
              
              ap.antennaPatternFileName = apData.antennaPatternFileName;
            }
            state.aps.push(ap);
          });
          state.cachedHeatmap = null;
          state.heatmapUpdatePending = false;
        }

        // Restore walls
        state.walls = [];
        var typeCounters = {};
        if (projectData.walls && Array.isArray(projectData.walls)) {
          projectData.walls.forEach(function (wData) {
            var elementType = wData.elementType || "wall";
            var defaultColor = "#60a5fa";
            var defaultThickness = 3;
            var defaultLoss = 3;

            if (elementType === "window") {
              defaultColor = "#3b82f6";
              defaultThickness = 2;
              defaultLoss = 1;
            } else if (elementType === "door") {
              defaultColor = "#a16207";
              defaultThickness = 2;
              defaultLoss = 4;
            } else if (elementType === "doubleDoor") {
              defaultColor = "#a16207";
              defaultThickness = 2;
              defaultLoss = 4;
            }

            var wallType = wData.type;
            if (!wallType && elementType === "wall") {
              for (var t in wallTypes) {
                if (wallTypes[t].loss == (wData.loss !== undefined ? wData.loss : defaultLoss) &&
                  wallTypes[t].color == (wData.color || defaultColor)) {
                  wallType = t;
                  break;
                }
              }
            }

            var baseName = "Wall";
            if (elementType === "window") {
              baseName = "Window";
            } else if (elementType === "door") {
              baseName = "Door";
            } else if (elementType === "doubleDoor") {
              baseName = "DoubleDoor";
            } else if (wallType && wallTypes[wallType]) {
              baseName = wallTypes[wallType].name;
            }

            if (!typeCounters[baseName]) typeCounters[baseName] = 0;
            typeCounters[baseName]++;

            var name = baseName + "_" + typeCounters[baseName];

            var wall = {
              id: wData.id || "wall-" + Date.now() + "-" + Math.random(),
              name: wData.name || name,
              type: wallType,
              loss: wData.loss !== undefined ? wData.loss : defaultLoss,
              color: wData.color || defaultColor,
              thickness: wData.thickness || defaultThickness,
              height: wData.height,
              elementType: elementType,
              width: wData.width,
            };
            
            if (wData.points && Array.isArray(wData.points) && wData.points.length >= 2) {
              wall.points = wData.points.map(function(p) {
                return { x: p.x + offsetX, y: p.y + offsetY };
              });
            } else if (wData.p1 && wData.p2) {
              wall.p1 = { x: wData.p1.x + offsetX, y: wData.p1.y + offsetY };
              wall.p2 = { x: wData.p2.x + offsetX, y: wData.p2.y + offsetY };
            } else {
              wall.p1 = { x: 0, y: 0 };
              wall.p2 = { x: 0, y: 0 };
            }
            
            state.walls.push(wall);
          });
        }

        // Restore floor planes
        state.floorPlanes = [];
        if (
          projectData.floorPlanes &&
          Array.isArray(projectData.floorPlanes)
        ) {
          projectData.floorPlanes.forEach(function (fpData) {
            var fp = {
              p1: fpData.p1 ? { x: fpData.p1.x + offsetX, y: fpData.p1.y + offsetY } : { x: 0, y: 0 },
              p2: fpData.p2 ? { x: fpData.p2.x + offsetX, y: fpData.p2.y + offsetY } : { x: 0, y: 0 },
              p3: fpData.p3 ? { x: fpData.p3.x + offsetX, y: fpData.p3.y + offsetY } : { x: 0, y: 0 },
              p4: fpData.p4 ? { x: fpData.p4.x + offsetX, y: fpData.p4.y + offsetY } : { x: 0, y: 0 },
              attenuation: fpData.attenuation || 3.0,
              height: fpData.height || 0,
              type: fpData.type || "horizontal",
              inclination: fpData.inclination || 0,
              inclinationDirection: fpData.inclinationDirection || 0,
            };
            if (fpData.imgP1) fp.imgP1 = fpData.imgP1;
            if (fpData.imgP2) fp.imgP2 = fpData.imgP2;
            if (fpData.imgP3) fp.imgP3 = fpData.imgP3;
            if (fpData.imgP4) fp.imgP4 = fpData.imgP4;
            state.floorPlanes.push(fp);
          });
        }

        // Restore antenna patterns
        if (
          projectData.antennaPatterns &&
          Array.isArray(projectData.antennaPatterns)
        ) {
          var patternsStr = JSON.stringify(projectData.antennaPatterns);
          state.antennaPatterns = JSON.parse(patternsStr);
          
          for (var i = 0; i < state.antennaPatterns.length; i++) {
            var pattern = state.antennaPatterns[i];
            if (!pattern.horizontalData || !Array.isArray(pattern.horizontalData)) {
              pattern.horizontalData = [];
            }
            if (!pattern.verticalData || !Array.isArray(pattern.verticalData)) {
              pattern.verticalData = [];
            }
          }
          
          state.defaultAntennaPatternIndex =
            projectData.defaultAntennaPatternIndex !== undefined
              ? projectData.defaultAntennaPatternIndex
              : -1;
          updateAntennaPatternsList();
        }

        // Restore ground plane
        if (projectData.groundPlane) {
          state.groundPlane = projectData.groundPlane;
        }

        // Restore 3D view settings
        if (projectData.cameraRotationX !== undefined)
          state.cameraRotationX = projectData.cameraRotationX;
        if (projectData.cameraRotationY !== undefined)
          state.cameraRotationY = projectData.cameraRotationY;
        if (projectData.cameraZoom !== undefined)
          state.cameraZoom = projectData.cameraZoom;
        if (projectData.cameraPanX !== undefined)
          state.cameraPanX = projectData.cameraPanX;
        if (projectData.cameraPanY !== undefined)
          state.cameraPanY = projectData.cameraPanY;

        // Restore CSV coverage data
        if (projectData.csvCoverageData)
          state.csvCoverageData = projectData.csvCoverageData;

        // Update UI
        if ($("view")) $("view").value = state.view;
        if ($("model")) $("model").value = state.model;
        if ($("minVal")) $("minVal").value = state.minVal;
        if ($("maxVal")) $("maxVal").value = state.maxVal;
        if ($("complianceThreshold")) $("complianceThreshold").value = state.complianceThreshold !== undefined ? state.complianceThreshold : state.minVal;
        if ($("compliancePercentage")) $("compliancePercentage").value = state.compliancePercentage !== undefined ? state.compliancePercentage : 80;
        if ($("showContours"))
          $("showContours").checked = state.showContours;
        if ($("showTooltip")) $("showTooltip").checked = state.showTooltip;
        if ($("showVisualization"))
          $("showVisualization").checked = state.showVisualization;
        if ($("alphaSlider")) {
          $("alphaSlider").value = state.backgroundImageAlpha;
          var alphaLabel = $("alphaLabel");
          if (alphaLabel) {
            alphaLabel.textContent =
              "Image Opacity: " +
              Math.round(state.backgroundImageAlpha * 100) +
              "%";
          }
        }

        // Re-render everything
        renderWalls();
        renderAPs();
        updateActiveAntennaStats();
        
        // AI COMMENT: Replaced inline heatmap cache invalidation with helper
        invalidateHeatmapCache();
        
        draw();

        NotificationSystem.success("Project loaded successfully!");
      } catch (error) {
        console.error("Error loading project:", error);
        NotificationSystem.error("Error loading project: " + error.message);
      }
    };
    reader.readAsText(file);
  }

  function loadProjectFromData(projectData) {
    try {
      if (!projectData.version) {
        NotificationSystem.error("Invalid project data format.");
        return;
      }

      // Restore core dimensions
      // For JSON/DXF files, preserve original aspect ratio instead of forcing 30:20
      if (projectData.w && projectData.h) {
        var originalAspectRatio = projectData.w / projectData.h;
        var canvasAspectRatio = 30 / 20;
        
        if (originalAspectRatio > canvasAspectRatio) {
          state.w = 30;
          state.h = 30 / originalAspectRatio;
        } else {
          state.w = 20 * originalAspectRatio;
          state.h = 20;
        }
        
        state.backgroundImageAspectRatio = originalAspectRatio;
        state.backgroundImageDisplayWidth = state.w;
        state.backgroundImageDisplayHeight = state.h;
      } else {
        if (projectData.w) state.w = projectData.w;
        if (projectData.h) state.h = projectData.h;
      }
      if (projectData.res) state.res = projectData.res;

      // Restore propagation model
      if (projectData.model) state.model = projectData.model;
      if (projectData.freq !== undefined) state.freq = projectData.freq;
      if (projectData.N !== undefined) state.N = projectData.N;
      if (projectData.refl !== undefined) state.refl = projectData.refl;
      if (projectData.noise !== undefined)
        state.noise = projectData.noise;

      // Restore view settings
      if (projectData.view) state.view = projectData.view;
      if (projectData.viewMode) state.viewMode = projectData.viewMode;
      if (projectData.viewModeTarget)
        state.viewModeTarget = projectData.viewModeTarget;
      if (projectData.minVal !== undefined)
        state.minVal = projectData.minVal;
      if (projectData.maxVal !== undefined)
        state.maxVal = projectData.maxVal;

      // Restore background image
      if (projectData.backgroundImage) {
        base64ToImage(projectData.backgroundImage)
          .then(function (img) {
            state.backgroundImage = img;
            state.floorPlanImage = img;
            if (projectData.backgroundImageAlpha !== undefined) {
              state.backgroundImageAlpha = projectData.backgroundImageAlpha;
            }
            
            var imgAspectRatio = img.width / img.height;
            var canvasAspectRatio = state.w / state.h;
            
            if (imgAspectRatio > canvasAspectRatio) {
              state.backgroundImageDisplayWidth = state.w;
              state.backgroundImageDisplayHeight = state.w / imgAspectRatio;
            } else {
              state.backgroundImageDisplayWidth = state.h * imgAspectRatio;
              state.backgroundImageDisplayHeight = state.h;
            }
            state.backgroundImageAspectRatio = imgAspectRatio;
            
            updateDeleteImageButton();
            draw();
          }).catch(function (err) {
            console.error("Error loading background image:", err);
          });
      } else {
        state.backgroundImage = null;
        state.floorPlanImage = null;
        state.backgroundImageAspectRatio = null;
        state.backgroundImageDisplayWidth = null;
        state.backgroundImageDisplayHeight = null;

        var imgLoader = $("imageLoader");
        if (imgLoader) imgLoader.value = "";

        updateDeleteImageButton();
      }

      // Force 2D view initially to avoid 3D rendering issues
      state.viewMode = '2d';
      state.viewModeTarget = '2d';
      state.viewModeTransition = 0;
      var viewToggle = $("viewModeToggle");
      if (viewToggle) viewToggle.checked = false;

      // Restore antennas
      state.aps = [];
      if (projectData.aps && Array.isArray(projectData.aps)) {
        projectData.aps.forEach(function (apData) {
          var ap = {
            id: apData.id || "AP" + (state.aps.length + 1),
            x: apData.x || 0,
            y: apData.y || 0,
            z: apData.z,
            tx: apData.tx || 15,
            gt: apData.gt || 5,
            ch: apData.ch || 1,
            azimuth: apData.azimuth || 0,
            tilt: apData.tilt || 0,
            enabled: apData.enabled !== undefined ? apData.enabled : true,
          };
          state.aps.push(ap);
        });
        state.cachedHeatmap = null;
        state.heatmapUpdatePending = false;
      }

      // Restore walls
      state.walls = [];
      if (projectData.walls && Array.isArray(projectData.walls)) {
        projectData.walls.forEach(function (wData) {
          state.walls.push({
            id: wData.id || "wall_" + (state.walls.length + 1),
            p1: { x: wData.p1.x, y: wData.p1.y },
            p2: { x: wData.p2.x, y: wData.p2.y },
            loss: wData.loss || 3,
            color: wData.color || "#475569",
            thickness: wData.thickness || 2,
            height: wData.height || 2.5,
            elementType: wData.elementType || "wall",
            width: wData.width || 0,
          });
        });
      }

      // Restore floor planes
      state.floorPlanes = [];
      if (projectData.floorPlanes && Array.isArray(projectData.floorPlanes)) {
        projectData.floorPlanes.forEach(function (fpData) {
          state.floorPlanes.push({
            p1: { x: fpData.p1.x, y: fpData.p1.y },
            p2: { x: fpData.p2.x, y: fpData.p2.y },
            p3: { x: fpData.p3.x, y: fpData.p3.y },
            p4: { x: fpData.p4.x, y: fpData.p4.y },
            attenuation: fpData.attenuation || 3,
            height: fpData.height || 0,
            type: fpData.type || "horizontal",
            inclination: fpData.inclination || 0,
            inclinationDirection: fpData.inclinationDirection || 0,
          });
        });
      }

      renderAPs();
      renderWalls();
      if (typeof renderFloorPlanes === 'function') {
        renderFloorPlanes();
      }
      draw();
    } catch (error) {
      console.error("Error loading project data:", error);
      NotificationSystem.error("Failed to load project.\n" + error.message);
    }
  }

  // Save/Load button handlers
  var saveBtn = $("saveProjectBtn");
  if (saveBtn) add(saveBtn, "click", function () {
    saveProject();
  });

  var loadBtn = $("loadProjectBtn");
  if (loadBtn) add(loadBtn, "click", function () {
    $("loadProjectFile").click();
  });

  var loadFileInput = $("loadProjectFile");
  if (loadFileInput) add(loadFileInput, "change", function (e) {
    if (e.target.files && e.target.files[0]) {
      loadProject(e.target.files[0]);
      e.target.value = "";
    }
  });

  // Expose on window for global access
  window.imageToBase64 = imageToBase64;
  window.base64ToImage = base64ToImage;
  window.saveProject = saveProject;
  window.downloadProject = downloadProject;
  window.loadProject = loadProject;
  window.loadProjectFromData = loadProjectFromData;

})();
