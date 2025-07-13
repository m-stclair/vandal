import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendModeOpts, ColorspaceOpts} from "../utils/glsl_enums.js";

const shaderPath = "../shaders/edgetrace.frag"
const includePaths = {
    'colorconvert.glsl': '../shaders/includes/colorconvert.glsl',
    'blend.glsl': '../shaders/includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Edge Trace",

    defaultConfig: {
        BLENDMODE: 1,
        COLORSPACE: 0,
        blendAmount: 1,
        threshold: 0.35,
        tint: [1, 1, 1]
    },
    uiLayout: [
        {type: "modSlider", key: "threshold", label: "Threshold", min: 0, max: 1, step: 0.01},
        {
            key: 'colorSpace',
            label: 'Colorspace',
            type: 'Select',
            options: ColorspaceOpts
        },
        {
            key: 'blendMode',
            label: 'Blend Mode',
            type: 'Select',
            options: BlendModeOpts
        },
        {key: 'blendAmount', label: 'Blend Amount', type: 'modSlider', min: 0, max: 1, step: 0.01},
        {
            key: "tint",
            label: "Tint",
            type: "vector",
            subLabels: ["R", "G", "B"],
            min: 0,
            max: 1,
            step: 0.01,
        },
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            blendAmount, colorSpace, blendMode, threshold, tint
        }= resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_blendamount: {type: "float", value: blendAmount},
            u_resolution: {type: "vec2", value: [width, height]},
            u_threshold: {type: "float", value: threshold},
            u_tint: {type: "vec3", value: tint},

        };
        const defines = {
            COLORSPACE: Number.parseInt(colorSpace),
            BLENDMODE: Number.parseInt(blendMode),
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
  group: "Edge",
  tags: ["edges", "masking", "outline", "threshold"],
  description: "Simple edge tracing via Sobel operator. Offers blend and " +
      + "threshold control.",
  backend: "gpu",
  animated: true,
  realtimeSafe: true,
}