/**
 * PropagationModel25D.js
 * 2.5D Propagation Model - Standalone Module
 * 
 * This module contains all RSSI calculation logic extracted from the HTML.
 * Can be used in Node.js or browser.
 * 
 * Usage:
 *   import { PropagationModel25D } from './PropagationModel25D.js';
 *   // or
 *   const { PropagationModel25D } = require('./PropagationModel25D.js');
 */

class PropagationModel25D {
  /**
     * Initialize the propagation model
     * @param {Object} config - Configuration object
     * @param {number} config.frequency - Frequency in MHz (default: 2400)
     * @param {number} config.N - Path loss exponent (default: 10)
     * @param {number} config.verticalFactor - 2.5D adjustment in dB (default: 2.0)
     * @param {number} config.shapeFactor - Antenna pattern sharpening (default: 3.0)
     */
  constructor(config = {}) {
    this.freq = config.frequency || 2400;
    this.N = config.N || 10;  // Path loss exponent (state.N in HTML)
    this.verticalFactor = config.verticalFactor || 2.0;
    this.shapeFactor = config.shapeFactor || 3.0;
    this.referenceOffset = config.referenceOffset || 0.0;
    this.minDistance = 0.5;  // Minimum distance in meters
  }

  /**
     * Logarithm base 10
     */
  log10(x) {
    return Math.log10(Math.max(x, 1e-10));
  }

  /**
     * Euclidean distance
     */
  hypot(dx, dy) {
    return Math.hypot(dx, dy);
  }

  /**
     * Free-Space Path Loss
     * @param {number} freqMHz - Frequency in MHz
     * @param {number} d - Distance in meters
     * @returns {number} Path loss in dB
     */
  fspl(freqMHz, d) {
    d = Math.max(d, this.minDistance);
    return 20 * this.log10(freqMHz) + 20 * this.log10(d) - 27.55;
  }

  /**
     * Ground plane loss with distance factor
     * @param {Object} txPos - Transmitter position {x, y}
     * @param {Object} rxPos - Receiver position {x, y}
     * @param {Object} config - Ground plane config {enabled, attenuation}
     * @returns {number} Ground plane loss in dB
     */
  groundPlaneLoss(txPos, rxPos, config) {
    if (!config || !config.enabled) return 0;

    const baseAttenuation = config.attenuation || 3.0;
    const distance = this.hypot(rxPos.x - txPos.x, rxPos.y - txPos.y);
    const distanceFactor = Math.min(1.0, distance / 10.0);

    return baseAttenuation * (0.7 + 0.3 * distanceFactor);
  }

  /**
     * Floor planes loss (vertical obstructions)
     * @param {Object} txPos - Transmitter position {x, y}
     * @param {Object} rxPos - Receiver position {x, y}
     * @param {Array} floorPlanes - Array of floor plane objects
     * @returns {number} Floor planes loss in dB
     */
  floorPlanesLoss(txPos, rxPos, floorPlanes) {
    let totalLoss = 0;
    for (const fp of floorPlanes) {
      if (this.lineIntersectsRect(txPos, rxPos, fp)) {
        totalLoss += fp.attenuation || 0;
      }
    }
    return totalLoss;
  }

  /**
     * Check if line intersects rectangle
     */
  lineIntersectsRect(p1, p2, rect) {
    // Check if either endpoint is inside
    if (this.pointInRect(p1, rect) || this.pointInRect(p2, rect)) {
      return true;
    }

    // Check edges
    const edges = [
      [rect.p1, rect.p2],
      [rect.p2, rect.p3],
      [rect.p3, rect.p4],
      [rect.p4, rect.p1]
    ];

    for (const [e1, e2] of edges) {
      if (this.segmentsIntersect(p1, p2, e1, e2)) {
        return true;
      }
    }

    return false;
  }

  /**
     * Check if point is inside rectangle
     */
  pointInRect(p, rect) {
    const xs = [rect.p1.x, rect.p2.x, rect.p3.x, rect.p4.x];
    const ys = [rect.p1.y, rect.p2.y, rect.p3.y, rect.p4.y];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
  }

  /**
     * Check if two line segments intersect
     */
  segmentsIntersect(p1, q1, p2, q2) {
    const orient = (p, q, r) => {
      const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
      if (val === 0) return 0;
      return val > 0 ? 1 : 2;
    };

    const onSegment = (p, q, r) => {
      return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
        q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
    };

    const o1 = orient(p1, q1, p2);
    const o2 = orient(p1, q1, q2);
    const o3 = orient(p2, q2, p1);
    const o4 = orient(p2, q2, q1);

    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;

    return false;
  }

  /**
     * Calculate wall loss
     * @param {Object} txPos - Transmitter position {x, y}
     * @param {Object} rxPos - Receiver position {x, y}
     * @param {Array} walls - Array of wall objects
     * @param {Object} elementTypes - Element type definitions
     * @returns {number} Total wall loss in dB
     */
  wallsLoss(txPos, rxPos, walls, elementTypes = null) {
    let totalLoss = 0;

    for (const wall of walls) {
      // Get wall segments
      const segments = [];
      if (wall.points && wall.points.length >= 2) {
        for (let i = 0; i < wall.points.length - 1; i++) {
          segments.push([wall.points[i], wall.points[i + 1]]);
        }
      } else if (wall.p1 && wall.p2) {
        segments.push([wall.p1, wall.p2]);
      } else {
        continue;
      }

      // Check intersection
      let intersects = false;
      for (const [s1, s2] of segments) {
        if (this.segmentsIntersect(txPos, rxPos, s1, s2)) {
          intersects = true;
          break;
        }
      }

      if (intersects) {
        // Get loss value
        let loss = wall.loss || 0;

        // If no loss specified, try to get from elementTypes
        if (loss === 0 && elementTypes) {
          const elemType = wall.elementType || wall.type;
          if (elemType && elementTypes[elemType]) {
            loss = elementTypes[elemType].loss || 0;
          } else if (wall.type && elementTypes.wall && elementTypes.wall[wall.type]) {
            loss = elementTypes.wall[wall.type].loss || 0;
          }
        }

        totalLoss += loss;
      }
    }

    return totalLoss;
  }

  /**
     * Interpolate gain from antenna pattern
     * @param {Array} data - Pattern data [{angle, gain}, ...]
     * @param {number} angle - Angle in degrees
     * @returns {number} Interpolated gain value
     */
  interpolateGain(data, angle) {
    if (!data || data.length === 0) return 0;
    if (data.length === 1) return data[0].gain;

    // Normalize angle to 0-360
    angle = ((angle % 360) + 360) % 360;

    // Find surrounding points
    const upperIdx = data.findIndex(p => p.angle > angle);

    let p1, p2;

    if (upperIdx === 0) {
      // Wraparound: angle between last and first
      p1 = data[data.length - 1];
      p2 = { angle: data[0].angle + 360, gain: data[0].gain };
    } else if (upperIdx === -1) {
      // Wraparound: angle larger than all points
      p1 = data[data.length - 1];
      p2 = { angle: data[0].angle + 360, gain: data[0].gain };
    } else {
      // Standard case
      p1 = data[upperIdx - 1];
      p2 = data[upperIdx];
    }

    const angleRange = p2.angle - p1.angle;
    if (Math.abs(angleRange) < 1e-9) {
      return p1.gain;
    }

    const t = (angle - p1.angle) / angleRange;
    return p1.gain + t * (p2.gain - p1.gain);
  }

  /**
     * Get gain from antenna pattern at specific angles
     * @param {Object} pattern - Pattern object {horizontalData, verticalData, _maxValue}
     * @param {number} horizontalAngleDeg - Horizontal angle in degrees
     * @param {number} verticalAngleDeg - Vertical angle in degrees
     * @returns {number} Gain in dBi
     */
  getGainFromPattern(pattern, horizontalAngleDeg, verticalAngleDeg) {
    if (!pattern || !pattern.horizontalData || pattern.horizontalData.length === 0) {
      return 0;
    }

    // Normalize horizontal angle
    const hAngle = ((horizontalAngleDeg % 360) + 360) % 360;

    // Interpolate horizontal gain
    const hGain = this.interpolateGain(pattern.horizontalData, hAngle);

    // If vertical data exists and elevation is significant
    if (pattern.verticalData && pattern.verticalData.length > 0 && Math.abs(verticalAngleDeg) > 0.1) {
      // Convert elevation to pattern angle (0-180 range)
      let vAngle = 90 + verticalAngleDeg;
      vAngle = Math.max(0, Math.min(180, vAngle));

      // Interpolate vertical gain
      const vGain = this.interpolateGain(pattern.verticalData, vAngle);

      // Combine using geometric mean (3D patterns)
      const hGainLinear = Math.pow(10, hGain / 10);
      const vGainLinear = Math.pow(10, vGain / 10);
      const combinedGainLinear = Math.sqrt(
        Math.max(0, hGainLinear) * Math.max(0, vGainLinear)
      );

      return (hGain + vGain) / 2.0;

    }

    return hGain;
  }

  /**
     * Get angle-dependent gain for access point
     * CRITICAL: Includes shape factor for pattern sharpening
     * @param {Object} ap - Access point object
     * @param {Object} rxPos - Receiver position {x, y}
     * @param {Object} patterns - Patterns registry
     * @returns {number} Effective antenna gain in dB
     */
  getAngleDependentGain(ap, rxPos, patterns = null) {


    const txX = ap.x;
    const txY = ap.y;
    const rxX = rxPos.x;
    const rxY = rxPos.y;

    if (txX === rxX && txY === rxY) {
      return ap.gt || ap.gain || 0;
    }

    const angleToPoint = Math.atan2(rxY - txY, rxX - txX);
    const apAzimuth = ap.azimuth || ap.heading || 0;
    const apAngle = ((apAzimuth + 90) * Math.PI) / 180;
    const angleDiff = angleToPoint - apAngle;
    const angleDiffDeg = ((angleDiff * 180 / Math.PI) + 360) % 360;


    let pattern = null;
    const patternAttr = ap.antennaPattern;

    if (typeof patternAttr === 'string') {
      if (patterns && patterns[patternAttr]) {
        pattern = patterns[patternAttr];
      }
    } else {
      pattern = patternAttr;
    }

    if (pattern && pattern.horizontalData && pattern.horizontalData.length > 0) {

      let elevationAngleDeg = 0;
      const antennaHeight = ap.z || 2.5;
      const targetHeight = 1.5;
      const horizontalDist = this.hypot(rxX - txX, rxY - txY);


      if (horizontalDist > 0.1 && pattern.verticalData && pattern.verticalData.length > 0) {
        const verticalDist = antennaHeight - targetHeight;
        const elevationFromHorizontalRad = Math.atan2(verticalDist, horizontalDist);
        const tiltRad = ((ap.tilt || 0) * Math.PI) / 180;
        const elevationRelativeToBoresightRad = elevationFromHorizontalRad - tiltRad;

        elevationAngleDeg = (elevationRelativeToBoresightRad * 180) / Math.PI;
        elevationAngleDeg = Math.max(-90, Math.min(90, elevationAngleDeg));
      } else {
        console.log("✗ Vertical pattern NOT applied. Reasons:");
        console.log("  horizontalDist > 0.1?", horizontalDist > 0.1);
        console.log("  pattern.verticalData exists?", pattern.verticalData !== undefined);
        console.log("  verticalData.length > 0?", pattern.verticalData ? pattern.verticalData.length > 0 : false);
      }

      const gainDbi = this.getGainFromPattern(pattern, angleDiffDeg, elevationAngleDeg);

      const peakGainDbi = pattern._maxValue !== undefined ? pattern._maxValue : 
        (ap.gt || ap.gain || 8.0);

      const exaggeratedDbDown = gainDbi * this.shapeFactor;

      const finalGain = peakGainDbi + exaggeratedDbDown;

      return finalGain;
    }

    console.log("No pattern found, using fallback");
    // Fallback code...
    return (ap.gt || ap.gain || 0);
  }

  /**
     * Calculate 2.5D path loss
     * @param {Object} txPos - Transmitter position {x, y}
     * @param {Object} rxPos - Receiver position {x, y}
     * @param {Array} walls - Array of walls
     * @param {Array} floorPlanes - Array of floor planes
     * @param {Object} groundPlaneConfig - Ground plane configuration
     * @param {Object} elementTypes - Element type definitions
     * @returns {number} Total path loss in dB
     */
  p25dLoss(txPos, rxPos, walls = [], floorPlanes = [], groundPlaneConfig = null, elementTypes = null) {
    let d = this.hypot(rxPos.x - txPos.x, rxPos.y - txPos.y);
    d = Math.max(d, this.minDistance);

    // Reference loss at 1m
    const refLoss1m = this.fspl(this.freq, 1.0);

    // Distance loss with path loss exponent
    // CRITICAL: HTML uses state.N * log10(d), not 10 * n * log10(d)
    console.log(`Calculating distance loss: N = ${this.N}, distance = ${d.toFixed(2)} m`);
    const distanceLoss = this.N * this.log10(d);
    console.log("ref loss:", refLoss1m);
    console.log("dist loss:", distanceLoss);

    // Base loss
    const baseLoss = refLoss1m + distanceLoss;
    console.log(`Base FSPL loss from AP to RX at (${rxPos.x}, ${rxPos.y}): ${baseLoss.toFixed(2)} dB`);

    // Environmental losses
    const wallAttenuation = this.wallsLoss(txPos, rxPos, walls, elementTypes);
    const groundAttenuation = this.groundPlaneLoss(txPos, rxPos, groundPlaneConfig);
    const floorPlaneAttenuation = this.floorPlanesLoss(txPos, rxPos, floorPlanes);

    return baseLoss + wallAttenuation + groundAttenuation + floorPlaneAttenuation + this.verticalFactor;
  }

  /**
     * Calculate RSSI
     * @param {number} tx - Transmit power in dBm
     * @param {number} gt - Antenna gain in dB
     * @param {number} L - Path loss in dB
     * @returns {number} RSSI in dBm
     */
  rssi(tx, gt, L) {
    return tx + gt - L - this.referenceOffset;
  }

  /**
     * Calculate RSSI from access point to receiver location
     * @param {Object} ap - Access point object
     * @param {Object} rxPos - Receiver position {x, y}
     * @param {Array} walls - Array of walls
     * @param {Array} floorPlanes - Array of floor planes
     * @param {Object} groundPlaneConfig - Ground plane configuration
     * @param {Object} elementTypes - Element type definitions
     * @param {Object} patterns - Patterns registry
     * @returns {number} RSSI in dBm
     */
  calculateRSSI(ap, rxPos, walls = [], floorPlanes = [], groundPlaneConfig = null, elementTypes = null, patterns = null) {
    const txPos = { x: ap.x, y: ap.y };
    const loss = this.p25dLoss(txPos, rxPos, walls, floorPlanes, groundPlaneConfig, elementTypes);
    console.log(`Calculated path loss from AP at (${ap.x}, ${ap.y}) to RX at (${rxPos.x}, ${rxPos.y}): ${loss.toFixed(2)} dB`);
    const gain = this.getAngleDependentGain(ap, rxPos, patterns);
    console.log(`Calculated angle-dependent gain from AP at (${ap.x}, ${ap.y}) to RX at (${rxPos.x}, ${rxPos.y}): ${gain.toFixed(2)} dB`);
    return this.rssi(ap.tx, gain, loss);
  }

  /**
     * Find best access point at location
     * @param {Array} aps - Array of access points
     * @param {Object} rxPos - Receiver position {x, y}
     * @param {Array} walls - Array of walls
     * @param {Array} floorPlanes - Array of floor planes
     * @param {Object} groundPlaneConfig - Ground plane configuration
     * @param {Object} elementTypes - Element type definitions
     * @param {Object} patterns - Patterns registry
     * @returns {Object} {ap, rssi} - Best AP and its RSSI
     */
  bestApAt(aps, rxPos, walls = [], floorPlanes = [], groundPlaneConfig = null, elementTypes = null, patterns = null) {
    let bestRssi = -1e9;
    let bestAp = null;

    for (const ap of aps) {
      if (ap.enabled === false) continue;

      const rssi = this.calculateRSSI(ap, rxPos, walls, floorPlanes, groundPlaneConfig, elementTypes, patterns);

      if (rssi > bestRssi) {
        bestRssi = rssi;
        bestAp = ap;
      }
    }

    return { ap: bestAp, rssi: bestRssi };
  }
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PropagationModel25D };
}

// Export for ES6 modules
if (typeof window !== 'undefined') {
  window.PropagationModel25D = PropagationModel25D;
}

