(function () {
  "use strict";

  function rssiFrom(ap, x, y) {
    return rssi(
      ap.tx,
      getAngleDependentGain(ap, x, y),
      modelLoss(ap.x, ap.y, x, y)
    );
  }

  function bestApAt(x, y) {
    var i,
      best = -1e9,
      ap = null;
    for (i = 0; i < state.aps.length; i++) {
      var a = state.aps[i];
      if (a.enabled === false) continue;
      var pr = rssi(
        a.tx,
        getAngleDependentGain(a, x, y),
        modelLoss(a.x, a.y, x, y)
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
    for (i = 0; i < state.aps.length; i++) {
      var ap = state.aps[i];
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
    for (var i = 0; i < state.aps.length; i++) {
      var ap = state.aps[i];
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
    return rssiDbm - state.noise;
  }

  function sinrAt(rssiDbm, cciDbm) {
    var I = cciDbm < -150 ? 0 : dbmToLin(cciDbm);
    var N = dbmToLin(state.noise);
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

  window.rssiFrom = rssiFrom;
  window.bestApAt = bestApAt;
  window.cciAt = cciAt;
  window.countInterferingAntennas = countInterferingAntennas;
  window.snrAt = snrAt;
  window.sinrAt = sinrAt;
  window.throughputFromSinr = throughputFromSinr;
})();
