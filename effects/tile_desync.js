import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendModeOpts,
    BlendTargetEnum,
    BlendTargetOpts,
    ColorspaceEnum, hasChromaBoostImplementation,
    ColorspaceOpts
} from "../utils/glsl_enums.js";

const shaderPath = "../shaders/tile_desync.frag"
const includePaths = {
    'noise.glsl': '../shaders/includes/noise.glsl',
    'colorconvert.glsl': '../shaders/includes/colorconvert.glsl',
    'blend.glsl': '../shaders/includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Desync Tiles",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        tileCountX: 10,
        tileCountY: 10,
        offsetAmount: 0.1,
        seed: 0,
    },
    uiLayout: [
        {type: "modSlider", key: "seed", label: "Seed", min: 1, max: 500, step: 1},
        {type: "modSlider", key: "tileCountX", label: "Tile Count X", min: 1, max: 100, step: 1},
        {type: "modSlider", key: "tileCountY", label: "Tile Count Y", min: 1, max: 100, step: 1},
        {type: "modSlider", key: "offsetAmount", label: "Offset", min: 0, max: 1, step:0.005},
        {
            key: 'COLORSPACE',
            label: 'Blend Colorspace',
            type: 'Select',
            options: ColorspaceOpts
        },
        {
            key: 'BLENDMODE',
            label: 'Blend Mode',
            type: 'Select',
            options: BlendModeOpts
        },
        {
            key: 'BLEND_CHANNEL_MODE',
            label: 'Blend Target',
            type: 'Select',
            options: BlendTargetOpts
        },
        {key: 'blendAmount', label: 'Blend Amount', type: 'modSlider', min: 0, max: 1, step: 0.01},
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            blendAmount, BLENDMODE, offsetAmount, tileCountX,
            tileCountY, seed, COLORSPACE, BLEND_CHANNEL_MODE
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_blendamount: {type: "float", value: blendAmount},
            u_resolution: {type: "vec2", value: [width, height]},
            u_tilecount: {type: "vec2", value: [tileCountX, tileCountY]},
            u_seed: {type: "float", value: seed},
            u_offsetamount: {type: "float", value: offsetAmount},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE
        }
        instance.glState.renderGL(inputTex, outputFBO, uniforms, defines);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    initHook: fragSources.load,
    glState: null,
    isGPU: true
}

export const effectMeta = {
  group: "Glitch",
  tags: ["tile", "offset", "glitch", "gpu", "displacement"],
  description: "Divides the image into tiles and desynchronizes their positions. " +
      "Can produce glassy noise, jittery breakup effects, and geometric confusion.",
  canAnimate: true,
  realtimeSafe: true,
};