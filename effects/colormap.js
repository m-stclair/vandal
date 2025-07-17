import {cmapLuts, colormaps, LUTSIZE} from "../utils/colormaps.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "../shaders/colormap.frag";
const includePaths = {
    "colorconvert.glsl": "../shaders/includes/colorconvert.glsl",
    "blend.glsl": "../shaders/includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Colormap",
    defaultConfig: {
        colormap: "orange_teal",
        reverse: false,
        blendAmount: 1,
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL
    },
    uiLayout: [
        {
            type: "select",
            key: "colormap",
            label: "Colormap",
            options: Object.keys(colormaps)
        },
        {
            type: "checkbox",
            key: "reverse",
            label: "Reverse",
        },
        blendControls()
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            reverse, BLENDMODE, BLEND_CHANNEL_MODE, COLORMAP, blendAmount, colormap
        } = resolveAnimAll(instance.config, t);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {value: blendAmount, type: "float"},
            u_reverse: {value: reverse, type: "float"}
        };
        uniformSpec["u_cmap"] = {
            value: instance.glState.getOrCreateLUT(colormap, cmapLuts[colormap]),
            type: "texture2D",
            width: LUTSIZE,
            height: 1
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            COLORMAP: COLORMAP
        };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
};

export const effectMeta = {
  group: "Color",
  tags: ["color", "colormap", "gpu", "lookup", "palette"],
  description: "Applies a colormap transformation using a 1D palette LUT. "
    + "Useful for remapping luminance or applying false color.",
  canAnimate: true,
  realtimeSafe: true,
};
