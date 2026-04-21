import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {makeEnum} from "../utils/glsl_enums.js";

const shaderPath = "colorblobs.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "noisenums.glsl": "includes/noises/noisenums.glsl",
    "noise.glsl": "includes/noise.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Colorblobs",
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            count, jitter, size, borderWidth, softness, seed
        } = resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_width: {value: borderWidth, type: "float"},
            u_softness: {value: softness, type: "float"},
            u_jitter: {value: jitter, type: "float"},
            u_count: {value: count, type: "int"},
            u_size: {value: size, type: "float"},
            u_seed: {value: seed, type: "float"},
        };
        const defines = {
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
    defaultConfig: {
        jitter: 0,
        count: 32,
        size: 0.9,
        borderWidth: 0.1,
        softness: 0.1,
        seed: 0,
    },
    uiLayout: [
        {
            type: "modSlider",
            key: "count",
            label: "Count",
            min: 1,
            max: 256,
            step: 1,
        },
        {
            type: "modSlider",
            key: "size",
            label: "Size",
            min: 0.1,
            max: 5,
            step: 0.05,
        },
        {
            type: "modSlider",
            key: "borderWidth",
            label: "Width",
            min: 0.01,
            max: 1,
            step: 0.01,
        },
        {
            type: "modSlider",
            key: "softness",
            label: "Softness",
            min: 0.01,
            max: 1,
            step: 0.01,
        },
        {
            type: "modSlider",
            key: "jitter",
            label: "Jitter",
            min: 0.01,
            max: 1,
            step: 0.01,
        },
        {
            type: "modSlider",
            key: "seed",
            label: "Seed",
            min:  0,
            max:  300,
            step: 1
        },
    ]
}

export const effectMeta = {
    group: "Synthesis",
    tags: ["noise", "color"],
    description: "Noise color stuff",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        }
};
