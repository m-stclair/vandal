// Built-in effect stack presets (not stored in localStorage)
export const builtInPresets = [
    {
        name: "Monkey Island",
        config: [
            {
                "name": "Invert",
                "config": {
                    "invert0": false,
                    "invert1": false,
                    "invert2": true,
                    "mode": "lab"
                }
            },
            {
                "name": "Posterize",
                "config": {
                    "levels": 8,
                    "perChannel": true,
                    "mode": "gamma",
                    "gamma": 3.3,
                    "preserveAlpha": true
                }
            },
            {
                "name": "Delay Line (GL)",
                "config": {
                    "delay": 178.49,
                    "window": "box",
                    "falloff": "uniform",
                    "density": 2,
                    "angle": 89.38,
                    "shearX": -0.7,
                    "shearY": 5,
                    "scaleX": 3,
                    "scaleY": 3
                }
            }
        ]
    },
    {
        name: "Moody Feedback",
        config: [
            {
                "name": "Invert",
                "config": {
                    "invert0": false,
                    "invert1": false,
                    "invert2": true,
                    "mode": "lab"
                }
            },
            {
                "name": "Posterize",
                "config": {
                    "levels": 8,
                    "perChannel": true,
                    "mode": "gamma",
                    "gamma": 3.3,
                    "preserveAlpha": true
                }
            },
            {
                "name": "Delay Line (GL)",
                "config": {
                    "delay": 178.49,
                    "window": "box",
                    "falloff": "uniform",
                    "density": 2,
                    "angle": 89.38,
                    "shearX": -0.7,
                    "shearY": 5,
                    "scaleX": 3,
                    "scaleY": 3
                }
            }
        ]
    },
    {
        name: "Pastel Silhouette",
        config: [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.57,
                    "cycle": true,
                    "cycleMode": "spatial",
                    "hueShift": 150,
                    "saturation": 35,
                    "lightness": 61,
                    "hueSpread": 1,
                    "bleed": 0.17
                }
            },
            {
                "name": "Perlin Distort (GL)",
                "config": {
                    "pitchX": 1.3,
                    "pitchY": 0.89,
                    "rollX": -1.21,
                    "rollY": 0.5,
                    "yawX": 1.49,
                    "yawY": 0.76,
                    "seed": 138,
                    "depth": 0.56,
                    "rate": 10.542246050789911,
                    "rateDrive": 0.49,
                    "fc": [
                        5,
                        8,
                        9.25
                    ],
                    "boundMode": "clamp"
                }
            }
        ]
    }
]