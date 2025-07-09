import {loadFragInit} from "../utils/load_runner.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {cmapLuts, colormaps, LUTSIZE} from "../utils/colormaps.js";
import {initGLEffect} from "../utils/gl.js";

const fragURL = [
    new URL("../shaders/noisemixer.frag", import.meta.url),
    new URL("../shaders/noise.frag", import.meta.url),
    new URL("../shaders/blend.frag", import.meta.url),
    new URL("../shaders/psrdnoise2.glsl", import.meta.url),
]

fragURL.forEach((u) => u.searchParams.set("v", Date.now()))

const fragSource = loadFragInit(fragURL);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Noise Mixer (GL)",
    defaultConfig: {
        frequency: 50,
        freqShift: 0,
        tint: [1, 1, 1],
        seed: 1,
        blendMode: "normal",
        tintSpace: "RGB",
        fc: [6, 15, 10],
        components: [0, 0, 1, 0, 0],
        master: 1,
        colormap: "none"
    },
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSource)
        const {
            seed, frequency, freqShift, components, fc,
            blendMode, tintSpace, tint, master, colormap
        } = resolveAnimAll(instance.config, t);
        // TODO: this is wrong
        if (!components.some((c) => c)) return inputTex;
        const [uniform, perlin, simplex, gauss, pink] = components;
        const blendCode = {
            "linear": 0,
            "screen": 1,
            "soft light": 2,
            "hard light": 3,
            "difference": 4,
            "color burn": 5,
            "darken": 6,
            "lighten": 7
        }[blendMode];

        const tintSpaceN = {"RGB": 0, "HSV": 1}[tintSpace];
        const noiseMax = pink + perlin + uniform + gauss + simplex;
        const masterC = (noiseMax < 1) ? Math.min(master, noiseMax) : master;

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
            u_tint: {value: new Float32Array(tint), type: "vec3"},
            u_tintSpace: {value: tintSpaceN, type: "int"},
            u_master: {value: masterC, type: "float"},
            u_cmap_len: {value: colormap !== "none" ? LUTSIZE : 0, type: "int"}
        };
        if (colormap !== "none") {
            uniformSpec["u_cmap"] = {
                value: instance.glState.getOrCreateLUT(colormap, cmapLuts[colormap]),
                type: "texture2D",
                width: LUTSIZE,
                height: 1
            }
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec);
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
        {key: "master", label: "Master", type: "Range", min: 0, max: 1, step: 0.01},
        {
            key: 'blendMode',
            label: 'Blend Mode',
            type: 'Select',
            options: ['linear', 'screen', 'soft light', 'hard light',
                'difference', 'color burn', 'darken', 'lighten']
        },
        {
            type: "select",
            key: "colormap",
            label: "Colormap",
            options: ["none", ...Object.keys(colormaps)]
        },
        {
            key: "tint",
            label: "Tint",
            type: "vector",
            subLabels: () => ["C1", "C2", "C3"],
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: 'tintSpace',
            label: 'Tint Colorspace',
            type: 'Select',
            options: ['RGB', 'HSV']
        },
        {key: "frequency", label: "Frequency", type: "Range", min: 1, max: 5000, steps: 300, scale: "log"},
        {
            key: "fc",
            label: "Fade Coefficients (Perlin)",
            type: "vector",
            subLabels: () => ["F1", "F2", "F3"],
            min: 5,
            max: 20,
            step: 0.25,
        },
        {key: "freqShift", label: "Frequency Shift", type: "Range", min: -0.25, max: 0.25, step: 0.02},
    ],
    initHook: fragSource.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
};

export const effectMeta = {
    group: "Synthesis",
    tags: ["noise", "retro", "synth", "webgl", "realtime"],  // Add relevant tags
    description: "Generates highly-configurable noise. Offers a variety of blending " +
        "methods for application to images; also suitable as a standalone pattern " +
        "generator.",
    canAnimate: true,
    realtimeSafe: true,
};
