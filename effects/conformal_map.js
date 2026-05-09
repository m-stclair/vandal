import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {blendControls} from "../utils/ui_configs.js";
import {deg2rad} from "../utils/mathutils.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
    makeEnum
} from "../utils/glsl_enums.js";

const shaderPath = "conformal_map.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl",
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: ConformalModeEnum,
    options: ConformalModeOpts
} = makeEnum([
    "POWER",
    "LOG",
    "INVERSION"
]);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Conformal Map",

    defaultConfig: {
        MODE: ConformalModeEnum.POWER,

        centerX: 0.5,
        centerY: 0.5,

        inputZoom: 1.0,
        outputScale: 1.0,
        depth: 1.0,

        preRotateDeg: 0,
        postRotateDeg: 0,

        power: 2.0,

        branchAngleDeg: 0,

        wrap: true,

        blendAmount: 1,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
    },

    uiLayout: [
        {
            key: "MODE",
            label: "Mode",
            type: "select",
            options: ConformalModeOpts,
            valueMap: ConformalModeEnum,
        },

        {
            key: "centerX",
            label: "Center X",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: "centerY",
            label: "Center Y",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01,
        },

        {
            key: "inputZoom",
            label: "Input Zoom",
            type: "modSlider",
            min: 0.1,
            max: 8,
            step: 0.01,
            scale: "log",
            scaleFactor: 3,
        },
        {
            key: "outputScale",
            label: "Output Scale",
            type: "modSlider",
            min: 0.1,
            max: 4,
            step: 0.01,
            scale: "log",
            scaleFactor: 2,
        },
        {
            key: "depth",
            label: "Depth",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01,
        },

        {
            key: "preRotateDeg",
            label: "Pre Rotate (°)",
            type: "modSlider",
            min: -180,
            max: 180,
            step: 1,
        },
        {
            key: "postRotateDeg",
            label: "Post Rotate (°)",
            type: "modSlider",
            min: -180,
            max: 180,
            step: 1,
        },
        {
            key: "power",
            label: "Power",
            type: "modSlider",
            min: -4,
            max: 4,
            step: 0.01,
            showIf: {key: "MODE", equals: ConformalModeEnum.POWER}
        },
        {
            key: "branchAngleDeg",
            label: "Branch Angle (°)",
            type: "modSlider",
            min: -180,
            max: 180,
            step: 1,
            showIf: {key: "MODE", notEquals: ConformalModeEnum.INVERSION}
        },
        {
            key: "wrap",
            label: "Wrap",
            type: "checkbox",
        },

        blendControls()
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);

        const {
            MODE,
            centerX, centerY,
            inputZoom,
            outputScale,
            depth,
            preRotateDeg,
            postRotateDeg,
            power,
            branchAngleDeg,
            wrap,
            blendAmount,
            BLENDMODE,
            BLEND_CHANNEL_MODE,
            COLORSPACE
        } = resolveAnimAll(instance.config, t);

        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_center: {type: "vec2", value: [centerX, centerY]},

            u_inputZoom: {type: "float", value: inputZoom},
            u_outputScale: {type: "float", value: outputScale},
            u_depth: {type: "float", value: depth},

            u_preRotate: {type: "float", value: deg2rad(preRotateDeg)},
            u_postRotate: {type: "float", value: deg2rad(postRotateDeg)},

            u_power: {type: "float", value: power},
            u_branchAngle: {type: "float", value: deg2rad(branchAngleDeg)},

            u_wrap: {type: "bool", value: wrap},
            u_blendamount: {type: "float", value: blendAmount},
        };

        const defines = {
            MODE,
            BLENDMODE,
            BLEND_CHANNEL_MODE,
            COLORSPACE,
        };

        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },

    initHook: async () => {
        await fragSources.load();
    },

    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },

    glState: null,
    isGPU: true,
};

export const effectMeta = {
    group: "Distortion",
    tags: ["complex", "conformal", "power", "log", "inversion", "warp"],
    description: "Complex-plane coordinate warps: power maps, logarithmic unwraps, and inversion around poles.",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        depth: {min: 0.7, max: 1},
        inputZoom: {min: 0.6, max: 1.8},
        outputScale: {min: 0.7, max: 1.6},
        singularityClamp: {min: 0.005, max: 0.02},
    }
};