import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendModeOpts} from "../utils/glsl_enums.js";

const shaderPath = "../shaders/scanlines.frag";
const includePaths = {
    "colorconvert.glsl": "../shaders/includes/colorconvert.glsl",
    "blend.glsl": "../shaders/includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @type {EffectModule} */
export default {
    name: "Scanlines",
    defaultConfig: {
        lineSpacing: 200,
        intensity: 0.5,
        phase: 0,
        blendAmount: 1,
        blendMode: '5'
    },
    uiLayout: [
        {type: "modSlider", key: "lineSpacing", label: "Line Spacing", min: 25, max: 1000, step: 5},
        {type: "modSlider", key: "phase", label: "Phase", min: -1, max: 1, step: 0.01},
        {type: "modSlider", key: "intensity", label: "Intensity", min: 0.1, max: 1, step: 0.1},
        {key: "blendAmount", label: "Blend", type: "modSlider", min: 0, max: 1, step: 0.01},
        {
            key: 'blendMode',
            label: 'Blend Mode',
            type: 'Select',
            options: BlendModeOpts
        },
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        const {lineSpacing, intensity, phase, blendAmount, blendMode} = resolveAnimAll(instance.config, t);
        initGLEffect(instance, fragSources);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_phase: {value: phase * Math.PI, type: "float"},
            u_intensity: {value: intensity, type: "float"},
            u_spacing: {value: lineSpacing, type: "float"},
            u_blendamount: {value: blendAmount, type: "float"}
        };
        const defines = { BLENDMODE: Number.parseInt(blendMode) };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,


}

export const effectMeta = {
  group: "Stylize",
  tags: ["scanlines", "retro", "overlay", "gpu", "patterns"],
  description: "Adds horizontal scanlines to simulate CRT-style rendering artifacts.",
  canAnimate: true,
  realtimeSafe: true,
};

