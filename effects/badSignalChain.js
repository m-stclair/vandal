import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "bad_signal_chain.frag"
const includePaths = {
    'noise.glsl': 'includes/noise.glsl',
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Bad Signal Chain",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,

        // Mechanical / transport instability.
        tearAmount: 0.2,
        jitter: 0.5,
        syncLoss: 0.25,
        chunks: 20,
        tearMode: "band",

        // RF / decoder behavior.
        noiseAmount: 0.35,
        rfNoise: 0.18,
        dropoutAmount: 0.15,
        chromaBleed: 0.45,
        ghostOffset: 0.05,
        ghostAmount: 0.22,

        // Display behavior.
        scanlineAmount: 0.35,
        phosphor: 0.25,
        flickerAmount: 0,

        // Existing modulation controls.
        t_: 0,
        bias: 0.85,
        scale: 1000,
        seed: 0,
    },
    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            label: "Signal / RF",
            children: [
                {
                    type: "range",
                    key: "noiseAmount",
                    label: "Noise Mix",
                    min: 0,
                    max: 1,
                    steps: 200
                },
                {
                    type: "range",
                    key: "rfNoise",
                    label: "RF Snow",
                    min: 0,
                    max: 1,
                    steps: 200
                },
                {
                    type: "range",
                    key: "dropoutAmount",
                    label: "Tape Dropout",
                    min: 0,
                    max: 1,
                    steps: 200
                },
                {
                    type: "range",
                    key: "chromaBleed",
                    label: "Chroma Bleed",
                    min: 0,
                    max: 1,
                    steps: 200
                },
                {
                    type: "range",
                    key: "ghostAmount",
                    label: "Reflection Ghost",
                    min: 0,
                    max: 1,
                    steps: 200
                },
                {
                    type: "range",
                    key: "ghostOffset",
                    label: "Ghost Offset",
                    min: 0,
                    max: 0.5,
                    step: 0.01
                },
            ]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Raster / CRT",
            children: [
                {
                    type: "modSlider",
                    key: "jitter",
                    label: "Line Jitter",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "modSlider",
                    key: "syncLoss",
                    label: "Sync Loss",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "range",
                    key: "scanlineAmount",
                    label: "Scanlines",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "range",
                    key: "phosphor",
                    label: "Phosphor",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "range",
                    key: "flickerAmount",
                    label: "Mains Flicker",
                    min: 0,
                    max: 1,
                    steps: 100
                },
            ]
        },
        {
            type: "group",
            label: "Tear",
            kind: "collapse",
            children: [
                {
                    type: "modSlider",
                    key: "tearAmount",
                    label: "Amount",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "range",
                    key: "chunks",
                    label: "Line Groups",
                    min: 1,
                    max: 64,
                    step: 1
                },
                {
                    type: "select",
                    key: "tearMode",
                    options: ["wave", "jump", "band", "chunk", "ghost"]
                }
            ]
        },
        {
            type: "group",
            label: "Noise Shape",
            kind: "collapse",
            children: [
                {
                    type: "modSlider",
                    key: "scale",
                    label: "Cell Scale",
                    min: 25,
                    max: 2000,
                    steps: 200,
                },
                {
                    type: "modSlider",
                    key: "bias",
                    label: "Anisotropy",
                    min: 0,
                    max: 1,
                    steps: 200
                },
            ]
        },
        {
            type: "group",
            label: "Progression",
            kind: "collapse",
            children: [
                {
                    type: "modSlider",
                    key: "t_",
                    label: "Phase",
                    min: 0,
                    max: Math.PI * 2,
                    steps: 250
                },
                {
                    type: "range",
                    key: "seed",
                    label: "Seed",
                    min: 0,
                    max: 499,
                    step: 1
                },
            ]
        },
        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            blendAmount, COLORSPACE, BLENDMODE, BLEND_CHANNEL_MODE,
            flickerAmount, tearAmount, jitter, syncLoss, t_, bias, scale, seed,
            chunks, tearMode, ghostOffset, ghostAmount, noiseAmount, rfNoise,
            dropoutAmount, chromaBleed, scanlineAmount, phosphor
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            "u_mod.seed": {type: "float", value: seed},
            "u_mod.scale": {type: "float", value: scale},
            "u_mod.t": {type: "float", value: t_},
            "u_mod.bias": {type: "float", value: bias},
            "u_mod.jitter": {type: "float", value: jitter},
            "u_mod.syncLoss": {type: "float", value: syncLoss},
            "u_mod.flickerAmount": {type: "float", value: flickerAmount},
            "u_mod.noiseAmount": {type: "float", value: noiseAmount},
            "u_mod.rfNoise": {type: "float", value: rfNoise},
            "u_mod.dropoutAmount": {type: "float", value: dropoutAmount},
            "u_mod.chromaBleed": {type: "float", value: chromaBleed},
            "u_mod.ghostAmount": {type: "float", value: ghostAmount},
            "u_mod.scanlineAmount": {type: "float", value: scanlineAmount},
            "u_mod.phosphor": {type: "float", value: phosphor},
            "u_mod.blendAmount": {type: "float", value: blendAmount},
            "u_tear.amount": {type: "float", value: tearAmount * 0.15},
            "u_tear.chunks": {type: "float", value: chunks},
            "u_tear.ghostOffset": {type: "float", value: ghostOffset},
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            TEARMODE: {'wave': 0, 'jump': 1, 'band': 2, 'chunk': 3, 'ghost': 4}[tearMode]
        }
        instance.glState.renderGL(inputTex, outputFBO, uniforms, defines);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    initHook: fragSources.load,
    glState: null,
    isGPU: true
}

export const effectMeta = {
    group: "Media",
    tags: ["tv", "retro", "vhs", "analog", "noise", "crt", "ntsc", "rf"],
    description: "Analog-ish damage built as a signal chain: horizontal sync error, chroma delay, RF snow, tape dropout, scanline/phosphor response, reflection ghosts, and decoder wobble.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true,
    parameterHints: {"t_": {"animationProb": 0.8}}
};
