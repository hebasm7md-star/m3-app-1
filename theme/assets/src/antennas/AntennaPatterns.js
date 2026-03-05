//
// AntennaPatterns.js
// Manages antenna pattern upload, parsing, deletion, and UI list rendering.
//
// Exposes on window:
//   getDefaultAntennaPattern, deleteAntennaPattern,
//   updateAntennaPatternsList, parseAntennaPattern, initAntennaPatternEvents
//
// Depends on: state, draw(), NotificationSystem
//

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  var DBD_TO_DBI_OFFSET = 2.15;  // dBd → dBi conversion offset
  var PARENT_ORIGIN     = "*";   // TODO: replace with your actual parent origin

  // ---------------------------------------------------------------------------
  // State helpers
  // ---------------------------------------------------------------------------
  function getDefaultAntennaPattern() {
    var idx = state.defaultAntennaPatternIndex;
    return (idx >= 0 && idx < state.antennaPatterns.length) ? state.antennaPatterns[idx] : null;
  }

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  // "Name (freq MHz) - gain dBi" — omits missing parts
  function patternDisplayText(p) {
    var t = p.name || "Unnamed Pattern";
    if (p.frequency) t += " (" + p.frequency + " MHz)";
    if (p.gain)      t += " - " + p.gain + " dBi";
    return t;
  }

  // Show/hide the delete button based on whether a real pattern is selected
  function syncDeleteButtonVisibility(selectEl) {
    var btn = document.getElementById("deleteSelectedPattern");
    if (btn) btn.style.display = (selectEl.value !== "-1" && selectEl.value !== "" && selectEl.value !== null) ? "flex" : "none";
  }

  // ---------------------------------------------------------------------------
  // Heatmap
  // ---------------------------------------------------------------------------
  function invalidateHeatmap() {
    if (state.heatmapUpdateRequestId !== null) { cancelAnimationFrame(state.heatmapUpdateRequestId); state.heatmapUpdateRequestId = null; }
    state.heatmapUpdatePending = false;
    state.cachedHeatmap        = null;
  }

  // ---------------------------------------------------------------------------
  // Pattern deletion
  // ---------------------------------------------------------------------------
  function deleteAntennaPattern(patternIndex) {
    if (patternIndex < 0 || patternIndex >= state.antennaPatterns.length) return;

    var pattern     = state.antennaPatterns[patternIndex];
    var patternName = pattern.name || "Unnamed Pattern";
    var affectedIds = state.aps
      .map(function (ap, i) { return ap.antennaPattern === pattern ? (ap.id || "AP " + (i + 1)) : null; })
      .filter(Boolean);

    NotificationSystem.confirm(buildDeleteConfirmMessage(patternName, affectedIds), "Delete Pattern", function (confirmed) {
      if (!confirmed) return;

      state.aps.forEach(function (ap) {
        if (ap.antennaPattern === pattern) { ap.antennaPattern = null; ap.antennaPatternFileName = null; }
      });

      state.antennaPatterns.splice(patternIndex, 1);
      state.defaultAntennaPatternIndex = resolveDefaultIndexAfterDelete(patternIndex);

      updateAntennaPatternsList();
      invalidateHeatmap();
      if (typeof draw === "function") draw();
      NotificationSystem.success("Pattern deleted successfully!");

    }, { danger: true, confirmLabel: "Delete", icon: "delete", isHtml: true });
  }

  function buildDeleteConfirmMessage(patternName, affectedIds) {
    var msg = "<div class='confirm-pattern-name'><span class='theme-text-strong'>Pattern:</span> <span class='theme-text'>" + patternName + "</span></div>";
    if (affectedIds.length > 0) {
      msg += "<div class='confirm-affected-label theme-text-strong'>Used by " + affectedIds.length + " antenna(s):</div>"
           + "<div class='confirm-affected-list theme-text'>" + affectedIds.join(", ") + "</div>"
           + "<div class='confirm-warning-text'>These antennas will lose their pattern assignment.</div>";
    }
    return msg;
  }

  // After splice at removedIndex: pick correct new default index
  function resolveDefaultIndexAfterDelete(removedIndex) {
    var cur = state.defaultAntennaPatternIndex;
    if (state.antennaPatterns.length === 0) return -1;
    if (cur === removedIndex)  return 0;
    if (cur > removedIndex)    return cur - 1;
    return cur;
  }

  // ---------------------------------------------------------------------------
  // Pattern list rendering
  // ---------------------------------------------------------------------------
  function updateAntennaPatternsList() {
    var container = document.getElementById("antennaPatternsList");
    var select    = document.getElementById("defaultAntennaPatternSelect");
    if (!container || !select) return;

    if (state.antennaPatterns.length === 0) { container.style.display = "none"; return; }

    container.style.display = "block";
    rebuildDefaultSelect(select);
    syncDeleteButtonVisibility(select);
    rebuildPerApSelects();
  }

  function rebuildDefaultSelect(select) {
    select.innerHTML = '<option value="-1">No default pattern</option>';
    state.antennaPatterns.forEach(function (p, i) {
      var opt = document.createElement("option");
      opt.value = i; opt.textContent = patternDisplayText(p); opt.selected = (i === state.defaultAntennaPatternIndex);
      select.appendChild(opt);
    });
  }

  function rebuildPerApSelects() {
    state.aps.forEach(function (ap, idx) {
      var sel = document.getElementById("patternSelect_" + idx);
      if (!sel) return;
      sel.innerHTML = '<option value="-1">Select from uploaded patterns...</option>';
      state.antennaPatterns.forEach(function (p, j) {
        var opt = document.createElement("option");
        opt.value = j; opt.textContent = patternDisplayText(p); opt.selected = (ap.antennaPattern === p);
        sel.appendChild(opt);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Pattern file parsing
  // ---------------------------------------------------------------------------

  /**
   * Parse an MSI/Planet antenna pattern file into a pattern object.
   * Gain in dBd (not dBi) is auto-converted using the +2.15 dB offset.
   */
  function parseAntennaPattern(fileContent) {
    var pattern = { name: "", frequency: 0, hWidth: 360, gain: 0, horizontal: {}, vertical: {} };
    var currentSection = null, hData = [], vData = [];

    fileContent.split("\n").forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      if      (line.startsWith("NAME "))       { pattern.name      = line.substring(5).trim(); }
      else if (line.startsWith("FREQUENCY "))  { pattern.frequency = parseFloat(line.substring(10)); }
      else if (line.startsWith("H_WIDTH "))    { pattern.hWidth    = parseFloat(line.substring(8)); }
      else if (line.startsWith("GAIN "))       { pattern.gain      = parseGainLine(line.substring(5).trim()); }
      else if (line.startsWith("HORIZONTAL"))  { currentSection = "horizontal"; hData = []; }
      else if (line.startsWith("VERTICAL"))    { currentSection = "vertical";   vData = []; }
      else if (currentSection)                 { parsePatternDataLine(line, currentSection, pattern, hData, vData); }
    });

    hData.sort(function (a, b) { return a.angle - b.angle; });
    vData.sort(function (a, b) { return a.angle - b.angle; });
    pattern.horizontalData = hData;
    pattern.verticalData   = vData;

    if (hData.length > 0) {
      pattern._maxValue  = pattern.gain;
      pattern._minValue  = Math.min.apply(null, hData.map(function (d) { return d.gain; }));
      pattern._peakAngle = hData.reduce(function (a, b) { return b.gain > a.gain ? b : a; }).angle;
    }

    return pattern;
  }

  // Parse GAIN line — converts dBd → dBi when unit is "dB"/"dBd" (not "dBi")
  function parseGainLine(gainStr) {
    var v = parseFloat(gainStr);
    return isNaN(v) ? 0 : (/db(?!i)/i.test(gainStr) ? v + DBD_TO_DBI_OFFSET : v);
  }

  function parsePatternDataLine(line, section, pattern, hData, vData) {
    var parts = line.split(/\s+/);
    if (parts.length < 2) return;
    var angle = parseFloat(parts[0]), value = parseFloat(parts[1]);
    if (isNaN(angle) || isNaN(value)) return;
    var key = Math.round(angle), gain = value > 0 ? -value : value;
    if (section === "horizontal") { pattern.horizontal[key] = value; hData.push({ angle: angle, gain: gain }); }
    else                          { pattern.vertical[key]   = value; vData.push({ angle: angle, gain: gain }); }
  }

  // ---------------------------------------------------------------------------
  // Upload flow — multi-file
  //
  // 1. Read all files in parallel
  // 2. Parse each; build batch[]
  // 3. If any need missing fields → ONE combined dialog (retry-capable)
  // 4. Show final confirm: "You uploaded N patterns — register them?"
  // 5. Register all at once, notify parent, refresh once
  // ---------------------------------------------------------------------------

  function handlePatternFileUpload(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;

    // Snapshot FileList → plain Array BEFORE clearing the input.
    // Clearing e.target.value on some browsers invalidates the live FileList reference.
    var fileArray = [];
    for (var i = 0; i < files.length; i++) fileArray.push(files[i]);

    e.target.value = "";  // safe to clear now — we hold a plain array

    readAllFiles(fileArray, processBatch);
  }

  // Read all files in parallel; fire callback once every FileReader has settled.
  // Accepts a plain Array so indices are always stable (no sparse-array holes).
  function readAllFiles(fileArray, callback) {
    var total   = fileArray.length;
    var done    = 0;
    var results = new Array(total);  // pre-sized — guarantees no holes

    fileArray.forEach(function (file, index) {
      var reader = new FileReader();

      reader.onload = function (ev) {
        results[index] = { file: file, rawContent: ev.target.result, error: null };
        if (++done === total) callback(results);
      };

      reader.onerror = function () {
        results[index] = { file: file, rawContent: null, error: "Could not read file." };
        if (++done === total) callback(results);
      };

      reader.readAsText(file);
    });
  }

  function processBatch(readResults) {
    var batch = [];

    readResults.forEach(function (r) {
      if (r.error) {
        NotificationSystem.error('Could not read "' + r.file.name + '": ' + r.error);
        return;
      }
      try {
        var pattern = parseAntennaPattern(r.rawContent);
        batch.push({
          file: r.file, rawContent: r.rawContent, pattern: pattern,
          missingGain: !pattern.gain      || pattern.gain      === 0,
          missingFreq: !pattern.frequency || pattern.frequency === 0,
          isDuplicate: isDuplicatePattern(pattern)
        });
      } catch (err) {
        console.error("Error parsing:", r.file.name, err);
        NotificationSystem.error('Failed to parse "' + r.file.name + '".\n' + err.message);
      }
    });

    if (batch.length === 0) return;

    var needsInput = batch.some(function (item) { return !item.isDuplicate && (item.missingGain || item.missingFreq); });
    if (needsInput) {
      showMissingFieldsDialog(batch, showBatchConfirmDialog);
    } else {
      showBatchConfirmDialog(batch);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 3 — Missing fields dialog (retry-capable, never forces re-upload)
  // ---------------------------------------------------------------------------

  /**
   * Show one dialog for all files with missing fields.
   * On failed validation: re-opens immediately with values preserved + error banner.
   *
   * @param {Array}       batch        — full batch (items mutated in place when valid)
   * @param {function}    callback     — called with patched batch once all fields are valid
   * @param {object}      [saved]      — { "gain_N": "...", "freq_N": "..." } from previous attempt
   * @param {string|null} [errorMsg]   — shown as red banner on retry
   */
  function showMissingFieldsDialog(batch, callback, saved, errorMsg) {
    var needyItems = batch.filter(function (item) { return !item.isDuplicate && (item.missingGain || item.missingFreq); });

    // Assign stable form indices once — preserved across retries
    needyItems.forEach(function (item, i) { if (item._formIndex === undefined) item._formIndex = i; });

    var title = needyItems.length === 1 ? buildMissingFieldsTitle(needyItems[0].missingGain, needyItems[0].missingFreq) : "Missing Pattern Fields";

    NotificationSystem.confirm(buildCombinedMissingFieldsForm(needyItems, saved || {}, errorMsg || null), title, function (confirmed) {
      if (!confirmed) return;

      // Collect all typed values before the dialog closes.
      // IMPORTANT: use distinct variable names (gainEl / freqEl) — declaring
      // `var el` twice in the same function scope is a silent bug with var hoisting.
      var current = {};
      needyItems.forEach(function (item) {
        var idx = item._formIndex;
        if (item.missingGain) { var gainEl = document.getElementById("gainInput_" + idx); current["gain_" + idx] = gainEl ? gainEl.value : ""; }
        if (item.missingFreq) { var freqEl = document.getElementById("freqInput_" + idx); current["freq_" + idx] = freqEl ? freqEl.value : ""; }
      });

      // Validate — on first error re-show the same dialog with values preserved
      for (var i = 0; i < needyItems.length; i++) {
        var item = needyItems[i], idx = item._formIndex;
        if (item.missingGain && (isNaN(parseFloat(current["gain_" + idx])) || parseFloat(current["gain_" + idx]) === 0)) {
          showMissingFieldsDialog(batch, callback, current, 'Max Gain for "' + item.file.name + '" is required and must be a non-zero number (dBi).');
          return;
        }
        if (item.missingFreq && (isNaN(parseFloat(current["freq_" + idx])) || parseFloat(current["freq_" + idx]) <= 0)) {
          showMissingFieldsDialog(batch, callback, current, 'Frequency for "' + item.file.name + '" is required and must be a positive number (MHz).');
          return;
        }
      }

      // All valid — patch each item and continue
      needyItems.forEach(function (item) {
        var idx = item._formIndex;
        if (item.missingGain) {
          var gain = parseFloat(current["gain_" + idx]);
          item.pattern.gain = gain; item.pattern._maxValue = gain;
          item.rawContent = /^GAIN/im.test(item.rawContent) ? item.rawContent.replace(/^GAIN.*/im, "GAIN " + gain + " dBi") : "GAIN " + gain + " dBi\n" + item.rawContent;
        }
        if (item.missingFreq) {
          var freq = parseFloat(current["freq_" + idx]);
          item.pattern.frequency = freq;
          item.rawContent = /^FREQUENCY/im.test(item.rawContent) ? item.rawContent.replace(/^FREQUENCY.*/im, "FREQUENCY " + freq) : "FREQUENCY " + freq + "\n" + item.rawContent;
        }
      });

      callback(batch);

    }, { isHtml: true, confirmLabel: "Continue" });
  }

  function buildMissingFieldsTitle(missingGain, missingFreq) {
    return (missingGain && missingFreq) ? "Missing Pattern Fields" : missingGain ? "Missing Antenna Gain" : "Missing Antenna Frequency";
  }

  function buildCombinedMissingFieldsForm(needyItems, saved, errorMsg) {
    var iStyle  = "width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;";
    var iErr    = "width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #ef4444;border-radius:4px;font-size:13px;background:#fff5f5;";
    var lStyle  = "display:block;font-size:13px;font-weight:600;margin-bottom:4px;";

    var html = errorMsg
      ? "<div style='margin-bottom:14px;padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:13px;color:#dc2626;'>\u26a0\ufe0f " + errorMsg + "</div>"
      : "";

    html += "<p style='margin:0 0 14px;'>The following pattern" + (needyItems.length > 1 ? "s are" : " is") + " missing required fields. Please fill them in to continue:</p>";

    needyItems.forEach(function (item) {
      var idx    = item._formIndex;
      var fields = (item.missingGain && item.missingFreq) ? "gain and frequency" : item.missingGain ? "gain" : "frequency";
      var gVal   = saved["gain_" + idx] || "", fVal = saved["freq_" + idx] || "";
      var gBad   = gVal !== "" && (isNaN(parseFloat(gVal)) || parseFloat(gVal) === 0);
      var fBad   = fVal !== "" && (isNaN(parseFloat(fVal)) || parseFloat(fVal) <= 0);

      html += "<div style='margin-bottom:18px;padding:12px;border:1px solid #e5e7eb;border-radius:6px;'>"
            + "<div style='font-size:13px;font-weight:600;margin-bottom:10px;'>\u2022 " + item.file.name + " <span style='font-weight:400;color:#6b7280;'>(missing " + fields + ")</span></div>";

      if (item.missingGain) html += "<div style='margin-bottom:10px;'><label style='" + lStyle + "'>Max Gain (dBi)</label><input id='gainInput_" + idx + "' type='number' step='0.1' placeholder='e.g. 8.5' value='" + gVal + "' style='" + (gBad ? iErr : iStyle) + "' /></div>";
      if (item.missingFreq) html += "<div><label style='" + lStyle + "'>Frequency (MHz)</label><input id='freqInput_" + idx + "' type='number' step='1' placeholder='e.g. 2400' value='" + fVal + "' style='" + (fBad ? iErr : iStyle) + "' /></div>";

      html += "</div>";
    });

    return html;
  }

  // ---------------------------------------------------------------------------
  // Step 4 + 5 — Batch confirm dialog
  // ---------------------------------------------------------------------------
  function showBatchConfirmDialog(batch) {
    var newItems  = batch.filter(function (item) { return !item.isDuplicate; });
    var skipItems = batch.filter(function (item) { return  item.isDuplicate; });

    if (newItems.length === 0) { NotificationSystem.warning("The uploaded patterns were registered before."); return; }

    NotificationSystem.confirm(buildBatchConfirmMessage(newItems, skipItems), "Confirm Pattern Upload", function (confirmed) {
      if (!confirmed) return;
      registerBatch(newItems);
    }, { isHtml: true, confirmLabel: "Register " + newItems.length + " Pattern" + (newItems.length > 1 ? "s" : "") });
  }

  function buildBatchConfirmMessage(newItems, skipItems) {
    var html = "<p style='margin:0 0 10px;font-size:14px;'>You uploaded <strong>"
             + newItems.length + " pattern" + (newItems.length > 1 ? "s" : "")
             + "</strong>. Do you want to register them?</p>";

    var thStyle = "padding:6px 10px;font-size:11px;font-weight:600;color:#6b7280;"
                + "text-transform:uppercase;letter-spacing:0.04em;"
                + "border-bottom:1px solid #e5e7eb;text-align:left;white-space:nowrap;";
    var tdStyle  = "padding:6px 10px;font-size:12.5px;border-bottom:1px solid #f3f4f6;";
    var tdRStyle = tdStyle + "text-align:right;white-space:nowrap;color:#374151;";

    html += "<div style='border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;'>"
          + "<div style='max-height:220px;overflow-y:auto;'>"
          + "<table style='width:100%;border-collapse:collapse;'>"
          + "<thead style='position:sticky;top:0;background:#f9fafb;'><tr>"
          + "<th style='" + thStyle + "'>Pattern Name</th>"
          + "<th style='" + thStyle + "text-align:right;'>Freq&nbsp;(MHz)</th>"
          + "<th style='" + thStyle + "text-align:right;'>Gain&nbsp;(dBi)</th>"
          + "</tr></thead><tbody>";

    newItems.forEach(function (item) {
      var p = item.pattern;
      html += "<tr>"
            + "<td style='" + tdStyle + "font-weight:500;'>" + (p.name || item.file.name) + "</td>"
            + "<td style='" + tdRStyle + "'>" + (p.frequency || "\u2014") + "</td>"
            + "<td style='" + tdRStyle + "'>" + (p.gain      || "\u2014") + "</td>"
            + "</tr>";
    });

    html += "</tbody></table></div></div>";

    if (skipItems.length > 0) {
      html += "<div style='margin-top:8px;font-size:12px;color:#ef4444;'>"
            + "\u26a0\ufe0f " + skipItems.length + " duplicate" + (skipItems.length > 1 ? "s" : "") + " skipped: "
            + skipItems.map(function (item) { return item.pattern.name || item.file.name; }).join(", ")
            + "</div>";
    }

    return html;
  }

  // ---------------------------------------------------------------------------
  // Step 6 — Register confirmed patterns
  // ---------------------------------------------------------------------------
  function registerBatch(newItems) {
    var wasEmpty = state.antennaPatterns.length === 0;
    var now      = new Date().toISOString();

    var duplicateItems = [];
    var uniqueItems = [];

    newItems.forEach(function (item) {
      item.pattern.fileName = item.file.name; 
      item.pattern.uploadTime = now;

      if (isDuplicatePattern(item.pattern)) {
        duplicateItems.push(item.pattern.name);// || item.file.name);
      } else {
        uniqueItems.push(item);
        state.antennaPatterns.push(item.pattern);
      }
      // this will send one antenna pattern to the backend
      // if (window.parent !== window) {
      //   window.parent.postMessage({ type: "upload_antenna_pattern", filename: item.file.name, content: item.rawContent }, PARENT_ORIGIN);
      // }
    });
    // Only add unique patterns
    // uniqueItems.forEach(function (item) {
    //   item.pattern.fileName = item.file.name;
    //   item.pattern.uploadTime = now;
    //   state.antennaPatterns.push(item.pattern);
    // });

    if (wasEmpty && state.antennaPatterns.length > 0) state.defaultAntennaPatternIndex = 0;

    assignDefaultPatternToUnassignedAps();
    updateAntennaPatternsList();
    draw();

    // Warn if any were duplicates
    console.log("duplicateItems: %s", duplicateItems);
    console.log("uniqueItems: %s", uniqueItems);
    if (duplicateItems.length > 0) {
      NotificationSystem.warning(
        duplicateItems.length + " duplicate pattern(s) skipped: " + duplicateItems.join(", ") +
        ". Only unique patterns were registered."
      );
    }

    // Single postMessage with a "files" array — works for 1 or N patterns
    if (window.parent !== window && uniqueItems.length > 0) {
      window.parent.postMessage({
          type  : "upload_antenna_pattern",
          files : uniqueItems.map(function (item) {
              return { filename: item.file.name, content: item.rawContent };
          }),
      }, PARENT_ORIGIN);
    }
  
    NotificationSystem.success(newItems.length + " pattern" + (newItems.length > 1 ? "s" : "") + " registered successfully!");
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------
  function isDuplicatePattern(pattern) {
    return state.antennaPatterns.some(function (p) {
      if (p.name      !== pattern.name)      return false;
      if (p.frequency !== pattern.frequency) return false;
      if (p.gain      !== pattern.gain)      return false;
  
      if (p.horizontalData.length !== pattern.horizontalData.length) return false;
      if (p.verticalData.length   !== pattern.verticalData.length)   return false;
  
      for (var i = 0; i < p.horizontalData.length; i++) {
        if (p.horizontalData[i].angle !== pattern.horizontalData[i].angle) return false;
        if (p.horizontalData[i].gain  !== pattern.horizontalData[i].gain)  return false;
      }
  
      for (var j = 0; j < p.verticalData.length; j++) {
        if (p.verticalData[j].angle !== pattern.verticalData[j].angle) return false;
        if (p.verticalData[j].gain  !== pattern.verticalData[j].gain)  return false;
      }
  
      return true;
    });
  }

  function assignDefaultPatternToUnassignedAps() {
    var def = getDefaultAntennaPattern();
    if (!def) return;
    state.aps.forEach(function (ap) {
      if (!ap.antennaPattern) { ap.antennaPattern = def; ap.antennaPatternFileName = def.fileName || def.name || null; }
    });
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------
  function initAntennaPatternEvents() {
    bindUploadHandler();
    bindDeleteHandler();
    bindDefaultSelectHandler();
  }

  function bindUploadHandler() {
    var el = document.getElementById("antennaPatternUpload");
    if (!el) return;
    el.multiple = true;
    el.addEventListener("change", handlePatternFileUpload);
  }

  function bindDeleteHandler() {
    var btn = document.getElementById("deleteSelectedPattern");
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      var select = document.getElementById("defaultAntennaPatternSelect");
      if (!select) return;
      var idx = parseInt(select.value, 10);
      if (!isNaN(idx) && idx >= 0 && idx < state.antennaPatterns.length) deleteAntennaPattern(idx);
    });
  }

  function bindDefaultSelectHandler() {
    var select = document.getElementById("defaultAntennaPatternSelect");
    if (!select) return;
    select.addEventListener("change", function (e) {
      var idx = parseInt(e.target.value, 10);
      state.defaultAntennaPatternIndex = isNaN(idx) ? -1 : idx;
      syncDeleteButtonVisibility(select);
      assignDefaultPatternToUnassignedAps();
      draw();
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.getDefaultAntennaPattern  = getDefaultAntennaPattern;
  window.deleteAntennaPattern      = deleteAntennaPattern;
  window.updateAntennaPatternsList = updateAntennaPatternsList;
  window.parseAntennaPattern       = parseAntennaPattern;
  window.initAntennaPatternEvents  = initAntennaPatternEvents;

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", initAntennaPatternEvents); }
  else { initAntennaPatternEvents(); }

})();
