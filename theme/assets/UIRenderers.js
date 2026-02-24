//
// UIRenderers.js
// Renders the sidebar lists for APs, walls, and floor planes, and manages
// the AP detail panel (right sidebar with antenna properties).
//
// All functions are exposed on window for global access.
//
// Depends on: global state, $() helper, draw(),
//             generateHeatmapAsync(), invalidateHeatmapCache(),
//             saveState(), getDefaultAntennaPattern(),
//             parseAntennaPattern(), updateAntennaPatternsList(),
//             NotificationSystem, DataExportSystem, hexToRgb (ColorSystem)
//
// Called by:
//   Nearly every operation that changes AP/wall/floor-plane lists
//   AP add/remove/move/toggle/pattern-change
//   Wall add/remove/type-change/loss-change
//   Undo/restore, project load, canvas drag-end, selection change
//

(function () {

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
          /*if (state.isOptimizing) {
            alert("Cannot change antenna status while optimization is in progress. Please wait for optimization to complete.");
            return;
          }*/

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
        /*var safeAntennaId = String(a.id)
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
          */
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
    var apCountEl = $("apCount");
    if (apCountEl) apCountEl.textContent = state.aps.length;
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
        delBtn.textContent = "\u{1F5D1} Delete";
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
            ? '<label style="font-size:12px; margin-top:4px;">Inclination (\u00B0):</label>' +
            '<input type="number" step="1" value="' +
            inclination +
            '" title="Inclination angle" style="margin-bottom:8px;">' +
            '<label style="font-size:12px; margin-top:4px;">Direction (\u00B0):</label>' +
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
        delBtn.textContent = "\u{1F5D1} Delete";
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
    var wallCountEl = $("wallCount");
    if (wallCountEl) wallCountEl.textContent = state.walls.length;
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
      ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Azimuth (\u00B0)</label>' +
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
      ' !important; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Tilt (\u00B0)</label>' +
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
      (ap.id === state.selectedApId ? "\u2714 Selected" : "Select") +
      "</button>" +
      '<button id="apDetailToggle" style="background: ' +
      (ap.enabled !== false ? "#ef4444" : "#10b981") +
      '; color: white; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; transition: background 0.2s; margin-bottom: 8px;">' +
      (ap.enabled !== false ? "Turn Off" : "Turn On") +
      "</button>" +
      '<button id="apDetailDownloadRsrp" style="background: #3b82f6; color: white; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; transition: background 0.2s;">' +
      "\u{1F4E5} Download RSRP" +
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
          /*if (state.isOptimizing) {
            alert("Cannot change antenna status while optimization is in progress. Please wait for optimization to complete.");
            return;
          }*/

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

  window.renderAPs = renderAPs;
  window.renderApDetails = renderApDetails;
  window.renderWalls = renderWalls;
  window.renderFloorPlanes = renderFloorPlanes;
  window.scrollToSelectedAp = scrollToSelectedAp;
  window.scrollToSelectedWall = scrollToSelectedWall;
  window.updateActiveAntennaStats = updateActiveAntennaStats;

  renderAPs();
  renderWalls();
  renderFloorPlanes();

})();
