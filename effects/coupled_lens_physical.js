import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "coupled_lens_physical.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl",
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Coupled Lens System (Physical)",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1.0,

        lensSeparation: 0.18,
        lensRadius: 0.38,
        curvatureA: 0.85,
        curvatureB: -0.55,
        refractiveIndex: 1.35,
        dispersion: 0.03,
        coupling: 0.75,
        passes: 3.0,
        rotation: 0.0,
        aperture: 0.82,
        apertureFalloff: 0.18,
        edgeSoftness: 0.22,
        depth: 1.0
    },

    uiLayout: [
        {
            type: "modSlider",
            key: "lensSeparation",
            label: "Lens Separation",
            min: 0.0,
            max: 0.6,
            steps: 200
        },
        {
            type: "modSlider",
            key: "lensRadius",
            label: "Lens Radius",
            min: 0.05,
            max: 1.0,
            steps: 200
        },
        {
            type: "modSlider",
            key: "curvatureA",
            label: "Curvature A",
            min: -2.0,
            max: 2.0,
            steps: 400
        },
        {
            type: "modSlider",
            key: "curvatureB",
            label: "Curvature B",
            min: -2.0,
            max: 2.0,
            steps: 400
        },
        {
            type: "modSlider",
            key: "refractiveIndex",
            label: "Refractive Index",
            min: 1.0,
            max: 2.0,
            steps: 200
        },
        {
            type: "modSlider",
            key: "dispersion",
            label: "Dispersion",
            min: 0.0,
            max: 0.12,
            steps: 200
        },
        {
            type: "modSlider",
            key: "coupling",
            label: "Coupling",
            min: 0.0,
            max: 2.0,
            steps: 200
        },
        {
            type: "modSlider",
            key: "passes",
            label: "Passes",
            min: 1.0,
            max: 10.0,
            steps: 180
        },
        {
            type: "modSlider",
            key: "rotation",
            label: "Rotation",
            min: -3.14159,
            max: 3.14159,
            steps: 300
        },
        {
            type: "modSlider",
            key: "aperture",
            label: "Aperture",
            min: 0.05,
            max: 1.0,
            steps: 150
        },
        {
            type: "modSlider",
            key: "apertureFalloff",
            label: "Aperture Falloff",
            min: 0.01,
            max: 0.8,
            steps: 150
        },
        {
            type: "modSlider",
            key: "edgeSoftness",
            label: "Edge Softness",
            min: 0.01,
            max: 1.0,
            steps: 150
        },
        {
            type: "modSlider",
            key: "depth",
            label: "Depth",
            min: 0.0,
            max: 1.0,
            steps: 100
        },
        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;

        const {
            blendAmount,
            COLORSPACE,
            BLENDMODE,
            BLEND_CHANNEL_MODE,
            lensSeparation,
            lensRadius,
            curvatureA,
            curvatureB,
            refractiveIndex,
            dispersion,
            coupling,
            passes,
            rotation,
            aperture,
            apertureFalloff,
            edgeSoftness,
            depth
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {type: "float", value: blendAmount},

            u_lens_separation: {type: "float", value: lensSeparation},
            u_lens_radius: {type: "float", value: lensRadius},
            u_curvature_a: {type: "float", value: curvatureA},
            u_curvature_b: {type: "float", value: curvatureB},
            u_refractive_index: {type: "float", value: refractiveIndex},
            u_dispersion: {type: "float", value: dispersion},
            u_coupling: {type: "float", value: coupling},
            u_passes: {type: "float", value: passes},
            u_rotation: {type: "float", value: rotation},
            u_aperture: {type: "float", value: aperture},
            u_aperture_falloff: {type: "float", value: apertureFalloff},
            u_edge_softness: {type: "float", value: edgeSoftness},
            u_depth: {type: "float", value: depth}
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
    isGPU: true
};

export const effectMeta = {
    group: "Stylize",
    tags: ["optical", "lens", "refraction", "dispersion", "chromatic"],
    description: "A physically flavored coupled-lens distortion effect with curvature, " +
        "refractive-index style bending, chromatic dispersion, and aperture falloff.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true
};