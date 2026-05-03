import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, makeEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "fractal_orbit.frag";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: FractalModeEnum,
    options: FractalModeOpts
} = makeEnum([
    'MANDELBROT',
    'JULIA'
]);

const {
    enum: TrackModeEnum,
    options: TrackModeOpts
} = makeEnum([
    'ORBIT_CENTROID',
    'ESCAPE_VECTOR',
    'TRAP_CLOSEST',
    'TRACK_ORBIT_FOLLOW'
]);

const {
    enum: ColoringModeEnum,
    options: ColoringModeOpts
} = makeEnum([
    'NONE',
    'ESCAPE',
    'ANGLE',
    'TRAP'
]);

const {
    enum: WrapModeEnum,
    options: WrapModeOpts
} = makeEnum([
    'CARTESIAN',
    'POLAR',
]);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Fractal Orbit",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,

        FRACTAL_MODE: FractalModeEnum.JULIA,
        TRACK_MODE: TrackModeEnum.TRAP_CLOSEST,
        COLORING_MODE: ColoringModeEnum.NONE,
        WRAP_MODE: WrapModeEnum.CARTESIAN,
        ITERATIONS: 48,

        depth: 1,
        zoom: 0.4,
        spin: 0,
        centerX: 0,
        centerY: 0,

        juliaReal: -0.8,
        juliaImag: 0.156,
        escapeRadius: 8,

        orbitScale: 1,
        orbitSpin: 0,
        earlyOrbitBias: 0.2,
        trapX: 0,
        trapY: 0,
        trailDecay: 0.7,

        chromaGamma: 1,
        startHue: 0.58,
        hueSpacing: 1,
        hueBleed: 0
    },

    uiLayout: [
        {
            type: "select",
            key: "FRACTAL_MODE",
            label: "Fractal Mode",
            options: FractalModeOpts
        },
        {
            type: "select",
            key: "TRACK_MODE",
            label: "Track Mode",
            options: TrackModeOpts
        },
        {
            type: "select",
            key: "WRAP_MODE",
            label: "Wrap Mode",
            options: WrapModeOpts
        },
        {
            type: "range",
            key: "ITERATIONS",
            label: "Iterations",
            min: 1,
            max: 160,
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
            key: "zoom",
            label: "Zoom",
            min: 0.05,
            max: 20,
            steps: 120,
            scale: "log"
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
            key: "centerX",
            label: "Center X",
            min: -2.5,
            max: 2.5,
            step: 0.001
        },
        {
            type: "modSlider",
            key: "centerY",
            label: "Center Y",
            min: -2.5,
            max: 2.5,
            step: 0.001
        },
        {
            type: "group",
            label: "Julia",
            kind: "collapse",
            children: [
                {
                    type: "modSlider",
                    key: "juliaReal",
                    label: "Julia Real",
                    min: -1.5,
                    max: 1.5,
                    step: 0.001,
                },
                {
                    type: "modSlider",
                    key: "juliaImag",
                    label: "Julia Imag",
                    min: -1.5,
                    max: 1.5,
                    step: 0.001,
                },
            ],
            showIf: {"key": "FRACTAL_MODE", "equals": FractalModeEnum.JULIA}
        },
        {
            type: "group",
            label: "Tracking",
            kind: "collapse",
            children: [
                {
                    type: "modSlider",
                    key: "orbitScale",
                    label: "Orbit Scale",
                    min: 0.05,
                    max: 8,
                    steps: 120,
                    scale: "log"
                },
                {
                    type: "modSlider",
                    key: "orbitSpin",
                    label: "Orbit Spin",
                    min: 0,
                    max: 360,
                    step: 1
                },
                {
                    type: "modSlider",
                    key: "earlyOrbitBias",
                    label: "Early Bias",
                    min: 0,
                    max: 1,
                    step: 0.01,
                    showIf: {"key": "TRACK_MODE", "equals": TrackModeEnum.ORBIT_CENTROID}
                },
                {
                    type: "modSlider",
                    key: "trapX",
                    label: "Trap X",
                    min: -2,
                    max: 2,
                    step: 0.001,
                    showIf: {"key": "TRACK_MODE", "equals": TrackModeEnum.TRAP_CLOSEST}
                },
                {
                    type: "modSlider",
                    key: "trapY",
                    label: "Trap Y",
                    min: -2,
                    max: 2,
                    step: 0.001,
                    showIf: {"key": "TRACK_MODE", "equals": TrackModeEnum.TRAP_CLOSEST}
                },
                {
                    type: "modSlider",
                    key: "trailDecay",
                    label: "Trail Decay",
                    min: 0,
                    max: 1,




                    step: 0.01,
                    showIf: {"key": "TRACK_MODE", "equals": TrackModeEnum.TRACK_ORBIT_FOLLOW}
                },
                {
                    type: "modSlider",
                    key: "escapeRadius",
                    label: "Escape Radius",
                    min: 2,
                    max: 64,
                    steps: 100,
                    scale: "log"
                },
            ]
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
            FRACTAL_MODE, TRACK_MODE, ITERATIONS, WRAP_MODE,
            depth, zoom, spin, centerX, centerY,
            juliaReal, juliaImag, escapeRadius, trailDecay,
            orbitScale, orbitSpin, earlyOrbitBias, trapX, trapY,
            chromaGamma, hueSpacing, startHue, hueBleed, COLORING_MODE
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {type: "float", value: blendAmount},

            u_depth: {type: "float", value: depth},
            u_zoom: {type: "float", value: zoom},
            u_spin: {type: "float", value: spin * Math.PI / 180},
            u_center: {type: "vec2", value: [centerX, centerY]},

            u_juliaC: {type: "vec2", value: [juliaReal, juliaImag]},
            u_escapeRadius: {type: "float", value: escapeRadius},

            u_orbitScale: {type: "float", value: orbitScale},
            u_orbitSpin: {type: "float", value: orbitSpin * Math.PI / 180},
            u_earlyOrbitBias: {type: "float", value: earlyOrbitBias},
            u_trapPoint: {type: "vec2", value: [trapX, trapY]},
            u_trailDecay: {type: "float", value: trailDecay},

            u_chromaGamma: {type: "float", value: chromaGamma},
            u_hueSpacing: {type: "float", value: hueSpacing},
            u_startHue: {type: "float", value: startHue},
            u_hueBleed: {type: "float", value: hueBleed}
        };

        const defines = {
            FRACTAL_MODE: FRACTAL_MODE,
            TRACK_MODE: TRACK_MODE,
            ITERATIONS: ITERATIONS,
            COLORING_MODE: COLORING_MODE,
            COLORSPACE: COLORSPACE,
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            WRAP_MODE: WRAP_MODE
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
    tags: ["fractal", "orbit", "escape-time"],
    description: "Warps image via a Mandelbrot/Julia orbit-induced map.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true,
    parameterHints: {
        "ITERATIONS": {"min": 12, "max": 96},
        "depth": {"min": 0.1, "max": 1},
        "zoom": {"min": 0.25, "max": 3, "aniMin": 0.1},
        "orbitScale": {"min": 0.5, "max": 3},
        "earlyOrbitBias": {"min": 0.05, "max": 0.3},
        "chromaGamma": {"min": 0.7, "max": 1.3},
        "juliaReal": {"min": -0.8, "max": 0.8},
        "juliaImag": {"min": -0.8, "max": 0.8},
        "centerX": {"min": -1, "max": 1},
        "centerY": {"min": -1, "max": 1},
        "trailDecay": {"min": 0, "max": 0.9}

    }
};
