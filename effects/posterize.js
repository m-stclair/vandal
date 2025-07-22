import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
    hasChromaBoostImplementation,
    PosterizeEnum,
    PosterizeModeOpts
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "../shaders/posterizer.frag"
const includePaths = {
    'colorconvert.glsl': '../shaders/includes/colorconvert.glsl',
    'blend.glsl': '../shaders/includes/blend.glsl',
    'posterize.glsl': '../shaders/includes/posterize.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Posterize",

    defaultConfig: {
        levels: 8,
        mode: PosterizeEnum.UNIFORM,
        COLORSPACE: ColorspaceEnum.RGB,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        mod: 0.5,
        c1: true,
        c2: true,
        c3: true,
        chromaBoost: 1
    },

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            blendAmount, mod, COLORSPACE, mode, levels, chromaBoost,
            c1, c2, c3, BLENDMODE, BLEND_CHANNEL_MODE} = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_blendamount: {type: "float", value: blendAmount},
            u_resolution: {type: "vec2", value: [width, height]},
            u_logbase: {type: "float", value: mod * 4 + 1},
            u_bias: {type: "float", value: mod / 2 + 0.1},
            u_bayer_resolution: {type: "float", value: mod * mod},
            u_chromaBoost: {type: "float", value: chromaBoost},
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            POSTERIZE_MODE: Number.parseInt(mode),
            POSTERIZE_LEVELS: levels,
            POSTERIZE_C1: Number(c1),
            POSTERIZE_C2: Number(c2),
            POSTERIZE_C3: Number(c3),
        }
        instance.glState.renderGL(inputTex, outputFBO, uniforms, defines);
    },

    uiLayout: [
        {key: "levels", label: "Levels", type: "modSlider", min: 2, max: 32, step: 1},
        {key: "blendAmount", label: "Blend Amount", type: "modSlider", min: 0, max: 1, step: 0.01},
        {
            key: 'mode',
            label: 'Mode',
            type: 'Select',
            options: PosterizeModeOpts
        },
        {key: "mod", label: "Modulator", type: "modSlider", min: 0, max: 1, step: 0.01},
        {key: "c1", label: "Channel 1", type: "checkbox"},
        {key: "c2", label: "Channel 2", type: "checkbox"},
        {key: "c3", label: "Channel 2", type: "checkbox"},
        blendControls()

    ],
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    initHook: fragSources.load,
    glState: null,
    isGPU: true
}

export const effectMeta = {
  group: "Color",
  tags: ["color", "posterize", "quantization", "webgl", "mix"],
  description:  "Classic posterization / quantization effect with multiple " +
                "quantization modes and colorspaces.",
  canAnimate: true,
  realtimeSafe: true,
  parameterHints: {
      blendAmount: {min: 0.75, max: 1}
  }
};