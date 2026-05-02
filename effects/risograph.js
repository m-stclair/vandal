import {resolveAnimAll} from "../utils/animutils.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
    makeEnum,
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {noisePass} from "./layers/noise_pass.js";
import {risoPlatePass} from "./layers/riso_plate_pass.js";

const shaderPath = "risograph.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl",
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: RisographModeEnum,
    options: RisographModeOpts,
} = makeEnum([
    "RISOGRAPH_DUOTONE",
    "RISOGRAPH_TRITONE",
]);

const risoPalette = new Map([
    [
        "Sunburn",
        {
            paper: [0.985, 0.930, 0.780],
            ink1: [0.080, 0.105, 0.650],
            ink2: [1.000, 0.265, 0.055],
            ink3: [0.970, 0.035, 0.285],
        },
    ],
    [
        "Seaweed",
        {
            paper: [0.940, 0.950, 0.835],
            ink1: [0.055, 0.250, 0.170],
            ink2: [0.090, 0.625, 0.590],
            ink3: [0.700, 0.125, 0.820],
        },
    ],
    [
        "Dirty Zine",
        {
            paper: [0.930, 0.900, 0.790],
            ink1: [0.055, 0.050, 0.060],
            ink2: [0.820, 0.060, 0.155],
            ink3: [0.080, 0.250, 0.720],
        },
    ],
    [
        "Fluoro",
        {
            paper: [0.985, 0.945, 0.835],
            ink1: [0.045, 0.105, 0.790],
            ink2: [1.000, 0.055, 0.470],
            ink3: [0.990, 0.770, 0.045],
        },
    ],
]);

function rotPacked(angleRad) {
    const s = Math.sin(angleRad);
    const c = Math.cos(angleRad);
    return [c, -s, s, c];
}

function invRotPacked(angleRad) {
    const s = Math.sin(angleRad);
    const c = Math.cos(angleRad);
    return [c, s, -s, c];
}

function plateOffset(offsetPx, seed) {
    const a = seed * 2.399963;
    return [Math.cos(a) * offsetPx, Math.sin(a) * offsetPx];
}

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
    name: "Risograph",
    defaultConfig: {
        blendAmount: 1,
        COLORSPACE: ColorspaceEnum.RGB,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        RISOGRAPH_MODE: RisographModeEnum.RISOGRAPH_DUOTONE,
        palette: "Fluoro",

        cellSize: 7,
        ink1Angle: 12,
        ink2Angle: 72,
        ink3Angle: 33,
        ink1Offset: 1.5,
        ink2Offset: 4.0,
        ink3Offset: 7.0,
        plateWobble: 0.35,

        grainAmount: 0.42,
        paperAmount: 0.55,
        inkCoverage: 0.92,
        edgeBleed: 0.55,
        posterizeLevels: 5,
        noiseSeed: 0,
    },
    uiLayout: [
        {type: "select", key: "RISOGRAPH_MODE", label: "Riso Mode", options: RisographModeOpts},
        {type: "select", key: "palette", label: "Ink Set", options: ["Sunburn", "Seaweed", "Dirty Zine", "Fluoro"]},
        {type: "modSlider", key: "cellSize", label: "Dot Size", min: 3, max: 24, step: 1},
        {type: "modSlider", key: "posterizeLevels", label: "Poster Steps", min: 2, max: 9, step: 1},

        {
            type: "group",
            label: "Plate Registration",
            kind: "collapse",
            children: [
                {type: "modSlider", key: "ink1Angle", label: "Plate 1 Angle", min: 0, max: 359, step: 1},
                {type: "modSlider", key: "ink2Angle", label: "Plate 2 Angle", min: 0, max: 359, step: 1},
                {
                    type: "modSlider",
                    key: "ink3Angle",
                    label: "Plate 3 Angle",
                    min: 0,
                    max: 359,
                    step: 1,
                    showIf: {key: "RISOGRAPH_MODE", equals: RisographModeEnum.RISOGRAPH_TRITONE},
                },
                {type: "modSlider", key: "ink1Offset", label: "Plate 1 Offset", min: 0, max: 18, step: 0.25},
                {type: "modSlider", key: "ink2Offset", label: "Plate 2 Offset", min: 0, max: 18, step: 0.25},
                {
                    type: "modSlider",
                    key: "ink3Offset",
                    label: "Plate 3 Offset",
                    min: 0,
                    max: 18,
                    step: 0.25,
                    showIf: {key: "RISOGRAPH_MODE", equals: RisographModeEnum.RISOGRAPH_TRITONE},
                },
                {type: "modSlider", key: "plateWobble", label: "Plate Jitter", min: 0, max: 2, step: 0.01},
            ],
        },

        {
            type: "group",
            label: "Ink & Paper Dirt",
            kind: "collapse",
            children: [
                {type: "modSlider", key: "grainAmount", label: "Ink Grain", min: 0, max: 2, step: 0.01},
                {type: "modSlider", key: "paperAmount", label: "Paper Tooth", min: 0, max: 20, step: 0.05},
                {type: "modSlider", key: "inkCoverage", label: "Ink Coverage", min: 0, max: 1.35, step: 0.01},
                {type: "modSlider", key: "edgeBleed", label: "Edge Bleed", min: 0, max: 3, step: 0.01},
            ],
        },
        {type: "range", label: "seed", key: "noiseSeed", min: 0, max: 100, step: 1},
        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);

        const {
            cellSize,
            ink1Angle,
            ink2Angle,
            ink3Angle,
            ink1Offset,
            ink2Offset,
            ink3Offset,
            plateWobble,
            grainAmount,
            paperAmount,
            inkCoverage,
            edgeBleed,
            posterizeLevels,
            noiseSeed,
            RISOGRAPH_MODE,
            blendAmount,
            COLORSPACE,
            BLEND_CHANNEL_MODE,
            BLENDMODE,
            palette,
        } = resolveAnimAll(instance.config, t);

        const paletteElements = risoPalette.get(palette) ?? risoPalette.get("Fluoro");

        const plateDefines = {
            RISOGRAPH_MODE,
        };

        const plateFBO = instance.risoPlatePass.calculate(
            instance.risoPlatePass,
            inputTex,
            width,
            height,
            {},
            plateDefines
        );

        const noiseFBO = instance.risoNoisePass.calculate(
            instance.risoNoisePass,
            inputTex,
            width,
            height,
            {
                u_noiseSeed: {type: "float", value: noiseSeed},
            },
            {}
        );

        const a1 = ink1Angle * Math.PI / 180;
        const a2 = ink2Angle * Math.PI / 180;
        const a3 = ink3Angle * Math.PI / 180;

        const uniformSpec = {
            u_cellsize: {type: "float", value: cellSize},
            u_ink1Rot: {type: "vec4", value: rotPacked(a1)},
            u_ink1InvRot: {type: "vec4", value: invRotPacked(a1)},
            u_ink2Rot: {type: "vec4", value: rotPacked(a2)},
            u_ink2InvRot: {type: "vec4", value: invRotPacked(a2)},
            u_ink3Rot: {type: "vec4", value: rotPacked(a3)},
            u_ink3InvRot: {type: "vec4", value: invRotPacked(a3)},
            u_ink1OffsetPx: {type: "vec2", value: plateOffset(ink1Offset, 1.0)},
            u_ink2OffsetPx: {type: "vec2", value: plateOffset(ink2Offset, 2.0)},
            u_ink3OffsetPx: {type: "vec2", value: plateOffset(ink3Offset, 3.0)},
            u_grainAmount: {type: "float", value: grainAmount},
            u_paperAmount: {type: "float", value: paperAmount},
            u_inkCoverage: {type: "float", value: inkCoverage},
            u_edgeBleed: {type: "float", value: edgeBleed},
            u_plateWobble: {type: "float", value: plateWobble},
            u_posterizeLevels: {type: "float", value: posterizeLevels},
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {type: "float", value: blendAmount},
            u_ink1: {type: "vec3", value: paletteElements.ink1},
            u_ink2: {type: "vec3", value: paletteElements.ink2},
            u_ink3: {type: "vec3", value: paletteElements.ink3},
            u_paper: {type: "vec3", value: paletteElements.paper},
            u_plateMap: {type: "texture2D", value: plateFBO.texture},
            u_noise: {type: "texture2D", value: noiseFBO.texture},
        };

        const defines = {
            BLENDMODE,
            COLORSPACE,
            BLEND_CHANNEL_MODE,
            RISOGRAPH_MODE,
        };

        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },

    initHook: async (instance, renderer) => {
        instance.risoNoisePass = makePassState(noisePass);
        instance.risoPlatePass = makePassState(risoPlatePass);

        await instance.risoNoisePass.initHook(instance.risoNoisePass, renderer);
        await instance.risoPlatePass.initHook(instance.risoPlatePass, renderer);
        await fragSources.load(instance, renderer);
    },

    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
        instance.risoNoisePass?.cleanupHook(instance.risoNoisePass);
        instance.risoPlatePass?.cleanupHook(instance.risoPlatePass);
    },

    glState: null,
    isGPU: true,
};

export const effectMeta = {
    group: "Stylize",
    tags: ["print", "risograph", "riso", "zine", "poster", "grain", "analog"],
    description: (
        "Risograph-style spot-ink halftone with precomputed plate separation, shared paper tooth, misregistration, and overprint."
    ),
    canAnimate: true,
    realtimeSafe: true,
};
