import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {kernelPass} from "./layers/kernel_pass.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";

const shaderPath = "dog.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl", "blend.glsl": "includes/blend.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

function makeKernelPass(id) {
    return {
        initHook: kernelPass.initHook,
        cleanupHook: kernelPass.cleanupHook,
        setupFBO: kernelPass.setupFBO,
        calculate: kernelPass.calculate,
        outputFBO: null,
        width: null,
        height: null,
        id: id
    }
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "DoG",

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            BLENDMODE, COLORSPACE, blendAmount, BLEND_CHANNEL_MODE,
            radius1, radius2, softness1, softness2, temperature, weight
        } = resolveAnimAll(instance.config, t);

        const sharedParams = [inputTex, width, height, "gaussian"]
        const kernel1FBO = instance.kernelPass1.calculate(
            instance.kernelPass1,
            ...sharedParams,
            radius1,
            radius1,
            softness1
        )
        const kernel2FBO = instance.kernelPass2.calculate(
            instance.kernelPass2,
            ...sharedParams,
            radius2,
            radius2,
            softness2
        )

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_kernelPass1: {value: kernel1FBO.texture, type: "texture2D"},
            u_kernelPass2: {value: kernel2FBO.texture, type: "texture2D"},
            u_blendAmount: {value: blendAmount, type: "float"},
            u_weight: {value: weight, type: "float"},
            u_temperature: {value: temperature, type: "float"}
        }

        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },

    initHook: async (instance, renderer) => {
        await fragSources.load();
        instance.kernelPass1 = makeKernelPass(`${instance.id}-kernelPass1`);
        instance.kernelPass2 = makeKernelPass(`${instance.id}-kernelPass2`);
        await instance.kernelPass1.initHook(instance.kernelPass1, renderer);
        await instance.kernelPass2.initHook(instance.kernelPass2, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
        instance.kernelPass1.cleanupHook(instance.kernelPass1);
        instance.kernelPass2.cleanupHook(instance.kernelPass2);
    },
    glState: null,
    isGPU: true,
    pass: null,
    defaultConfig: {
        radius1: 2,
        radius2: 8,
        softness1: 1.5,
        softness2: 2.5,
        temperature: 10,
        weight: 0.98,
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        chromaBoost: 1,
    },
    uiLayout: [
        {
            key: "radius1",
            label: "Radius 1",
            type: "modSlider",
            min: 1,
            max: 15,
            step: 1,
        },
        {
            key: "softness1",
            label: "Softness 1",
            type: "modSlider",
            min: 1,
            max: 10,
            step: 0.1,
        },
        {
            key: "radius2",
            label: "Radius 2",
            type: "modSlider",
            min: 1,
            max: 15,
            step: 1,
        },
        {
            key: "softness2",
            label: "Softness 2",
            type: "modSlider",
            min: 0,
            max: 10,
            step: 0.1,
        },
        {
            key: "temperature",
            label: "Temperature",
            type: "modSlider",
            min: 1,
            max: 20,
            step: 0.1
        },
        {
          key: "weight",
          label: "#2 Weight",
          type: "modSlider",
          min: 0.95,
          max: 1.05,
          step: 0.005
        },
        blendControls()
    ]
}

export const effectMeta = {
  group: "Utility",
  tags: ["edge", "sharpen"],
  description: "Difference of gaussians.",
  backend: "gpu",
  canAnimate: true,
  realtimeSafe: true,
  parameterHints: {"useKernel": {"always": false}},
  notInRandom: true
};
