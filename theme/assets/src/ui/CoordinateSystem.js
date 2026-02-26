// 02-COORDINATE-SYSTEM.js - Map between world and screen canvas coordinates
// Depends on: global state, canvas, pad()

var CoordinateSystem = (function() {

  function pad() {
    return 30;
  }

  function mx(x) {
    var canvas = document.getElementById("plot");
    if (!canvas) return 0;
    return pad() + (x * (canvas.width - 2 * pad())) / state.w;
  }

  function my(y) {
    var canvas = document.getElementById("plot");
    if (!canvas) return 0;
    return pad() + (y * (canvas.height - 2 * pad())) / state.h;
  }

  function invx(px) {
    var canvas = document.getElementById("plot");
    if (!canvas) return 0;
    return ((px - pad()) * state.w) / (canvas.width - 2 * pad());
  }

  function invy(py) {
    var canvas = document.getElementById("plot");
    if (!canvas) return 0;
    return ((py - pad()) * state.h) / (canvas.height - 2 * pad());
  }

  // Convert world coordinates to canvas pixel coordinates (top-left reference)
  function worldToCanvasPixels(worldX, worldY) {
    var canvasX = mx(worldX);
    var canvasY = my(worldY);
    return { x: canvasX, y: canvasY };
  }

  window.pad = pad;
  window.mx = mx;
  window.my = my;
  window.invx = invx;
  window.invy = invy;
  window.worldToCanvasPixels = worldToCanvasPixels;

  return {
    pad: pad,
    mx: mx,
    my: my,
    invx: invx,
    invy: invy,
    worldToCanvasPixels: worldToCanvasPixels
  };
})();
