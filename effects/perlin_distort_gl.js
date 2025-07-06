import {WebGLRunner} from "../utils/webgl_runner.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {makeShaderInit} from "../utils/load_runner.js";

const fragURL = [
    new URL("../shaders/perlin_distort.frag", import.meta.url),
    new URL("../shaders/noise.frag", import.meta.url),
]
fragURL[0].searchParams.set("v", Date.now());
fragURL[1].searchParams.set("v", Date.now());

const shaderStuff = makeShaderInit({
    fragURL,
    makeRunner: () => new WebGLRunner()
});


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Perlin Distort (GL)",

    defaultConfig: {
        boundMode: "fract",
        pitchX: 0,
        pitchY: 0,
        freqX: 5,
        freqY: 5,
        seed: 1,
        depth: 0.5,
        rate: 4,
        rateDrive: 0,
        fc: [6, 15, 10],
        phase: [0, 0],
        fuzz: 0
    },

    uiLayout: [
        {key: "seed", label: "Random Seed", type: "range", min: 1, max: 500, step: 1},
        {key: "depth", label: "Noise Depth", type: "modSlider", min: 0, max: 1, step: 0.01},
        {key: "pitchX", label: "Grid Shift (X)", type: "modSlider", min: -2, max: 2, step: 0.01},
        {key: "pitchY", label: "Grid Shift (Y)", type: "modSlider", min: -2, max: 2, step: 0.01},
        {key: "fuzz", label: "Grid Fuzz", type: "Range", min: 0, max: 0.1, step: 0.005},
        {key: "freqX", label: "Noise Frequency (x)", type: "modSlider", min: 0, max: 75, steps: 250, scale: "log", scaleFactor: 1.1},
        {key: "freqY", label: "Noise Frequency (y)", type: "modSlider", min: 0, max: 75, steps: 250, scale: "log", scaleFactor: 1.1},
        {key: 'boundMode', label: 'Boundary Mode', type: 'Select', options: ['fract', 'free', 'clamp']},
        {key: "rate", label: "Spatial Modulation Frequency", type: "modSlider", min: 0, max: 100, steps: 200, scale: "log"},
        {key: 'phase', label: 'Spatial Modulation Phase', type: 'vector', sublabels: () => ["X", "Y"], length: 2, min: 0, max: 1, step: 0.005},
        {key: "rateDrive", label: "Spatial Modulation Depth", type: "modSlider", min: 0, max: 1, step: 0.01},
        {
            key: "fc",
            label: "Fade Coefficients",
            type: "vector",
            subLabels: () => ["C1", "C2", "C3"],
            min: 5,
            max: 20,
            step: 0.25,
        },
    ],

    apply(instance, data, width, height, t, inputKey) {
        const {
            pitchX, pitchY, freqX, freqY, phase,
            fc, seed, depth, boundMode, rate, rateDrive, fuzz
        } = resolveAnimAll(instance.config, t);
        const boundCode = {'fract': 0, 'free': 1, 'clamp': 2}[boundMode];
        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_pitch: {value: [pitchX, pitchY], type: "vec2"},
            u_freq: {value: [freqX, freqY], type: "vec2"},
            u_seed: {value: seed, type: "float"},
            u_fc: {value: new Float32Array(fc), type: "floatArray"},
            u_depth: {value: depth, type: "float"},
            u_rate: {value: rate, type: "float"},
            u_ratedrive: {value: rateDrive, type: "float"},
            u_phase: {value: phase, type: "vec2"},
            u_fuzz: {value: fuzz, type: "float"},
            u_boundmode: {value: boundCode, type: "int"},
        };
        return shaderStuff.runner.run(
            shaderStuff.fragSource, uniformSpec, data, width, height, inputKey
        );
    },
    initHook: shaderStuff.initHook
}

export const effectMeta = {
    group: "Distortion",
    tags: ["noise", "distortion", "webgl"],
    description: "Projects the image onto a surface generated from Perlin noise. "
        + "Creates organic-but-retro warps, curves, and plastic tumbler patterns.",
    canAnimate: true,
    realtimeSafe: true,
};
