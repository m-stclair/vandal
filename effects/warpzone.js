import {cmapLuts, colormaps, LUTSIZE} from "../utils/colormaps.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendOpts, BlendTargetOpts, ColorspaceIndices, ColorspaceOpts} from "../utils/glsl_enums.js";

const shaderPath = "../shaders/warpzone.glsl";
const includePaths = {
    "psrdnoise2.glsl": "../shaders/includes/psrdnoise2.glsl",
    "colorconvert.glsl": "../shaders/includes/colorconvert.glsl",
    "blend.glsl": "../shaders/includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Warp Zone",

    defaultConfig: {
        COLORSPACE: ColorspaceIndices.RGB,
        BLENDMODE: '1',
        blendAmount: 1,
        BLEND_CHANNEL_MODE: '0',
        DEBUG_MASK: false,
        ZONESHAPE: "radial",
        zoneCX: 0.5,
        zoneSX: 0.6,
        zoneCY: 0.5,
        zoneSY: 0.6,
        zoneSoftness: 0.1,
        zoneFalloff: 0.1,
        WARPMODE: "lens",
        paramA: 0,
        paramB: 0,
        warpStrength: 25,
        PREBLEND_WARP_CHANNEL: 2,
        WARPDRIVE_COLORSPACE: 6,
        WARPDRIVE_MODE: 0,
        WARPDRIVE_CHANNEL: 2,
        zoneAngle: 0,
        warpAngle: 0,

    },
    uiLayout: [
        {type: "range", key: "zoneCX", label: "Zone Center X", min: 0, max: 1, steps: 200},
        {type: "range", key: "zoneSX", label: "Zone Scale X", min: 0, max: 1, steps: 200},
        {type: "range", key: "zoneCY", label: "Zone Center Y", min: 0, max: 1, steps: 200},
        {type: "range", key: "zoneSY", label: "Zone Scale Y", min: 0, max: 1, steps: 200},
        {type: "range", key: "zoneSoftness", label: "Zone Softness", min: 0, max: 1, steps: 200},
        {type: "range", key: "zoneFalloff", label: "Zone Falloff (radial only)", min: 0.01, max: 1, steps: 200},
        {type: "modSlider", key: "zoneAngle", label: "Zone Angle", min: 0, max: Math.PI * 2, steps: 200},
        {type: "modSlider", key: "warpAngle", label: "Warp Angle", min: 0, max: Math.PI * 2, steps: 200},
        {
            type: "select",
            key: "ZONESHAPE",
            label: "Zone Shape",
            options: ["box", "vertical", "radial", "horizontal"]
        },
        {
            type: "modSlider",
            key: "warpStrength",
            label: "Warp Strength",
            min: -100,
            max: 100,
            steps: 200,
        },
        {key: 'paramA', label: 'Warp Parameter 1', type: 'modSlider', min: 0, max: 1, steps: 200},
        {
            type: "select",
            key: "WARPMODE",
            label: "Warp Mode",
            options: ["shift", "sine", "noise", "lens"]
        },
        {type: "checkbox", key: "DEBUG_MASK", label: "Debug Mask"},
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
            options: BlendOpts
        },
        {
            key: 'BLEND_CHANNEL_MODE',
            label: 'Blend Target',
            type: 'Select',
            options: BlendTargetOpts
        },
        {
            key: 'WARPDRIVE_MODE',
            label: 'Warpdrive Mode',
            type: 'Select',
            options: [{'label': 'none', 'value': 0}, {'label': 'channeldrive', 'value': 1}]
        },
        {
            key: 'WARPDRIVE_COLORSPACE',
            label: 'Warpdrive Colorspace',
            type: 'Select',
            // TODO: ugly
            options: [
                {'label': 'RGB', 'value': ColorspaceIndices.RGB},
                {'label': 'LCH', 'value': ColorspaceIndices.LCH},
                {'label': 'HSL', 'value': ColorspaceIndices.HSL}
            ]
        },
        {
            key: 'WARPDRIVE_CHANNEL',
            label: 'Warpdrive Channel',
            type: 'Select',
            options: [{'label': '1', 'value': 0}, {'label': '2', 'value': 1}, {'label': '3', 'value': 2}]
        },
        {key: 'paramB', label: 'Preblend Color Warp', type: 'modSlider', min: 0, max: 1, steps: 200},
        {
            key: 'PREBLEND_WARP_CHANNEL',
            label: 'Preblend Color Warp Channel',
            type: 'Select',
            options: [{'label': 'Chroma', 'value': 1}, {'label': 'Hue', 'value': 2}]
        }
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            BLENDMODE, COLORSPACE, BLEND_CHANNEL_MODE, blendAmount,
            ZONESHAPE, zoneCX, zoneSX, zoneCY, zoneSY,
            zoneSoftness, zoneFalloff, DEBUG_MASK, paramA, WARPMODE,
            warpStrength, WARPDRIVE_CHANNEL, WARPDRIVE_COLORSPACE,
            WARPDRIVE_MODE, PREBLEND_WARP_CHANNEL, paramB, warpAngle,
            zoneAngle
        } = resolveAnimAll(instance.config, t);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {value: blendAmount, type: "float"},
            u_zoneSoftness: {value: zoneSoftness, type: "float"},
            u_zoneFalloffGamma: {value: zoneFalloff, type: "float"},
            u_zoneMin: {value: [zoneCX - zoneSX / 2, zoneCY - zoneSY / 2], type: "vec2"},
            u_zoneMax: {value: [zoneCX + zoneSX / 2, zoneCY + zoneSY / 2], type: "vec2"},
            u_param_a: {value: paramA, type: "float"},
            u_param_b: {value: paramB, type: "float"},
            u_warpStrength: {value: warpStrength, type: "float"},
            u_warpAngle: {value: warpAngle, type: "float"},
            u_zoneAngle: {value: zoneAngle, type: "float"},
        };

        const shapeCode = {
            "box": 0, "vertical": 1, "radial": 2, "horizontal": 3
        }[ZONESHAPE];
        const warpCode = {
            "shift": 0, "sine": 1, "noise": 2, "lens": 3
        }[WARPMODE];
        const defines = {
            COLORSPACE: Number.parseInt(COLORSPACE),
            BLENDMODE: Number.parseInt(BLENDMODE),
            BLEND_CHANNEL_MODE: Number.parseInt(BLEND_CHANNEL_MODE),
            ZONESHAPE: shapeCode,
            DEBUG_MASK: Number(DEBUG_MASK),
            WARPMODE: warpCode,
            WARPDRIVE_MODE: WARPDRIVE_MODE,
            WARPDRIVE_COLORSPACE: WARPDRIVE_COLORSPACE,
            WARPDRIVE_CHANNEL: WARPDRIVE_CHANNEL,
            PREBLEND_WARP_CHANNEL: PREBLEND_WARP_CHANNEL,
            PREBLEND_CHANNEL_WARP: Number(paramB > 0),
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
    group: "Geometry",
    tags: ["mask", "shape", "warp"],
    description: "Applies a spatially-bounded warping mask.",
    canAnimate: true,
    realtimeSafe: true,
};
