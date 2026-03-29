import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, makeEnum} from "../utils/glsl_enums.js";

const shaderPath = "polar_transform.frag";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);
const {
    enum: PolarModeEnum,
    names: PolarModeNames,
    options: PolarModeOpts
} = makeEnum([
    "UNWRAP", // cartesian → polar  (tunnel, radial unfurl)
    "WRAP" // polar → cartesian  (swirl, pinwheel)
])

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Polar Transform",
    defaultConfig: {
        POLAR_MODE:   PolarModeEnum.WRAP,
        centerX:      0.5,
        centerY:      0.5,
        angleOffset:  0,      // [0..1] — full rotation at 1.0
        radialScale:  0.5,
        angularScale: 1.0,
        blendAmount:  1,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
    },
    uiLayout: [
        {
            key: "POLAR_MODE",
            label: "Mode",
            type: "select",
            options: PolarModeOpts,
            valueMap: PolarModeEnum,
        },
        {
            key: "centerX",
            label: "Center X",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: "centerY",
            label: "Center Y",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: "angleOffset",
            label: "Angle Offset",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.005,
        },
        {
            key: "radialScale",
            label: "Radial Scale",
            type: "modSlider",
            min: 0.1,
            max: 2.0,
            step: 0.01,
        },
        {
            key: "angularScale",
            label: "Angular Scale",
            type: "modSlider",
            min: 0.25,
            max: 4.0,
            step: 0.05,
        },
        blendControls()
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            POLAR_MODE,
            centerX, centerY,
            angleOffset,
            radialScale,
            angularScale,
            blendAmount,
            BLENDMODE,
            BLEND_CHANNEL_MODE,
            COLORSPACE
        } = resolveAnimAll(instance.config, t);

        const uniformSpec = {
            u_resolution:   {type: "vec2",  value: [width, height]},
            u_center:       {type: "vec2",  value: [centerX, centerY]},
            u_angleOffset:  {type: "float", value: angleOffset},
            u_radialScale:  {type: "float", value: radialScale},
            u_angularScale: {type: "float", value: angularScale},
            u_blendAmount:  {type: "float", value: blendAmount},
        };

        const defines = {
            POLAR_MODE: POLAR_MODE,
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE:  BLEND_CHANNEL_MODE,
            COLORSPACE: COLORSPACE,
        };

        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: async (instance, renderer) => {
        await fragSources.load(instance, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
};

export const effectMeta = {
    group: "Distortion",
    tags: ["polar", "radial", "warp", "tunnel", "swirl", "unwrap"],
    description: "Maps between cartesian and polar coordinate spaces. Unwrap mode creates tunnel and radial unfurl effects; wrap mode creates swirl and pinwheel effects. Animating angleOffset spins the transform.",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        angleOffset:  {min: 0, max: 0, aniMin: 0, aniMax: 100},
        radialScale:  {min: 0.3, max: 0.7},
        angularScale: {min: 1, max: 2},
        blendAmount:  {min: 0.85, max: 1},
    },
};