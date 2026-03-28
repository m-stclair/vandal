import {resolveAnimAll} from "../utils/animutils.js";
import {cmapLuts, colormaps, LUTSIZE} from "../utils/colormaps.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation, CalcModeEnum,
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";
import {calcPass} from "./probes/calcpass.js";

const shaderPath = "dither.frag"
const includePaths = {
    'zones.glsl': 'includes/zones.glsl',
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
    'noise.glsl': 'includes/noise.glsl',
    'psrdnoise2.glsl': 'includes/noises/psrdnoise2.glsl',
    "classicnoise2D.glsl": 'includes/noises/classicnoise2D.glsl',
    "cellular2D.glsl": 'includes/noises/cellular2D.glsl',
    "noise2D.glsl": 'includes/noises/noise2D.glsl',
    'noisenums.glsl': "includes/noises/noisenums.glsl",
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Dither",
    defaultConfig: {
        scale: 1100,
        tint: [1, 1, 1],
        seed: 1,
        levels: 2,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        chromaBoost: 1,
        components: [0, 0, 0, 0.1, 0.5, 0, 0],
        blendAmount: 1,
        colormap: "none",
        USE_STRUCTURE: false,
        edgeStrength: 1
    },
    uiLayout: [
        {
            type: "group",
            label: "Dither",
            kind: 'collapse',
            collapsed: false,
            children: [
                {key: "seed", label: "Seed", type: "modSlider", min: 1, max: 500, step: 1},
                {
                    key: "components",
                    label: "Noise Components",
                    type: "vector",
                    subLabels: () => ["Uniform", "Perlin", "Simplex", "Gaussian", "Value", "Brown", "Worley"],
                    min: 0,
                    max: 1,
                    step: 0.01,
                    length: 7
                },
                {key: "scale", label: "Scale", type: "modSlider", min: 250, max: 5000, steps: 300, scale: "log"},
                {key: "levels", label: "Levels", type: "modSlider", min: 2, max: 16, step: 1},
                {
                    key: "edgeStrength",
                    label: "Edge Strength",
                    type: "modSlider",
                    min: 0,
                    max: 10,
                    steps: 100,
                    showIf: {key: "USE_STRUCTURE", equals: true}
                },
                {key: "USE_STRUCTURE", label: "Use Structure", type: "checkbox"}
            ]
        },
        {
            type: 'group',
            label: 'Color',
            kind: 'collapse',
            children: [
                {
                    type: "select",
                    key: "colormap",
                    label: "Colormap",
                    options: ["none", ...Object.keys(colormaps)]
                },
                {
                    key: "tint",
                    label: "Tint",
                    type: "vector",
                    subLabels: () => ["C1", "C2", "C3"],
                    min: 0,
                    max: 1,
                    length: 3,
                    step: 0.01,
                },
            ]
        },
        blendControls(),
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources)
        const {
            seed, scale, components, levels, USE_STRUCTURE, edgeStrength,
            BLENDMODE, COLORSPACE, tint, blendAmount, colormap,
            BLEND_CHANNEL_MODE, chromaBoost
        } = resolveAnimAll(instance.config, t);
        // TODO: this is wrong
        if (!components.some((c) => c)) return inputTex;
        const quantLevels = Math.round(levels)
        const [uniform, perlin, simplex, gauss, value, brown, worley] = components;
        const uniformSpec = {
            u_scale: {type: "float", value: scale},
            u_seed: {type: "float", value: seed / 11.3},
            u_levels: {type: "float", value: quantLevels},
            u_resolution: {type: "vec2", value: [width, height]},
            u_perlin: {type: "float", value: perlin},
            u_gauss: {type: "float", value: gauss},
            u_uniform: {type: "float", value: uniform},
            u_brown: {type: "float", value: brown},
            u_value: {type: "float", value: value},
            u_worley: {type: "float", value: worley},
            u_simplex: {type: "float", value: simplex},
            u_tint: {value: new Float32Array(tint), type: "vec3"},
            u_blendamount: {value: blendAmount, type: "float"},
            u_chromaBoost: {type: "float", value: chromaBoost},
            u_edgeStrength: {type: "float", value: edgeStrength}
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            USE_CMAP: colormap === "none" ? 0 : 1,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            USE_STRUCTURE: USE_STRUCTURE
        }
        if (USE_STRUCTURE) {
            const calcPassTexture = instance.calcPass.calculate(
                instance.calcPass,
                inputTex,
                width,
                height,
                1,
                1,
                true,
                3,
                CalcModeEnum.STRUCTURE_TENSOR
            ).texture
            // this uniform is #defined out if !USE_STRUCTURE
            uniformSpec.u_calcPass = {value: calcPassTexture, type: "texture2D"};
        }

        if (colormap !== "none") {
            uniformSpec["u_cmap"] = {
                value: instance.glState.getOrCreateLUT(colormap, cmapLuts[colormap]),
                type: "texture2D",
                width: LUTSIZE,
                height: 1
            };
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: async (instance, renderer) => {
        await fragSources.load();
        instance.calcPass = {
            initHook: calcPass.initHook,
            cleanupHook: calcPass.cleanupHook,
            setupFBO: calcPass.setupFBO,
            calculate: calcPass.calculate,
            outputFBO: null,
            width: null,
            height: null
        };
        await instance.calcPass.initHook(instance.calcPass, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
        instance.calcPass.cleanupHook(instance.calcPass);
    },
    glState: null,
    isGPU: true
};

export const effectMeta = {
    group: "Stylize",
    tags: ["poster", "noise", "print"],
    description: "Applies a configurable dithering effect that can approximate a variety of print techniques.",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {}
};
