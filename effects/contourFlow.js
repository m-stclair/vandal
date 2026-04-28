import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
    makeEnum,
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";
import {generate2DKernel, KernelTypeEnum, subsampleKernel2D} from "../utils/kernels.js";
import {contourOffsetPass} from "./layers/contour_offset_pass.js";
import {kernelPass} from "./layers/kernel_pass.js";

const shaderPath = "contour_flow.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: CChannelEnum,
    names: CChannelNames,
    options: CChannelOpts
} = makeEnum([
    'LUMA',
    'R',
    'G',
    'B',
    "H",
    "S",
]);

const {
    enum: FlowModeEnum,
    names: FlowModeNames,
    options: FlowModeOpts
} = makeEnum([
    'TANGENT',
    'NORMAL',
    'RIDGE_SPIRAL'
]);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "contourFlow()",
    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        blendAmount: 1,

        warpStrength: 0.18,
        scalarChannel: CChannelEnum.LUMA,
        flowMode: FlowModeEnum.TANGENT,
        directionPolarity: false,

        edgeGain: 6,
        edgeLow: 0.02,
        edgeHigh: 0.8,
        flowGamma: 1.2,
        twistAmount: 0,

        streamSteps: 5,
        stepLength: 1.5,
        decay: 1.6,
        centerWeight: 1,

        kernelName: "gaussian",
        kernelRadiusX: 5,
        kernelRadiusY: 5,
        kernelSoftness: 8,

        useChromaGate: false,
        chromaGateAmount: 1,
    },
    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            collapsed: false,
            label: "Contour Current",
            children: [
                {key: "warpStrength", label: "Warp Strength", type: "modSlider", min: -2, max: 2, steps: 200},
                {key: "edgeGain", label: "Edge Gain", type: "modSlider", min: 0.1, max: 40, scale: "log", steps: 220},
                {key: "edgeLow", label: "Edge Low", type: "modSlider", min: 0, max: 1, steps: 200, showIf: {"key": "scalarChannel", "notEquals": CChannelEnum.CONSTANT}},
                {key: "edgeHigh", label: "Edge High", type: "modSlider", min: 0, max: 1, steps: 200, showIf: {"key": "scalarChannel", "notEquals": CChannelEnum.CONSTANT}},
                {key: "flowGamma", label: "Edge Gamma", type: "modSlider", min: 0.01, max: 8, scale: "log", steps: 200},
                {
                    type: "select",
                    key: "scalarChannel",
                    label: "Contour Channel",
                    options: CChannelOpts
                },
                {
                    type: "checkbox",
                    key: "useChromaGate",
                    label: "Chroma Gate"
                },
                {
                    type: "range",
                    key: "chromaGateAmount",
                    label: "Gate Amount",
                    min: 0,
                    max: 1,
                    steps: 100,
                    showIf: {key: "useChromaGate", "notEquals": false}
                }
            ]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Direction Field",
            children: [
                {
                    type: "select",
                    key: "flowMode",
                    label: "Flow Mode",
                    options: FlowModeOpts
                },
                {key: "twistAmount", label: "Local Twist", type: "modSlider", min: -12.566, max: 12.566, steps: 240},
            ]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Stream Integration",
            children: [
                {type: "range", key: "streamSteps", label: "Steps", min: 1, max: 12, step: 1},
                {key: "stepLength", label: "Step Length", type: "modSlider", min: 0.05, max: 4, steps: 200, scale: "log"},
                {key: "decay", label: "Step Decay", type: "modSlider", min: 0.1, max: 8, steps: 200, scale: "log"},
                {key: "centerWeight", label: "Center Weight", type: "modSlider", min: 0, max: 8, steps: 200},
            ]
        },
        {
            type: "group",
            label: "Field Smoothing Kernel",
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
            BLEND_CHANNEL_MODE, scalarChannel,
            flowMode, warpStrength,
            edgeGain, edgeLow, edgeHigh, flowGamma, twistAmount,
            streamSteps, stepLength, decay, centerWeight,
            kernelName, kernelRadiusX, kernelRadiusY,
            kernelSoftness, useChromaGate, chromaGateAmount
        } = resolveAnimAll(instance.config, t);

        const offsetUniformSpec = {
            u_texelSize: {type: "vec2", value: [1 / width, 1 / height]},
            u_warpStrength: {type: "float", value: warpStrength},
            u_edgeGain: {type: "float", value: edgeGain},
            u_edgeLow: {type: "float", value: edgeLow},
            u_edgeHigh: {type: "float", value: edgeHigh},
            u_flowGamma: {type: "float", value: flowGamma},
            u_twistAmount: {type: "float", value: twistAmount},
            u_chromaGateAmount: {type: "float", value: chromaGateAmount},
        }
        const offsetDefineSpec = {
            SCALAR_CHANNEL: scalarChannel,
            FLOW_MODE: flowMode,
            USE_CHROMA_GATE: Number(useChromaGate)
        }
        const offsetFBO = instance.contourOffsetPass.calculate(
            instance.contourOffsetPass,
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
        const safeStreamSteps = Math.max(1, Math.min(12, Math.round(streamSteps)));
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {value: blendAmount, type: "float"},
            u_texelSize: {type: "vec2", value: [1 / width, 1 / height]},
            u_offsets: {type: "texture2D", value: blurFBO.texture},
            u_stepLength: {type: "float", value: stepLength},
            u_decay: {type: "float", value: decay},
            u_centerWeight: {type: "float", value: centerWeight},
        };
        const defines = {
            STREAM_STEPS: safeStreamSteps,
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: async (instance, renderer) => {
        instance.contourOffsetPass = {
            initHook: contourOffsetPass.initHook,
            cleanupHook: contourOffsetPass.cleanupHook,
            setupFBO: contourOffsetPass.setupFBO,
            calculate: contourOffsetPass.calculate,
            outputFBO: null,
            width: null,
            height: null
        }
        instance.kernelPass = {
            initHook: kernelPass.initHook,
            cleanupHook: kernelPass.cleanupHook,
            setupFBO: kernelPass.setupFBO,
            calculate: kernelPass.calculate,
            outputFBO: null,
            width: null,
            height: null
        }
        await instance.contourOffsetPass.initHook(instance.contourOffsetPass, renderer);
        await instance.kernelPass.initHook(instance.kernelPass, renderer);
        await fragSources.load(instance, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
        instance.contourOffsetPass.cleanupHook(instance.contourOffsetPass);
        instance.kernelPass.cleanupHook(instance.kernelPass);
    },
    glState: null,
    isGPU: true
};
export const effectMeta = {
    group: "Operators",
    tags: ["contour", "flow", "paint", "warp"],
    description: "Topo-map ink, river seams, oily contour currents. " +
        "Builds a displacement field from local image gradients, then integrates color " +
        "forward and backward along the resulting contour stream",
    canAnimate: true,
    realtimeSafe: true,
    notInRandom: false,
    parameterHints: {
        warpStrength: {min: 0.08, max: 0.6},
        edgeGain: {min: 3, max: 14},
        edgeLow: {min: 0, max: 0.08},
        edgeHigh: {min: 0.55, max: 1},
        streamSteps: {min: 3, max: 8},
        kernelRadiusX: {min: 3, max: 8},
        kernelRadiusY: {min: 3, max: 8},
        kernelName: {"always": "gaussian"},
        edgeGamma: {"aniMin": 0.01},
        BLENDMODE: {"always": BlendModeEnum.MIX}
    }
};
