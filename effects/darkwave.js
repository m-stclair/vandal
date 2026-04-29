import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {blendControls, group} from "../utils/ui_configs.js";

const shaderPath = "darkwave.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Darkwave",
    defaultConfig: {
        threshold: 0.45,
        cycleMode: "shadow",
        hueShift: 0,
        saturation: 80,
        lightness: 20,
        hueSpread: 1.25,
        bleed: 0.15,
        shadowPower: 1.4,
        voidAmount: 0.35,
        falloff: 0.18,
        COLORSPACE: 0,
        BLENDMODE: 1,
        BLEND_CHANNEL_MODE: 0,
        blendAmount: 1,
        bandingSteps: 2,
        waveType: "tri",
        dutyCycle: 0.68,
        originX: 0.5,
        originY: 0.5,
        spatialPattern: "radial",
        bandHue: 0.72,
        paletteMode: "nocturne"
    },
    uiLayout: [
        {type: "modSlider", key: "threshold", label: "Shadow Gate", min: 0, max: 1, step: 0.01},

        {
            type: "select",
            key: "cycleMode",
            label: "Cycle Mode",
            options: ["hue", "shadow", "spatial"]
        },

        group("Hue Mapping", [
            {type: "modSlider", key: "hueShift", label: "Shift", min: 0, max: 2, step: 0.01},
            {
                type: "modSlider",
                key: "hueSpread",
                label: "Spread",
                min: 0,
                max: 10,
                steps: 200,
                scale: "log",
                scaleFactor: 3
            },
        ], {
            color: "#120018"
        }),

        group("Spatial Pattern", [
            {
                type: "Select",
                key: "spatialPattern",
                label: "Pattern",
                options: ["radial", "horizontal", "vertical", "diagonal", "angle", "checker", "sweep"]
            },
            {type: "modSlider", key: "originX", label: "X Origin", min: 0, max: 1, step: 0.01},
            {type: "modSlider", key: "originY", label: "Y Origin", min: 0, max: 1, step: 0.01}
        ], {
            showIf: {key: "cycleMode", equals: "spatial"},
            color: "#001018"
        }),

        group("Darkwave Controls", [
            {type: "range", key: "saturation", label: "Saturation", min: 0, max: 100, step: 1},
            {type: "range", key: "lightness", label: "Glow", min: 0, max: 100, step: 1},
            {type: "range", key: "falloff", label: "Falloff", min: 0.01, max: 0.75, step: 0.01},
            {type: "range", key: "shadowPower", label: "Depth", min: 0.25, max: 4, step: 0.01},
            {type: "range", key: "voidAmount", label: "Void", min: 0, max: 1, step: 0.01},
            {type: "range", key: "bleed", label: "Bleed", min: 0, max: 1, step: 0.01},
            {type: "modSlider", key: "bandHue", label: "Base Hue", min: 0, max: 1, steps: 100},
            {type: "select", key: "paletteMode", options: ["continuous", "nocturne", "ember", "spectral"],
             showIf: {"key": "waveType", "notEquals": "square"}}
        ], {color: "#08080f"}),

        group("Waveform Controls", [
            {type: "Select", key: "waveType", label: "Waveform", options: ["saw", "tri", "sine", "square"]},
            {type: "range", key: "bandingSteps", label: "Cuts", min: 0, max: 5, step: 1, showIf: {key: "waveType", notEquals: "square"}},
            {type: "range", key: "dutyCycle", label: "Duty Cycle", min: 0.01, max: 0.99, step: 0.01, showIf: {key: "waveType", notEquals: "sine"}},
        ], {color: "#180006"}),

        blendControls(),
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
            shadowPower,
            voidAmount,
            falloff,
            COLORSPACE,
            BLENDMODE,
            blendAmount,
            bandingSteps,
            waveType,
            dutyCycle,
            originX,
            originY,
            spatialPattern,
            BLEND_CHANNEL_MODE,
            bandHue,
            paletteMode
        } = resolveAnimAll(instance.config, t);

        let satNorm, lightNorm, shiftNorm, spreadNorm;
        const DARKWORLD_CYCLE = {"hue": 0, "shadow": 1, "spatial": 2}[cycleMode] ?? 1;
        if (DARKWORLD_CYCLE === 0) {
            satNorm = saturation / 100;
            lightNorm = lightness / 100;
            shiftNorm = hueShift;
            spreadNorm = ((hueSpread * 3) ** 0.4);
        } else if (DARKWORLD_CYCLE === 1) {
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
        const waveCode = {"saw": 0, "tri": 1, "sine": 2, "square": 3}[waveType] ?? 1;
        const patternCode = {
            "radial": 0, "horizontal": 1, "vertical": 2,
            "diagonal": 3, "angle": 4, "checker": 5, "sweep": 6
        }[spatialPattern];
        const paletteCode = {
            "continuous": 0, "nocturne": 1, "ember": 2, "spectral": 3
        }[paletteMode]
        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_blendamount: {type: "float", value: blendAmount},
            u_resolution: {type: "vec2", value: [width, height]},
            u_threshold: {type: "float", value: threshold},
            u_shiftNorm: {type: "float", value: shiftNorm},
            u_spreadNorm: {type: "float", value: spreadNorm},
            u_bleed: {type: "float", value: bleed},
            u_satNorm: {type: "float", value: satNorm},
            u_lightNorm: {type: "float", value: lightNorm},
            u_duty: {type: "float", value: dutyCycle},
            u_bandingSteps: {type: "float", value: bandingSteps},
            u_origin: {type: "vec2", value: [originX * width, originY * height]},
            u_baseHue: {type: "float", value: bandHue},
            u_shadowPower: {type: "float", value: shadowPower},
            u_voidAmount: {type: "float", value: voidAmount},
            u_falloff: {type: "float", value: falloff}
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            DARKWORLD_CYCLE: DARKWORLD_CYCLE,
            DARKWORLD_BLEED: Number(bleed > 0),
            USE_BANDING: Number(bandingSteps > 0),
            WAVETYPE: waveCode,
            SPATIAL_PATTERN: patternCode,
            PALETTE_MODE: paletteCode
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
    group: "Synthesis",
    tags: ["color", "synth", "shadow", "threshold", "nocturne"],
    description: "Modulates the dark parts of an image using a synthetic nocturne hue field. " +
        "Useful for cursed palettes, night-vision color maps, underpainted shadows, and negative-space glow.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        threshold: {min: 0.1, max: 0.75},
        saturation: {min: 45, max: 100},
        lightness: {min: 5, max: 35},
        voidAmount: {min: 0.1, max: 0.65}
    }
}
