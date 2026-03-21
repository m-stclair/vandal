import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {structureTensorPass} from "./probes/structuretensor.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums";

const shaderPath = "kuwahara.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Kuwahara",

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            BLENDMODE, COLORSPACE, blendAmount, BLEND_CHANNEL_MODE, chromaBoost,
            texelSizeX, texelSizeY, radius, sharpness, eccentricity
        } = resolveAnimAll(instance.config, t);

        instance.structureTensorPass.calculate(
            instance.structureTensorPass,
            inputTex,
            width,
            height,
            texelSizeX,
            texelSizeY
        )

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_structureTensor: {
                value: instance.structureTensorPass.outputFBO.texture,
                type: "texture2D"
            },
            u_texelSize: {value: [texelSizeX, texelSizeY], type: "vec2"},
            u_radius: {value: radius, type: "float"},
            u_sharpness: {value: sharpness, type: "float"},
            u_eccentricity: {value: eccentricity, type: "float"}
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
        texelSizeX: 1,
        texelSizeY: 1,
        radius: 4,
        sharpness: 2.5,
        eccentricity: 1,
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        chromaBoost: 1,

    },
    uiLayout: [
        {
            key: "texelSizeX",
            label: "Texel Stretch X",
            type: "range",
            min: 1,
            max: 8,
            step: 1,
        },
        {
            key: "texelSizeY",
            label: "Texel Stretch Y",
            type: "range",
            min: 1,
            max: 8,
            step: 1,
        },
        {
            key: "radius",
            label: "Radius",
            type: "range",
            min: 3,
            max: 16,
            step: 1,
        },
        {
            key: "sharpness",
            label: "Sharpness",
            type: "range",
            min: 1,
            max: 8,
            steps: 100,
        },
        {
            key: "eccentricity",
            label: "Eccentricity",
            type: "range",
            min: 0,
            max: 6,
            steps: 100
        },
        blendControls()
    ]
}

export const effectMeta = {
  group: "Stylize",
  tags: ["paint", "brush", "edge", "blur"],
  description: "Applies a Kuwahara filter for painterly effects.",
  backend: "gpu",
  canAnimate: false,
  realtimeSafe: false,
  notInRandom: true
};
