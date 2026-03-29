import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";

const shaderPath = "vignette.frag";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
}
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Vignette",
    defaultConfig: {
        strength: 0.5,
        radius: 0.75,
        softness: 0.45,
        roundness: 1.0,
        blendAmount: 1.0,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        chromaBoost: 1,
    },
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            strength, radius, softness, roundness,
            BLENDMODE, COLORSPACE, BLEND_CHANNEL_MODE, blendAmount
        } =
            resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_strength:   {value: strength, type: "float"},
            u_radius:     {value: radius, type: "float"},
            u_softness:   {value: softness, type: "float"},
            u_roundness:  {value: roundness, type: "float"},
            u_blendAmount: {value: blendAmount, type: "float"}
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            collapsed: false,
            children:
                [
                {
                    key: "strength",
                    label: "Strength",
                    type: "modSlider",
                    min: 0,
                    max: 1,
                    step: 0.01
                },
                {
                    key: "radius",
                    label: "Radius",
                    type: "modSlider",
                    min: 0,
                    max: 1.5,
                    step: 0.01
                },
                {
                    key: "softness",
                    label: "Softness",
                    type: "modSlider",
                    min: 0.01,
                    max: 1,
                    step: 0.01
                },
                {
                    key: "roundness",
                    label: "Roundness",
                    type: "modSlider",
                    min: 0,
                    max: 1,
                    step: 0.01
                }
            ]
        },
        blendControls()
    ]
};

export const effectMeta = {
    group: "Utility",
    tags: ["vignette", "darken", "edges", "frame", "focus"],
    description: "Darkens the edges of the image with a soft oval falloff.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        strength: {min: 0.2, max: 0.8},
        radius: {min: 0.4, max: 1.0}
    }
};