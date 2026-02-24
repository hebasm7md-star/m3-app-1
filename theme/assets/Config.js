/**
 * Config.js
 * Application state, element types, wall types, and configuration constants.
 * Single source of truth — all modules read/write window.state.
 */

var state = {
  w: 30,
  h: 20,
  res: 0.2,
  freq: 2400,
  N: 10,
  refl: 6,
  model: "p25d",
  view: "rssi",
  noise: -92,
  aps: [],
  walls: [],
  floorPlanes: [],
  addingWall: false,
  temp: null,
  drag: null,
  addingAP: false,
  addingFloorPlane: false,
  tempFloorPlane: null,
  selectedApForDetail: null,
  minVal: -100,
  maxVal: -30,
  viewMinMax: {
    rssi: { min: -100, max: -30 },
    snr: { min: 0, max: 40 },
    cci: { min: -10, max: 40 },
    thr: { min: 0, max: 80 },
    best: { min: -100, max: -30 },
    servch: { min: -100, max: -30 }
  },
  complianceThreshold: -85,
  compliancePercentage: 80,
  palette: "custom",
  selectedApId: null,
  highlight: false,
  viewedApId: null,
  selectedWallId: null,
  selectedWallIds: [],
  wallDrag: null,
  mouseDownPos: null,
  isDragging: false,
  isDraggingAntenna: false,
  cachedHeatmap: null,
  cachedHeatmapAntennaCount: 0,
  heatmapUpdatePending: false,
  heatmapUpdateRequestId: null,
  heatmapWorker: null,
  heatmapWorkerCallback: null,
  threeScene: null,
  threeRenderer: null,
  threeCamera: null,
  threeObjects: {},
  threeGeometryCache: {},
  threeTextureCache: {},
  useThreeJS: true,
  threeCanvas: null,
  threeRaycaster: null,
  selectionBox: null,
  isSelecting: false,
  justOpenedApSidebar: false,
  weak: "#ff0000",
  mid: "#ffff00",
  strong: "#00ff00",
  backgroundImage: null,
  backgroundImageAlpha: 0.7,
  backgroundImageAspectRatio: null,
  backgroundImageDisplayWidth: null,
  backgroundImageDisplayHeight: null,
  isCalibrating: false,
  calibrationLine: null,
  calibratingDrag: false,
  calibrationPixels: null,
  showContours: false,
  showTooltip: false,
  showVisualization: true,
  selectedElementType: "",
  selectedWallType: "drywall",
  customWallLoss: 15,
  snapToGrid: true,
  snapThreshold: 0.3,
  wallSnapPoints: [],
  manualWallControl: false,
  legendDrag: false,
  legendDragStart: null,
  legendManuallyMoved: false,
  legendDefaultPosition: null,
  antennaPatterns: [],
  defaultAntennaPatternIndex: -1,
  viewMode: "2d",
  viewModeTarget: "2d",
  viewModeTransition: 0,
  cameraRotationX: -Math.PI / 6,
  cameraRotationY: 0,
  cameraZoom: 1.0,
  cameraPanX: 0,
  cameraPanY: 0,
  isRotating3D: false,
  isPanning3D: false,
  rotateStartX: 0,
  rotateStartY: 0,
  rotateStartRotX: 0,
  rotateStartRotY: 0,
  panStartX: 0,
  panStartY: 0,
  panStartPanX: 0,
  panStartPanY: 0,
  groundPlane: {
    enabled: true,
    attenuation: 3.0,
    height: 0,
  },
  floorPlaneAttenuation: 3.0,
  floorPlaneHeight: 0.0,
  floorPlaneType: "horizontal",
  floorPlaneInclination: 0,
  floorPlaneInclinationDirection: 0,
  currentProjectFileName: null,
  // csvCoverageData: null,
  // csvCoverageGrid: null,
  optimizationRsrpGrid: null,
  optimizationCompliancePercent: null,
};

var elementTypes = {
  wall: {
    drywall: {
      loss: 3,
      material: "drywall",
      color: "#3b82f6",
      thickness: 0.15,
      height: 2.5,
      name: "Drywall",
    },
    brick: {
      loss: 8,
      material: "brick",
      color: "#92400e",
      thickness: 0.2,
      height: 2.5,
      name: "Brick",
    },
    concrete: {
      loss: 14.22,
      material: "concrete",
      color: "#6b7280",
      thickness: 0.25,
      height: 2.5,
      name: "Concrete",
    },
    metal: {
      loss: 20,
      material: "metal",
      color: "#374151",
      thickness: 0.1,
      height: 2.5,
      name: "Metal",
    },
    glass: {
      loss: 4.44,
      material: "glass",
      color: "#60a5fa",
      thickness: 0.05,
      height: 2.5,
      name: "Glass",
    },
    wood: {
      loss: 10.3,
      material: "wood",
      color: "#d97706",
      thickness: 0.1,
      height: 2.5,
      name: "Wood",
    },
    custom: {
      loss: 15,
      material: "custom",
      color: "#f59e0b",
      thickness: 0.15,
      height: 2.5,
      name: "Custom",
    },
  },
  door: {
    loss: 10.3,
    material: "wood",
    color: "#8b4513",
    thickness: 0.05,
    height: 2.1,
    width: 1.2,
    name: "Door",
    shape: "door",
  },
  doubleDoor: {
    loss: 10.3,
    material: "wood",
    color: "#8b4513",
    thickness: 0.05,
    height: 2.1,
    width: 2.4,
    name: "Double Door",
    shape: "doubleDoor",
  },
  window: {
    loss: 4.44,
    material: "glass",
    color: "#87ceeb",
    thickness: 0.05,
    height: 1.2,
    width: 1.5,
    name: "Window",
    shape: "window",
  },
};

var wallTypes = {
  drywall: { loss: 3, color: "#3b82f6", thickness: 2, name: "Drywall" },
  brick: { loss: 8, color: "#92400e", thickness: 3, name: "Brick" },
  concrete: {
    loss: 14.22,
    color: "#6b7280",
    thickness: 4,
    name: "Concrete",
  },
  metal: { loss: 20, color: "#374151", thickness: 5, name: "Metal" },
  glass: { loss: 4.44, color: "#60a5fa", thickness: 1.5, name: "Glass" },
  wood: { loss: 10.3, color: "#d97706", thickness: 2.5, name: "Wood" },
  custom: { loss: 15, color: "#f59e0b", thickness: 3, name: "Custom" },
};

/* ========= Config — structured reference for propagation modules ========= */

var Config = {
  propagation: {
    frequency: 2400,
    N: 10,
    verticalFactor: 2.0,
    shapeFactor: 3.0,
    referenceOffset: 0.0,
    minDistance: 0.5,
  },

  groundPlane: state.groundPlane,

  elementTypes: elementTypes,

  signalQuality: {
    excellent: -50,
    good: -60,
    fair: -70,
    weak: -80,
    veryWeak: -100,
  },

  noise: -92,

  compliance: {
    threshold: -85,
    percentage: 80,
  },
};

Config.getSignalQuality = function (rssi) {
  if (rssi > this.signalQuality.excellent) return "Excellent";
  if (rssi > this.signalQuality.good) return "Good";
  if (rssi > this.signalQuality.fair) return "Fair";
  if (rssi > this.signalQuality.weak) return "Weak";
  return "Very Weak";
};

Config.calculateSNR = function (rssi) {
  return rssi - this.noise;
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Config: Config };
}

if (typeof window !== "undefined") {
  window.Config = Config;
}
