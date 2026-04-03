import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {morphPass} from "./layers/morph_pass.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, MorphEnum, MorphOpts} from "../utils/glsl_enums.js";

const shaderPath = "morphology.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl", "blend.glsl": "includes/blend.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

function makeMorphPass(id) {
    return {
        initHook: morphPass.initHook,
        cleanupHook: morphPass.cleanupHook,
        setupFBO: morphPass.setupFBO,
        calculate: morphPass.calculate,
        outputFBO: null,
        width: null,
        height: null,
        id: id
    }
}

function dilate(pass, input, width, height, seRadius, CHANNEL_MODE) {
    return pass.calculate(
        pass, input, width, height, seRadius, MorphEnum.DILATION, CHANNEL_MODE
    ).texture;
}

function erode(pass, input, width, height, seRadius, REDUCE_TO_GRAYSCALE) {
    return pass.calculate(
        pass, input, width, height, seRadius, MorphEnum.EROSION, REDUCE_TO_GRAYSCALE
    ).texture;
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Morphology",

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            BLENDMODE, COLORSPACE, blendAmount, BLEND_CHANNEL_MODE,
            operation, radius
        } = resolveAnimAll(instance.config, t);

        const opcode = Number(operation);
        let tex, SUBTRACT_MODE;
        let tex2 = null;
        if (opcode === MorphEnum.DILATION) {
            tex = dilate(instance.morphPass1, inputTex, width, height, radius, 1);
        } else if (opcode === MorphEnum.EROSION) {
            tex = erode(instance.morphPass1, inputTex, width, height, radius, 1);
        } else if (opcode === MorphEnum.OPENING || opcode === MorphEnum.TOP_HAT) {
            const eroded = erode(instance.morphPass1, inputTex, width, height, radius, 1);
            tex = dilate(instance.morphPass2, eroded, width, height, radius, 0);
        } else if (opcode === MorphEnum.CLOSING || opcode === MorphEnum.BLACK_HAT) {
            const dilated = dilate(instance.morphPass1, inputTex, width, height, radius, 1);
            tex = erode(instance.morphPass2, dilated, width, height, radius, 0);
        } else if (opcode === MorphEnum.GRADIENT) {
            tex = dilate(instance.morphPass1, inputTex, width, height, radius, 1);
            tex2 = erode(instance.morphPass2, inputTex, width, height, radius, 1);
        } else {
            throw new Error(`Unsupported operation code ${operation}`);
        }
        if (opcode === MorphEnum.TOP_HAT) {
            SUBTRACT_MODE = 1;
        } else if (opcode === MorphEnum.BLACK_HAT) {
            SUBTRACT_MODE = 2;
        } else if (opcode === MorphEnum.GRADIENT) {
            SUBTRACT_MODE = 3;
        } else {
            SUBTRACT_MODE = 0;
        }

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_morphology: {value: tex, type: "texture2D"},
            u_blendAmount: {value: blendAmount, type: "float"}
        }

        if (opcode === MorphEnum.GRADIENT) {
            // #defined out in other SUBTRACT_MODEs
            uniformSpec['u_morphology_2'] = {"value": tex2, "type": "texture2D"};
        }

        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            SUBTRACT_MODE: SUBTRACT_MODE
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },

    initHook: async (instance, renderer) => {
        await fragSources.load();
        instance.morphPass1 = makeMorphPass(`${instance.id}-morphPass1`);
        instance.morphPass2 = makeMorphPass(`${instance.id}-morphPass2`);
        await instance.morphPass1.initHook(instance.morphPass1, renderer);
        await instance.morphPass2.initHook(instance.morphPass2, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
        instance.morphPass1.cleanupHook(instance.morphPass1);
        instance.morphPass2.cleanupHook(instance.morphPass2);
    },
    glState: null,
    isGPU: true,
    pass: null,
    defaultConfig: {
        radius: 3,
        operation: MorphEnum.EROSION,
        blendAmount: 1.0,
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL
    },
    uiLayout: [
        {
            key: "radius",
            label: "Radius",
            type: "modSlider",
            min: 1,
            max: 10,
            step: 1,
        },
        {
            key: "operation",
            label: "Operation",
            type: "select",
            options: MorphOpts
        },
        blendControls()
    ]
}

export const effectMeta = {
  group: "Utility",
  tags: ["dilation", "erosion", "opening", "closing", "kernel"],
  description: "Morphological operators.",
  backend: "gpu",
  canAnimate: true,
  realtimeSafe: true,
  notInRandom: true
};
