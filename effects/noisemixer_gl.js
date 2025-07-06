import {WebGLRunner} from "../utils/webgl_runner.js";
import {makeShaderInit} from "../utils/load_runner.js";
import {resolveAnimAll} from "../utils/animutils.js";

const fragURL = [
    new URL("../shaders/noisemixer.frag", import.meta.url),
    new URL("../shaders/noise.frag", import.meta.url),
    new URL("../shaders/blend.frag", import.meta.url),
]

fragURL.forEach((u) => u.searchParams.set("v", Date.now()))

const shaderStuff = makeShaderInit({
    fragURL,
    makeRunner: () => new WebGLRunner()
});

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Noise Mixer (GL)",
    defaultConfig: {
        frequency: 200,
        freqShift: 0,
        seed: 1,
        blendMode: "normal",
        fc: [6, 15, 10],
        components: [0, 0.5, 0, 0, 0],
        blur: 0
    },
    apply(instance, data, width, height, t, inputKey) {
        const {
            seed, frequency, freqShift, components, fc,
            blendMode, blur
        } = resolveAnimAll(instance.config, t);
        const [uniform, perlin, simplex, gauss, pink] = components;
        const blendCode = {
            "linear": 0,
            "screen": 1,
            "soft light": 2,
            "hard light": 3,
            "difference": 4,
            "hue": 5
        }[blendMode];
        const uniformSpec = {
            u_freqx: {type: "float", value: frequency * (1 + freqShift)},
            u_freqy: {type: "float", value: frequency * (1 - freqShift)},
            u_seed: {type: "float", value: seed / 11.3},
            u_resolution: {type: "vec2", value: [width, height]},
            u_perlin: {type: "float", value: perlin},
            u_gauss: {type: "float", value: gauss},
            u_uniform: {type: "float", value: uniform},
            u_pink: {type: "float", value: pink},
            u_simplex: {type: "float", value: simplex},
            u_fc: {value: new Float32Array(fc), type: "floatArray"},
            u_blendmode: {value: blendCode, type: "int"},
            u_blur: {value: blur, type: "int"}
        };
        const {fragSource, runner} = shaderStuff;
        return runner.run(fragSource, uniformSpec, data, width, height, inputKey);
    },
    uiLayout: [
        {key: "seed", label: "Seed", type: "modSlider", min: 1, max: 500, step: 1},
        {
            key: "components",
            label: "Noise Components",
            type: "vector",
            subLabels: () => ["Uniform", "Perlin", "Simplex", "Gaussian", "Pink"],
            min: 0,
            max: 1,
            step: 0.01,
            length: 5
        },
        {
            key: 'blendMode',
            label: 'Blend Mode',
            type: 'Select',
            options: ['linear', 'screen', 'soft light', 'hard light', 'difference', 'burn']
        },
        {key: "frequency", label: "Frequency", type: "Range", min: 1, max: 5000, steps: 300, scale: "log"},
        {
            key: "fc",
            label: "Fade Coefficients",
            type: "vector",
            subLabels: () => ["C1", "C2", "C3"],
            min: 5,
            max: 20,
            step: 0.25,
        },
        {key: "blur", label: "Blur", type: "Range", min: 0, max: 10, step: 1},
        {key: "freqShift", label: "Frequency Shift", type: "Range", min: -0.25, max: 0.25, step: 0.02},

    ],

    initHook: shaderStuff.initHook,
};

export const effectMeta = {
    group: "Synthesis",
    tags: ["noise", "retro", "webgl", "realtime"],  // Add relevant tags
    description: "Applies highly-configurable noise to image.",
    canAnimate: true,
    realtimeSafe: true,
};
