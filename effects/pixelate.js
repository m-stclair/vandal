import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum} from "../utils/glsl_enums.js";

const shaderPath = "../shaders/pixelate.frag";
const includePaths = {
    'colorconvert.glsl': '../shaders/includes/colorconvert.glsl',
    'blend.glsl': '../shaders/includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @type {EffectModule} */
export default {
    name: "Pixelate",
    defaultConfig: {
        blockSize: 8,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        blendAmount: 1
    },
    uiLayout: [
        {type: 'modSlider', key: "blockSize", label: "Block Size", min: 1, max: 64, step: 1},
        blendControls()
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            blockSize, BLENDMODE, COLORSPACE, BLEND_CHANNEL_MODE, blendAmount
        } = resolveAnimAll(instance.config, t);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blocksize: {value: blockSize, type: "float"},
            u_blendamount: {value: blendAmount, type: "float"}
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
        };
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
    tags: ["pixel", "quantize", "gpu", "lofi"],
    description: "Reduces image resolution by averaging blocks of pixels, " +
        "producing a pixelated appearance. Block size can be animated.",
    canAnimate: true,
    realtimeSafe: true,
};