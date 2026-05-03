import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {calcPass} from "./probes/calcpass.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, CalcModeEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";

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
            BLENDMODE, COLORSPACE, blendAmount, BLEND_CHANNEL_MODE, CALCULATE_MODE,
            magnitude, anisoDrag, angle, kernelRadius, useKernel,
            texelSizeX, texelSizeY
        } = resolveAnimAll(instance.config, t);

        const calcPassFBO = instance.calcPass.calculate(
            instance.calcPass,
            inputTex,
            width,
            height,
            texelSizeX,
            texelSizeY,
            Number(CALCULATE_MODE),
            useKernel,
            kernelRadius,
        )

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_calcPass: {value: calcPassFBO.texture, type: "texture2D"},
            u_texelSize: {value: [1 / width, 1 / height], type: "vec2"},
            u_magnitude: {value: magnitude, type: "float"},
            u_anisoDrag: {value: anisoDrag, type: "float"},
            u_angle: {value: angle * Math.PI / 180, type: "float"},
            u_blendAmount: {value: blendAmount, type: "float"},
        }

        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            CALCULATE_MODE: CALCULATE_MODE
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
            height: null,
            id: `${instance.id}-calc-pass`
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
        magnitude: 3,
        anisoDrag: 0,
        angle: 90,
        CALCULATE_MODE: CalcModeEnum.STRUCTURE_TENSOR,
        useKernel: false,
        kernelRadius: 3,
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        texelSizeX: 1,
        texelSizeY: 1
    },
    uiLayout: [
        {
            key: "magnitude",
            label: "Strength",
            type: "modSlider",
            min: 0,
            max: 50,
            steps: 200,
        },
        {
            key: "anisoDrag",
            label: "Texture Drag",
            type: "modSlider",
            min: 0,
            max: 100,
            steps: 200,
            showIf: {"key": "CALCULATE_MODE", "equals": CalcModeEnum.STRUCTURE_TENSOR}
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
            key: "CALCULATE_MODE",
            label: "Mode",
            type: "select",
            options: [
                {label: "Structure", value: CalcModeEnum.STRUCTURE_TENSOR},
                {label: "Isophote", value: CalcModeEnum.ISOPHOTE},
                {label: "Flowline", value: CalcModeEnum.FLOWLINE}
            ]
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
            min: 3,
            max: 10,
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
  tags: ["edge", "displacement", "smooth"],
  description: "Selective displacement along edges, optionally attenuated by local texture.",
  backend: "gpu",
  canAnimate: true,
  realtimeSafe: true,
  parameterHints: {"kernelRadius": {"min": 1, "max": 4}},
  notInRandom: false
};
