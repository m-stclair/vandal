import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";

const shaderPath = "huerotate.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Hue Rotation",
    defaultConfig: {
        rotation: 0,
    },
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            rotation,
        } = resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_rotation: {value: rotation, type: "float"},
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
            key: "rotation",
            label: "Rotation",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01
        }
    ]

}

export const effectMeta = {
    group: "Color",
    tags: ["hue", "color", "shift"],
    description: "Simple hue rotation.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    notInRandom: true,
};
