import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, hasChromaBoostImplementation, makeEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "sierpinski.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: ColoringModeEnum,
    names: ColoringModeNames,
    options: ColoringModeOpts
} = makeEnum([
    'COLORING_NONE',
    'COLORING_TINT_ITERS',
])

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Sierpinski",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        scale: 0.5,
        ITERATIONS: 4,
        COLORING_MODE: 0,
        depth: 1,
        zoom: 1,
        spin: 0,
        chromaGamma: 1,
        startHue: 0.5,
        hueSpacing: 0.5,
        hueBleed: 0
    },
    uiLayout: [
        {
            type: "modSlider",
            key: "scale",
            label: "Scale",
            min: 0.1,
            max: 0.8,
            step: 0.01
        },
        {
            type: "range",
            key: "ITERATIONS",
            label: "Iterations",
            min: 1,
            max: 12,
            step: 1
        },
        {
            type: "modSlider",
            key: "spin",
            label: "Spin",
            min: 0,
            max: 360,
            step: 1
        },
        {
            type: "modSlider",
            key: "zoom",
            label: "Zoom",
            min: 0.1,
            max: 5,
            steps: 100
        },
        {
            type: "modSlider",
            key: "depth",
            label: "Depth",
            min: 0,
            max: 1,
            steps: 100
        },
        {
            type: "select",
            key: "COLORING_MODE",
            label: "Coloring Mode",
            options: ColoringModeOpts
        },
        {
            type: "modSlider",
            key: "chromaGamma",
            label: "Chroma Gamma",
            min: 0,
            max: 3,
            step: 0.1,
            showIf: {"key": "COLORING_MODE", "equals": ColoringModeEnum.COLORING_TINT_ITERS}
        },
        {
            type: "modSlider",
            key: "hueSpacing",
            label: "Hue Spacing",
            min: 0,
            max: 7,
            step: 0.01,
            showIf: {"key": "COLORING_MODE", "equals": ColoringModeEnum.COLORING_TINT_ITERS}
        },
        {
            type: "modSlider",
            key: "startHue",
            label: "Start Hue",
            min: 0,
            max: 1,
            step: 0.01,
            showIf: {"key": "COLORING_MODE", "equals": ColoringModeEnum.COLORING_TINT_ITERS}
        },
        {
            type: "modSlider",
            key: "hueBleed",
            label: "Hue Bleed",
            min: 0,
            max: 1,
            step: 0.01,
            showIf: {"key": "COLORING_MODE", "equals": ColoringModeEnum.COLORING_TINT_ITERS}
        },
        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            blendAmount, COLORSPACE, BLENDMODE, BLEND_CHANNEL_MODE,
            scale, ITERATIONS, depth, spin, zoom, COLORING_MODE,
            chromaGamma, hueSpacing, startHue, hueBleed
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {type: "float", value: blendAmount},
            u_scale: {type: "float", value: scale},
            u_depth: {type: "float", value: depth},
            u_spin: {type: "float", value: spin * Math.PI / 180},
            u_zoom: {type: "float", value: zoom},
            u_chromaGamma: {type: "float", value: chromaGamma},
            u_hueSpacing: {type: "float", value: hueSpacing},
            u_startHue: {type: "float", value: startHue},
            u_hueBleed: {type: "float", value: hueBleed}

        };
        const defines = {
            ITERATIONS: ITERATIONS,
            COLORING_MODE: COLORING_MODE,
            COLORSPACE: COLORSPACE,
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
        }
        instance.glState.renderGL(inputTex, outputFBO, uniforms, defines);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    initHook: fragSources.load,
    glState: null,
    isGPU: true
}

export const effectMeta = {
    group: "Stylize",
    tags: ["fractal"],
    description: "Warps image based on generalized Sierpinski triangle.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true,
    parameterHints: {
        "ITERATIONS": {"min": 2, "max": 10},
        "depth": {"always": 1},
        "zoom": {"min": 0.25, "max": 1},
        "scale": {"min": 0.45, "max": 0.55}
    }
};
