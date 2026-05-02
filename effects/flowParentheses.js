import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
    makeEnum,
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";
import {KernelTypeEnum} from "../utils/kernels.js";
import {flowOffsetPass} from "./layers/flow_offset_pass.js";
import {kernelPass} from "./layers/kernel_pass.js";

const shaderPath = "flow_parentheses.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
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
    "S",
    "CONSTANT"
]);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "flow()",
    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        blendAmount: 1,
        warpStrength: 0.2,
        directionStrength: 0.5,
        directionChannel: PChannelEnum.LUMA,
        magChannel: PChannelEnum.LUMA,
        directionPolarity: false,
        magPolarity: false,
        threshLow: 0,
        threshHigh: 1,
        magGamma: 1,
        kernelName: "gaussian",
        kernelRadiusX: 3,
        kernelRadiusY: 3,
        kernelSoftness: 10,
        useChromaDrag: false,
        chromaDragAmount: 1,
        APPROX_INVERSE: false,
        INVERSE_APPROX_ITERS: 5,
        relaxation: 0.33
    },
    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            collapsed: false,
            label: "Base Warp Parameters",
            children: [
                {key: "warpStrength", label: "Warp Strength", type: "modSlider", min: -5, max: 5, steps: 200},
                {key: "threshLow", label: "Threshold Low", type: "modSlider", min: 0, max: 1, steps: 200, showIf: {"key": "magChannel", "notEquals": PChannelEnum.CONSTANT}},
                {key: "threshHigh", label: "Threshold High", type: "modSlider", min: 0, max: 1, steps: 200, showIf: {"key": "magChannel", "notEquals": PChannelEnum.CONSTANT}},
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
                {
                    type: "checkbox",
                    key: "useChromaDrag",
                    label: "Chroma Drag"
                },
                {
                    type: "range",
                    key: "chromaDragAmount",
                    label: "Drag Amount",
                    min: 0,
                    max: 1,
                    steps: 100,
                    showIf: {key: "useChromaDrag", "notEquals": false}
                },
                {
                   type: "checkbox",
                   key: "APPROX_INVERSE",
                   label: "Inverse Warp"
                },
                {
                    type: "range",
                    key: "INVERSE_APPROX_ITERS",
                    label: "Inverse Approx. Iter.",
                    min: 1,
                    max: 10,
                    step: 1,
                    showIf: {key: "APPROX_INVERSE", equals: true}
                },
                {
                    type: "range",
                    key: "relaxation",
                    label: "Approx. Relaxation",
                    min: 0.01,
                    max: 0.99,
                    steps: 100,
                    showIf: {key: "APPROX_INVERSE", equals: true}
                }
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
            directionStrength, directionPolarity,
            kernelName, kernelRadiusX, kernelRadiusY,
            kernelSoftness, useChromaDrag, chromaDragAmount,
            APPROX_INVERSE, INVERSE_APPROX_ITERS, relaxation
        } = resolveAnimAll(instance.config, t);
        const offsetUniformSpec = {
            u_warpStrength: {type: "float", value: warpStrength},
            u_threshLow: {type: "float", value: threshLow},
            u_threshHigh: {type: "float", value: threshHigh},
            u_directionStrength: {type: "float", value: directionStrength},
            u_directionPolarity: {type: "float", value: Number(directionPolarity)},
            u_magnitudePolarity: {type: "float", value: Number(magPolarity)},
            u_magnitudeGamma: {type: "float", value: magGamma},
            u_chromaDragAmount: {type: "float", value: chromaDragAmount},
        }
        const offsetDefineSpec = {
            MAGNITUDE_CHANNEL: magChannel,
            DIRECTION_CHANNEL: directionChannel,
            USE_CHROMA_DRAG: Number(useChromaDrag),
        }
        const offsetFBO = instance.flowOffsetPass.calculate(
            instance.flowOffsetPass,
            inputTex,
            width,
            height,
            offsetUniformSpec,
            offsetDefineSpec
        )
        const blurFBO = instance.kernelPass.calculate(
            instance.kernelPass,
            offsetFBO.texture,
            width,
            height,
            kernelName,
            kernelRadiusX,
            kernelRadiusY,
            kernelSoftness
        )
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {value: blendAmount, type: "float"},
            u_offsets: {type: "texture2D", value: blurFBO.texture},
            u_relaxation: {type: "float", value: relaxation}
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            APPROX_INVERSE: APPROX_INVERSE,
            INVERSE_APPROX_ITERS: INVERSE_APPROX_ITERS
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: async (instance, renderer) => {
        instance.flowOffsetPass = {
            initHook: flowOffsetPass.initHook,
            cleanupHook: flowOffsetPass.cleanupHook,
            setupFBO: flowOffsetPass.setupFBO,
            calculate: flowOffsetPass.calculate,
            outputFBO: null,
            width: null,
            height: null,
            id: `${instance.id}-offset-pass`
        }
        instance.kernelPass = {
            initHook: kernelPass.initHook,
            cleanupHook: kernelPass.cleanupHook,
            setupFBO: kernelPass.setupFBO,
            calculate: kernelPass.calculate,
            outputFBO: null,
            width: null,
            height: null,
            id: `${instance.id}-kernel-pass`
        }
        await instance.flowOffsetPass.initHook(instance.flowOffsetPass, renderer);
        await instance.kernelPass.initHook(instance.kernelPass, renderer);
        await fragSources.load(instance, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
        instance.flowOffsetPass.cleanupHook(instance.flowOffsetPass);
    },
    glState: null,
    isGPU: true
};
export const effectMeta = {
    group: "Operators",
    tags: ["sort", "blur", "paint", "warp"],
    description: "Ink in water, hourglass sandlight, dissection, pixel clouds. " +
        "Applies a spatial displacement field to an image, with rotation and magnitude " +
        "separately modulated by luma, hue, saturation, or specified color channels. ",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        threshHigh: {min: 0.55, max: 1},
        threshLow: {min: 0, max: 0.5},
        warpStrength: {min: 0.2, max: 1},
        kernelRadiusX: {min: 2, max: 9},
        kernelRadiusY: {min: 2, max: 9},
        APPROX_INVERSE: {always: false}
    }
};
