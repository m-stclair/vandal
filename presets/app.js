// Built-in effect stack presets (not stored in localStorage)
export const builtInPresets = [
    {
        name: "Monkey Island",
        config: [
            {
                "name": "Pixelate",
                "config": {
                    "blockSize": 3,
                    "sampleStrategy": "corner",
                    "preserveAlpha": true
                }
            },
            {
                "name": "Pixel Sort",
                "config": {
                    "threshold": 0.68,
                    "direction": "vertical",
                    "useR": true,
                    "useG": true,
                    "useB": true,
                    "perlin": false
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
        "name": "Pastel Unfold",
        "config": [
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
                    "boundMode": "fract",
                    "pitchX": 0,
                    "pitchY": 0,
                    "freqX": 1.0344800199802937,
                    "freqY": 1.0344800199802937,
                    "seed": 1,
                    "depth": 0.5,
                    "rate": 11.953835045930655,
                    "rateDrive": 0.47,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0
                }
            }
        ]
    },
    {
        "name": "Under the Rift",
        "config": [
            {
                "name": "Wave Distortion",
                "config": {
                    "amplitude": 47,
                    "frequency": 0.4,
                    "direction": "horizontal"
                }
            },
            {
                "name": "Contour Synth",
                "config": {
                    "freq": 0.3190439989799574,
                    "freqScale": 7.249460795278276,
                    "phaseScale": 3.18256855947942,
                    "blend": 0.22,
                    "phaseOff": 25.5,
                    "spatialMode": "radial",
                    "colorMode": "none",
                    "hueModStrength": 0.63,
                    "waveform": "tri"
                }
            }
        ]
    },

    {
        "name": "Reverse Oilslick",
        "config": [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.45,
                    "cycle": true,
                    "cycleMode": "brightness",
                    "hueShift": 61,
                    "saturation": 10,
                    "lightness": 50,
                    "hueSpread": 1.2,
                    "bleed": 0
                }
            },
            {
                "name": "Pixelate",
                "config": {
                    "blockSize": 3,
                    "sampleStrategy": "center",
                    "preserveAlpha": true
                }
            }
        ]
    },
    {
        "name": "Undo (Moonlight)",
        "config": [
            {
                "name": "Invert",
                "config": {
                    "invert0": true,
                    "invert1": false,
                    "invert2": false,
                    "mode": "lab"
                }
            },
            {
                "name": "Posterize",
                "config": {
                    "levels": 5,
                    "perChannel": true,
                    "mode": "gamma",
                    "gamma": 0.5,
                    "preserveAlpha": true
                }
            }
        ]
    },
    {
        "name": "Transfer Sunrise",
        "config": [
            {
                "name": "Posterize",
                "config": {
                    "levels": 8,
                    "perChannel": true,
                    "mode": "uniform",
                    "gamma": 2.2,
                    "preserveAlpha": true
                }
            },
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.275,
                    "cycle": true,
                    "cycleMode": "spatial",
                    "hueShift": 286,
                    "saturation": 34,
                    "lightness": 48,
                    "hueSpread": 1.75,
                    "bleed": 0.84
                }
            },
            {
                "name": "Channel Mixer",
                "config": {
                    "colorSpaceIn": "lab",
                    "colorSpaceOut": "lab",
                    "mixMatrix": [
                        [
                            1,
                            0,
                            -0.04
                        ],
                        [
                            0.4,
                            0.69,
                            0
                        ],
                        [
                            0,
                            -0.16,
                            1
                        ]
                    ],
                    "offset": [
                        0,
                        0,
                        0
                    ]
                }
            }
        ]
    },
    {
        "name": "Gouge Away",
        "config": [
            {
                "name": "Colorshred",
                "config": {
                    "density": 0.1,
                    "flip": false
                }
            },
            {
                "name": "Pixel Sort",
                "config": {
                    "threshold": 0.4,
                    "direction": "horizontal",
                    "useR": true,
                    "useG": true,
                    "useB": true,
                    "perlin": false
                }
            }
        ]
    },
    {
        "name": "Detached Pastel",
        "config": [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.675,
                    "cycle": true,
                    "cycleMode": "brightness",
                    "hueShift": 208,
                    "saturation": 20,
                    "lightness": 57,
                    "hueSpread": 1.15,
                    "bleed": 0
                }
            },
            {
                "name": "Perlin Distort (GL)",
                "config": {
                    "pitchX": 1.3,
                    "pitchY": -0.76,
                    "rollX": 1.66,
                    "rollY": 0.5,
                    "freqX": 2,
                    "freqY": 5,
                    "seed": 143,
                    "depth": 0.08,
                    "rate": 1.9581181956675286,
                    "rateDrive": 0,
                    "fc": [
                        8.25,
                        9.75,
                        15.75
                    ],
                    "boundMode": "fract"
                }
            }
        ]
    },
    {
        "name": "glitch haze",
        "config": [
            {
                "name": "Colorshred",
                "config": {
                    "density": 0.2,
                    "flip": false
                }
            },
            {
                "name": "Desync Tiles",
                "config": {
                    "tileSize": 12,
                    "corruptionRate": 0.12,
                    "maxOffset": 6,
                    "freezeTiles": false
                }
            },
            {
                "name": "Blur",
                "config": {
                    "intensity": 2
                }
            }
        ]
    },
    {
        "name": "Failing Monitor",
        "config": [
            {
                "name": "Wave Distortion",
                "config": {
                    "amplitude": 5,
                    "frequency": 0.2,
                    "direction": "vertical"
                }
            },
            {
                "name": "Scanlines",
                "config": {
                    "lineSpacing": 4,
                    "intensity": 0.7,
                    "phase": 0.25
                }
            },
            {
                "name": "RGB Shift (SVG)",
                "config": {
                    "rdx": -3,
                    "rdy": 0,
                    "gdx": 0,
                    "gdy": 0,
                    "bdx": 0,
                    "bdy": 0
                }
            }
        ]
    },
    {
        "name": "Nagel",
        "config": [
            {
                "name": "Affine Transform (GL)",
                "config": {
                    "angle": {
                        "value": 23.13,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "shearX": 0,
                    "shearY": 0,
                    "scaleX": 1.0742140565555607,
                    "scaleY": 1,
                    "translateX": 0,
                    "translateY": 0,
                    "wrap": false
                }
            },
            {
                "name": "Pixel Sort",
                "config": {
                    "threshold": {
                        "value": 0.5,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "direction": "vertical",
                    "useR": true,
                    "useG": true,
                    "useB": true,
                    "perlin": false
                }
            },
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.28,
                    "cycle": false,
                    "cycleMode": "spatial",
                    "hueShift": 296,
                    "saturation": 60,
                    "lightness": 56,
                    "hueSpread": 0.4,
                    "bleed": 0.14
                }
            }
        ]
    }, {
        "name": "Blood Dragon",
        "config": [
            {
                "name": "RGB Shift (SVG)",
                "config": {
                    "rdx": 2,
                    "rdy": 0,
                    "gdx": -2,
                    "gdy": 1,
                    "bdx": 3,
                    "bdy": -1
                }
            },
            {
                "name": "Posterize",
                "config": {
                    "levels": 8,
                    "perChannel": true,
                    "mode": "uniform",
                    "gamma": 2.2,
                    "preserveAlpha": false
                }
            },
            {
                "name": "Scanlines",
                "config": {
                    "lineSpacing": 4,
                    "intensity": 0.5,
                    "phase": 0.28
                }
            },
            {
                "name": "Colormap",
                "config": {
                    "colormap": "neon",
                    "reverse": false
                }
            }
        ]
    }, {
        "name": "Saudade",
        "config": [
            {
                "name": "Noise Mixer (GL)",
                "config": {
                    "frequency": 115.95100609902991,
                    "freqShift": 0.05,
                    "seed": 161,
                    "blendMode": "hard light",
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "components": [
                        0.17,
                        0.03,
                        0.34,
                        0,
                        0.05
                    ],
                    "blur": 2
                }
            },
            {
                "name": "Auto Levels",
                "config": {
                    "method": "percentile",
                    "paramA": 1,
                    "paramB": 72.5,
                    "channelwise": false
                }
            },
            {
                "name": "Colormap",
                "config": {
                    "colormap": "cubehelix",
                    "reverse": false
                }
            }
        ]
    }, {
        "name": "Helium Afternoon",
        "config": [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.415,
                    "cycle": false,
                    "cycleMode": "spatial",
                    "hueShift": 11,
                    "saturation": 78,
                    "lightness": 50,
                    "hueSpread": 1.55,
                    "bleed": 0.01
                }
            },
            {
                "name": "Perlin Distort (GL)",
                "config": {
                    "pitchX": -0.1,
                    "pitchY": 0.1,
                    "freqX": 0.139,
                    "freqY": 0.139,
                    "seed": 109,
                    "depth": 0.33,
                    "rate": 2.027172223044206,
                    "rateDrive": 0.52,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "boundMode": "fract"
                }
            },
            {
                "name": "MorphOp (SVG)",
                "config": {
                    "operator": "dilate",
                    "radius": 2,
                    "threshold": 0.51,
                    "useThreshold": false,
                    "k1": 0.2,
                    "k2": -0.5,
                    "k3": 0.1,
                    "k4": -0.3
                }
            },
            {
                "name": "Invert",
                "config": {
                    "invert0": false,
                    "invert1": true,
                    "invert2": true,
                    "mode": "lab"
                }
            },
            {
                "name": "B/C/S",
                "config": {
                    "brightness": 0.1,
                    "contrast": 1,
                    "saturation": 0.84
                }
            }
        ]
    },
    {
        "name": "Untimely Met",
        "config": [
            {
                "name": "Perlin Distort (GL)",
                "config": {
                    "pitchX": -1.01,
                    "pitchY": 0.25,
                    "rollX": 0.25,
                    "rollY": -0.01,
                    "yawX": 1.37,
                    "yawY": 0,
                    "seed": 35,
                    "depth": 0.77,
                    "rate": 5.947282785909293,
                    "rateDrive": 0,
                    "fc": [
                        7.5,
                        17.25,
                        8.25
                    ],
                    "boundMode": "clamp"
                }
            },
            {
                "name": "Delay Line (GL)",
                "config": {
                    "delay": 8.62,
                    "window": "box",
                    "falloff": "uniform",
                    "density": 5.2,
                    "angle": -10.26,
                    "shearX": 0.3,
                    "shearY": -5,
                    "scaleX": 2.6,
                    "scaleY": 0.1
                }
            }
        ]
    },
    {
        "name": "Craquelure",
        "config": [
            {
                "name": "Colormap",
                "config": {
                    "colormap": "vaportrail",
                    "reverse": true
                }
            },
            {
                "name": "Contour Synth",
                "config": {
                    "freq": 2.0271722230442055,
                    "freqScale": 1.0044899294395582,
                    "phaseScale": 0.3152240342834747,
                    "blend": 0.59,
                    "phaseOff": 103.5,
                    "spatialMode": "xy",
                    "colorMode": "preserve",
                    "hueModStrength": 0.23,
                    "waveform": "sawtooth"
                }
            }
        ]
    }
]