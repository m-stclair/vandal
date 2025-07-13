import {resolveAnimAll} from "../utils/animutils.js";
import {cmapLuts, colormaps, LUTSIZE} from "../utils/colormaps.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendModeOpts, BlendTargetEnum, BlendTargetOpts,
    ColorspaceOpts,
    GateModeOpts,
    ZoneShapeEnum,
    ZoneShapeOpts
} from "../utils/glsl_enums.js";

const shaderPath = "../shaders/noisemixer.frag"
const includePaths = {
    'zones.glsl': '../shaders/includes/zones.glsl',
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
        BLENDMODE: BlendModeEnum.MIX,
        BLENDTARGET: BlendTargetEnum.ALL,
        COLORSPACE: 0,
        fc: [6, 15, 10],
        components: [0, 0, 1, 0, 0],
        blendAmount: 0.5,
        colormap: "none",
        threshold: 0,
        cutoff: 1,
        gate: "none",
        burstThreshold: 0.1,
        burstFreq: 50,
        ZONESHAPE: ZoneShapeEnum.SUPERELLIPSE,
        zoneCX: 0.5,
        zoneSX: 0.6,
        zoneCY: 0.5,
        zoneSY: 0.6,
        zoneEllipseN: 2,
        zoneSoftness: 0.1,
        zoneAngle: 0,
        APPLY_MASK: false
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
        {key: "gate", label: "Use Gate", type: "Select", options: GateModeOpts},
        {key: "threshold", label: "Gate Low", type: "modSlider", min: 0, max: 1, steps: 200},
        {key: "cutoff", label: "Gate High", type: "modSlider", min: 0, max: 1, steps: 200},
        {key: "burstThreshold", label: "Burst Threshold", type: "modSlider", min: 0, max: 1, steps: 200},
        {key: "burstFreq", label: "Burst Frequency", type: "modSlider", min: 1, max: 5000, steps: 300, scale: "log"},
        {key: "blendAmount", label: "Blend Amount", type: "Range", min: 0, max: 1, step: 0.01},
        {
            key: 'BLENDMODE',
            label: 'Blend Mode',
            type: 'Select',
            options: BlendModeOpts
        },
       {
            key: 'BLENDTARGET',
            label: 'Blend Target',
            type: 'Select',
            options: BlendTargetOpts
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
            key: 'COLORSPACE',
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
        {key: "freqShift", label: "Frequency Shift", type: "Range", min: -3.14, max: 3.14, steps: 200},
        {key: "APPLY_MASK", label: "Apply Mask", type: "checkbox"},
        {
            type: "select",
            key: "ZONESHAPE",
            label: "Zone Shape",
            options: ZoneShapeOpts
        },
        {type: "modSlider", key: "zoneCX", label: "Zone Center X", min: 0, max: 1, steps: 200},
        {type: "modSlider", key: "zoneSX", label: "Zone Scale X", min: 0, max: 1, steps: 200},
        {type: "modSlider", key: "zoneCY", label: "Zone Center Y", min: 0, max: 1, steps: 200},
        {type: "modSlider", key: "zoneSY", label: "Zone Scale Y", min: 0, max: 1, steps: 200},
        {type: "modSlider", key: "zoneSoftness", label: "Zone Softness", min: 0, max: 1, steps: 200},
        {type: "modSlider", key: "zoneAngle", label: "Zone Angle", min: 0, max: Math.PI * 2, steps: 200},
        {type: "modSlider", key: "zoneEllipseN", label: "Superellipse Shape Parameter", min: 0.9, max: 10, steps: 200},
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources)
        const {
            seed, frequency, freqShift, components, fc,
            BLENDMODE, COLORSPACE, tint, blendAmount, colormap,
            threshold, cutoff, gate, burstThreshold, burstFreq,
            ZONESHAPE, zoneCX, zoneSX, zoneCY, zoneSY,
            zoneSoftness, zoneEllipseN, zoneAngle, APPLY_MASK,
            BLENDTARGET,
        } = resolveAnimAll(instance.config, t);
        // TODO: this is wrong
        if (!components.some((c) => c)) return inputTex;
        const [uniform, perlin, simplex, gauss, pink] = components;
        const noiseMax = pink + perlin + uniform + gauss + simplex;
        const blendAmountC = (noiseMax < 1) ? Math.min(blendAmount, noiseMax) : blendAmount;
        let xMax = zoneCX + zoneSX / 2;
        let yMax = zoneCY + zoneSY / 2;
        let xMin = zoneCX - zoneSX / 2;
        let yMin = zoneCY - zoneSY / 2;
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
            u_threshold: {type: "float", value: threshold},
            u_cutoffHigh: {type: "float", value: cutoff},
            u_burstFreq: {type: "float", value: burstFreq},
            u_burstThreshold: {type: "float", value: burstThreshold},
            u_fc: {value: new Float32Array(fc), type: "floatArray"},
            u_tint: {value: new Float32Array(tint), type: "vec3"},
            u_blendamount: {value: blendAmountC, type: "float"},
            u_zoneSoftness: {value: zoneSoftness, type: "float"},
            u_zoneEllipseN: {value: zoneEllipseN, type: "float"},
            u_zoneMin: {value: [xMin, yMin], type: "vec2"},
            u_zoneMax: {value: [xMax, yMax], type: "vec2"},
            u_zoneAngle: {value: zoneAngle, type: "float"},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            USE_CMAP: colormap === "none" ? 0 : 1,
            COLORSPACE: COLORSPACE,
            GATE_MODE: gate,
            USE_WINDOW: Number(cutoff < 1),
            ZONESHAPE: ZONESHAPE,
            APPLY_MASK: Number(APPLY_MASK),
            BLEND_CHANNEL_MODE: BLENDTARGET,
        }
        if (colormap !== "none") {
            uniformSpec["u_cmap"] = {
                value: instance.glState.getOrCreateLUT(colormap, cmapLuts[colormap]),
                type: "texture2D",
                width: LUTSIZE,
                height: 1
            };
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
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
