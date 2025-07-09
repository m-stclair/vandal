import {resolveAnimAll} from "../utils/animutils.js";
import {loadFragInit} from "../utils/load_runner.js";
import {initGLEffect} from "../utils/gl.js";

const fragURL = new URL("../shaders/channelmixer.frag", import.meta.url);
fragURL.searchParams.set("v", Date.now());
const fragSource = loadFragInit(fragURL);



/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "RGB Channel Mixer (GL)",

    defaultConfig: {
        rMix: [1, 0, 0],
        gMix: [0, 1, 0],
        bMix: [0, 0, 1],
        offset: [0, 0, 0],
    },

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSource);
        const {config} = instance;
        const resolved = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_rMix: {type: "vec3", value: resolved.rMix},
            u_gMix: {type: "vec3", value: resolved.gMix},
            u_bMix: {type: "vec3", value: resolved.bMix},
            u_offset: {type: "vec3", value: resolved.offset},
        };
        instance.glState.renderGL(inputTex, outputFBO, uniforms);
    },

    uiLayout: [
        {
            key: "rMix",
            label: "Red Mix",
            type: "vector",
            subLabels: ["R", "G", "B"],
            min: -2,
            max: 2,
            step: 0.01,
        },
        {
            key: "gMix",
            label: "Green Mix",
            type: "vector",
            subLabels: ["R", "G", "B"],
            min: -2,
            max: 2,
            step: 0.01,
        },
        {
            key: "bMix",
            label: "Blue Mix",
            type: "vector",
            subLabels: ["R", "G", "B"],
            min: -2,
            max: 2,
            step: 0.01,
        },
        {
            key: "offset",
            label: "Offset",
            type: "vector",
            subLabels: ["R", "G", "B"],
            min: -1,
            max: 1,
            step: 0.01,
        },
    ],
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    initHook: fragSource.load,
    glState: null,
    isGPU: true
}

export const effectMeta = {
  group: "Color",
  tags: ["color", "rgb", "matrix", "webgl", "mix"],
  description: "GPU-accelerated, channel mixer using a 3×3 matrix. " +
      "Much faster than the CPU version for large images, but RGB-only",
  canAnimate: false,
  realtimeSafe: true,
};