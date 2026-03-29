import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {blendControls} from "../utils/ui_configs.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
    hasChromaBoostImplementation
} from "../utils/glsl_enums.js";

const shaderPath   = "voronoi.frag";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @type {EffectModule} */
export default {
    name: "Voronoi",
    defaultConfig: {
        cellCount: 32,
        jitter: 0.85,
        edgeWidth: 0.45,
        edgeOpacity: 0.85,
        edgeColor: [0, 0, 0],
        seed: 0,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        blendAmount: 1,
        chromaBoost: 1,
    },
    uiLayout: [
        {type: 'modSlider', key: "cellCount", label: "Cell Count", min: 4, max: 120, step: 1},
        {type: 'modSlider', key: "jitter", label: "Jitter", min: 0, max: 1, step: 0.01},
        {type: 'modSlider', key: "edgeWidth", label: "Edge Width", min: 0, max: 1, step: 0.01},
        {type: 'modSlider', key: "edgeOpacity", label: "Edge Opacity", min: 0, max: 1,  step: 0.01},
        {
            key: "edgeColor",
            label: "Edge Color",
            type: "vector",
            subLabels: ["R", "G", "B"],
            min: 0,
            max: 1,
            step: 0.01,
        },
        {type: 'modSlider', key: "seed", label: "Seed", min: 0,  max: 100, step: 0.01},
        blendControls(),
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            cellCount, jitter, edgeWidth, edgeOpacity, edgeColor, seed,
            BLENDMODE, COLORSPACE, BLEND_CHANNEL_MODE, blendAmount, chromaBoost,
        } = resolveAnimAll(instance.config, t);

        const uniformSpec = {
            u_resolution: {type: "vec2",  value: [width, height]},
            u_cellCount: {type: "float", value: cellCount},
            u_jitter: {type: "float", value: jitter},
            u_edgeWidth: {type: "float", value: edgeWidth},
            u_edgeOpacity: {type: "float", value: edgeOpacity},
            u_edgeColor: {type: "vec3",  value: edgeColor},
            u_seed: {type: "float", value: seed},
            u_blendamount: {type: "float", value: blendAmount},
            u_chromaBoost: {type: "float", value: chromaBoost},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
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
    tags:  ["mosaic", "voronoi", "stained-glass", "tile"],
    description:
        "Tesselates the image into Voronoi cells, sampling each cell's color from its " +
        "seed point. Produces mosaic, stained-glass, or pointillist effects depending " +
        "on cell count, jitter, and edge settings. Seed can be animated to reshuffle cells.",
    canAnimate:   true,
    realtimeSafe: true,
    parameterHints: {
        cellCount: {min: 16, max: 80},
        jitter: {min: 0.6,  max: 1.0},
        edgeWidth: {min: 0.2,  max: 0.7},
        edgeOpacity: {min: 0.6,  max: 1.0},
        edgeColor: {always: [0, 0, 0]},
        seed: {min: 0, max: 100, aniMin: 0, aniMax: 100},
    },
};