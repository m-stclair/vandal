import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";

const shaderPath = "selectcolor.frag";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Selective Color",

    defaultConfig: {
        hueWidth: 0.2,
        knee: 0.05,
        hueCenter: 0,
        flip: false,
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        chromaBoost: 1,
    },
    uiLayout: [
        {type: "modSlider", key: "hueCenter", label: "Hue", min: 0, max: 1, step: 0.01},
        {type: "modSlider", key: "hueWidth", label: "Width", min: 0, max: 1, step: 0.01},
        {type: "modSlider", key: "knee", label: "Knee", min: 0, max: 1, step: 0.01},
        {type: "checkbox", key: "flip", label: "Flip"},
        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            blendAmount, COLORSPACE, BLENDMODE, BLEND_CHANNEL_MODE, chromaBoost,
            flip, hueWidth, knee, hueCenter
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_blendAmount: {type: "float", value: blendAmount},
            u_resolution: {type: "vec2", value: [width, height]},
            // shader interprets hueWidth and knee as half-intervals, hence / 2
            u_hueWidth: {type: "float", value: hueWidth / 2},
            u_knee: {type: "float", value: knee / 2},
            u_hueCenter: {type: "float", value: hueCenter},
            u_chromaBoost: {type: "float", value: chromaBoost},
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            BLENDMODE: BLENDMODE,
            FLIP: flip ? 1 : 0,
        }
        instance.glState.renderGL(inputTex, outputFBO, uniforms, defines);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    initHook: fragSources.load,
    glState: null,
    isGPU: true
}

export const effectMeta = {
    group: "Color",
    tags: ["color", "threshold", "select"],
    description: "Selectively desaturates a specific color, or all but a specific color.",
    backend: "gpu",
    canAnimate: true
    parameterHints: {width: {min: 0.25, max: 0.5}, knee: {min: 0, max: 0.2}},
    realtimeSafe: true,
}