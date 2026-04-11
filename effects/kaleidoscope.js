import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, hasChromaBoostImplementation
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "kaleidoscope.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Kaleidoscope",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        mirrors: 3,
        reflections: 3,
        tubeLength: 0.5,
        magnification: 1,
    },
    uiLayout: [
       {
           type: "modSlider",
           key: "mirrors",
           label: "Mirrors",
           min: 2,
           max: 10,
           step: 1
       },
        {
            type: "modSlider",
            key: "reflections",
            label: "Reflections",
            min: 1,
            max: 10,
            step: 1
        },
        {
            type: "modSlider",
            key: "tubeLength",
            label: "Tube Length",
            min: 0.01,
            max: 1,
            steps: 100,
        },
        {
            type: "modSlider",
            key: "magnification",
            label: "Magnification",
            min: 0.1,
            max: 3,
            steps: 100
        },
        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            blendAmount, COLORSPACE, BLENDMODE, BLEND_CHANNEL_MODE,
            magnification, mirrors, tubeLength, reflections
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {type: "float", value: blendAmount},
            u_reflections: {type: "float", value: reflections},
            u_tube_length: {type: "float", value: tubeLength},
            u_mirrors: {type: "float", value: mirrors},
            u_magnification: {type: "float", value: magnification},
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
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
    group: "Stylize",
    tags: ["optical"],
    description: "Applies shaped noise, flicker, and tear. Can simulate " +
        "VHS dropout, NTSC hash, CRT raster offset, and failing analog broadcasts.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true
};