import {resolveAnimAll} from "../utils/animutils.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
    makeEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";

const shaderPath = "risograph.frag";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: RisographModeEnum,
    options: RisographModeOpts
} = makeEnum([
    'RISOGRAPH_DUOTONE',
    'RISOGRAPH_TRITONE'
]);

const {
    enum: RisographPaletteEnum,
    options: RisographPaletteOpts
} = makeEnum([
    'RISO_FLUORO',
    'RISO_SUNBURN',
    'RISO_SEAWEED',
    'RISO_DIRTY_ZINE'
]);

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
        RISO_PALETTE: RisographPaletteEnum.RISO_FLUORO,

        cellSize: 7,
        ink1Angle: 12,
        ink2Angle: 72,
        ink3Angle: 33,
        ink1Offset: 1.5,
        ink2Offset: 4.0,
        ink3Offset: 7.0,

        grainAmount: 0.42,
        paperAmount: 0.55,
        inkCoverage: 0.92,
        edgeBleed: 0.55,
        plateWobble: 0.34,
        posterizeLevels: 5,
    },
    uiLayout: [
        {type: 'select', key: 'RISOGRAPH_MODE', label: 'Riso Mode', options: RisographModeOpts},
        {type: 'select', key: 'RISO_PALETTE', label: 'Ink Set', options: RisographPaletteOpts},
        {'type': 'modSlider', 'key': 'cellSize', 'label': 'Dot Size', 'min': 3, 'max': 24, 'step': 1},
        {'type': 'modSlider', 'key': 'posterizeLevels', 'label': 'Poster Steps', 'min': 2, 'max': 9, 'step': 1},

        {
            type: 'group',
            label: 'Plate Registration',
            kind: 'collapse',
            children: [
                {'type': 'modSlider', 'key': 'ink1Angle', 'label': 'Plate 1 Angle', 'min': 0, 'max': 359, 'step': 1},
                {'type': 'modSlider', 'key': 'ink2Angle', 'label': 'Plate 2 Angle', 'min': 0, 'max': 359, 'step': 1},
                {
                    'type': 'modSlider', 'key': 'ink3Angle', 'label': 'Plate 3 Angle', 'min': 0, 'max': 359, 'step': 1,
                    showIf: {key: 'RISOGRAPH_MODE', equals: RisographModeEnum.RISOGRAPH_TRITONE}
                },
                {'type': 'modSlider', 'key': 'ink1Offset', 'label': 'Plate 1 Offset', 'min': 0, 'max': 18, 'step': 0.25},
                {'type': 'modSlider', 'key': 'ink2Offset', 'label': 'Plate 2 Offset', 'min': 0, 'max': 18, 'step': 0.25},
                {
                    'type': 'modSlider', 'key': 'ink3Offset', 'label': 'Plate 3 Offset', 'min': 0, 'max': 18, 'step': 0.25,
                    showIf: {key: 'RISOGRAPH_MODE', equals: RisographModeEnum.RISOGRAPH_TRITONE}
                },
                {'type': 'modSlider', 'key': 'plateWobble', 'label': 'Plate Wobble', 'min': 0, 'max': 1.5, 'step': 0.01},
            ]
        },

        {
            type: 'group',
            label: 'Ink & Paper Dirt',
            kind: 'collapse',
            children: [
                {'type': 'modSlider', 'key': 'grainAmount', 'label': 'Ink Grain', 'min': 0, 'max': 2, 'step': 0.01},
                {'type': 'modSlider', 'key': 'paperAmount', 'label': 'Paper Tooth', 'min': 0, 'max': 20, 'step': 0.05},
                {'type': 'modSlider', 'key': 'inkCoverage', 'label': 'Ink Coverage', 'min': 0, 'max': 1.35, 'step': 0.01},
                {'type': 'modSlider', 'key': 'edgeBleed', 'label': 'Edge Bleed', 'min': 0, 'max': 3, 'step': 0.01},
            ]
        },

        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            cellSize,
            ink1Angle, ink2Angle, ink3Angle,
            ink1Offset, ink2Offset, ink3Offset,
            grainAmount, paperAmount, inkCoverage, edgeBleed, plateWobble, posterizeLevels,
            RISOGRAPH_MODE, RISO_PALETTE,
            blendAmount, COLORSPACE, BLEND_CHANNEL_MODE, BLENDMODE,
        } = resolveAnimAll(instance.config, t);

        const uniformSpec = {
            u_cellsize: {type: "float", value: cellSize},
            u_ink1Angle: {type: "float", value: ink1Angle * Math.PI / 180},
            u_ink2Angle: {type: "float", value: ink2Angle * Math.PI / 180},
            u_ink3Angle: {type: "float", value: ink3Angle * Math.PI / 180},
            u_ink1Offset: {type: "float", value: ink1Offset},
            u_ink2Offset: {type: "float", value: ink2Offset},
            u_ink3Offset: {type: "float", value: ink3Offset},
            u_grainAmount: {type: "float", value: grainAmount},
            u_paperAmount: {type: "float", value: paperAmount},
            u_inkCoverage: {type: "float", value: inkCoverage},
            u_edgeBleed: {type: "float", value: edgeBleed},
            u_plateWobble: {type: "float", value: plateWobble},
            u_posterizeLevels: {type: "float", value: posterizeLevels},
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {type: "float", value: blendAmount},
        };

        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            RISOGRAPH_MODE: RISOGRAPH_MODE,
            RISO_PALETTE: RISO_PALETTE,
        };

        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
};

export const effectMeta = {
    group: "Stylize",
    tags: ["print", "risograph", "riso", "zine", "poster", "grain", "analog"],
    description: (
        "Risograph-style spot-ink halftone with paper tooth, misregistration, wobble, and rough ink coverage."
    ),
    canAnimate: true,
    realtimeSafe: true,
};