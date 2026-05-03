import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, hasChromaBoostImplementation, makeEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "penrose.frag";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: ColoringModeEnum,
    options: ColoringModeOpts
} = makeEnum([
    'NONE',
    'SEED',
    'BRANCH',
    'TILE_TYPE',
    'ORIENTATION'
]);

const {
    enum: UVModeEnum,
    options: UVModeOpts
} = makeEnum([
    'ADDRESS',
    'LOCAL',
    'DISPLACE'
]);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Penrose",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,

        ITERATIONS: 7,
        COLORING_MODE: ColoringModeEnum.NONE,
        UV_MODE: UVModeEnum.DISPLACE,

        depth: 1,
        zoom: 1,
        spin: 0,

        seedRadius: 2.75,
        phiWrap: 1,

        // In DISPLACE mode this is the actual image-preserving warp strength.
        // The old branch-address mapping is still available as ADDRESS mode.
        warpAmount: 0.22,
        localScale: 1,
        addressSpread: 1,

        edgeAmount: 0.35,
        edgeWidth: 0.018,

        chromaGamma: 1,
        startHue: 0.06,
        hueSpacing: 1,
        hueBleed: 0.15,

        curveStrength: 0,
        curveDirection: 0,
        panX: 0,
        panY: 0,
        originX: 0,
        originY: 0
    },

    uiLayout: [
        {
            type: "range",
            key: "ITERATIONS",
            label: "Iterations",
            min: 1,
            max: 13,
            step: 1
        },
        {
            type: "select",
            key: "UV_MODE",
            label: "UV Mode",
            options: UVModeOpts
        },
        {
            type: "modSlider",
            key: "warpAmount",
            label: "Warp Amount",
            min: 0,
            max: 1.5,
            step: 0.01,
            showIf: {"key": "UV_MODE", "equals": UVModeEnum.DISPLACE}
        },
        {
            type: "modSlider",
            key: "localScale",
            label: "Local Scale",
            min: 0.1,
            max: 6,
            step: 0.01,
            showIf: {"key": "UV_MODE", "equals": UVModeEnum.LOCAL}
        },
        {
            type: "modSlider",
            key: "addressSpread",
            label: "Address Spread",
            min: 0,
            max: 4,
            step: 0.01,
            showIf: {"key": "UV_MODE", "equals": UVModeEnum.ADDRESS}
        },
        {
            type: "modSlider",
            key: "spin",
            label: "Spin",
            min: 0,
            max: 360,
            step: 1
        },
        {
            type: "modSlider",
            key: "zoom",
            label: "Zoom",
            min: 0.05,
            max: 5,
            steps: 100,
            scale: "log"
        },
        {
            type: "modSlider",
            key: "seedRadius",
            label: "Seed Radius",
            min: 0.75,
            max: 6,
            step: 0.01
        },
        {
            type: "modSlider",
            key: "phiWrap",
            label: "Phi Wrap",
            min: 0,
            max: 1,
            step: 0.01
        },
        {
            type: "modSlider",
            key: "panX",
            label: "Pan X",
            min: -1,
            max: 1,
            steps: 100
        },
        {
            type: "modSlider",
            key: "panY",
            label: "Pan Y",
            min: -1,
            max: 1,
            steps: 100
        },
        {
            type: "modSlider",
            key: "originX",
            label: "Origin X",
            min: -1,
            max: 1,
            steps: 100
        },
        {
            type: "modSlider",
            key: "originY",
            label: "Origin Y",
            min: -1,
            max: 1,
            steps: 100
        },
        {
            type: "modSlider",
            key: "curveStrength",
            label: "Curve Strength",
            min: 0,
            max: 1,
            step: 0.01
        },
        {
            type: "modSlider",
            key: "curveDirection",
            label: "Curve Direction",
            min: 0,
            max: 360,
            step: 1
        },
        {
            type: "modSlider",
            key: "depth",
            label: "Depth",
            min: 0,
            max: 1,
            steps: 200
        },
        {
            type: "modSlider",
            key: "edgeAmount",
            label: "Subdivision Edge Amount",
            min: 0,
            max: 1,
            step: 0.01
        },
        {
            type: "modSlider",
            key: "edgeWidth",
            label: "Subdivision Edge Width",
            min: 0,
            max: 0.08,
            step: 0.001
        },
        {
            type: "group",
            label: "Color",
            kind: "collapse",
            children: [
                {
                    type: "select",
                    key: "COLORING_MODE",
                    label: "Coloring Mode",
                    options: ColoringModeOpts
                },
                {
                    type: "modSlider",
                    key: "chromaGamma",
                    label: "Chroma Gamma",
                    min: 0,
                    max: 3,
                    step: 0.1,
                    showIf: {"key": "COLORING_MODE", "notEquals": ColoringModeEnum.NONE}
                },
                {
                    type: "modSlider",
                    key: "hueSpacing",
                    label: "Hue Spacing",
                    min: 0,
                    max: 7,
                    step: 0.01,
                    showIf: {"key": "COLORING_MODE", "notEquals": ColoringModeEnum.NONE}
                },
                {
                    type: "modSlider",
                    key: "startHue",
                    label: "Start Hue",
                    min: 0,
                    max: 1,
                    step: 0.01,
                    showIf: {"key": "COLORING_MODE", "notEquals": ColoringModeEnum.NONE}
                },
                {
                    type: "modSlider",
                    key: "hueBleed",
                    label: "Hue Bleed",
                    min: 0,
                    max: 1,
                    step: 0.01,
                    showIf: {"key": "COLORING_MODE", "notEquals": ColoringModeEnum.NONE}
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
            ITERATIONS, depth, spin, zoom, COLORING_MODE, UV_MODE,
            chromaGamma, hueSpacing, startHue, hueBleed,
            curveStrength, curveDirection, panX, panY,
            originX, originY, seedRadius, phiWrap,
            warpAmount, localScale, addressSpread,
            edgeAmount, edgeWidth
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {type: "float", value: blendAmount},

            u_depth: {type: "float", value: depth},
            u_spin: {type: "float", value: spin * Math.PI / 180},
            u_zoom: {type: "float", value: zoom},

            u_seedRadius: {type: "float", value: seedRadius},
            u_phiWrap: {type: "float", value: phiWrap},

            u_warpAmount: {type: "float", value: warpAmount},
            u_localScale: {type: "float", value: localScale},
            u_addressSpread: {type: "float", value: addressSpread},

            u_edgeAmount: {type: "float", value: edgeAmount},
            u_edgeWidth: {type: "float", value: edgeWidth},

            u_chromaGamma: {type: "float", value: chromaGamma},
            u_hueSpacing: {type: "float", value: hueSpacing},
            u_startHue: {type: "float", value: startHue},
            u_hueBleed: {type: "float", value: hueBleed},

            u_curveStrength: {type: "float", value: curveStrength},
            u_curveDirection: {type: "float", value: curveDirection * Math.PI / 180},
            u_pan: {type: "vec2", value: [panX, panY]},
            u_origin: {type: "vec2", value: [originX, originY]}
        };

        const defines = {
            ITERATIONS: ITERATIONS,
            COLORING_MODE: COLORING_MODE,
            UV_MODE: UV_MODE,
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
    isGPU: true
};

export const effectMeta = {
    group: "Fractal",
    tags: ["fractal", "penrose", "aperiodic", "p3", "rhomb", "tiling"],
    description: "Folds image through a recursively subdivided Penrose P3 rhomb tiling, with address, local, and image-preserving displacement UV modes.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true,
    parameterHints: {
        "ITERATIONS": {"min": 2, "max": 11},
        "depth": {"min": 0.1, "max": 1},
        "warpAmount": {"min": 0.12, "max": 0.45},
        "zoom": {"min": 0.25, "max": 2},
        "seedRadius": {"min": 1.5, "max": 4},
        "phiWrap": {"min": 0.65, "max": 1},
        "edgeAmount": {"min": 0.15, "max": 0.6},
        "edgeWidth": {"min": 0.008, "max": 0.03},
        "chromaGamma": {"min": 0.7, "max": 1.3}
    }
};
