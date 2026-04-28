import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "busted_vhs.frag";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Busted VHS",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,

        trackingAmount: 0.78,
        tapeWarp: 0.62,
        headSwitch: 0.58,
        verticalRoll: 0,

        syncLoss: 0.42,
        signalBandwidth: 0.62,
        rfNoise: 0.46,
        interlaceJitter: 0.28,

        chromaBleed: 0.7,
        ghostAmount: 0.38,
        colorRot: 0.22,

        snowAmount: 0.48,
        dropoutAmount: 0.42,
        scanlineAmount: 0.52,
        crushedLuma: 0.28,

        t_: 0,
        seed: 0,
    },

    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            label: "Tape Damage",
            children: [
                {
                    type: "modSlider",
                    key: "trackingAmount",
                    label: "Tracking Tear",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "tapeWarp",
                    label: "Tape Warp",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "headSwitch",
                    label: "Head Switch",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "verticalRoll",
                    label: "Vertical Roll",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
            ],
        },
        {
            type: "group",
            kind: "collapse",
            label: "Signal Physics",
            children: [
                {
                    type: "modSlider",
                    key: "syncLoss",
                    label: "Sync Loss",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "signalBandwidth",
                    label: "Bandwidth Loss",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "rfNoise",
                    label: "RF Hash",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "interlaceJitter",
                    label: "Field Weave",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
            ],
        },
        {
            type: "group",
            kind: "collapse",
            label: "Color Smear",
            children: [
                {
                    type: "modSlider",
                    key: "chromaBleed",
                    label: "Chroma Bleed",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "ghostAmount",
                    label: "Ghost Echo",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "colorRot",
                    label: "Color Drift",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
            ],
        },
        {
            type: "group",
            kind: "collapse",
            label: "Noise / Luma",
            children: [
                {
                    type: "modSlider",
                    key: "snowAmount",
                    label: "Snow",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "dropoutAmount",
                    label: "Dropout",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "scanlineAmount",
                    label: "Scanline Dirt",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "crushedLuma",
                    label: "Crushed Luma",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
            ],
        },
        {
            type: "group",
            kind: "collapse",
            label: "Progression",
            children: [
                {
                    type: "modSlider",
                    key: "t_",
                    label: "Phase",
                    min: 0,
                    max: Math.PI * 2,
                    steps: 250,
                },
                {
                    type: "range",
                    key: "seed",
                    label: "Seed",
                    min: 0,
                    max: 499,
                    step: 1,
                },
            ],
        },
        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            blendAmount, COLORSPACE, BLENDMODE, BLEND_CHANNEL_MODE,
            trackingAmount, tapeWarp, headSwitch, verticalRoll,
            syncLoss, signalBandwidth, rfNoise, interlaceJitter,
            chromaBleed, ghostAmount, colorRot,
            snowAmount, dropoutAmount, scanlineAmount, crushedLuma,
            t_, seed,
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            "u_vhs.seed": {type: "float", value: seed},
            "u_vhs.t": {type: "float", value: t_},
            "u_vhs.blendAmount": {type: "float", value: blendAmount},
            "u_vhs.trackingAmount": {type: "float", value: trackingAmount},
            "u_vhs.tapeWarp": {type: "float", value: tapeWarp},
            "u_vhs.headSwitch": {type: "float", value: headSwitch},
            "u_vhs.verticalRoll": {type: "float", value: verticalRoll},
            "u_vhs.syncLoss": {type: "float", value: syncLoss},
            "u_vhs.signalBandwidth": {type: "float", value: signalBandwidth},
            "u_vhs.rfNoise": {type: "float", value: rfNoise},
            "u_vhs.interlaceJitter": {type: "float", value: interlaceJitter},
            "u_vhs.chromaBleed": {type: "float", value: chromaBleed},
            "u_vhs.ghostAmount": {type: "float", value: ghostAmount},
            "u_vhs.colorRot": {type: "float", value: colorRot},
            "u_vhs.snowAmount": {type: "float", value: snowAmount},
            "u_vhs.dropoutAmount": {type: "float", value: dropoutAmount},
            "u_vhs.scanlineAmount": {type: "float", value: scanlineAmount},
            "u_vhs.crushedLuma": {type: "float", value: crushedLuma},
        };

        const defines = {
            COLORSPACE: COLORSPACE,
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
        };

        instance.glState.renderGL(inputTex, outputFBO, uniforms, defines);
    },

    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },

    initHook: fragSources.load,
    glState: null,
    isGPU: true,
};

export const effectMeta = {
    group: "Media",
    tags: ["vhs", "tape", "analog", "tracking", "dropout", "crt", "glitch"],
    description: " timebase error, sync loss, YIQ chroma bandwidth, " +
        "RF hash, oxide dropout, head-switch wobble, field weave, and crushed luma.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true,
};
