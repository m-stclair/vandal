import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {calcPass} from "./probes/calcpass.js";
import {generate2DKernel, KernelTypeEnum, subsampleKernel2D} from "../utils/kernels.js";
import {blendControls} from "../utils/ui_configs.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
    CalcModeEnum,
} from "../utils/glsl_enums.js";

const shaderPath = "structurekernel.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl", "blend.glsl": "includes/blend.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Structure Kernel",

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            BLENDMODE, COLORSPACE, BLEND_CHANNEL_MODE, CALCULATE_MODE, blendAmount,
            calcKernelRadius, useCalcKernel, kernelName, kernelRadiusX, kernelRadiusY, kernelSoftness,
            intensity, temperature, STRUCTURE_MODE, stretchAmount,
        } = resolveAnimAll(instance.config, t);

        const calcPassFBO = instance.calcPass.calculate(
            instance.calcPass,
            inputTex,
            width,
            height,
            1,
            1,
            CALCULATE_MODE,
            useCalcKernel,
            calcKernelRadius,
        )

        let kernelInfo;
        const kernelSettings = [kernelName, kernelRadiusX, kernelRadiusY, kernelSoftness];
        if (String(instance.auxiliaryCache.lastKernelSettings) !== String(kernelSettings)) {
            const MAX_KERNEL_SIZE = 255;
            kernelInfo = generate2DKernel(kernelName, kernelRadiusX, kernelRadiusY, kernelSoftness);
            if (kernelInfo.kernel.length > MAX_KERNEL_SIZE) {
                kernelInfo = subsampleKernel2D(kernelInfo, MAX_KERNEL_SIZE);
            }
            instance.auxiliaryCache.lastKernelSettings = kernelSettings;
            instance.auxiliaryCache.kernelInfo = kernelInfo;
        } else {
            kernelInfo = instance.auxiliaryCache.kernelInfo;
        }
        instance.auxiliaryCache.lastKernelSettings = kernelSettings;


        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_calcPass: {value: calcPassFBO.texture, type: "texture2D"},
            u_kernel: {type: "floatArray", value: kernelInfo.kernel},
            u_blendamount: {value: blendAmount, type: "float"},
            u_intensity: {value: intensity, type: "float"},
            u_temperature: {value: temperature, type: "float"},
            u_texelSize: {value: [1.0 / width, 1.0 / height], type: "vec2"},
            u_stretchAmount: {value: stretchAmount, type: "float"}
        }

        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            CALCULATE_MODE: CALCULATE_MODE,
            KERNEL_WIDTH: kernelInfo.width,
            KERNEL_HEIGHT: kernelInfo.height,
            STRUCTURE_MODE: STRUCTURE_MODE
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: async (instance, renderer) => {
        instance.auxiliaryCache = {};
        await fragSources.load();
        instance.calcPass = {
            initHook: calcPass.initHook,
            cleanupHook: calcPass.cleanupHook,
            setupFBO: calcPass.setupFBO,
            calculate: calcPass.calculate,
            id: `${instance.id}-calc-pass`,
            outputFBO: null,
            width: null,
            height: null
        }
        await instance.calcPass.initHook(instance.calcPass, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
        instance.calcPass.cleanupHook(instance.calcPass);
    },
    glState: null,
    isGPU: true,
    pass: null,
    defaultConfig: {
        intensity: 0.5,
        temperature: 4,
        CALCULATE_MODE: CalcModeEnum.SOBEL,
        useCalcKernel: true,
        calcKernelRadius: 3,
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        kernelName: "gaussian",
        kernelRadiusX: 3,
        kernelRadiusY: 3,
        kernelSoftness: 10,
        STRUCTURE_MODE: 0,
        stretchAmount: 0
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
        {
            key: "intensity",
            label: "Intensity",
            type: "modSlider",
            min: -2,
            max: 2,
            step: 0.01,
        },
        {
            key: "temperature",
            label: "Temperature",
            type: "range",
            min: 0.5,
            max: 8,
            step: 0.1,
        },
        {
            key: "STRUCTURE_MODE",
            label: "Pullback / Apply",
            type: "select",
            options: [
                {"value": 0, label: "Pullback"},
                {"value": 1, label: "Apply"}
            ]
        },
        {
            key: "CALCULATE_MODE",
            label: "Mode",
            type: "select",
            options: [
                {label: "Isophote", value: CalcModeEnum.ISOPHOTE},
                {label: "Sobel", value: CalcModeEnum.SOBEL},
            ]
        },
        {type: "modSlider", key: "stretchAmount", label: "Stretch Amount", min: 0, max: 1000, steps: 200},
        {
            key: "useCalcKernel",
            label: "Smoothing",
            type: "checkbox",
        },
        {
            key: "calcKernelRadius",
            label: "Smoothing Radius",
            type: "range",
            min: 3,
            max: 10,
            step: 1,
            showIf: {"key": "useCalcKernel", "equals": true}
        },
        blendControls()
    ]
}

export const effectMeta = {
  group: "Utility",
  tags: ["edge", "blur", "smooth"],
  description: "Selective structure-aware kernel filters.",
  backend: "gpu",
  canAnimate: true,
  realtimeSafe: true,
  parameterHints: {
      "kernelRadiusX": {"min": 2, "max": 7},
      "kernelRadiusY": {"min": 2, "max": 7},
      "calcKernelRadius": {"min": 2, "max": 6}
  },
  notInRandom: false
};
