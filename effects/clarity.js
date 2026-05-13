import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {claritySharpPass} from "./layers/clarity_sharp_pass.js";
import {generate2DKernel, subsampleKernel2D} from "../utils/kernels.js";
import {ColorspaceEnum} from "../utils/glsl_enums.js";
import {colorspacePass} from "./layers/colorspace_pass.js";

const shaderPath = "clarity.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Clarity",

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            sharpRadius, blurRadius, sharpKnee, sharpThreshold, sharpStrength,
            intensity, preserveTones, COLORSPACE
        } = resolveAnimAll(instance.config, t);

        const colorFBO = instance.colorspacePass.calculate(
            instance.colorspacePass, inputTex, width, height, COLORSPACE
        )
        const sharpFBO = instance.sharpPass.calculate(
            instance.sharpPass,
            colorFBO.texture,
            width,
            height,
            sharpRadius,
            sharpThreshold,
            sharpStrength,
            sharpKnee,
        )

        let kernelInfo;
        const MAX_KERNEL_SIZE = 255;
        if (instance.auxiliaryCache.lastKernelRadius !== blurRadius) {
            kernelInfo = generate2DKernel("gaussian", blurRadius, blurRadius, blurRadius + 0.5);
            if (kernelInfo.kernel.length > MAX_KERNEL_SIZE) {
                kernelInfo = subsampleKernel2D(kernelInfo, MAX_KERNEL_SIZE);
            }
            instance.auxiliaryCache.lastKernelRadius = blurRadius;
            instance.auxiliaryCache.kernelInfo = kernelInfo;
        } else {
            kernelInfo = instance.auxiliaryCache.kernelInfo;
        }

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_kernel: {type: "floatArray", value: kernelInfo.kernel},
            u_sharpPass: {type: "texture2D", value: sharpFBO.texture},
            u_intensity: {type: "float", value: intensity},
            u_preserveTones: {type: "float", value: preserveTones}
        }
        const defines = {
            KERNEL_WIDTH: kernelInfo.width,
            KERNEL_HEIGHT: kernelInfo.height,
            COLORSPACE: COLORSPACE
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },

    initHook: async (instance, renderer) => {
        await fragSources.load();
        instance.auxiliaryCache = {};
        instance.colorspacePass = {
            initHook: colorspacePass.initHook,
            cleanupHook: colorspacePass.cleanupHook,
            setupFBO: colorspacePass.setupFBO,
            calculate: colorspacePass.calculate,
            outputFBO: null,
            width: null,
            height: null,
            id: `${instance.id}-colorspace-pass`

        }
        instance.sharpPass = {
            initHook: claritySharpPass.initHook,
            cleanupHook: claritySharpPass.cleanupHook,
            setupFBO: claritySharpPass.setupFBO,
            calculate: claritySharpPass.calculate,
            outputFBO: null,
            width: null,
            height: null,
            id: `${instance.id}-sharp-pass`
        }
        await instance.colorspacePass.initHook(instance.colorspacePass, renderer);
        await instance.sharpPass.initHook(instance.sharpPass, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
        instance.sharpPass.cleanupHook(instance.sharpPass);
        instance.colorspacePass.cleanupHook(instance.colorspacePass);
    },
    glState: null,
    isGPU: true,
    pass: null,
    defaultConfig: {
        sharpRadius: 3,
        blurRadius: 3,
        sharpKnee: 0.01,
        sharpStrength: 1,
        sharpThreshold: 0.05,
        intensity: 1,
        preserveTones: 0.25,
        COLORSPACE: ColorspaceEnum.JzAzBz
    },
    uiLayout: [
        {
            key: "intensity",
            label: "Intensity",
            type: "range",
            min: 0,
            max: 1,
            step: 0.01
        },
        {
            key: "preserveTones",
            label: "Preserve Shadow/Highlight",
            type: "range",
            min: 0,
            max: 1,
            step: 0.01
        },
        {
            key: "sharpRadius",
            label: "Sharp Radius",
            type: "range",
            min: 1,
            max: 10,
            step: 1,
        },
        {
            key: "blurRadius",
            label: "Blur Radius",
            type: "range",
            min: 1,
            max: 10,
            step: 1,
        },
        {
            key: "sharpThreshold",
            label: "Sharp Threshold",
            type: "range",
            min: 0,
            max: 0.2,
            step: 0.01
        },
        {
            key: "sharpKnee",
            label: "Sharp Knee",
            type: "range",
            min: 0,
            max: 0.2,
            step: 0.01
        },
        {
            key: "sharpStrength",
            label: "Sharp Strength",
            type: "range",
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: "COLORSPACE",
            label: "Lightness Model",
            type: "select",
            options: [{"label": "JzAzBz", value: ColorspaceEnum.JzAzBz}, {"label": "Lab", "value": ColorspaceEnum.Lab}]
        }
    ]
}

export const effectMeta = {
  group: "Utility",
  tags: ["blur", "sharpen"],
  description: "Smooth contrast/sharpening effect.",
  backend: "gpu",
  canAnimate: false,
  realtimeSafe: true,
  parameterHints: {
      blurRadius: {min: 1, max: 6},
      sharpRadius: {min: 1, max: 6},
      intensity: {min: 0.5, max: 1}
  }
};
