import {cmapLuts, colormaps, LUTSIZE} from "../utils/colormaps.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendModeOpts} from "../utils/glsl_enums.js";

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
        blendMode: 1
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
        {key: "blendAmount", label: "Blend", type: "modSlider", min: 0, max: 1, step: 0.01},
        {
            key: 'blendMode',
            label: 'Blend Mode',
            type: 'Select',
            options: BlendModeOpts
        },
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            reverse, blendMode, blendAmount, colormap
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
        const defines = { BLENDMODE: Number.parseInt(blendMode) };
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
