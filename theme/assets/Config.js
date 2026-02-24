/**
 * Config.js
 * Configuration constants and default values
 * 
 * This matches the HTML state object and elementTypes
 */

const Config = {
    // Propagation model defaults
    propagation: {
        frequency: 2400,  // MHz
        N: 10,            // Path loss exponent (matches state.N in HTML)
        verticalFactor: 2.0,  // 2.5D adjustment
        shapeFactor: 3.0,     // Antenna pattern sharpening
        referenceOffset: 0.0, // RSSI offset
        minDistance: 0.5,     // Minimum distance in meters
    },

    // Ground plane configuration (matches HTML line 3524-3528)
    groundPlane: {
        enabled: true,      // Always enabled by default in HTML
        attenuation: 3.0,   // Ground plane attenuation in dB
        height: 0,          // Ground plane at z=0
    },

    // Element types (matches HTML lines 3541-3630)
    elementTypes: {
        wall: {
            drywall: {
                loss: 3.0,
                material: "drywall",
                color: "#3b82f6",
                thickness: 0.15,
                height: 2.5,
                name: "Drywall"
            },
            brick: {
                loss: 8.0,
                material: "brick",
                color: "#92400e",
                thickness: 0.2,
                height: 2.5,
                name: "Brick"
            },
            concrete: {
                loss: 14.22,  // CRITICAL: 14.22, not 14 or 15!
                material: "concrete",
                color: "#6b7280",
                thickness: 0.25,
                height: 2.5,
                name: "Concrete"
            },
            metal: {
                loss: 20.0,
                material: "metal",
                color: "#374151",
                thickness: 0.1,
                height: 2.5,
                name: "Metal"
            },
            glass: {
                loss: 4.44,  // CRITICAL: 4.44, not 4 or 5!
                material: "glass",
                color: "#60a5fa",
                thickness: 0.05,
                height: 2.5,
                name: "Glass"
            },
            wood: {
                loss: 10.30,  // CRITICAL: 10.30, not 10!
                material: "wood",
                color: "#d97706",
                thickness: 0.1,
                height: 2.5,
                name: "Wood"
            },
            custom: {
                loss: 15.0,
                material: "custom",
                color: "#f59e0b",
                thickness: 0.15,
                height: 2.5,
                name: "Custom"
            }
        },
        door: {
            loss: 10.30,  // Wood (matches HTML line 3601)
            material: "wood",
            color: "#8b4513",
            thickness: 0.05,
            height: 2.1,
            width: 1.2,
            name: "Door",
            shape: "door"
        },
        doubleDoor: {
            loss: 10.30,  // Wood (matches HTML line 3610)
            material: "wood",
            color: "#8b4513",
            thickness: 0.05,
            height: 2.1,
            width: 2.4,
            name: "Double Door",
            shape: "doubleDoor"
        },
        window: {
            loss: 4.44,  // Glass (matches HTML line 3621)
            material: "glass",
            color: "#87ceeb",
            thickness: 0.05,
            height: 1.2,
            width: 1.5,
            name: "Window",
            shape: "window"
        }
    },

    // Signal quality thresholds
    signalQuality: {
        excellent: -50,  // > -50 dBm
        good: -60,       // -50 to -60 dBm
        fair: -70,       // -60 to -70 dBm
        weak: -80,       // -70 to -80 dBm
        veryWeak: -100   // < -80 dBm
    },

    // Noise floor
    noise: -92,  // dBm (matches HTML line 3426)

    // Compliance settings
    compliance: {
        threshold: -85,     // dBm
        percentage: 80      // %
    }
};

// Helper function to get signal quality from RSSI
Config.getSignalQuality = function(rssi) {
    if (rssi > this.signalQuality.excellent) return 'Excellent';
    if (rssi > this.signalQuality.good) return 'Good';
    if (rssi > this.signalQuality.fair) return 'Fair';
    if (rssi > this.signalQuality.weak) return 'Weak';
    return 'Very Weak';
};

// Helper function to calculate SNR
Config.calculateSNR = function(rssi) {
    return rssi - this.noise;
};

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Config };
}

if (typeof window !== 'undefined') {
    window.Config = Config;
}
