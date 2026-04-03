import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";

const shaderPath = "gamma.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Gamma",
    defaultConfig: {
        gamma: 1.0,
    },
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            gamma,
        } = resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_gamma: {value: gamma, type: "float"},
        }
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
            key: "gamma",
            label: "Gamma",
            type: "modSlider",
            min: 0.1,
            max: 9.99,
            steps: 200,
            scale: "log"
        }
    ]

}

export const effectMeta = {
    group: "Utility",
    tags: ["brightness", "gamma"],
    description: "Simple single-parameter gamma adjustment.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    notInRandom: true,
};
