import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, makeEnum} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "colorshred.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "noise.glsl": "includes/noise.glsl",
    "blend.glsl": "includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: SModeEnum,
    names: SModeNames,
    options: SModeOpts
} = makeEnum(['DISJOINT', 'JOINT', 'PRESERVE_LUMA']);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Colorshred",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        blendAmount: 1,
        mode: SModeEnum.DISJOINT,
        density: 0.1,
        chromaThreshold: 0,
        INVERT_CHROMA_THRESHOLD: false
    },

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            mode, density, chromaThreshold, INVERT_CHROMA_THRESHOLD,
            blendAmount, COLORSPACE, BLEND_CHANNEL_MODE,
            BLENDMODE
        } = resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_density: {value: density, type: "float"},
            u_chromaThreshold: {value: chromaThreshold, type: "float"},
            u_blendamount: {value: blendAmount, type: "float"}
        };
        const defines = {
            SHRED_COLOR_MODE: mode,
            CHROMA_THRESHOLDING: Number(INVERT_CHROMA_THRESHOLD ? chromaThreshold < 1 : chromaThreshold > 0),
            INVERT_CHROMA_THRESHOLD: Number(INVERT_CHROMA_THRESHOLD),
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
        };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },

    async initHook(fx, renderer) {
        await fragSources.load();
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
    uiLayout: [
        {
            key: "mode",
            label: "Mode ",
            type: "select",
            options: SModeOpts
        },
        {
            type: "modSlider",
            key: "density",
            label: "Density",
            min: 0,
            max: 1,
            step: 0.01
        },
        {
            type: "modSlider",
            key: "chromaThreshold",
            label: "Chroma Threshold",
            min: 0,
            max: 1,
            step: 0.01
        },
        {
            type: "checkbox",
            key: "INVERT_CHROMA_THRESHOLD",
            label: "Invert Chroma Threshold",
        },
        blendControls()
    ]
}

export const effectMeta = {
    group: "Glitch",
    tags: ["noise", "color"],
    description: "Applies color-frequency-sensitive noise to the image, " +
        "changing its spatial distribution with little effect on overall channel distribution.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        chromaThreshold: {min: 0.25, max: 0.5},
        density: {min: 0.1, max: 0.85},
        mode: {weights: {[SModeEnum.PRESERVE_LUMA]: 0}}
    }
};
