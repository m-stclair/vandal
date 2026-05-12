import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "broken_projector.frag";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Broken Projector",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,

        gateWeave: 0.42,
        frameSlip: 0.18,
        shutterFlicker: 0.38,
        lampInstability: 0.52,

        focusBlur: 0.32,
        lensBreathing: 0.22,
        chromaticFringe: 0.28,
        keystoneWarp: 0.16,

        dustAmount: 0.36,
        scratchAmount: 0.30,
        burnAmount: 0.10,
        sprocketShadow: 0.18,

        vignette: 0.42,
        gateShadow: 0.28,
        t_: 0,
        seed: 0,
    },

    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            label: "Transport",
            children: [
                {
                    type: "modSlider",
                    key: "gateWeave",
                    label: "Gate Weave",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "frameSlip",
                    label: "Frame Slip",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "shutterFlicker",
                    label: "Shutter Flicker",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "lampInstability",
                    label: "Lamp Flutter",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
            ],
        },
        {
            type: "group",
            kind: "collapse",
            label: "Optics",
            children: [
                {
                    type: "modSlider",
                    key: "focusBlur",
                    label: "Focus Blur",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "lensBreathing",
                    label: "Lens Breathing",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "chromaticFringe",
                    label: "Chromatic Fringe",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "keystoneWarp",
                    label: "Keystone Warp",
                    min: -1,
                    max: 1,
                    steps: 200,
                },
            ],
        },
        {
            type: "group",
            kind: "collapse",
            label: "Film Damage",
            children: [
                {
                    type: "modSlider",
                    key: "dustAmount",
                    label: "Dust / Hair",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "scratchAmount",
                    label: "Scratches",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "burnAmount",
                    label: "Gate Burn",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "sprocketShadow",
                    label: "Sprocket Shadow",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
            ],
        },
        {
            type: "group",
            kind: "collapse",
            label: "Projection Surface",
            children: [
                {
                    type: "modSlider",
                    key: "vignette",
                    label: "Vignette",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "gateShadow",
                    label: "Gate Shadow",
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
            gateWeave, frameSlip, shutterFlicker, lampInstability,
            focusBlur, lensBreathing, chromaticFringe, keystoneWarp,
            dustAmount, scratchAmount, burnAmount, sprocketShadow,
            vignette, gateShadow, t_, seed,
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            "u_projector.seed": {type: "float", value: seed},
            "u_projector.t": {type: "float", value: t_},
            "u_projector.blendAmount": {type: "float", value: blendAmount},
            "u_projector.gateWeave": {type: "float", value: gateWeave},
            "u_projector.frameSlip": {type: "float", value: frameSlip},
            "u_projector.shutterFlicker": {type: "float", value: shutterFlicker},
            "u_projector.lampInstability": {type: "float", value: lampInstability},
            "u_projector.focusBlur": {type: "float", value: focusBlur},
            "u_projector.lensBreathing": {type: "float", value: lensBreathing},
            "u_projector.chromaticFringe": {type: "float", value: chromaticFringe},
            "u_projector.keystoneWarp": {type: "float", value: keystoneWarp},
            "u_projector.dustAmount": {type: "float", value: dustAmount},
            "u_projector.scratchAmount": {type: "float", value: scratchAmount},
            "u_projector.burnAmount": {type: "float", value: burnAmount},
            "u_projector.sprocketShadow": {type: "float", value: sprocketShadow},
            "u_projector.vignette": {type: "float", value: vignette},
            "u_projector.gateShadow": {type: "float", value: gateShadow},
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
    tags: ["film", "projector", "analog", "optical", "dust", "scratches", "flicker"],
    description: "Simulates a dying film projector: gate weave, frame slip, shutter/lamp flicker, soft optics, chromatic lens fringe, gate shadows, sprocket ghosts, dust, hair, scratches, and heat-burn bloom.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true,
    parameterHints: {"t_": {"animationProb": 0.8}}
};