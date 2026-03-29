import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";

const shaderPath = "solarize.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl"}
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Solarize",
    defaultConfig: {
        threshold: 0.5,
        strength: 1.0,
        softness: 0.0
    },
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {threshold, strength, softness} = resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_threshold: {value: threshold, type: "float"},
            u_strength: {value: strength, type: "float"},
            u_softness: {value: softness, type: "float"}
        };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, {});
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
    uiLayout: [
            {
                key: "threshold",
                label: "Threshold",
                type: "modSlider",
                min: 0,
                max: 1,
                step: 0.01
            },
            {
                key: "strength",
                label: "Strength",
                type: "modSlider",
                min: 0,
                max: 1,
                step: 0.01
            },
            {
                key: "softness",
                label: "Softness",
                type: "modSlider",
                min: 0,
                max: 0.5,
                step: 0.01
            }
    ]
};

export const effectMeta = {
    group: "Utility",
    tags: ["solarize", "sabattier", "invert", "color", "psychedelic", "darkroom"],
    description: "Classic solarization / Sabattier effect. Inverts tones " +
        "above a threshold, creating a partial-negative look.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        threshold: {min: 0.2, max: 0.8},
        strength: {min: 0.8, max: 1.0},
        softness: {min: 0, max: 0.1}
    }
};