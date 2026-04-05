import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, CalcModeEnum, ColorspaceEnum, MorphEnum} from "../utils/glsl_enums.js";
import {calcPass} from "./probes/calcpass.js";

const shaderPath = "edgetrace.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Edge Trace",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        threshold: 0.35,
        tint: [1, 1, 1],
        baseOpacity: 0,
        dilation: 0,
        smoothing: 0,
        softness: 0
    },
    uiLayout: [
        {type: "modSlider", key: "threshold", label: "Thresh", min: 0, max: 1, step: 0.01},
        {type: "modSlider", key: "softness", label: "Softness", min: 0, max: 1, step: 0.01},
        {type: "modSlider", key: "dilation", label: "Dilation", min: 0, max: 6, step: 1},
        {type: "modSlider", key: "smoothing", label: "Smoothing", min: 0, max: 6, step: 1},
        {type: "modSlider", key: "baseOpacity", label: "Base Opacity", min: 0, max: 1, step: 0.01},
        {
            key: "tint",
            label: "Tint",
            type: "vector",
            subLabels: ["R", "G", "B"],
            min: 0,
            max: 1,
            step: 0.01,
        },
        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            blendAmount, COLORSPACE, BLENDMODE, BLEND_CHANNEL_MODE, threshold, tint,
            baseOpacity, dilation, smoothing, softness
        } = resolveAnimAll(config, t);

        const sobelFBO = instance.calcPass.calculate(
            instance.calcPass,
            inputTex,
            width,
            height,
            1,
            1,
            CalcModeEnum.SOBEL,
            Boolean(smoothing > 0),
            smoothing,
            Boolean(dilation > 0),
            dilation,
            MorphEnum.DILATION
        );
        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_blendamount: {type: "float", value: blendAmount},
            u_resolution: {type: "vec2", value: [width, height]},
            u_threshold: {type: "float", value: threshold},
            u_softness: {type: "float", value: softness},
            u_tint: {type: "vec3", value: tint},
            u_baseOpacity: {type: "float", value: baseOpacity},
            u_sobel: {type: "texture2D", value: sobelFBO.texture}
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            BLENDMODE: BLENDMODE
        }
        instance.glState.renderGL(inputTex, outputFBO, uniforms, defines);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
        instance.calcPass.cleanupHook(instance.calcPass);
    },
    initHook: async(instance, renderer) => {
        await fragSources.load();
        instance.calcPass = {
            initHook: calcPass.initHook,
            cleanupHook: calcPass.cleanupHook,
            setupFBO: calcPass.setupFBO,
            calculate: calcPass.calculate,
            outputFBO: null,
            width: null,
            height: null,
            id: `${instance.id}-calc-pass`
        }
        await instance.calcPass.initHook(instance.calcPass, renderer);
    },
    glState: null,
    isGPU: true
}

export const effectMeta = {
    group: "Edge",
    tags: ["edges", "masking", "outline", "threshold"],
    description: "Simple edge tracing via Sobel operator. Offers various smoothing, threshold, " +
        "and blending controls.",
    backend: "gpu",
    parameterHints:{
        "dilation": {min: 0, max: 2},
        "smoothing": {min: 0, max: 3},
        "threshold": {min: 0.08, max: 0.5}
    },
    canAnimate: true,
    realtimeSafe: true,
}