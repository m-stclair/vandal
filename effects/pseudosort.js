import {resolveAnimAll} from "../utils/animutils.js";
import {cmapLuts, colormaps, LUTSIZE} from "../utils/colormaps.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, makeEnum,
    ZoneShapeEnum,
} from "../utils/glsl_enums.js";
import {blendControls, zoneControls} from "../utils/ui_configs.js";

const shaderPath = "../shaders/pseudosort.glsl"
const includePaths = {
    'colorconvert.glsl': '../shaders/includes/colorconvert.glsl',
    'blend.glsl': '../shaders/includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: PChannelEnum,
    names: PChannelNames,
    options: PChannelOpts
} = makeEnum([
    'LUMA',
    'R',
    'G',
    'B',
    "H",
    "S"
]);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Pseudosort",
    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        blendAmount: 1,
        warpStrength: 0,
        directionAngle: 0,
        modAmount: 0,
        driverChannel: PChannelEnum.LUMA,
        modulatorChannel: PChannelEnum.H,
        driverPolarity: false,
        modulatorPolarity: false,
        threshLow: 0,
        threshHigh: 1,
        driverGamma: 1,
        flatThreshold: false
    },
    uiLayout: [
        {key: "warpStrength", label: "Warp Strength", type: "range", min: 0, max: 2, steps: 200},
        {key: "threshLow", label: "Threshold Low", type: "modSlider", min: 0, max: 1, steps: 200},
        {key: "threshHigh", label: "Threshold High", type: "modSlider", min: 0, max: 1, steps: 200},
        {key: "driverGamma", label: "Driver Gamma", type: "modSlider", min: 0, max: 5, scale: "log", steps: 200},
        {key: "directionAngle", label: "Direction Angle", type: "range", min: -Math.PI, max: Math.PI, steps: 200},
        {key: "modAmount", label: "modulation intensity", type: "range", min: 0, max: 1, steps: 200},
        {
            type: "select",
            key: "driverChannel",
            label: "Driver Channel",
            options: PChannelOpts
        },
        {
            type: "checkbox",
            key: "flatThreshold",
            label: "Use Flat Threshold"
        },
        {
            type: "checkbox",
            key: "driverPolarity",
            label: "flip driver polarity"
        },
        {
            type: "select",
            key: "modulatorChannel",
            label: "Modulator Channe;",
            options: PChannelOpts
        },
        {
            type: "checkbox",
            key: "modulatorPolarity",
            label: "flip mod polarity"
        },
        blendControls()
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources)
        const {
            BLENDMODE, COLORSPACE, blendAmount,
            BLEND_CHANNEL_MODE, driverChannel, modulatorChannel,
            directionAngle, warpStrength, modAmount, modulatorPolarity,
            driverPolarity, threshLow, threshHigh, driverGamma,
            flatThreshold
        } = resolveAnimAll(instance.config, t);
        // TODO: this is wrong
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_warpStrength: {type: "float", value: warpStrength},
            u_threshLow: {type: "float", value: threshLow},
            u_threshHigh: {type: "float", value: threshHigh},
            u_directionAngle: {type: "float", value: directionAngle},
            u_modAmount: {type: "float", value: modAmount},
            u_driverChannel: {type: "int", value: driverChannel},
            u_modulatorChannel: {type: "int", value: modulatorChannel},
            u_modulatorPolarity: {type: "float", value: Number(modulatorPolarity)},
            u_driverPolarity: {type: "float", value: Number(driverPolarity)},
            u_driverGamma: {type: "float", value: Number(driverGamma)},
            u_blendamount: {value: blendAmount, type: "float"},
            u_flatThreshold: {value: flatThreshold, type: "int"}
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
};

export const effectMeta = {
    group: "Glitch",
    tags: ["sort", "webgl", "blur"],
    description: "Applies a spatial warp to an image, optionally modulated by luma, hue, saturation, or" +
        "a specified color channel. At some settings, works something like a very fast version " +
        "of a classic pixel sort effect, but can also create a variety of blur, ghosting, and " +
        "generally painterly effects.",
    canAnimate: true,
    realtimeSafe: true,
};
