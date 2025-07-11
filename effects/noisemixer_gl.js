import {resolveAnimAll} from "../utils/animutils.js";
import {cmapLuts, colormaps, LUTSIZE} from "../utils/colormaps.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendOpts, ColorspaceOpts} from "../utils/glsl_enums.js";

const shaderPath = "../shaders/noisemixer.frag"
const includePaths = {
    'colorconvert.glsl': '../shaders/includes/colorconvert.glsl',
    'blend.glsl': '../shaders/includes/blend.glsl',
    'noise.glsl': '../shaders/includes/noise.glsl',
    'psrdnoise2.glsl': '../shaders/includes/psrdnoise2.glsl'
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Noise Mixer (GL)",
    defaultConfig: {
        frequency: 50,
        freqShift: 0,
        tint: [1, 1, 1],
        seed: 1,
        blendMode: '1',
        colorSpace: '0',
        fc: [6, 15, 10],
        components: [0, 0, 1, 0, 0],
        blendAmount: 0.5,
        colormap: "none"
    },
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources)
        const {
            seed, frequency, freqShift, components, fc,
            blendMode, colorSpace, tint, blendAmount, colormap
        } = resolveAnimAll(instance.config, t);
        // TODO: this is wrong
        if (!components.some((c) => c)) return inputTex;
        const [uniform, perlin, simplex, gauss, pink] = components;
        const noiseMax = pink + perlin + uniform + gauss + simplex;
        const blendAmountC = (noiseMax < 1) ? Math.min(blendAmount, noiseMax) : blendAmount;

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
            u_tint: {value: new Float32Array(tint), type: "vec3"},
            u_blendamount: {value: blendAmountC, type: "float"},
            u_cmap_len: {value: colormap !== "none" ? LUTSIZE : 0, type: "int"}
        };
        const defines = {
            BLENDMODE: Number.parseInt(blendMode),
            USE_CMAP: colormap === "none" ? 0 : 1,
            COLORSPACE: Number.parseInt(colorSpace)
        }
        if (colormap !== "none") {
            uniformSpec["u_cmap"] = {
                value: instance.glState.getOrCreateLUT(colormap, cmapLuts[colormap]),
                type: "texture2D",
                width: LUTSIZE,
                height: 1
            }
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
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
        {key: "blendAmount", label: "Blend", type: "Range", min: 0, max: 1, step: 0.01},
        {
            key: 'blendMode',
            label: 'Blend Mode',
            type: 'Select',
            options: BlendOpts
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
            key: 'colorSpace',
            label: 'Blend Colorspace',
            type: 'Select',
            options: ColorspaceOpts
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
    initHook: fragSources.load,
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
