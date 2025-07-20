import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, hasChromaBoostImplementation,
    makeEnum,
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";
import {generate2DKernel, KernelTypeEnum, subsampleKernel2D} from "../utils/kernels.js";

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
        warpStrength: 0.2,
        directionStrength: 0.5,
        u_directionChannel: PChannelEnum.H,
        magChannel: PChannelEnum.LUMA,
        directionPolarity: false,
        magPolarity: false,
        threshLow: 0,
        threshHigh: 1,
        magGamma: 1,
        kernelName: "gaussian",
        kernelRadiusX: 3,
        kernelRadiusY: 3,
        kernelSoftness: 10

    },
    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            collapsed: false,
            label: "Base Warp Parameters",
            children: [
                {key: "warpStrength", label: "Warp Strength", type: "modSlider", min: -5, max: 5, steps: 200},
                {key: "threshLow", label: "Threshold Low", type: "modSlider", min: 0, max: 1, steps: 200},
                {key: "threshHigh", label: "Threshold High", type: "modSlider", min: 0, max: 1, steps: 200},
                {key: "magGamma", label: "Warp Gamma", type: "modSlider", min: 0.01, max: 8, scale: "log", steps: 200},
                {
                    type: "select",
                    key: "magChannel",
                    label: "Warp Channel",
                    options: PChannelOpts
                },
                {
                    type: "checkbox",
                    key: "magPolarity",
                    label: "Flip Warp Polarity"
                },
            ]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Direction",
            children: [
                {
                    key: "directionStrength",
                    label: "Direction Strength",
                    type: "modSlider",
                    min: 0,
                    max: 20,
                    steps: 250,
                    scale: "log"
                },
                {
                    type: "select",
                    key: "directionChannel",
                    label: "Direction Channel",
                    options: PChannelOpts
                },
                {
                    type: "checkbox",
                    key: "directionPolarity",
                    label: "Direction Polarity",
                },

            ]
        },
        {
            type: "group",
            label: "Kernel",
            kind: "collapse",
            children: [
                {type: "range", key: "kernelRadiusX", label: "Radius X", min: 1, max: 30, step: 1},
                {type: "range", key: "kernelRadiusY", label: "Radius Y", min: 1, max: 30, step: 1},
                {type: "modSlider", key: "kernelSoftness", label: "Softness", min: 1, max: 20, steps: 200},
                {
                    key: 'kernelName',
                    label: 'Kernel Shape',
                    type: 'Select',
                    options: Object.values(KernelTypeEnum)
                },
            ]
        },
        blendControls(),
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources)
        const {
            BLENDMODE, COLORSPACE, blendAmount,
            BLEND_CHANNEL_MODE, magChannel,
            directionChannel, warpStrength,
            magPolarity, threshLow, threshHigh, magGamma,
            flatThreshold, directionStrength,
            kernelName, kernelRadiusX, kernelRadiusY,
            kernelSoftness,
        } = resolveAnimAll(instance.config, t);

        const MAX_KERNEL_SIZE = 255;
        let kernelInfo = generate2DKernel(kernelName, kernelRadiusX, kernelRadiusY, kernelSoftness);
        if (kernelInfo.kernel.length > MAX_KERNEL_SIZE) {
            kernelInfo = subsampleKernel2D(kernelInfo.kernel, kernelInfo.width, kernelInfo.height, MAX_KERNEL_SIZE);
        }

        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_warpStrength: {type: "float", value: warpStrength},
            u_threshLow: {type: "float", value: threshLow},
            u_threshHigh: {type: "float", value: threshHigh},
            u_directionStrength: {type: "float", value: directionStrength},
            u_directionChannel: {type: "int", value: directionChannel},
            u_directionPolarity: {type: "float", value: Number(magPolarity)},
            u_magnitudeChannel: {type: "int", value: magChannel},
            u_magnitudePolarity: {type: "float", value: Number(magPolarity)},
            u_magnitudeGamma: {type: "float", value: magGamma},
            u_blendamount: {value: blendAmount, type: "float"},
            u_flatThreshold: {value: flatThreshold, type: "int"},
            u_kernel: {type: "floatArray", value: kernelInfo.kernel},
            u_kernelWidth: {type: "int", value: kernelInfo.width},
            u_kernelHeight: {type: "int", value: kernelInfo.height},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            KERNEL_SIZE: kernelInfo.kernel.length,
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
