// 
// RadioCalculations.js
// Standalone module for radio signal calculations.
//
// Contains: rssiFrom, bestApAt, snrAt, cciAt, sinrAt,
//           throughputFromSinr, countInterferingAntennas
//
// IMPORTANT: Call RadioCalculations.init({...}) from IPSStudioV2.6.js
// after state, modelLoss, and _propModel are ready.
//
// Usage:
//   RadioCalculations.init({ state, modelLoss, propModel });
//   var rsrp = RadioCalculations.rssiFrom(ap, x, y);
//   var best = RadioCalculations.bestApAt(x, y);
// 

var RadioCalculations = (function () {
  'use strict';

  // ── Dependencies (injected via init) ──
  var _state = null;
  var _modelLoss = null;
  var _propModel = null;

  // ── Pure math helpers ──
  function log10(x) {
    return Math.log(x) / Math.log(10);
  }
  function dbmToLin(dBm) {
    return Math.pow(10, dBm / 10);
  }
  function linToDbm(lin) {
    return 10 * log10(Math.max(lin, 1e-12));
  }

  // ── Core radio functions ──

  function rssiFrom(ap, x, y) {
    return _propModel.rssi(
      ap.tx,
      _propModel.getAngleDependentGain(ap, {x: x, y: y}),
      _modelLoss(ap.x, ap.y, x, y)
    );
  }

  function bestApAt(x, y) {
    var i,
      best = -1e9,
      ap = null;
    for (i = 0; i < _state.aps.length; i++) {
      var a = _state.aps[i];
      if (a.enabled === false) continue;
      var pr = _propModel.rssi(
        a.tx,
        _propModel.getAngleDependentGain(a, {x: x, y: y}),
        _modelLoss(a.x, a.y, x, y)
      );
      if (pr > best) {
        best = pr;
        ap = a;
      }
    }
    return { ap: ap, rssiDbm: best };
  }

  function cciAt(x, y, servingAp) {
    var i,
      sumLin = 0;
    for (i = 0; i < _state.aps.length; i++) {
      var ap = _state.aps[i];
      if (ap.enabled === false) continue;
      if (ap === servingAp) continue;
      if (ap.ch !== servingAp.ch) continue;
      var p = rssiFrom(ap, x, y);
      sumLin += dbmToLin(p);
    }
    if (sumLin <= 0) return -200;
    return linToDbm(sumLin);
  }

  function countInterferingAntennas(x, y, servingAp) {
    if (!servingAp) return 0;
    var count = 0;
    var servingChannel = servingAp.ch;
    for (var i = 0; i < _state.aps.length; i++) {
      var ap = _state.aps[i];
      if (ap.enabled === false) continue;
      if (ap === servingAp) continue;
      if (ap.ch !== servingChannel) continue;
      var power = rssiFrom(ap, x, y);
      if (power > -85) {
        count++;
      }
    }
    return count;
  }

  function snrAt(rssiDbm) {
    return rssiDbm - _state.noise;
  }

  function sinrAt(rssiDbm, cciDbm) {
    var I = cciDbm < -150 ? 0 : dbmToLin(cciDbm);
    var N = dbmToLin(_state.noise);
    var sinrLin = dbmToLin(rssiDbm) / Math.max(I + N, 1e-12);
    return 10 * log10(sinrLin);
  }

  function throughputFromSinr(sinr) {
    var T = [
      { t: -5, r: 0 },
      { t: 0, r: 6.5 },
      { t: 5, r: 13 },
      { t: 10, r: 26 },
      { t: 15, r: 39 },
      { t: 20, r: 58.5 },
      { t: 25, r: 72.2 },
    ];
    var i,
      rate = 0;
    for (i = 0; i < T.length; i++) {
      if (sinr >= T[i].t) rate = T[i].r;
    }
    return rate;
  }

  // ── Public API ──
  return {
    init: function (deps) {
      _state                  = deps.state;
      _modelLoss              = deps.modelLoss;
      _propModel              = deps.propModel;
      // console.log('RadioCalculations initialized.');
    },

    // Expose all calculation functions
    rssiFrom:                 rssiFrom,
    bestApAt:                 bestApAt,
    cciAt:                    cciAt,
    snrAt:                    snrAt,
    sinrAt:                   sinrAt,
    throughputFromSinr:       throughputFromSinr,
    countInterferingAntennas: countInterferingAntennas,

    // Expose helpers for other modules that may need them
    dbmToLin:                 dbmToLin,
    linToDbm:                 linToDbm
  };
})();
