import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendModeOpts, BlendTargetOpts, ColorspaceOpts} from "../utils/glsl_enums.js";

const shaderPath = "../shaders/chromawave.frag"
const includePaths = {
    'colorconvert.glsl': '../shaders/includes/colorconvert.glsl',
    'blend.glsl': '../shaders/includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Chromawave",
    defaultConfig: {
        threshold: 0.45,
        cycle: true,
        cycleMode: "spatial",
        hueShift: 180,
        saturation: 100,
        lightness: 50,
        hueSpread: 1,
        bleed: 0,
        COLORSPACE: 0,
        BLENDMODE: 1,
        blendAmount: 1,
        bandingSteps: 0,
        waveType: 0,
        dutyCycle: 0.5,
        originX: 0.5,
        originY: 0.5,
        spatialPattern: "radial",
        blendTarget: '0'

    },
    uiLayout: [
        {type: "modSlider", key: "threshold", label: "Threshold", min: 0, max: 1, step: 0.01},
        {type: "select", key: "cycleMode", label: "Cycle Mode", options: ["hue", "luma", "spatial"]},
        {type: "modSlider", key: "hueShift", label: "Hue Shift", min: 0, max: 2, step: 0.01},
        {type: "modSlider", key: "hueSpread", label: "Hue Spread", min: 0, max: 4, step: 0.05},
        {type: "range", key: "saturation", label: "Saturation", min: 0, max: 100, step: 1},
        {type: "range", key: "lightness", label: "Lightness", min: 0, max: 100, step: 1},
        {type: "range", key: "bleed", label: "Bleed", min: 0, max: 1, step: 0.01},
        {type: "Select", key: "waveType", label: "Waveform", options: ["saw", "tri", "sine", "square"]},
        {type: "range", key: "bandingSteps", label: "Bands", min: 0, max: 5, step: 1},
        {type: "range", key: "dutyCycle", label: "Duty Cycle", min: 0.01, max: 0.99, step: 0.01},
        {key: 'blendAmount', label: 'Blend Amount', type: 'modSlider', min: 0, max: 1, step: 0.01},
        {
            key: 'COLORSPACE',
            label: 'Colorspace',
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
            key: 'blendTarget',
            label: 'Blend Target',
            type: 'Select',
            options: BlendTargetOpts
        },
        {type: "Select", key: "spatialPattern", label: "Spatial Pattern", options: ["radial", "horizontal", "vertical", "diagonal", "angle", "checker"]},
        {type: "range", key: "originX", label: "X Origin", min: 0, max: 1, step: 0.01},
        {type: "range", key: "originY", label: "Y Origin", min: 0, max: 1, step: 0.01},
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            saturation,
            lightness,
            cycleMode,
            hueShift,
            hueSpread,
            threshold,
            bleed,
            COLORSPACE,
            BLENDMODE,
            blendAmount,
            bandingSteps,
            waveType,
            dutyCycle,
            originX,
            originY,
            spatialPattern,
            blendTarget
        } = resolveAnimAll(instance.config, t);

        let satNorm, lightNorm, shiftNorm, spreadNorm, period;
        const CHROMAWAVE_CYCLE = {"hue": 0, "luma": 1, "spatial": 2}[cycleMode];
        if (CHROMAWAVE_CYCLE === 0) {
            satNorm = saturation / 100;
            lightNorm = lightness / 100;
            shiftNorm = hueShift;
            spreadNorm = ((hueSpread * 3) ** 0.4);
        } else if (CHROMAWAVE_CYCLE === 1) {
            satNorm = saturation / 100;
            lightNorm = lightness / 100;
            shiftNorm = (hueShift / 4) ** 0.7;
            spreadNorm = (hueSpread / 2) ** 0.5;
        } else {
            satNorm = saturation / 100;
            lightNorm = lightness / 100;
            shiftNorm = hueShift / 2;
            spreadNorm = (hueSpread * 2) ** 0.8;
        }
        const waveCode = {"saw": 0, "tri": 1, "sine": 2, "square": 3}[waveType]
        const patternCode = {
            "radial": 0, "horizontal": 1, "vertical": 2,
            "diagonal": 3, "angle": 4, "checker": 5
        }[spatialPattern];
        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_blendamount: {type: "float", value: blendAmount},
            u_resolution: {type: "vec2", value: [width, height]},
            u_threshold: {type: "float", value: threshold},
            u_shiftNorm: {type: "float", value: shiftNorm},
            u_spreadNorm: {type: "float", value: spreadNorm},
            u_period: {type: "float", value: period},
            u_bleed: {type: "float", value: bleed},
            u_satNorm: {type: "float", value: satNorm},
            u_lightNorm: {type: "float", value: lightNorm},
            u_duty: {type: "float", value: dutyCycle},
            u_bandingSteps: {type: "float", value: bandingSteps},
            u_origin: {type: "vec2", value: [originX * width, originY * height]}
        };
        const defines = {
            COLORSPACE:COLORSPACE,
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: blendTarget,
            CHROMAWAVE_CYCLE: CHROMAWAVE_CYCLE,
            CHROMAWAVE_BLEED: Number(bleed > 0),
            USE_BANDING: Number(bandingSteps > 0),
            WAVETYPE: waveCode,
            SPATIAL_PATTERN: patternCode
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
  group: "Edge",
  tags: ["edges", "masking", "outline", "threshold"],
  description: "Simple edge tracing via Sobel operator. Offers blend and " +
      + "threshold control.",
  backend: "gpu",
  animated: true,
  realtimeSafe: true,
}