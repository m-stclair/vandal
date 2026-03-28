import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendModeEnum, BlendTargetEnum, CalcModeEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";
import {rgb2Lab} from "../utils/colorutils.js";
import {calcPass} from "./probes/calcpass.js";

const shaderPath = "engrave.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl",
    "noise.glsl": "includes/noise.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Engrave",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        chromaBoost: 1,
        brightness: 1,
        contrast: 2,
        scale: 2,
        jitter: 0.25,
        inkColor: [0.2, 0.1, 0],
        paperColor: [0.96, 0.95, 0.92],
        inkOpacity: 1,
        paperOpacity: 1,
        lineWidth: 0.1,
        lineWidthSensitivity: 0,
        lineSpacing: 18,
        lineSpacingSensitivity: 0,
        angle: 25,
        USE_STRUCTURE: false,
        anisoDrag: 0,
    },

    uiLayout: [
        {
            type: "group",
            label: "Line",
            kind: "collapse",
            collapsed: false,
            children: [
                {
                    key: "lineWidth",
                    label: "Width",
                    type: "modSlider",
                    min: 0.01,
                    max: 0.3,
                    step: 0.01,
                },
                {
                    key: "lineWidthSensitivity",
                    label: "Width Sensitivity",
                    type: "modSlider",
                    min: 0,
                    max: 2,
                    step: 0.01
                },
                {
                    key: "lineSpacing",
                    label: "Spacing",
                    type: "modSlider",
                    min: 5,
                    max: 40,
                    step: 0.01
                },
                {
                    key: "lineSpacingSensitivity",
                    label: "Spacing Sensitivity",
                    type: "modSlider",
                    min: 0,
                    max: 0.1,
                    step: 0.005
                },
                {
                    key: "angle",
                    label: "Hatch Angle",
                    type: "modSlider",
                    min: 0,
                    max: 90,
                    step: 1,
                    showIf: {key: "USE_STRUCTURE", equals: false}
                },
                {
                    key: "anisoDrag",
                    label: "Texture Toning",
                    type: "modSlider",
                    min: -1,
                    max: 1,
                    steps: 100,
                    showIf: {key: "USE_STRUCTURE", equals: true}
                },
                {
                    key: "scale",
                    label: "Scale",
                    type: "modSlider",
                    min: 0.5,
                    max: 4,
                    step: 0.01,
                },
                {
                    key: "jitter",
                    label: "Jitter",
                    type: "modSlider",
                    min: 0,
                    max: 2,
                    step: 0.01,
                },
            ]
        },
        {
            key: "USE_STRUCTURE",
            label: "Use Structure",
            type: "checkbox"
        },
        {
            type: "group",
            label: "Global Tone",
            kind: "collapse",
            children: [
                {
                    key: "brightness",
                    label: "Brightness",
                    type: "modSlider",
                    min: 0.1,
                    max: 2,
                    step: 0.01,
                },
                {
                    key: "contrast",
                    label: "Contrast",
                    type: "modSlider",
                    min: 0.5,
                    max: 5,
                    step: 0.02,
                },
           ]
        },
        {
            type: "group",
            label: "Color",
            kind: "collapse",
            children: [
                {
                    key: "inkColor",
                    label: "Ink Color",
                    type: "vector",
                    subLabels: ["R", "G", "B"],
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                {
                    key: "inkOpacity",
                    label: "Ink Opacity",
                    type: "modSlider",
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                {
                    key: "paperColor",
                    label: "Paper Color",
                    type: "vector",
                    subLabels: ["R", "G", "B"],
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                {
                    key: "paperOpacity",
                    label: "Paper Opacity",
                    type: "modSlider",
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
            ],
        },
        blendControls()
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            BLENDMODE, COLORSPACE, BLEND_CHANNEL_MODE, blendAmount,
            brightness, contrast, scale, jitter, angle,
            lineWidth, lineWidthSensitivity,
            lineSpacing, lineSpacingSensitivity,
            inkOpacity, inkColor, paperOpacity, paperColor,
            USE_STRUCTURE, anisoDrag
        } = resolveAnimAll(instance.config, t);
        //
        // const darkLab = rgb2Lab(...darkColor);
        // const lightLab = rgb2Lab(...lightColor);



        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_brightness: {value: brightness, type: "float"},
            u_contrast: {value: contrast, type: "float"},
            u_scale: {value: scale, type: "float"},
            u_lineWidth: {value: lineWidth, type: "float"},
            u_lineWidthSensitivity: {value: lineWidthSensitivity, type: "float"},
            u_lineSpacing: {value: lineSpacing, type: "float"},
            u_lineSpacingSensitivity: {value: lineSpacingSensitivity, type: "float"},
            u_paperColor: {value: paperColor, type: "vec3"},
            u_inkColor: {value: inkColor, type: "vec3"},
            u_jitter: {value: jitter, type: "float"},
            u_inkOpacity: {value: inkOpacity, type: "float"},
            u_paperOpacity: {value: paperOpacity, type: "float"},
            u_blendAmount: {value: blendAmount, type: "float"},
            u_angle: {value: angle * Math.PI / 180, type: "float"},
            u_anisoDrag: {value: anisoDrag, type: "float"},
        };

        if (USE_STRUCTURE) {
            const calcPassTexture = instance.calcPass.calculate(
                instance.calcPass,
                inputTex,
                width,
                height,
                1,
                1,
                true,
                4,
                CalcModeEnum.STRUCTURE_TENSOR
            ).texture
            // this uniform is #defined out if !USE_STRUCTURE
            uniformSpec.u_calcPass = {value: calcPassTexture, type: "texture2D"};
        }

        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            USE_STRUCTURE: USE_STRUCTURE ? 1 : 0
        };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: async (instance, renderer) => {
        await fragSources.load();
        instance.calcPass = {
            initHook: calcPass.initHook,
            cleanupHook: calcPass.cleanupHook,
            setupFBO: calcPass.setupFBO,
            calculate: calcPass.calculate,
            outputFBO: null,
            width: null,
            height: null
        };
        await instance.calcPass.initHook(instance.calcPass, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
        instance.calcPass.cleanupHook(instance.calcPass);
    },
    glState: null,
    isGPU: true,
}

export const effectMeta = {
  group: "Stylize",
  tags: ["engraving", "plate", "screen", "ink", "print"],
  description: "Engraving / line screen effect.",
  backend: "gpu",
  canAnimate: true,
  realtimeSafe: true,
  parameterHints: {
      hatchAngle: {"min": 15, "max": 45},
      lineSpacing: {"min": 10, "max": 25},
      lineSpacingSensitivity: {"min": 0, "max": 0.03},
      inkColor: {"always": [0.2, 0.1, 0]},
      paperColor: {"always": [0.96, 0.95, 0.92]},
      inkOpacity: {"always": 1.0},
      paperOpacity: {"min": 0.6, "max": 1},
      scale: {"min": 1.2, "max": 3},
      width: {"min": 0.05, "max": 0.2},
      contrast: {"min": 1, "max": 3},
      brightness: {"min": 0.75, "max": 1.5},
      jitter: {"min": 0, "max": 0.5}
  },
  // notInRandom: true
};
