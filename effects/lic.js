import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {calcPass} from "./probes/calcpass.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, CalcModeEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";

const shaderPath = "lic.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl", "blend.glsl": "includes/blend.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Line Integral Convolution",

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            BLENDMODE, COLORSPACE, blendAmount, BLEND_CHANNEL_MODE,
            stepSize, falloff, angle, kernelRadius, useKernel,
            texelSizeX, texelSizeY, STEPS, jitter, seed, sharpness
        } = resolveAnimAll(instance.config, t);

        const calcPassFBO = instance.calcPass.calculate(
            instance.calcPass,
            inputTex,
            width,
            height,
            texelSizeX,
            texelSizeY,
            CalcModeEnum.STRUCTURE_TENSOR,
            useKernel,
            kernelRadius,
        )

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_calcPass: {value: calcPassFBO.texture, type: "texture2D"},
            u_texelSize: {value: [1 / width, 1 / height], type: "vec2"},
            u_falloff: {value: falloff, type: "float"},
            u_stepSize: {value: stepSize, type: "float"},
            u_angle: {value: angle * Math.PI / 180, type: "float"},
            u_blendamount: {value: blendAmount, type: "float"},
            u_jitter: {value: jitter * 2 * Math.PI, type: "float"},
            u_seed: {value: seed, type: "float"},
            u_sharpness: {value: sharpness, type: "float"}
        }

        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            STEPS: STEPS
        }

        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: async (instance, renderer) => {
        await fragSources.load();
        instance.calcPass = {
            initHook: calcPass.initHook,
            cleanupHook: calcPass.cleanupHook,
            setupFBO: calcPass.setupFBO,
            calculate: calcPass.calculate,
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
        angle: 90,
        useKernel: true,
        kernelRadius: 3,
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        texelSizeX: 1,
        texelSizeY: 1,
        stepSize: 1,
        falloff: 0.02,
        STEPS: 10,
        jitter: 0,
        seed: 0,
        sharpness: 2
    },
    uiLayout: [
        {
            key: "stepSize",
            label: "Step Size",
            type: "modSlider",
            min: 0,
            max: 5,
            steps: 100,
        },
        {
            key: "falloff",
            label: "Falloff",
            type: "modSlider",
            min: 0,
            max: 0.1,
            steps: 100,
        },
        {
            key: "sharpness",
            label: "Sharpness",
            type: "modSlider",
            min: 1,
            max: 3,
            steps: 100
        },
        {
          key: "STEPS",
          label: "Steps",
          type: "range",
          min: 1,
          max: 15,
          step: 1
        },
        {
            key: "angle",
            label: "Angle",
            type: "modSlider",
            min: 0,
            max: 360,
            step: 1,
        },
        {
            key: "jitter",
            label: "Jitter",
            type: "modSlider",
            min: 0,
            max: 0.25,
            steps: 100,
        },
        {
            key: "seed",
            label: "Seed",
            type: "modSlider",
            min: 0,
            max: 100,
            step: 1
        },
        {
            key: "useKernel",
            label: "Smoothing",
            type: "checkbox",
        },
        {
            key: "kernelRadius",
            label: "Smoothing Radius",
            type: "range",
            min: 1,
            max: 8,
            step: 1,
            showIf: {"key": "useKernel", "equals": true}
        },
        {
            key: "texelSizeX",
            label: "Texel Size X",
            type: "range",
            min: 1,
            max: 10,
            step: 1
        },
        {
            key: "texelSizeY",
            label: "Texel Size Y",
            type: "range",
            min: 1,
            max: 10,
            step: 1
        },
        blendControls()
    ]
}

export const effectMeta = {
  group: "Stylize",
  tags: ["edge", "brush", "paint"],
  description: "Edge-directed blurring. A variety of painterly effects.",
  backend: "gpu",
  canAnimate: true,
  realtimeSafe: true,
  parameterHints: {
      "kernelRadius": {"min": 1, "max": 5},
      "steps": {"min": 3, "max": 10},
      "falloff": {"min": 0, "max": 0.05},
      "jitter": {"min": 0, "max": 0.15}
  },
  notInRandom: false
};
