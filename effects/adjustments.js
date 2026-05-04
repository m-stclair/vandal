import {deg2rad, rotationMatrix2D, shearMatrix2D, scaleMatrix2D, multiplyMat2} from "../utils/mathutils.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "adjustments.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Adjustments",

    defaultConfig: {
        COLORSPACE: ColorspaceEnum.JCHz,
        exposure: 0,
        gamma: 1,
        brightness: 0,
        chromaExposure: 0,
        chromaGamma: 1,
        saturation: 0,
        hueExposure: 0,
        hueGamma: 1,
        hueShift: 0,
        hueCenter: 0
    },

    uiLayout: [
        {key: "exposure", label: "Exposure", type: "range", min: -5, max: 5, steps: 200},
        {key: "gamma", label: "Gamma", type: "range", min: 0.1, max: 9.99, steps: 200, scale: "log"},
        {key: "brightness", label: "Brightness", type: "range", min: -1, max: 1, steps: 200},
        {key: "chromaExposure", label: "Chroma Exposure", type: "range", min: -5, max: 5, steps: 200},
        {key: "chromaGamma", label: "Chroma Gamma", type: "range", min: 0.1, max: 9.99, steps: 200, scale: "log"},
        {key: "saturation", label: "Saturation", type: "range", min: -1, max: 1, steps: 200},
        {key: "hueExposure", label: "Hue Exposure", type: "range", min: -5, max: 5, steps: 200},
        {key: "hueGamma", label: "Hue Gamma", type: "range", min: 0.1, max: 9.99, steps: 200, scale: "log"},
        {key: "hueShift", label: "Hue Shift", type: "range", min: -1, max: 1, steps: 200},
        {key: "hueCenter", label: "Hue Center", type: "range", min: 0, max: 1, steps: 200},
        {
            key: "COLORSPACE",
            label: "Colorspace",
            type: "select",
            options: [{"label": "JCHz", value: ColorspaceEnum.JCHz}, {"label": "LCH", "value": ColorspaceEnum.LCH}]
        }
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            brightness,
            gamma,
            exposure,
            saturation,
            chromaExposure,
            chromaGamma,
            hueShift,
            hueGamma,
            hueExposure,
            hueCenter,
            COLORSPACE,
        } = resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_brightness: {value: brightness, type: "float"},
            u_exposure: {value: exposure, type: "float"},
            u_gamma: {value: gamma, type: "float"},
            u_saturation: {value: saturation, type: "float"},
            u_chromaExposure: {value: chromaExposure, type: "float"},
            u_chromaGamma: {value: chromaGamma, type: "float"},
            u_hueShift: {value: hueShift, type: "float"},
            u_hueExposure: {value: hueExposure, type: "float"},
            u_hueGamma: {value: hueGamma, type: "float"},
            u_hueCenter: {value: hueCenter, type: "float"},

        }
        const defines = {
            COLORSPACE: COLORSPACE,
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
}

export const effectMeta = {
    group: "Utility",
    tags: ["brightness", "chroma", "lightness", "gamma", "exposure", "saturation", "hue"],
    description: "Extended utility palette of gamma/exposure/chroma/etc. controls.",
    canAnimate: false,
    realtimeSafe: true,
    notInRandom: true
}
