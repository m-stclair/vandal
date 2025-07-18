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
                    "mode": "2"
                }
            },
            {
                "name": "Posterize",
                "config": {
                    "levels": 8,
                    "mode": "3",
                    "mod": 0.55,
                }
            },
            {
                "name": "Delay Line",
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
                    "threshold": 0.3,
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
                "name": "Perlin Distort",
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
                    "noiseMode": "pseudo"
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
                    "amplitude": 0.5,
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
        "name": "Transfer Sunrise",
        "config": [{
            "name": "Posterize",
            "config": {
                "levels": 8,
                "mode": "1",
                "colorSpace": "0",
                "blendAmount": 1,
                "mod": 0.5,
                "c1": true,
                "c2": true,
                "c3": true
            }
        }, {
            "name": "Chromawave",
            "config": {
                "threshold": 0.37,
                "cycle": true,
                "cycleMode": "spatial",
                "hueShift": 1.26,
                "saturation": 34,
                "lightness": 48,
                "hueSpread": 0.6,
                "bleed": 0.77,
                "COLORSPACE": 0,
                "BLENDMODE": "1",
                "blendAmount": 1,
                "bandingSteps": 0,
                "waveType": "square",
                "dutyCycle": 0.5,
                "originX": 0.57,
                "originY": 0.42,
                "spatialPattern": "radial"
            }
        }, {
            "name": "Channel Mixer",
            "config": {
                "mix1": [1, 0, -0.04],
                "mix2": [0.4, 0.83, 0],
                "mix3": [0, -0.14, 1],
                "offset": [0, 0, 0],
                "colorSpace": "1"
            }
        }]
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
                "name": "Perlin Distort",
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
                    noiseMode: "pseudo"
                }
            }
        ]
    },
    {
        "name": "Not Raining",
        "config": [
            {
                "name": "Perlin Distort",
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
                "name": "Delay Line",
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
                "name": "Perlin Distort",
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
                "name": "Delay Line",
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
                "name": "Perlin Distort",
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
                "name": "Channel Mixer",
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
        "name": "Failing Monitor",
        "config": [
            {
                "name": "Wave Distortion",
                "config": {
                    "amplitude": 0.05,
                    "frequency": 0.2,
                    "direction": "vertical"
                }
            },
            {
                "name": "Scanlines",
                "config": {
                    "lineSpacing": 135,
                    "intensity": 0.7,
                    "phase": 0.25
                }
            },
            {
                "name": "Chromatic Aberration",
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
        "name": "Been There",
        "config": [{
            "name": "Desync Tiles",
            "config": {"tileSize": 60, "corruptionRate": 0.19, "maxOffset": 28, "freezeTiles": false}
        }, {
            "name": "Noise Mixer",
            "config": {
                "frequency": 1.8814068375361006,
                "freqShift": -0.15,
                "tint": [1, 1, 1],
                "seed": 208,
                "blendMode": "1",
                "colorSpace": "1",
                "fc": [6, 15, 10],
                "components": [0.25, 0, 0.56, 0, 0, 0, 0],
                "blendAmount": 0.49,
                "colormap": "aqua_pink",
                "tintSpace": "RGB",
                "master": 0.49
            }
        }, {
            "name": "Auto Levels",
            "config": {"method": "percentile", "paramA": 55.5, "paramB": 100, "channelwise": true}
        }, {
            "name": "Pixel Sort",
            "config": {
                "threshold": 0.25,
                "direction": "horizontal",
                "useR": false,
                "useG": false,
                "useB": true,
                "perlin": false
            }
        }]
    },
    {
        "name": "Nagel",
        "config": [
            {
                "name": "Affine Transform",
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
    },
    {
    "name": "Venetian Morning",
    "config": [
        {
            "name": "Invert",
            "config": {
                "invert0": false,
                "invert1": false,
                "invert2": true,
                "COLORSPACE": 0,
                "mode": "lab",
                "colorSpace": "1"
            }
        },
        {
            "name": "Banded Flip",
            "config": {
                "bandSize": 76,
                "orientation": "vertical",
                "mirrorRate": 1,
                "offset": -3
            }
        }
    ]
},

    {
        "name": "Blood Dragon",
        "config": [
            {
                "name": "Chromatic Aberration",
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
                }
            },
            {
                "name": "Scanlines",
                "config": {
                    "lineSpacing": 225,
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
                "name": "Noise Mixer",
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
                        0.05,
                        0,
                        0
                    ],
                    "blur": 2
                }
            },
            {
                "name": "Auto Levels",
                "config": {
                    "method": "percentile",
                    "paramA": 1,
                    "paramB": 75,
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
        "config": [{
            "name": "Chromawave",
            "config": {
                "threshold": 0.3,
                "cycle": false,
                "cycleMode": "spatial",
                "hueShift": 1.55,
                "saturation": 71,
                "lightness": 65,
                "hueSpread": 0.6,
                "bleed": 0,
                "COLORSPACE": "0",
                "BLENDMODE": 1,
                "blendAmount": 0.39,
                "bandingSteps": 0,
                "waveType": 0,
                "dutyCycle": 0.5,
                "originX": 0.5,
                "originY": 0.5,
                "spatialPattern": "radial",
                "blendTarget": "0"
            }
        }, {
            "name": "Perlin Distort",
            "config": {
                "boundMode": "fract",
                "pitchX": 0.22,
                "pitchY": 0.32,
                "freqX": 0.6573439067386198,
                "freqY": 0.0748420839139603,
                "seed": 377,
                "depth": 0.35,
                "rate": 0,
                "rateDrive": 0,
                "fc": [6, 15, 10],
                "phase": [0, 0],
                "fuzz": 0,
                "noiseMode": "classic",
                "clampScale": 1.1
            }
        }, {
            "name": "Invert",
            "config": {
                "invert0": false,
                "invert1": true,
                "invert2": true,
                "COLORSPACE": 0,
                "mode": "2",
                "colorSpace": "1"
            }
        }, {"name": "B/C/S", "config": {"brightness": 0.1, "contrast": 1, "saturation": 0.84, "graypoint": 0.3}}]
    },
    {
        "name": "Untimely Met",
        "config": [
            {
                "name": "Perlin Distort",
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
                "name": "Delay Line",
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
                "name": "Noise Mixer",
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
                        0.39,
                        0,
                        0
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
                "name": "Channel Mixer",
                "config": {
                    "colorSpace": '1',
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
                    ],
                    "blendMode": 1,
                    "blendAmount": 0.8
                }
            }
        ]
    },
    {
        "name": "Nickelodeon",
        "config": [
            {
                "name": "Noise Mixer",
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
                        0,
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
                "name": "Perlin Distort",
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
                "name": "Perlin Distort",
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
                "name": "Noise Mixer",
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
                        0,
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
    "name": "Sheen",
    "config": [
        {
            "name": "Look",
            "config": {
                "exposure": 1.05,
                "toneShoulder": -1.25,
                "toneCenter": 0.7,
                "chromaWeight": 1.01,
                "chromaFadeLow": -1.7,
                "chromaFadeHigh": 4.1,
                "tintAxis": [
                    0.55,
                    0.14,
                    0.18
                ],
                "tintStrength": 0.47
            }
        },
        {
            "name": "Noise Mixer",
            "config": {
                "frequency": 206.5833893106919,
                "freqShift": 0,
                "tint": [
                    1,
                    1,
                    1
                ],
                "seed": {
                    "value": 1,
                    "mod": {
                        "type": "sine",
                        "freq": 0.5,
                        "phase": 0,
                        "rangeMode": "bipolar",
                        "scale": 500,
                        "offset": 249.5
                    }
                },
                "BLENDMODE": "5",
                "BLEND_CHANNEL_MODE": "0",
                "COLORSPACE": "1",
                "components": [
                    0.68,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0
                ],
                "blendAmount": 0.38,
                "colormap": "inferno",
                "threshold": 0.585,
                "cutoff": 0.78,
                "gate": "1",
                "burstThreshold": 0.1,
                "burstFreq": 100,
                "burstTheta": 0.52,
                "burstDTheta": 0,
                "ZONESHAPE": 2,
                "zoneCX": 0.5,
                "zoneSX": 0.6,
                "zoneCY": 0.5,
                "zoneSY": 0.6,
                "zoneEllipseN": 2,
                "zoneSoftness": 0.1,
                "zoneAngle": 0,
                "APPLY_MASK": false,
                "burstModType": "simplex"
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
                    "paramA": 25,
                    "paramB": 90,
                    "mode": "channelwise"
                }
            },
            {
                "name": "Black Light Party",
                "config": [{
                    "name": "Invert",
                    "config": {"invert0": false, "invert1": true, "invert2": true, "mode": "lab"}
                }, {
                    "name": "Noise Mixer",
                    "config": {
                        "frequency": 28.355256795885165,
                        "freqShift": -0.05,
                        "tint": [0, 1, 0],
                        "seed": 160,
                        "blendMode": "10",
                        "colorSpace": "0",
                        "fc": [6, 14.75, 10],
                        "components": [0, 0, 0.73, 0, 0, 0, 0],
                        "blendAmount": 0.44,
                        "colormap": "none",
                        "tintSpace": "RGB",
                        "master": 0.6
                    }
                }, {
                    "name": "Look",
                    "config": {
                        "exposure": -0.95,
                        "toneShoulder": -1.2,
                        "toneCenter": 0.58,
                        "chromaWeight": 4,
                        "chromaFadeLow": -6,
                        "chromaFadeHigh": -3.9,
                        "tintAxis": [1.04, 1, 0.96],
                        "tintStrength": 0
                    }
                }]
            },
            {
                "name": "Noise Mixer",
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
                        0,
                        0,
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
                "name": "Perlin Distort",
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
                    "threshold": 0.28,
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
                "name": "Noise Mixer",
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
                        0,
                        0,
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
                    "paramA": 1,
                    "paramB": 100,
                    "mode": "channelwise"
                }
            }
        ]
    },
    {
        "name": "Not Raining",
        "config": [
            {
                "name": "Perlin Distort",
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
                "name": "Delay Line",
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
                "name": "Perlin Distort",
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
                "name": "Delay Line",
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
                "name": "Perlin Distort",
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
                "name": "Channel Mixer",
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
    },
    {
        "name": "Powder",
        "config": [
            {
                "name": "Posterize",
                "config": {
                    "levels": 8,
                    "mode": "2",
                    "colorSpace": "1",
                    "blendAmount": 1,
                    "mod": 0.25,
                    "c1": true,
                    "c2": false,
                    "c3": false
                }
            },
            {
                "name": "Colormap",
                "config": {
                    "colormap": "blush",
                    "reverse": true
                }
            },
            {
                "name": "Delay Line",
                "config": {
                    "delay": {
                        "value": 172.44,
                        "mod": {
                            "type": "sine",
                            "freq": 0.09,
                            "phase": 0,
                            "rangeMode": "unipolar",
                            "scale": 16.88,
                            "offset": 47.62
                        }
                    },
                    "window": "circle",
                    "falloff": "quadratic",
                    "density": {
                        "value": 2.3,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "angle": {
                        "value": -37.27,
                        "mod": {
                            "type": "sine",
                            "freq": 0.01,
                            "phase": 0,
                            "rangeMode": "bipolar",
                            "scale": 142.73,
                            "offset": -37.27
                        }
                    },
                    "shearX": -4,
                    "shearY": -1.2,
                    "scaleX": 1.5,
                    "scaleY": 0.3
                }
            },
            {
                "name": "Look",
                "config": {
                    "exposure": 0.9,
                    "toneShoulder": -0.15,
                    "toneCenter": 2,
                    "chromaWeight": 1.33,
                    "chromaFadeLow": -1.6,
                    "chromaFadeHigh": 3.4,
                    "tintAxis": [
                        1.04,
                        1,
                        0.96
                    ],
                    "tintStrength": 0.02
                }
            }
        ]
    },
    {
        "name": "Conte Brush",
        "config": [{
            "name": "Noise Mixer",
            "config": {
                "frequency": 44.734163413665485,
                "freqShift": 0,
                "tint": [0.56, 0.42, 0.28],
                "seed": 297,
                "blendMode": "1",
                "colorSpace": "0",
                "fc": [6, 15, 10],
                "components": [0, 0, 0, 1, 0, 0, 0],
                "blendAmount": 0.41,
                "colormap": "sunset",
                "tintSpace": "HSV",
                "master": 0.73
            }
        }, {
            "name": "Delay Line",
            "config": {
                "delay": 16.86,
                "window": "box",
                "falloff": "diagonal",
                "density": 4.1,
                "angle": 0,
                "shearX": -2.7,
                "shearY": -1,
                "scaleX": 0.4,
                "scaleY": 0.3
            }
        }, {"name": "Auto Levels", "config": {"method": "stddev", "paramA": 2.5, "paramB": 98.5, "channelwise": true}}]
    },
    {
        "name": "Mirror Stage",
        "config": [{
            "name": "Look",
            "config": {
                "exposure": 1.65,
                "toneShoulder": -0.7,
                "toneCenter": 0.95,
                "chromaWeight": 1.66,
                "chromaFadeLow": -3.6,
                "chromaFadeHigh": 2.7,
                "tintAxis": [0.96, 1, 0.96],
                "tintStrength": 0.01
            }
        }, {
            "name": "Posterize",
            "config": {
                "levels": 12,
                "mode": "1",
                "colorSpace": "1",
                "blendAmount": 0.56,
                "mod": 0.5,
                "c1": true,
                "c2": false,
                "c3": false
            }
        }, {
            "name": "Perlin Distort",
            "config": {
                "boundMode": "clamp",
                "pitchX": {
                    "value": 0,
                    "mod": {"type": "sine", "freq": 0.01, "phase": 0, "rangeMode": "bipolar", "scale": 2, "offset": 0}
                },
                "pitchY": 0,
                "freqX": {
                    "value": 3.982172218161989,
                    "mod": {
                        "type": "sine",
                        "freq": 0.12,
                        "phase": 0,
                        "rangeMode": "bipolar",
                        "scale": 0.17,
                        "offset": 3.98
                    }
                },
                "freqY": {
                    "value": 3.982172218161989,
                    "mod": {
                        "type": "sine",
                        "freq": 0.01,
                        "phase": 0,
                        "rangeMode": "bipolar",
                        "scale": 2.05,
                        "offset": 3.98
                    }
                },
                "seed": 190,
                "depth": {
                    "value": 0.5,
                    "mod": {
                        "type": "saw",
                        "freq": 1.52,
                        "phase": 0,
                        "rangeMode": "unipolar",
                        "scale": 0.42,
                        "offset": 0.03
                    }
                },
                "rate": 0.7398770712450367,
                "rateDrive": 0,
                "fc": [5.5, 7, 6.75],
                "phase": [0, 0],
                "fuzz": 0,
                "noiseMode": "pseudo",
                "clampScale": 0.5
            }
        }]
    },
    {
        "name": "Crew Mosaic",
        "config": [
            {
                "name": "Pixelate",
                "config": {
                    "blockSize": 44,
                    "sampleStrategy": "center",
                    "preserveAlpha": true
                }
            },
            {
                "name": "Contour Synth",
                "config": {
                    "freq": 2.992973354685282,
                    "freqScale": 0.9106275029062469,
                    "phaseScale": 1.8154937020529025,
                    "blend": 0.44,
                    "phaseOff": -102,
                    "spatialMode": "xy",
                    "colorMode": "pass",
                    "hueModStrength": 0.5,
                    "waveform": "sawtooth"
                }
            },
            {
                "name": "Wave Distortion",
                "config": {
                    "amplitude": 0.05,
                    "frequency": 1,
                    "direction": "vertical"
                }
            }
        ]
    },
    {"name":"Lean Close","config":[{"name":"Bloom","config":{"BLENDMODE":"1","BLENDTARGET":"4","COLORSPACE":"6","blendAmount":1,"bloomThreshold":{"value":0.56,"mod":{"type":"saw","freq":4,"phase":0,"rangeMode":"bipolar","scale":0.06,"offset":0.78}},"bloomSoftness":0.27,"bloomStrength":0.69,"kernelName":"sinc","kernelRadius":20,"kernelSoftness":{"value":8.79,"mod":{"type":"sine","freq":3.32,"phase":0,"rangeMode":"bipolar","scale":1.89,"offset":9.5}},"BLOOM_MODE":"0","BLOOM_CHROMA_TAIL":true,"chromaOffset":[2.1,-4.95,1.78]}},{"name":"Look","config":{"exposure":0.35,"toneShoulder":-0.6,"toneCenter":0.85,"chromaWeight":1.35,"chromaFadeLow":-2.3,"chromaFadeHigh":3,"tintAxis":[1.27,0.72,-1.1],"tintStrength":0.16}},{"name":"Warp Zone","config":{"COLORSPACE":0,"BLENDMODE":"1","blendAmount":{"value":1,"mod":{"type":"saw","freq":0.5,"phase":0,"rangeMode":"bipolar","scale":0.5,"offset":0.75}},"BLEND_CHANNEL_MODE":"0","DEBUG_MASK":false,"ZONESHAPE":2,"zoneCX":{"value":0.585,"mod":{"type":"sine","freq":0.35,"phase":0,"rangeMode":"bipolar","scale":0.09,"offset":0.5}},"zoneSX":1.25333333333333,"zoneCY":0.48,"zoneSY":0.72,"zoneEllipseN":4.813,"zoneSoftness":0,"WARPMODE":"lens","paramA":0,"paramB":0,"warpStrength":7,"PREBLEND_WARP_CHANNEL":2,"WARPDRIVE_COLORSPACE":"0","WARPDRIVE_MODE":"0","WARPDRIVE_CHANNEL":"1","zoneAngle":0,"warpAngle":0}}]},
    {"name":"Neon Grille","config":[{"name":"Grid Pattern","config":{"lineWidth":4.404701675429672,"spacingFactor":1.2278914891318364,"phaseX":{"value":0.67,"mod":{"type":"none"}},"phaseY":{"value":0,"mod":{"type":"none"}},"direction":"horizontal","mode":"binary","BLENDMODE":"1","BLEND_CHANNEL_MODE":"0","COLORSPACE":0,"blendAmount":0.51,"invert":true,"noiseScale":0.01,"noiseAmount":0,"skew":0,"lumaMod":-0.26,"lumaThreshold":0.255,"lumaSoftness":0,"channelPhase0":0,"channelPhase1":0,"channelPhase2":0,"color":[1,0,1],"lumaAngle":0.15}},{"name":"Look","config":{"exposure":1.65,"toneShoulder":-2.8,"toneCenter":1.26,"chromaWeight":1,"chromaFadeLow":-6,"chromaFadeHigh":2.4,"tintAxis":[1.27,0.57,0],"tintStrength":0}}]},
{
  "name": "Site Jitter",
  "config": [
    {
      "name": "Noise Mixer",
      "config": {
        "frequency": 35.165954655638664,
        "freqShift": 0,
        "tint": [
          1,
          1,
          1
        ],
        "seed": {
          "value": 1,
          "mod": {
            "type": "sine",
            "freq": 0.5,
            "phase": 0,
            "rangeMode": "bipolar",
            "scale": 500,
            "offset": 249.5
          }
        },
        "BLENDMODE": "10",
        "BLEND_CHANNEL_MODE": 0,
        "COLORSPACE": "6",
        "components": [
          0.64,
          0,
          0,
          0.29,
          0,
          0,
          0
        ],
        "blendAmount": 0.5,
        "colormap": "none",
        "threshold": 0,
        "cutoff": 1,
        "gate": 0,
        "burstThreshold": 0.1,
        "burstFreq": 100,
        "burstTheta": 0.52,
        "burstDTheta": 0,
        "ZONESHAPE": 2,
        "zoneCX": 0.235,
        "zoneSX": 0.2,
        "zoneCY": 0.445,
        "zoneSY": 0.21,
        "zoneEllipseN": 2,
        "zoneSoftness": 0.1,
        "zoneAngle": 0,
        "APPLY_MASK": true,
        "burstModType": "simplex"
      }
    },
    {
      "name": "Warp Zone",
      "config": {
        "COLORSPACE": "6",
        "BLENDMODE": "6",
        "blendAmount": 1,
        "BLEND_CHANNEL_MODE": 0,
        "ZONESHAPE": 2,
        "zoneCX": 0.22,
        "zoneSX": 0.26,
        "zoneCY": 0.435,
        "zoneSY": 0.245,
        "zoneEllipseN": 2,
        "zoneSoftness": 1,
        "WARPMODE": "lens",
        "paramA": 0,
        "paramB": 0,
        "warpStrength": -51,
        "PREBLEND_WARP_CHANNEL": 2,
        "WARPDRIVE_COLORSPACE": 6,
        "WARPDRIVE_MODE": 0,
        "WARPDRIVE_CHANNEL": 2,
        "zoneAngle": 2.63893782901543,
        "warpAngle": 2.79601746169492
      }
    }
  ]
},
    {
    "name": "Someday",
    "config": [
        {
            "name": "Grid Pattern",
            "config": {
                "lineWidth": 13.826194041024442,
                "spacingFactor": 2.7589005745667357,
                "phaseX": -0.04,
                "phaseY": -0.49,
                "direction": "grid",
                "mode": "saw",
                "BLENDMODE": "9",
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": "3",
                "blendAmount": 0.42,
                "invert": true,
                "noiseScale": 0.1,
                "noiseAmount": 0.3,
                "skew": {
                    "value": -0.33,
                    "mod": {
                        "type": "saw",
                        "freq": 0.17,
                        "phase": 0,
                        "rangeMode": "bipolar",
                        "scale": 0.17,
                        "offset": -0.52
                    }
                },
                "lumaMod": 0,
                "lumaThreshold": 0.225,
                "lumaSoftness": 0,
                "channelPhase0": 0.45,
                "channelPhase1": -1,
                "channelPhase2": -1,
                "color": [
                    1,
                    1,
                    1
                ],
                "blendMode": "1",
                "blendTarget": "0",
                "colorSpace": "0"
            }
        },
        {
            "name": "Warp Zone",
            "config": {
                "COLORSPACE": 0,
                "BLENDMODE": 1,
                "blendAmount": 1,
                "BLEND_CHANNEL_MODE": 0,
                "ZONESHAPE": 2,
                "zoneCX": 0.5,
                "zoneSX": 1,
                "zoneCY": 0.5,
                "zoneSY": 1,
                "zoneEllipseN": 2,
                "zoneSoftness": 0.955,
                "WARPMODE": "lens",
                "paramA": 0,
                "paramB": 0,
                "warpStrength": 25,
                "PREBLEND_WARP_CHANNEL": 2,
                "WARPDRIVE_COLORSPACE": "0",
                "WARPDRIVE_MODE": "1",
                "WARPDRIVE_CHANNEL": 2,
                "zoneAngle": 0,
                "warpAngle": {
                    "value": 4.68097305384879,
                    "mod": {
                        "type": "sine",
                        "freq": 0.01,
                        "phase": 0,
                        "rangeMode": "bipolar",
                        "scale": 6.28,
                        "offset": 3.14
                    }
                }
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
                "COLORSPACE": 0,
                "mode": "2",
                "colorSpace": "1"
            }
        },
        {
            "name": "Posterize",
            "config": {
                "levels": 5,
                "mode": "1",
                "COLORSPACE": 0,
                "BLENDMODE": 1,
                "BLEND_CHANNEL_MODE": 0,
                "blendAmount": 1,
                "mod": 0.5,
                "c1": false,
                "c2": true,
                "c3": true,
                "colorSpace": "2"
            }
        }
    ]
},
    {
    "name": "Mr. Johnson",
    "config": [
        {
            "name": "Edge Trace",
            "config": {
                "BLENDMODE": "5",
                "COLORSPACE": "5",
                "BLEND_CHANNEL_MODE": "0",
                "blendAmount": 0.85,
                "threshold": 0.13,
                "tint": [
                    0.38,
                    0.05,
                    0.63
                ]
            }
        },
        {
            "name": "B/C/S",
            "config": {
                "brightness": 0.01,
                "contrast": 1,
                "saturation": 0.9,
                "graypoint": 0.3
            }
        }
    ]
},
    {"name":"Line Ghosts","config":[{"name":"2D Kernel","config":{"BLENDMODE":"8","BLENDTARGET":0,"COLORSPACE":"0","blendAmount":1,"kernelName":"impulse","kernelRadiusX":8,"kernelRadiusY":9,"kernelSoftness":6.605}},{"name":"Pseudosort","config":{"BLENDMODE":"4","BLEND_CHANNEL_MODE":"4","COLORSPACE":"2","blendAmount":1,"warpStrength":-0.73,"directionAngle":-1.4451326206513,"modAmount":0.405,"driverChannel":"5","modulatorChannel":"0","driverPolarity":false,"modulatorPolarity":true,"threshLow":0.17,"threshHigh":0.4,"driverGamma":0.7583998736407089,"flatThreshold":false}}]},
    {"name":"Lessening","config":[{"name":"Posterize","config":{"levels":8,"mode":"2","COLORSPACE":"4","BLENDMODE":"10","BLEND_CHANNEL_MODE":0,"blendAmount":1,"mod":0.5,"c1":true,"c2":true,"c3":true}},{"name":"Pseudosort","config":{"BLENDMODE":1,"BLEND_CHANNEL_MODE":0,"COLORSPACE":0,"warpStrength":-0.21,"directionAngle":-0.534070751110264,"modAmount":0,"driverChannel":"1","modulatorChannel":"5","driverPolarity":true,"modulatorPolarity":false,"threshLow":0.535,"threshHigh":0.945,"driverGamma":1.1414812755524588,"flatThreshold":true}}]},
    {"name":"Gray Goo","config":[{"name":"Look","config":{"exposure":3.8,"toneShoulder":-1.7,"toneCenter":0.27,"chromaWeight":3.16,"chromaFadeLow":-3.9,"chromaFadeHigh":2.9,"tintAxis":[1.27,0.57,0],"tintStrength":0}},{"name":"Delay Line","config":{"delay":68.45,"window":"ring","falloff":"uniform","density":2.1,"angle":7.72,"shearX":-1.7,"shearY":-3,"scaleX":2.4,"scaleY":1,"COLORSPACE":"6","BLENDMODE":"10","blendAmount":1,"blendTarget":"0","jitter":0.11,"BLEND_CHANNEL_MODE":"2"}}]},
    {"name":"Fog Glitch","config":[{"name":"Colorshred","config":{"density":0.2,"flip":false}},{"name":"Desync Tiles","config":{"BLENDMODE":1,"COLORSPACE":0,"BLEND_CHANNEL_MODE":0,"blendAmount":1,"tileCountX":50,"tileCountY":50,"offsetAmount":0.05,"seed":10}},{"name":"2D Kernel","config":{"BLENDMODE":1,"BLENDTARGET":0,"COLORSPACE":0,"blendAmount":1,"kernelName":"gaussian","kernelRadiusX":5,"kernelRadiusY":5,"kernelSoftness":3.85}}]},
    {
    "name": "Rain like Sand",
    "config": [
        {
            "name": "Posterize",
            "config": {
                "levels": 8,
                "mode": "2",
                "COLORSPACE": 0,
                "BLENDMODE": 1,
                "BLEND_CHANNEL_MODE": 0,
                "blendAmount": 0.51,
                "mod": 0.5,
                "c1": true,
                "c2": true,
                "c3": true
            }
        },
        {
            "name": "Pseudosort",
            "config": {
                "BLENDMODE": "1",
                "BLEND_CHANNEL_MODE": "1",
                "COLORSPACE": "2",
                "blendAmount": 1,
                "warpStrength": 1.47,
                "directionAngle": -1.539380400259,
                "modAmount": 0.505,
                "driverChannel": 0,
                "modulatorChannel": "5",
                "driverPolarity": false,
                "modulatorPolarity": true,
                "threshLow": 0.185,
                "threshHigh": 0.4,
                "driverGamma": 1.655170605255106,
                "flatThreshold": false
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
                "threshold": 0.25,
                "cycle": true,
                "cycleMode": "hue",
                "hueShift": 1.11,
                "saturation": 25,
                "lightness": 50,
                "hueSpread": 1.15,
                "bleed": 0,
                "COLORSPACE": 0,
                "BLENDMODE": "1",
                "blendAmount": 1,
                "bandingSteps": 0,
                "waveType": 0,
                "dutyCycle": 0.5,
                "originX": 0.5,
                "originY": 0.5,
                "spatialPattern": "radial",
                "blendTarget": "0"
            }
        },
        {
            "name": "Pixelate",
            "config": {
                "blockSize": 5,
                "BLENDMODE": "3",
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": "0",
                "blendAmount": 0.58,
                "sampleStrategy": "center",
                "preserveAlpha": true
            }
        }
    ]
},



]