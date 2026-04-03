import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "noop.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl", "blend.glsl": "includes/blend.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "No-op",
    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
    },
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            blendAmount, BLENDMODE, BLEND_CHANNEL_MODE, COLORSPACE
        } = resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_blendAmount: {value: blendAmount, type: "float"},
        }
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
    uiLayout: [blendControls()]

}

export const effectMeta = {
    group: "Utility",
    tags: [],
    description: "Does nothing on its own, but offers access to the blend " +
        "system. Intended for blending an image back into itself in various ways.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    notInRandom: true,
};
