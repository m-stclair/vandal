import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";
import {noisePass} from "./layers/noise_pass.js";

const shaderPath = "busted_dvd.frag";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

function makePassState(passImpl) {
    return {
        initHook: passImpl.initHook,
        cleanupHook: passImpl.cleanupHook,
        setupFBO: passImpl.setupFBO,
        calculate: passImpl.calculate,
        outputFBO: null,
        width: null,
        height: null,
        glState: null,
    };
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Busted DVD",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,

        macroblockAmount: 0.5,
        blockSize: 0.5,
        packetLoss: 0.5,
        errorConceal: 0.50,

        motionVectorGlitch: 0,
        gopStutter: 0,
        sliceTear: 0,

        quantization: 0,
        dctRinging: 0,
        banding: 0,

        chromaSubsample: 0.5,
        chromaMisalign: 0.3,
        colorTableSlip: 0.2,

        bitRot: 0.3,
        blockSparkle: 0,
        deinterlaceComb: 0,

        t_: 0,
        seed: 0,
    },

    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            label: "Codec Blocks",
            children: [
                {
                    type: "modSlider",
                    key: "macroblockAmount",
                    label: "Macroblocks",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "blockSize",
                    label: "Block Size",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "packetLoss",
                    label: "Packet Loss",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "errorConceal",
                    label: "Error Conceal",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
            ],
        },
        {
            type: "group",
            kind: "collapse",
            label: "GOP / Prediction",
            children: [
                {
                    type: "modSlider",
                    key: "motionVectorGlitch",
                    label: "Motion Vector Tear",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "gopStutter",
                    label: "GOP Stutter",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "sliceTear",
                    label: "Slice Tear",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
            ],
        },
        {
            type: "group",
            kind: "collapse",
            label: "Compression Texture",
            children: [
                {
                    type: "modSlider",
                    key: "quantization",
                    label: "Quantization",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "dctRinging",
                    label: "DCT Ringing",
                    min: 0,
                    max: 10,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "banding",
                    label: "Banding",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
            ],
        },
        {
            type: "group",
            kind: "collapse",
            label: "Digital Color",
            children: [
                {
                    type: "modSlider",
                    key: "chromaSubsample",
                    label: "4:2:0 Chroma",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "chromaMisalign",
                    label: "Chroma Misalign",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "colorTableSlip",
                    label: "Color Table Slip",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
            ],
        },
        {
            type: "group",
            kind: "collapse",
            label: "Playback Failure",
            children: [
                {
                    type: "modSlider",
                    key: "bitRot",
                    label: "Bit Rot",
                    min: 0,
                    max: 10,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "blockSparkle",
                    label: "Block Sparkle",
                    min: 0,
                    max: 1,
                    steps: 100,
                },
                {
                    type: "modSlider",
                    key: "deinterlaceComb",
                    label: "Deinterlace Comb",
                    min: 0,
                    max: 10,
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
            macroblockAmount, blockSize, packetLoss, errorConceal,
            motionVectorGlitch, gopStutter, sliceTear,
            quantization, dctRinging, banding,
            chromaSubsample, chromaMisalign, colorTableSlip,
            bitRot, blockSparkle, deinterlaceComb,
            t_, seed,
        } = resolveAnimAll(config, t);

        const noiseFBO = instance.dvdNoisePass.calculate(
            instance.dvdNoisePass,
            inputTex,
            width,
            height,
            {
                u_noiseSeed: {type: "float", value: seed},
            },
            {}
        );

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            "u_dvd.seed": {type: "float", value: seed},
            "u_dvd.t": {type: "float", value: t_},
            "u_dvd.blendAmount": {type: "float", value: blendAmount},
            "u_dvd.macroblockAmount": {type: "float", value: macroblockAmount},
            "u_dvd.blockSize": {type: "float", value: blockSize},
            "u_dvd.packetLoss": {type: "float", value: packetLoss},
            "u_dvd.errorConceal": {type: "float", value: errorConceal},
            "u_dvd.motionVectorGlitch": {type: "float", value: motionVectorGlitch},
            "u_dvd.gopStutter": {type: "float", value: gopStutter},
            "u_dvd.sliceTear": {type: "float", value: sliceTear},
            "u_dvd.quantization": {type: "float", value: quantization},
            "u_dvd.dctRinging": {type: "float", value: dctRinging},
            "u_dvd.banding": {type: "float", value: banding},
            "u_dvd.chromaSubsample": {type: "float", value: chromaSubsample},
            "u_dvd.chromaMisalign": {type: "float", value: chromaMisalign},
            "u_dvd.colorTableSlip": {type: "float", value: colorTableSlip},
            "u_dvd.bitRot": {type: "float", value: bitRot},
            "u_dvd.blockSparkle": {type: "float", value: blockSparkle},
            "u_dvd.deinterlaceComb": {type: "float", value: deinterlaceComb},
            u_noise: {type: "texture2D", value: noiseFBO.texture},
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
        instance.dvdNoisePass?.cleanupHook(instance.dvdNoisePass);
    },

    initHook: async (instance, renderer) => {
        instance.dvdNoisePass = makePassState(noisePass);
        await instance.dvdNoisePass.initHook(instance.dvdNoisePass, renderer);
        await fragSources.load(instance, renderer);
    },
    glState: null,
    isGPU: true,
};

export const effectMeta = {
    group: "Media",
    tags: ["dvd", "mpeg", "digital", "macroblock", "compression", "codec", "glitch"],
    description: " macroblock corruption, MPEG prediction failure, packet loss, " +
        "DCT ringing, 4:2:0 chroma damage, bit rot, and deinterlace combing.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true,
    parameterHints: {bitRot: {min: 0, max: 3}}
};