import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {structureTensorPass} from "./probes/structuretensor.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";

const shaderPath = "structureflow.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl", "blend.glsl": "includes/blend.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Structure Flow",

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            BLENDMODE, COLORSPACE, blendAmount, BLEND_CHANNEL_MODE, chromaBoost,
            magnitude, anisoDrag, edgeAngle, kernelRadius, USE_KERNEL
        } = resolveAnimAll(instance.config, t);

        instance.structureTensorPass.calculate(
            instance.structureTensorPass,
            inputTex,
            width,
            height,
            1,
            1,
            USE_KERNEL,
            kernelRadius
        )

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_structureTensor: {
                value: instance.structureTensorPass.outputFBO.texture,
                type: "texture2D"
            },
            u_texelSize: {value: [1 / width, 1 / height], type: "vec2"},
            u_magnitude: {value: magnitude, type: "float"},
            u_anisoDrag: {value: anisoDrag, type: "float"},
            u_edgeAngle: {value: edgeAngle * Math.PI / 180, type: "float"},
            u_blendAmount: {value: blendAmount, type: "float"},
            u_chromaBoost: {value: chromaBoost, type: "float"}
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
        instance.structureTensorPass = {
            initHook: structureTensorPass.initHook,
            cleanupHook: structureTensorPass.cleanupHook,
            setupFBO: structureTensorPass.setupFBO,
            calculate: structureTensorPass.calculate,
            outputFBO: null,
            width: null,
            height: null
        }
        await instance.structureTensorPass.initHook(instance.structureTensorPass, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
    pass: null,
    defaultConfig: {
        magnitude: 3,
        anisoDrag: 0.2,
        edgeContribution: 1,
        edgeAngle: 90,
        USE_KERNEL: false,
        kernelRadius: 3,
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        chromaBoost: 1,
    },
    uiLayout: [
        {
            key: "magnitude",
            label: "Strength",
            type: "modSlider",
            min: 0,
            max: 25,
            steps: 100,
        },
        {
            key: "anisoDrag",
            label: "Texture Drag",
            type: "modSlider",
            min: 0,
            max: 1,
            steps: 100,
        },
        {
            key: "edgeAngle",
            label: "Edge Angle",
            type: "modSlider",
            min: 0,
            max: 360,
            step: 1
        },
        {
            key: "USE_KERNEL",
            label: "Smoothing",
            type: "checkbox",
        },
        {
            key: "kernelRadius",
            label: "Smoothing Radius",
            type: "range",
            min: 3,
            max: 5,
            step: 1,
            showIf: {"key": "USE_KERNEL", "equals": true}
        },
        blendControls()
    ]
}

export const effectMeta = {
  group: "Stylize",
  tags: ["edge", "blur", "smooth"],
  description: "Selective blur along edges, optionally attenuated by local texture.",
  backend: "gpu",
  canAnimate: true,
  realtimeSafe: true,
  parameterHints: {"USE_KERNEL": {"always": false}},
  notInRandom: true
};
