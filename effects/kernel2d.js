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
import {generate2DKernel, KernelTypeEnum, subsampleKernel2D} from "../utils/kernels.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "../shaders/kernel2d.glsl";
const includePaths = {
    'colorconvert.glsl': '../shaders/includes/colorconvert.glsl',
    'blend.glsl': '../shaders/includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "2D Kernel",
    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        BLENDTARGET: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        blendAmount: 1,
        kernelName: "gaussian",
        kernelRadiusX: 3,
        kernelRadiusY: 3,
        kernelSoftness: 10
    },
    uiLayout: [
        {
            key: 'kernelName',
            label: 'Kernel Shape',
            type: 'Select',
            options: Object.values(KernelTypeEnum)
        },
        {type: "range", key: "kernelRadiusX", label: "Radius X", min: 1, max: 30, step: 1},
        {type: "range", key: "kernelRadiusY", label: "Radius Y", min: 1, max: 30, step: 1},
        {type: "modSlider", key: "kernelSoftness", label: "Softness", min: 1, max: 20, steps: 200},
        blendControls()
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        let {
            kernelName, kernelRadiusX, kernelRadiusY, kernelSoftness,
            BLENDMODE, COLORSPACE, BLENDTARGET, blendAmount
        } = resolveAnimAll(instance.config, t);

        const MAX_KERNEL_SIZE = 255;
            let kernelInfo = generate2DKernel(kernelName, kernelRadiusX, kernelRadiusY, kernelSoftness);
            if (kernelInfo.kernel.length > MAX_KERNEL_SIZE) {
                kernelInfo = subsampleKernel2D(kernelInfo.kernel, kernelInfo.width, kernelInfo.height, MAX_KERNEL_SIZE);
            }        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_kernel: {type: "floatArray", value: kernelInfo.kernel},
            u_kernelWidth: {type: "int", value: kernelInfo.width},
            u_kernelHeight: {type: "int", value: kernelInfo.height},
            u_blendamount: {type: "float", value: blendAmount}
        };

        const defines = {
            KERNEL_SIZE: kernelInfo.kernel.length,
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLENDTARGET
        };

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
    group: "Utility",
    tags: ["kernel", "blur", "sharpen", "emboss", "webgl", "filter", "convolution"],
    description: "Applies a generic 2D convolution kernel; use for blur, emboss, sharpening, etc.",
    canAnimate: true,
    realtimeSafe: true,
};
