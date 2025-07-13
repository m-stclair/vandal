import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendOpts, BlendTargetOpts, ColorspaceOpts} from "../utils/glsl_enums.js";

const shaderPath = "../shaders/gridpattern.frag";
const includePaths = {
    "colorconvert.glsl": "../shaders/includes/colorconvert.glsl",
    "blend.glsl": "../shaders/includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Grid Pattern",
    defaultConfig: {
        lineWidth: 11,
        spacingFactor: 1.2,
        phaseX: 0.0,
        phaseY: 0.0,
        direction: "grid",
        mode: "binary",
        blendMode: '1',
        blendTarget: '0',
        colorSpace: '0',
        blendAmount: 0.5,
        invert: true,
        noiseScale: 0.01,
        noiseAmount: 0,
        skew: 0,
        lumaMod: 0,
        lumaThreshold: 1,
        lumaSoftness: 0,
        channelPhase0: 0,
        channelPhase1: 0,
        channelPhase2: 0,
        color: [1, 1, 1],
    },
    uiLayout: [
        {
            key: "lineWidth",
            label: "Width",
            type: "modSlider",
            min: 2,
            max: 200,
            steps: 100,
            scale: "log",
            scaleFactor: 2
        },
        {
            key: "spacingFactor",
            label: "Spacing",
            type: "modSlider",
            min: 1.05,
            max: 4,
            steps: 150,
            scale: "log"
        },
        {
            key: "phaseX",
            label: "Phase (X)",
            type: "modSlider",
            min: -1,
            max: 1,
            steps: 200,
        },
        {
            key: "phaseY",
            label: "Phase (Y)",
            type: "modSlider",
            min: -1,
            max: 1,
            steps: 200,
        },
        {
            key: "skew",
            label: "Skew",
            type: "modSlider",
            min: -1,
            max: 1,
            steps: 200,
       },
       {
            key: "noiseScale",
            label: "Noise Scale",
            type: "modSlider",
            min: 0.01,
            max: 0.06,
            steps: 100,
        },
       {
            key: "noiseAmount",
            label: "Noise Amount",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: "direction",
            label: "Direction",
            type: "Select",
            options: ["vertical", "horizontal", "grid"]
        },
        {
            key: "mode",
            label: "Mode",
            type: "Select",
            options: ["binary", "sine", "tri", "saw"]
        },
        {
            key: "lumaThreshold",
            label: "Luma Threshold",
            type: "range",
            min: 0,
            max: 1,
            steps: 200
        },
        {
            key: "lumaAngle",
            label: "Luma Angle",
            type: "range",
            min: -0.5,
            max: 0.5,
            steps: 200
        },
        {
            key: "lumaMod",
            label: "Luma Modulation",
            type: "range",
            min: -2,
            max: 2,
            steps: 200
        },
        {
            key: "invert",
            label: "Invert",
            type: "checkbox"
        },
        {
            key: 'colorSpace',
            label: 'Blend Colorspace',
            type: 'Select',
            options: ColorspaceOpts
        },
        {key: "blendAmount", label: "Blend", type: "Range", min: 0, max: 1, step: 0.01},
        {
            key: 'blendMode',
            label: 'Blend Mode',
            type: 'Select',
            options: BlendOpts
        },
        {
            key: 'blendTarget',
            label: 'Blend Target',
            type: 'Select',
            options: BlendTargetOpts
        },
        {
            key: "color",
            label: "Color",
            type: "vector",
            subLabels: ["R", "G", "B"],
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: "channelPhase0",
            label: "Channel 1 Phase Shift",
            type: "modSlider",
            min: -1,
            max: 1,
            steps: 200
        },
        {
            key: "channelPhase1",
            label: "Channel 2 Phase Shift",
            type: "modSlider",
            min: -1,
            max: 1,
            steps: 200
        },
        {
            key: "channelPhase2",
            label: "Channel 3 Phase Shift",
            type: "modSlider",
            min: -1,
            max: 1,
            steps: 200
        },
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            lineWidth, phaseX, phaseY, noiseScale, noiseAmount, direction, mode, blendMode, blendAmount,
            colorSpace, invert, spacingFactor, skew, blendTarget, lumaMod, color,
            lumaThreshold, lumaAngle, channelPhase0, channelPhase1, channelPhase2
        } = resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_width: {value: lineWidth, type: "float"},
            u_skew: {value: skew, type: "float"},
            u_noisescale: {value: noiseScale, type: "float"},
            u_noiseamount: {value: noiseAmount, type: "float"},
            u_blendamount: {value: blendAmount, type: "float"},
            u_spacingfactor: {value: spacingFactor, type: "float"},
            u_lumamod: {value: lumaMod, type: "float"},
            u_luma_angle: {value: lumaAngle, type: "float"},
            u_lumathreshold: {value: lumaThreshold, type: "float"},
            u_phase: {value: [phaseX * width, phaseY * height], type: "vec2"},
            u_color: {value: color, type: "vec3"},
            u_channelphase: {
                value: [
                    channelPhase0 * lineWidth * spacingFactor,
                    channelPhase1 * lineWidth * spacingFactor,
                    channelPhase2 * lineWidth * spacingFactor,
                ],
                type: "vec3"
            },
        };
        // console.log(uniformSpec);
        const defines = {
            DIRECTION: {"vertical": 0, "horizontal": 1, "grid": 2}[direction],
            MODE: {"binary": 0, "sine": 1, "tri": 2, "saw": 3}[mode],
            BLENDMODE: Number.parseInt(blendMode),
            BLEND_CHANNEL_MODE: blendTarget,
            COLORSPACE: Number.parseInt(colorSpace),
            INVERT: Number(invert),
            ADD_NOISE: Number(noiseAmount > 0),
            MOD_LUMA: Number((lumaMod !== 0) || (lumaThreshold !== 0 && lumaThreshold !== 1)),
        };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
}

export const effectMeta = {
  group: "Stylize",
  tags: ["grid", "monitor", "tv", "pattern"],
  description: "Creates a grid pattern.",
  backend: "gpu",
  canAnimate: true,
  realtimeSafe: true,
};
