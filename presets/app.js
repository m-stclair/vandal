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
                "name": "Posterize (GL)",
                "config": {
                    "levels": 8,
                    "mode": "3",
                    "mod": 0.55,
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
                    "fuzz": 0,
                    "noiseMode": "blocks"
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
                "name": "Posterize (GL)",
                "config": {
                    "levels": 5,
                    "mode": "1",
                    "colorSpace": "2",
                    "c1": false
                }
            }
        ]
    },
    {
        "name": "Transfer Sunrise",
        "config": [
            {
                "name": "Posterize (GL)",
                "config": {
                    "levels": 8,
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
                "name": "Matrix Channel Mixer",
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
                    "threshold": 0.48,
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
                    "boundMode": "clamp",
                    "pitchX": -0.98,
                    "pitchY": -0.76,
                    "freqX": 5.722920576554524,
                    "freqY": 0.25257086810163276,
                    "seed": 143,
                    "depth": 0.06,
                    "rate": 1.9581181956675286,
                    "rateDrive": 0,
                    "fc": [
                        8.25,
                        9.75,
                        15.75
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    noiseMode: "blocks"
                }
            }
        ]
    },
    {
        "name": "Not Raining",
        "config": [
            {
                "name": "Perlin Distort (GL)",
                "config": {
                    "boundMode": "clamp",
                    "pitchX": -0.91,
                    "pitchY": 0,
                    "freqX": 9.069993561306088,
                    "freqY": 9.82365286443436,
                    "seed": 128,
                    "depth": 0.39,
                    "rate": 4,
                    "rateDrive": 0,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "classic",
                    "clampScale": 0.5
                }
            },
            {
                "name": "Delay Line (GL)",
                "config": {
                    "delay": 5.74,
                    "window": "circle",
                    "falloff": "uniform",
                    "density": 1.6,
                    "angle": -99.23,
                    "shearX": 0,
                    "shearY": 0,
                    "scaleX": 1,
                    "scaleY": 1
                }
            },
            {
                "name": "Perlin Distort (GL)",
                "config": {
                    "boundMode": "clamp",
                    "pitchX": -1.23,
                    "pitchY": -0.1,
                    "freqX": 17.93629400332466,
                    "freqY": 14.810053228674818,
                    "seed": 251,
                    "depth": 0.5,
                    "rate": 4,
                    "rateDrive": 0,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "classic",
                    "clampScale": 0.45
                }
            },
            {
                "name": "Delay Line (GL)",
                "config": {
                    "delay": 2.85,
                    "window": "box",
                    "falloff": "uniform",
                    "density": 2.1,
                    "angle": -99.23,
                    "shearX": 0,
                    "shearY": 0,
                    "scaleX": 1,
                    "scaleY": 1
                }
            },
            {
                "name": "Perlin Distort (GL)",
                "config": {
                    "boundMode": "clamp",
                    "pitchX": -1.07,
                    "pitchY": 0.11,
                    "freqX": 3.012220095961826,
                    "freqY": 4.452548829300998,
                    "seed": 182,
                    "depth": 0.55,
                    "rate": 4,
                    "rateDrive": 0,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "classic",
                    "clampScale": 0.45
                }
            },
            {
                "name": "Channel Mixer (GL)",
                "config": {
                    "mix1": [
                        0.83,
                        0,
                        0
                    ],
                    "mix2": [
                        0,
                        1,
                        0
                    ],
                    "mix3": [
                        -0.14,
                        -0.04,
                        1
                    ],
                    "offset": [
                        0,
                        0,
                        0
                    ],
                    "colorSpace": '0'
                }
            }
        ]
    },
    {
        "name": "Fog Glitch",
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
                "name": "Posterize (GL)",
                "config": {
                    "levels": 8,
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
                    "blendMode": "10",
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
    },
    {
        "name": "Ardor",
        "config": [
            {
                "name": "Noise Mixer (GL)",
                "config": {
                    "frequency": 30.744329067236027,
                    "freqShift": -0.07,
                    "seed": 280,
                    "blendMode": "soft light",
                    "fc": [
                        5,
                        13.75,
                        8.25
                    ],
                    "components": [
                        0,
                        0.44,
                        0,
                        0,
                        0.39
                    ],
                    "blur": 0
                }
            },
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.215,
                    "cycle": true,
                    "cycleMode": "brightness",
                    "hueShift": 70,
                    "saturation": 91,
                    "lightness": 49,
                    "hueSpread": 0.85,
                    "bleed": 0.31
                }
            },
            {
                "name": "Matrix Channel Mixer",
                "config": {
                    "colorSpaceIn": "lab",
                    "colorSpaceOut": "lab",
                    "mixMatrix": [
                        [
                            1,
                            -0.05,
                            -0.09
                        ],
                        [
                            0.1,
                            0.8,
                            0.06
                        ],
                        [
                            -0.3,
                            0.28,
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
        "name": "Nickelodeon",
        "config": [
            {
                "name": "Noise Mixer (GL)",
                "config": {
                    "frequency": 70.25175969985042,
                    "freqShift": 0.15,
                    "tint": [
                        0.7,
                        0.33,
                        0.42
                    ],
                    "seed": 314,
                    "blendMode": "10",
                    "tintSpace": "HSV",
                    "fc": [
                        7,
                        14.75,
                        11.75
                    ],
                    "components": [
                        0,
                        0.81,
                        0.23,
                        0,
                        0
                    ],
                    "master": 0.49,
                    "blur": 0
                }
            }
        ]
    },
    {
        "name": "Thrifted Lava",
        "config": [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.2,
                    "cycle": false,
                    "cycleMode": "spatial",
                    "hueShift": 188,
                    "saturation": 100,
                    "lightness": 50,
                    "hueSpread": 0.55,
                    "bleed": 0.88
                }
            },
            {
                "name": "Perlin Distort (GL)",
                "config": {
                    "boundMode": "fract",
                    "pitchX": -1.41,
                    "pitchY": {
                        "value": -1.06,
                        "mod": {
                            "type": "sine",
                            "freq": 0.01,
                            "phase": 0,
                            "rangeMode": "bipolar",
                            "scale": 2,
                            "offset": 0
                        }
                    },
                    "freqX": 3.3599009346722157,
                    "freqY": 5.959923872645924,
                    "seed": 381,
                    "depth": 0.44,
                    "rate": 4,
                    "rateDrive": 0,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "classic"
                }
            }
        ]
    },
    {
        "name": "Vintage Lava",
        "config": [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.2,
                    "cycle": false,
                    "cycleMode": "spatial",
                    "hueShift": 188,
                    "saturation": 100,
                    "lightness": 50,
                    "hueSpread": 0.55,
                    "bleed": 0.88
                }
            },
            {
                "name": "Perlin Distort (GL)",
                "config": {
                    "boundMode": "fract",
                    "pitchX": -1.41,
                    "pitchY": {
                        "value": -1.06,
                        "mod": {
                            "type": "sine",
                            "freq": 0.01,
                            "phase": 0,
                            "rangeMode": "bipolar",
                            "scale": 2,
                            "offset": 0
                        }
                    },
                    "freqX": 3.3599009346722157,
                    "freqY": 5.959923872645924,
                    "seed": 381,
                    "depth": 0.44,
                    "rate": 4,
                    "rateDrive": 0,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "classic"
                }
            }
        ]
    },
    {
    "name": "When Crayon",
    "config": [
        {
            "name": "Contour Synth",
            "config": {
                "freq": 1,
                "freqScale": 0.7780101850886281,
                "phaseScale": 1.3454242035217665,
                "blend": 0.36,
                "phaseOff": -94.5,
                "spatialMode": "none",
                "colorMode": "pass",
                "hueModStrength": 0.5
            }
        },
        {
            "name": "Noise Mixer (GL)",
            "config": {
                "frequency": 74.06700812523023,
                "freqShift": -0.01,
                "tint": [
                    1,
                    1,
                    1
                ],
                "seed": 374,
                "blendMode": "9",
                "colorSpace": "0",
                "fc": [
                    5.75,
                    15,
                    10
                ],
                "components": [
                    0,
                    0.25,
                    0.45,
                    0,
                    0
                ],
                "blendAmount": 0.5,
                "colormap": "inferno",
                "tintSpace": "RGB",
                "master": 0.69
            }
        },
        {
            "name": "B/C/S",
            "config": {
                "brightness": 0,
                "contrast": 1,
                "saturation": 0.83,
                "graypoint": 0.3
            }
        }
    ]
},
    {
    "name": "Puzzling",
    "config": [
        {
            "name": "Auto Levels",
            "config": {
                "method": "percentile",
                "paramA": 25,
                "paramB": 98.5,
                "channelwise": true
            }
        },
        {
            "name": "Noise Mixer (GL)",
            "config": {
                "frequency": 84.52299235058047,
                "freqShift": 0,
                "tint": [
                    0.56,
                    0.42,
                    0.28
                ],
                "seed": 242,
                "blendMode": "8",
                "colorSpace": "0",
                "fc": [
                    6,
                    15,
                    10
                ],
                "components": [
                    0,
                    0,
                    0,
                    0.85,
                    0
                ],
                "blendAmount": 0.67,
                "colormap": "none",
                "tintSpace": "HSV",
                "master": 0.23
            }
        },
        {
            "name": "Pixelate",
            "config": {
                "blockSize": 44,
                "sampleStrategy": "center",
                "preserveAlpha": true
            }
        },
        {
            "name": "Perlin Distort (GL)",
            "config": {
                "boundMode": "clamp",
                "pitchX": 0,
                "pitchY": 0,
                "freqX": 18.63212537688127,
                "freqY": 17.597682203195408,
                "seed": 145,
                "depth": 0.07,
                "rate": 5.049024392298793,
                "rateDrive": 0,
                "fc": [
                    6,
                    15,
                    10
                ],
                "phase": [
                    0,
                    0
                ],
                "fuzz": 0,
                "noiseMode": "classic",
                "clampScale": 1.15
            }
        }
    ]
},
    {
    "name": "Night City Waterfall",
    "config": [
        {
            "name": "Chromawave",
            "config": {
                "threshold": 0.36,
                "cycle": true,
                "cycleMode": "spatial",
                "hueShift": 143,
                "saturation": 65,
                "lightness": 42,
                "hueSpread": 1.85,
                "bleed": 0
            }
        },
        {
            "name": "Noise Mixer (GL)",
            "config": {
                "frequency": 50,
                "freqShift": 0,
                "tint": [
                    1,
                    1,
                    0.42
                ],
                "seed": 321,
                "blendMode": "9",
                "colorSpace": "0",
                "fc": [
                    6,
                    15,
                    10
                ],
                "components": [
                    0.25,
                    0,
                    0,
                    0.22,
                    0
                ],
                "blendAmount": 0.5,
                "colormap": "aqua_pink",
                "tintSpace": "RGB",
                "master": 1
            }
        },
        {
            "name": "Pixel Sort",
            "config": {
                "threshold": 0.5,
                "direction": "vertical",
                "useR": false,
                "useG": false,
                "useB": true,
                "perlin": false
            }
        },
        {
            "name": "Auto Levels",
            "config": {
                "method": "minmax",
                "paramA": 1,
                "paramB": 100,
                "channelwise": true
            }
        }
    ]
},
    {
    "name": "Not Raining",
    "config": [
        {
            "name": "Perlin Distort (GL)",
            "config": {
                "boundMode": "clamp",
                "pitchX": -0.91,
                "pitchY": 0,
                "freqX": 9.069993561306088,
                "freqY": 9.82365286443436,
                "seed": 128,
                "depth": 0.39,
                "rate": 4,
                "rateDrive": 0,
                "fc": [
                    6,
                    15,
                    10
                ],
                "phase": [
                    0,
                    0
                ],
                "fuzz": 0,
                "noiseMode": "classic",
                "clampScale": 0.5
            }
        },
        {
            "name": "Delay Line (GL)",
            "config": {
                "delay": 5.74,
                "window": "circle",
                "falloff": "uniform",
                "density": 1.6,
                "angle": -99.23,
                "shearX": 0,
                "shearY": 0,
                "scaleX": 1,
                "scaleY": 1
            }
        },
        {
            "name": "Perlin Distort (GL)",
            "config": {
                "boundMode": "clamp",
                "pitchX": -1.23,
                "pitchY": -0.1,
                "freqX": 17.93629400332466,
                "freqY": 14.810053228674818,
                "seed": 251,
                "depth": 0.5,
                "rate": 4,
                "rateDrive": 0,
                "fc": [
                    6,
                    15,
                    10
                ],
                "phase": [
                    0,
                    0
                ],
                "fuzz": 0,
                "noiseMode": "classic",
                "clampScale": 0.45
            }
        },
        {
            "name": "Delay Line (GL)",
            "config": {
                "delay": 2.85,
                "window": "box",
                "falloff": "uniform",
                "density": 2.1,
                "angle": -99.23,
                "shearX": 0,
                "shearY": 0,
                "scaleX": 1,
                "scaleY": 1
            }
        },
        {
            "name": "Perlin Distort (GL)",
            "config": {
                "boundMode": "clamp",
                "pitchX": -1.07,
                "pitchY": 0.11,
                "freqX": 3.012220095961826,
                "freqY": 4.452548829300998,
                "seed": 182,
                "depth": 0.55,
                "rate": 4,
                "rateDrive": 0,
                "fc": [
                    6,
                    15,
                    10
                ],
                "phase": [
                    0,
                    0
                ],
                "fuzz": 0,
                "noiseMode": "classic",
                "clampScale": 0.45
            }
        },
        {
            "name": "Channel Mixer (GL)",
            "config": {
                "mix1": [
                    0.83,
                    0,
                    0
                ],
                "mix2": [
                    0,
                    1,
                    0
                ],
                "mix3": [
                    -0.14,
                    -0.04,
                    1
                ],
                "offset": [
                    0,
                    0,
                    0
                ],
                "colorSpace": "0"
            }
        }
    ]
}
]