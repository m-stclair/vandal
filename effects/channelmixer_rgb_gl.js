import {resolveAnimAll, resolveAnim} from "../utils/animutils.js";
import {WebGLRunner} from "../utils/webgl_runner.js";
import {makeShaderInit} from "../utils/load_runner.js";

const fragURL = new URL("../shaders/channelmixer.frag", import.meta.url);
fragURL.searchParams.set("v", Date.now());
const shaderStuff = makeShaderInit({
    fragURL,
    makeRunner: () => new WebGLRunner()
});


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

    apply(instance, data, width, height, t, inputKey) {
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
        const {fragSource, runner} = shaderStuff;
        return runner.run(fragSource, uniforms, data, width, height, inputKey);
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
    initHook: shaderStuff.initHook,
}

export const effectMeta = {
  group: "Color",
  tags: ["color", "rgb", "matrix", "webgl", "mix"],
  description: "GPU-accelerated, channel mixer using a 3×3 matrix. " +
      "Much faster than the CPU version for large images, but RGB-only",
  canAnimate: false,
  realtimeSafe: true,
};