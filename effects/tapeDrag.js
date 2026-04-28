import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, hasChromaBoostImplementation
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "tapeDrag.frag";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Tape Drag",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        warpAmount: 0.35,
        smearAmount: 0.25,
        chromaLag: 0.35,
        dropoutAmount: 0.12,
        tracking: 0.5,
        scanlineAmount: 0.2,
        rollAmount: 0,
        headSwitch: 0.18,
        grainAmount: 0.08,
        damageMode: "drift",
        t_: 0,
        seed: 0,
        chromaBoost: 1
    },
    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            label: "Transport",
            children: [
                {
                    type: "modSlider",
                    key: "warpAmount",
                    label: "Warp",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "modSlider",
                    key: "tracking",
                    label: "Tracking",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "modSlider",
                    key: "rollAmount",
                    label: "Roll",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "select",
                    key: "damageMode",
                    options: ["drift", "dropout", "head", "weave", "melt"]
                }
            ]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Magnetic Loss",
            children: [
                {
                    type: "modSlider",
                    key: "smearAmount",
                    label: "Smear",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "modSlider",
                    key: "chromaLag",
                    label: "Chroma Lag",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "modSlider",
                    key: "dropoutAmount",
                    label: "Dropout",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "modSlider",
                    key: "headSwitch",
                    label: "Head Switch",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "range",
                    key: "grainAmount",
                    label: "Grain",
                    min: 0,
                    max: 0.5,
                    steps: 100
                },
                {
                    type: "range",
                    key: "scanlineAmount",
                    label: "Scanlines",
                    min: 0,
                    max: 1,
                    steps: 100
                }
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
            warpAmount, smearAmount, chromaLag, dropoutAmount, tracking,
            scanlineAmount, rollAmount, headSwitch, grainAmount, damageMode,
            t_, seed, chromaBoost
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            "u_tape.warpAmount": {type: "float", value: warpAmount},
            "u_tape.smearAmount": {type: "float", value: smearAmount},
            "u_tape.chromaLag": {type: "float", value: chromaLag},
            "u_tape.dropoutAmount": {type: "float", value: dropoutAmount},
            "u_tape.tracking": {type: "float", value: tracking},
            "u_tape.scanlineAmount": {type: "float", value: scanlineAmount},
            "u_tape.rollAmount": {type: "float", value: rollAmount},
            "u_tape.headSwitch": {type: "float", value: headSwitch},
            "u_tape.grainAmount": {type: "float", value: grainAmount},
            "u_tape.blendAmount": {type: "float", value: blendAmount},
            "u_tape.seed": {type: "float", value: seed},
            "u_tape.t": {type: "float", value: t_},
            u_chromaBoost: {type: "float", value: chromaBoost}
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            DAMAGE_MODE: {'drift': 0, 'dropout': 1, 'head': 2, 'weave': 3, 'melt': 4}[damageMode]
        };
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
    group: "Stylize",
    tags: ["tape", "vhs", "tracking", "magnetic", "analog"],
    description: "Simulates tape transport failure: capstan wobble, chroma lag, " +
        "horizontal magnetic smear, oxide dropout, scanline gating, and head-switch chatter.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true
};
