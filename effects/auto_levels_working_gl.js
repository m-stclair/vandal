import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";

const shaderPath = "../shaders/auto_levels.frag";
const includePaths = {};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Auto Levels",

    defaultConfig: {
        method: "percentile", // "minmax", "stddev"
        paramA: 1.0,           // For percentile: lower percentile, for stddev: sigma
        paramB: 99.0,          // For percentile: upper percentile
        channelwise: true
    },

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            method,
            paramA,
            paramB,
            channelwise
        } = resolveAnimAll(instance.config, t);


        // /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        // /** @type {UniformSpec} */
        // const uniformSpec = {
        //     u_resolution: {value: [width, height], type: "vec2"},
        //     u_brightness: {value: brightness, type: "float"},
        //     u_contrast: {value: contrast + 1, type: "float"},
        //     u_saturation: {value: saturation + 1, type: "float"},
        //     u_graypoint: {value: graypoint, type: "float"},
        // }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
    uiLayout: [
        {
            key: "brightness",
            label: "Brightness",
            type: "modSlider",
            min: -1,
            max: 1,
            step: 0.01,
        },
        {
            key: "contrast",
            label: "Contrast",
            type: "modSlider",
            min: -1,
            max: 1,
            step: 0.01,
        },
        {
            key: "saturation",
            label: "Saturation",
            type: "modSlider",
            min: -1,
            max: 1,
            step: 0.01,
        },
        {
            key: "graypoint",
            label: "Gray Point",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01,
        },
    ]
}

export const effectMeta = {
  group: "Utility",
  tags: ["color", "brightness", "contrast", "saturation"],
  description: "Adjusts brightness, contrast, and saturation.",
  backend: "gpu",
  canAnimate: true,
  realtimeSafe: true,
};
