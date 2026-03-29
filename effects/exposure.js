import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {group} from "../utils/ui_configs.js";
import {hsv2Rgb} from "../utils/colorutils.js";

const shaderPath = "exposure.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Exposure",
    defaultConfig: {
        exposure: 0,
    },
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            exposure,
        } = resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_exposure: {value: exposure, type: "float"},
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
                key: "exposure",
                label: "Exposure",
                type: "modSlider",
                min: -5,
                max: 5,
                step: 0.05
            }
    ]

}

export const effectMeta = {
    group: "Utility",
    tags: ["brightness", "exposure"],
    description: "Adjusts exposure.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    notInRandom: true,
};
