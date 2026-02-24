//
// ColorSystem.js
// Maps signal values (RSSI, SNR, SINR, throughput) to RGB colors for heatmap
// pixels. Also provides categorical color assignment for AP, channel, and CCI
// views, and updates the legend bar gradient.
//
// All functions are exposed on window for global access.
//
// Depends on: GeometryUtils.js (clamp01), global state, $() helper
//
// Called by:
//   generateHeatmapAsync()  — colorNumeric, colorForAP, colorForChannel, colorForCount
//   draw()                  — updateLegendBar, colorForAP, colorForChannel, colorForCount
//   renderDoor3D, renderWindow3D, wall rendering — hexToRgb
//

(function () {
  "use strict";

  var channelColorMap = {};
  var cciColorMap = {};

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

  function colorCustom(val) {
    var t = (val - state.minVal) / (state.maxVal - state.minVal);
    t = clamp01(t);
    var w = hexToRgb(state.weak),
      m = hexToRgb(state.mid),
      s = hexToRgb(state.strong);
    var r, g, b, u;
    if (t <= 0.5) {
      u = t / 0.5;
      r = lerp(w.r, m.r, u);
      g = lerp(w.g, m.g, u);
      b = lerp(w.b, m.b, u);
    } else {
      u = (t - 0.5) / 0.5;
      r = lerp(m.r, s.r, u);
      g = lerp(m.g, s.g, u);
      b = lerp(m.b, s.b, u);
    }
    return [r, g, b, 220];
  }

  function colorNumeric(val) {
    var t = (val - state.minVal) / (state.maxVal - state.minVal);
    t = clamp01(t);
    if (t <= 0.01) return [0, 0, 0, 0];

    if (state.showContours) {
      return colorZone(val);
    }

    return colorCustom(val);
  }

  function colorZone(val) {
    var range = state.maxVal - state.minVal;
    var weakMidThreshold = state.minVal + range * 0.33;
    var midStrongThreshold = state.minVal + range * 0.67;

    if (val < weakMidThreshold) {
      return [255, 0, 0, 220];
    } else if (val < midStrongThreshold) {
      return [255, 255, 0, 220];
    } else {
      return [0, 255, 0, 220];
    }
  }

  function updateLegendBar() {
    var bar = $("legendBar");
    if (state.showContours) {
      bar.style.background =
        "linear-gradient(90deg,#ff0000,#ffff00,#00ff00)";
    } else {
      bar.style.background =
        "linear-gradient(90deg,rgba(255,255,255,0)," +
        state.weak +
        "," +
        state.mid +
        "," +
        state.strong +
        ")";
    }
  }

  function hashStr(s) {
    var h = 2166136261 >>> 0,
      i;
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function hslToRgb(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = l - c / 2,
      r = 0,
      g = 0,
      b = 0;
    if (0 <= h && h < 60) {
      r = c;
      g = x;
    } else if (60 <= h && h < 120) {
      r = x;
      g = c;
    } else if (120 <= h && h < 180) {
      g = c;
      b = x;
    } else if (180 <= h && h < 240) {
      g = x;
      b = c;
    } else if (240 <= h && h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    };
  }

  function getAPColorMap(aps) {
    var colorMap = {};
    if (aps.length === 0) return colorMap;
    var goldenAngle = 137.508;
    for (var i = 0; i < aps.length; i++) {
      var ap = aps[i];
      var hue = (i * goldenAngle) % 360;
      var rgb = hslToRgb(hue, 0.75, 0.55);
      colorMap[ap.id] = [rgb.r, rgb.g, rgb.b, 230];
    }
    return colorMap;
  }

  function colorForAP(id) {
    if (state.view === "best" && state.apColorMap && state.apColorMap[id]) {
      return state.apColorMap[id];
    }
    var h = hashStr(String(id)) % 360;
    var rgb = hslToRgb(h, 0.65, 0.55);
    return [rgb.r, rgb.g, rgb.b, 230];
  }

  function seededRandom(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  function colorForChannel(ch) {
    if (channelColorMap[ch]) {
      return channelColorMap[ch];
    }

    var seed = hashStr("ch_color_" + String(ch));
    var hue = seededRandom(seed) * 360;

    var satSeed = hashStr("ch_sat_" + String(ch));
    var lightnessSeed = hashStr("ch_light_" + String(ch));
    var saturation = 0.7 + (seededRandom(satSeed) * 0.2);
    var lightness = 0.5 + (seededRandom(lightnessSeed) * 0.1);

    var rgb = hslToRgb(hue, saturation, lightness);
    var color = [rgb.r, rgb.g, rgb.b, 230];

    channelColorMap[ch] = color;
    return color;
  }

  function colorForCount(count) {
    var n = Math.max(0, Math.round(count || 0));

    if (cciColorMap[n]) {
      return cciColorMap[n];
    }

    var goldenAngle = 137.508;
    var hue = (n * goldenAngle) % 360;
    var rgb = hslToRgb(hue, 0.75, 0.55);
    var color = [rgb.r, rgb.g, rgb.b, 230];

    cciColorMap[n] = color;
    return color;
  }

  window.hexToRgb = hexToRgb;
  window.lerp = lerp;
  window.colorCustom = colorCustom;
  window.colorNumeric = colorNumeric;
  window.colorZone = colorZone;
  window.updateLegendBar = updateLegendBar;
  window.hashStr = hashStr;
  window.hslToRgb = hslToRgb;
  window.getAPColorMap = getAPColorMap;
  window.colorForAP = colorForAP;
  window.colorForChannel = colorForChannel;
  window.colorForCount = colorForCount;
})();
