// 
// DataExportSystem.js
// Refactored CSV export system.
//
// Depends on: RadioCalculations.js (must be loaded & initialized first)
//
// Methods:
//   DataExportSystem.init({ state })
//   DataExportSystem.exportAntennaRsrp(antenna, fileName, spacing)
//   DataExportSystem.exportCoverageMap(fileName, spacing)
//   DataExportSystem.exportDetailedCoverageData(fileName, spacing)
//   DataExportSystem.exportBackendRsrpGrid(fileName)
//   DataExportSystem.exportAntennaConfiguration(fileName)
// 

var DataExportSystem = (function () {
  'use strict';

  // ── Dependency (injected via init) ──
  var _state = null;

  function downloadCSV(csvData, filename) {
    var blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename || 'export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function getCurrentTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  }

  return {
    // ──────────────────────────────────────────────────────────
    // INIT — call from IPSStudioV2.6.js after state is defined
    // ──────────────────────────────────────────────────────────
    init: function (deps) {
      _state = deps.state;
      console.log('DataExportSystem initialized.');
    },

    // 
    // EXPORT ANTENNA-SPECIFIC RSRP
    // Per-antenna signal strength map
    // 
    exportAntennaRsrp: function (antenna, fileName, spacing) {
      if (!_state) {
        console.error('DataExportSystem not initialized. Call DataExportSystem.init() first.');
        return;
      }
      if (!antenna) {
        NotificationSystem.error('No antenna selected for RSRP export');
        return;
      }

      spacing = spacing || 1.0;
      var rows = ['X,Y,RSRP'];
      var count = 0;
      var minRsrp = Infinity;
      var maxRsrp = -Infinity;

      for (var x = 0; x <= _state.w + 1e-9; x += spacing) {
        for (var y = 0; y <= _state.h + 1e-9; y += spacing) {
          var xx = Math.round(x * 1000) / 1000;
          var yy = Math.round(y * 1000) / 1000;

          var rsrp = RadioCalculations.rssiFrom(antenna, xx, yy);

          rows.push(xx + ',' + yy + ',' + rsrp.toFixed(6));
          count++;

          if (rsrp > maxRsrp) maxRsrp = rsrp;
          if (rsrp < minRsrp) minRsrp = rsrp;
        }
      }

      var csvData = rows.join('\n');

      // Generate filename
      var baseFileName = antenna.id || ('antenna_' + Date.now());
      var finalFileName = fileName || (baseFileName + '_rsrp_' + getCurrentTimestamp() + '.csv');

      downloadCSV(csvData, finalFileName);

      NotificationSystem.toast(' Per-antenna RSRP exported successfully', 'success');
      console.log('Antenna RSRP CSV exported:', {
        antennaId: antenna.id,
        points: count,
        minRsrp: minRsrp.toFixed(2),
        maxRsrp: maxRsrp.toFixed(2),
        filename: finalFileName
      });
    },

    // 
    // EXPORT COVERAGE MAP (Combined Antennas - Best Signal)
    // 
    /*exportCoverageMap: function (fileName, spacing) {
      if (!_state) {
        console.error('DataExportSystem not initialized. Call DataExportSystem.init() first.');
        return;
      }

      spacing = spacing || 1.0;
      var rows = ['X,Y,SERVING_AP_ID,BEST_RSRP'];
      var count = 0;
      var cellCount = 0;
      var minRsrp = Infinity;
      var maxRsrp = -Infinity;
      var apCoverage = {}; // Track which AP covers each area

      for (var x = 0; x <= _state.w + 1e-9; x += spacing) {
        for (var y = 0; y <= _state.h + 1e-9; y += spacing) {
          var xx = Math.round(x * 1000) / 1000;
          var yy = Math.round(y * 1000) / 1000;

          var best = RadioCalculations.bestApAt(xx, yy);
          var servingApId = (best && best.ap) ? (best.ap.id || 'AP-' + best.ap.antennaId) : 'NONE';
          var rsrp = (best && best.ap) ? best.rssiDbm : -9999;

          rows.push(xx + ',' + yy + ',' + servingApId + ',' + rsrp.toFixed(6));
          count++;
          cellCount++;

          if (servingApId !== 'NONE') {
            apCoverage[servingApId] = (apCoverage[servingApId] || 0) + 1;
          }

          if (rsrp > -9999) {
            if (rsrp > maxRsrp) maxRsrp = rsrp;
            if (rsrp < minRsrp) minRsrp = rsrp;
          }
        }
      }

      var csvData = rows.join('\n');

      // Generate filename
      var finalFileName = fileName || ('coverage_map_' + getCurrentTimestamp() + '.csv');

      downloadCSV(csvData, finalFileName);

      NotificationSystem.toast(' Coverage map exported successfully', 'success');
      console.log('Coverage Map exported:', {
        totalCells: cellCount,
        activeAPs: Object.keys(apCoverage).length,
        minRsrp: minRsrp === Infinity ? 'N/A' : minRsrp.toFixed(2),
        maxRsrp: maxRsrp === -Infinity ? 'N/A' : maxRsrp.toFixed(2),
        coverageByAP: apCoverage,
        filename: finalFileName
      });
    },*/

    // EXPORT DETAILED RSRP DATA
    // Extended coverage data with multiple metrics per point
    // 
    exportDetailedCoverageData: function (fileName, spacing) {
      if (!_state) {
        console.error('DataExportSystem not initialized. Call DataExportSystem.init() first.');
        return;
      }

      spacing = spacing || 1.0;
      var rows = ['X,Y,best_ap_id,rssi_dbm,snr_db,cci_dbm,sinr_db,throughput_mbps'];
      var count = 0;

      for (var y = 0; y <= _state.h + 1e-9; y += spacing) {
        for (var x = 0; x <= _state.w + 1e-9; x += spacing) {
          var xx = Math.round(x * 1000) / 1000;
          var yy = Math.round(y * 1000) / 1000;

          var best = RadioCalculations.bestApAt(xx, yy);
          if (!best || !best.ap) continue;

          var ap = best.ap;
          var rssiVal = best.rssiDbm;
          var snrVal = RadioCalculations.snrAt(rssiVal);
          var cciVal = RadioCalculations.cciAt(xx, yy, ap);
          var sinrVal = RadioCalculations.sinrAt(rssiVal, cciVal);
          var thrVal = RadioCalculations.throughputFromSinr(sinrVal);

          rows.push(
            xx + ',' + yy + ',' +
            (ap.id || 'AP-' + ap.antennaId) + ',' +
            rssiVal.toFixed(2) + ',' +
            snrVal.toFixed(2) + ',' +
            cciVal.toFixed(2) + ',' +
            sinrVal.toFixed(2) + ',' +
            thrVal.toFixed(3)
          );
          count++;
        }
      }

      var csvData = rows.join('\n');
      var finalFileName = fileName || ('coverage_details.csv'); // + getCurrentTimestamp()

      downloadCSV(csvData, finalFileName);

      NotificationSystem.toast(' Detailed coverage data exported (' + count + ' points)', 'success');
      console.log('Detailed coverage exported:', { points: count, filename: finalFileName });
    },
    // HEBA : this function used only for dubugging the rsrp grid from the backend
    exportBackendRsrpGrid: function (fileName) {
      if (!_state) {
        console.error('DataExportSystem not initialized.');
        return;
      }
      var grid = _state.optimizationRsrpGrid;
      if (!grid || !grid.data) {
        console.warn('No backend RSRP grid data available to export.');
        return;
      }

      var csvRows = ['X,Y,rsrp'];
      for (var r = 0; r < grid.rows; r++) {
        for (var c = 0; c < grid.cols; c++) {
          var x = (c + 0.5) * grid.dx;
          var y = (r + 0.5) * grid.dy;
          var rsrp = grid.data[r * grid.cols + c];
          csvRows.push(x.toFixed(3) + ',' + y.toFixed(3) + ',' + rsrp.toFixed(2));
        }
      }

      var csvData = csvRows.join('\n');
      var finalFileName = fileName || ('backend_rsrp.csv');
      downloadCSV(csvData, finalFileName);

      NotificationSystem.toast('Backend RSRP grid exported (' + grid.data.length + ' points)', 'success');
      console.log('Backend RSRP exported:', { cols: grid.cols, rows: grid.rows, points: grid.data.length, filename: finalFileName });
    },

    // 
    // EXPORT ANTENNA POSITIONS & STATUS
    // 
    /*exportAntennaConfiguration: function (fileName) {
      if (!_state) {
        console.error('DataExportSystem not initialized. Call DataExportSystem.init() first.');
        return;
      }

      var rows = ['antenna_id,X,Y,Z,tx_power,azimuth,tilt,enabled,channel'];

      _state.aps.forEach(function (ap, index) {
        rows.push(
          (ap.id || 'AP-' + (index + 1)) + ',' +
          ap.x.toFixed(2) + ',' +
          ap.y.toFixed(2) + ',' +
          (ap.z || 2.5).toFixed(2) + ',' +
          (ap.tx || 15) + ',' +
          (ap.azimuth || 0).toFixed(1) + ',' +
          (ap.tilt || 0).toFixed(1) + ',' +
          (ap.enabled !== false ? 'YES' : 'NO') + ',' +
          (ap.ch || 1)
        );
      });

      var csvData = rows.join('\n');
      var finalFileName = fileName || ('antenna_config_' + getCurrentTimestamp() + '.csv');

      downloadCSV(csvData, finalFileName);

      NotificationSystem.toast(' Antenna configuration exported (' + state.aps.length + ' antennas)', 'success');
      console.log('Antenna configuration exported:', { totalAntennas: state.aps.length, filename: finalFileName });
    }*/
  };
})();
// AI COMMENT: Refactored CSV export system
// REPLACES: exportFrontendRsrpCsv() [line 206] + exportAntennaRsrpCsv() [line 240]
// IMPROVEMENTS:
//   - Separate per-antenna RSRP (specific antenna signal map)
//   - Separate coverage map (best signal from all antennas)
//   - New detailed metrics export (SINR, throughput, CCI)
//   - New antenna configuration export
//   - Professional filename generation with timestamps
//   - Statistics and summary logging
//   - Consistent toast notifications via NotificationSystem
// USAGE:
//   DataExportSystem.exportAntennaRsrp(antenna, 'MyAntenna.csv', 1.0);
//   DataExportSystem.exportCoverageMap('coverage.csv', 1.0);
//   DataExportSystem.exportDetailedCoverageData('detailed.csv', 1.0);
//   DataExportSystem.exportAntennaConfiguration('config.csv');

