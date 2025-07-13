import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendModeOpts, ColorspaceOpts, PosterizeModeOpts} from "../utils/glsl_enums.js";

const shaderPath = "../shaders/aberration.frag"
const includePaths = {
    'colorconvert.glsl': '../shaders/includes/colorconvert.glsl',
    'blend.glsl': '../shaders/includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Chromatic Aberration",

    defaultConfig: {
        BLENDMODE: 1,
        COLORSPACE: 0,
        blendAmount: 1,
        rdx: 0, rdy: 0,
        gdx: 0, gdy: 0,
        bdx: 0, bdy: 0
    },
    uiLayout: [
        {type: "modSlider", key: "rdx", label: "Channel 1 X", min: -50, max: 50, step: 1},
        {type: "modSlider", key: "rdy", label: "Channel 1 Y", min: -50, max: 50, step: 1},
        {type: "modSlider", key: "gdx", label: "Channel 2 X", min: -50, max: 50, step: 1},
        {type: "modSlider", key: "gdy", label: "Channel 2 Y", min: -50, max: 50, step: 1},
        {type: "modSlider", key: "bdx", label: "Channel 3 X", min: -50, max: 50, step: 1},
        {type: "modSlider", key: "bdy", label: "Channel 3 Y", min: -50, max: 50, step: 1},
        {
            key: 'colorSpace',
            label: 'Shift Colorspace',
            type: 'Select',
            options: ColorspaceOpts
        },
        {
            key: 'blendMode',
            label: 'Blend Mode',
            type: 'Select',
            options: BlendModeOpts
        },
        {key: 'blendAmount', label: 'Blend Amount', type: 'modSlider', min: 0, max: 1, step: 0.01},
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            blendAmount, colorSpace, blendMode, rdx, rdy,
            gdx, gdy, bdx, bdy
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_blendamount: {type: "float", value: blendAmount},
            u_resolution: {type: "vec2", value: [width, height]},
            u_shift0: {value: [rdx / width, rdy / height], "type": "vec2"},
            u_shift1: {value: [gdx / width, gdy / height], "type": "vec2"},
            u_shift2: {value: [bdx / width, bdy / height], "type": "vec2"},
        };
        const defines = {
            COLORSPACE: colorSpace,
            BLENDMODE: blendMode,
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
    tags: ["color", "shift", "displacement", "chromatic", "gpu"],
    description: "Shifts color channels independently, in selectable colorspaces," +
        "to create chromatic aberration, blur, and blend effect.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true
};