import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendModeOpts,
    BlendTargetEnum,
    BlendTargetOpts,
    ColorspaceEnum,
    ColorspaceOpts,
} from "../utils/glsl_enums.js";
import {generateKernel, KernelTypeEnum} from "../utils/kernels.js";

const shaderPath = "../shaders/bloom.glsl"
const includePaths = {
    'kernel_utils.glsl': '../shaders/includes/kernel_utils.glsl',
    'colorconvert.glsl': '../shaders/includes/colorconvert.glsl',
    'blend.glsl': '../shaders/includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Bloom",
    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        BLENDTARGET: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        blendAmount: 1,
        bloomThreshold: 0.4,
        bloomSoftness: 0.3,
        bloomStrength: 0.4,
        kernelName: "gaussian",
        kernelRadius: 3,
        kernelSoftness: 10,
        BLOOM_MODE: 0,
        BLOOM_CHROMA_TAIL: false,
        chromaOffset: [1.1, 1.0, 0.9]
    },
    uiLayout: [
        {type: "modSlider", key: "bloomThreshold", label: "Bloom Threshold", min: 0, max: 1, steps: 200},
        {type: "modSlider", key: "bloomSoftness", label: "Bloom Softness", min: 0, max: 1, steps: 200},
        {type: "modSlider", key: "bloomStrength", label: "Bloom Strength", min: 0, max: 3, steps: 200},
        {
            key: 'kernelName',
            label: 'Bloom Kernel',
            type: 'Select',
            options: Object.values(KernelTypeEnum)
        },
        {type: "range", key: "kernelRadius", label: "Kernel Radius", min: 3, max: 30, step: 1},
        {type: "modSlider", key: "kernelSoftness", label: "Kernel Softness", min: 1, max: 20, steps: 200},
        {
            key: 'BLOOM_MODE',
            label: 'Bloom Mode',
            type: 'Select',
            options: [{'label': 'Luma', 'value': 0}, {'label': "Saturation", "value": 1}]
        },
        {
            key: 'BLOOM_CHROMA_TAIL',
            label: 'Chroma Tail',
            type: 'Checkbox',
        },
        {
            key: "chromaOffset",
            label: "Chroma Tail Shape",
            type: "vector",
            length: 3,
            sublabels: ["R", "G", "B"],
            min: -10,
            max: 10,
            steps: 200
        },
        {
            key: "blendAmount",
            label: "Blend Amount",
            type: "Range",
            min: 0,
            max: 1,
            step: 0.01
        },
        {
            key: 'BLENDMODE',
            label: 'Blend Mode',
            type: 'Select',
            options: BlendModeOpts
        },
        {
            key: "COLORSPACE",
            type: "select",
            label: "Blend Colorspace",
            options: ColorspaceOpts
        },
        {
            key: 'BLENDTARGET',
            label: 'Blend Target',
            type: 'Select',
            options: BlendTargetOpts
        },
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources)
        let {
            BLENDMODE, COLORSPACE, blendAmount, BLENDTARGET, bloomStrength,
            bloomThreshold, bloomSoftness, BLOOM_MODE, kernelRadius,
            chromaOffset, BLOOM_CHROMA_TAIL, kernelName, kernelSoftness,
        } = resolveAnimAll(instance.config, t);
        const kernel = generateKernel(kernelName, kernelRadius, kernelSoftness);
        console.log(kernel);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {value: blendAmount, type: "float"},
            u_bloomSoftness: {value: bloomSoftness, type: "float"},
            u_bloomStrength: {value: bloomStrength, type: "float"},
            u_bloomThreshold: {value: bloomThreshold, type: "float"},
            u_kernel: {value: kernel, type: "floatArray"},
            u_chromaOffset: {value: chromaOffset, type: "vec3"},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLENDTARGET,
            KERNEL_SIZE: kernel.length,
            BLOOM_MODE: BLOOM_MODE,
            BLOOM_CHROMA_TAIL: Number(BLOOM_CHROMA_TAIL)
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
    group: "Stylize",
    tags: ["light", "bloom", "webgl", "lens", "light", "flare", "cinematic"],
    description: "Bloom / flare effect offering a variety of selectable modes and shapes",
    canAnimate: true,
    realtimeSafe: true,
};
