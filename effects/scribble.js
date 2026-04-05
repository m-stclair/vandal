import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "scribble.frag";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Scribble",
    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        steps: 5,
        cellScale: 3,
        strokeWidth: 1,
        arcLength: 1,
        shadeLow: 0,
        shadeHigh: 0.5,
        falloff: 0.2,
        blendAmount: 1.0,
        paperOpacity: 1.0,
        scribbleOpacity: 1.0,
        paperColor: [0.96, 0.95, 0.92],
        scribbleColor: [0.03, 0.03, 0.03],
        jitter: 0.1
    },
    uiLayout: [
        {
            key: "cellScale",
            label: "Cell Scale",
            type: "modSlider",
            min: 1,
            max: 10,
            step: 0.1
        },
        {
            key: "strokeWidth",
            label: "Stroke Width",
            type: "modSlider",
            min: 0.5,
            max: 2.5,
            step: 0.1
        },
        {
            key: 'arcLength',
            label: 'Arc Length',
            type: 'modSlider',
            min: 0.3,
            max: 5,
            step: 0.1
        },
        {
            key: 'shadeLow',
            label: 'Low Cutoff',
            type: 'modSlider',
            min: 0,
            max: 1,
            step: 0.01
        },
        {
            key: 'shadeHigh',
            label: 'High Cutoff',
            type: 'modSlider',
            min: 0,
            max: 1,
            step: 0.01
        },
        {
            key: 'falloff',
            label: 'Layer Falloff',
            type: 'modSlider',
            min: 0,
            max: 1,
            step: 0.01
        },
        {
            key: 'jitter',
            label: 'Arc Jitter',
            type: 'modSlider',
            min: 0,
            max: 6,
            step: 0.05
        },
        {
            key: "scribbleOpacity",
            label: "Scribble Opacity",
            type: "modSlider",
            min: 0,
            max: 1,
            steps: 100
        },
        {
            key: "paperOpacity",
            label: "Paper Opacity",
            type: "modSlider",
            min: 0,
            max: 1,
            steps: 100
        },
        {
            key: 'scribbleColor',
            label: 'Scribble Color',
            type: 'vector',
            subLabels: ['R', 'G', 'B'],
            min: 0,
            max: 1,
            step: 0.01
        },
        {
            key: 'paperColor',
            label: 'Paper Color',
            type: 'vector',
            subLabels: ['R', 'G', 'B'],
            min: 0,
            max: 1,
            step: 0.01
        },
        blendControls()
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        let {
            cellScale, strokeWidth, arcLength, shadeLow, shadeHigh,
            scribbleColor, paperColor, scribbleOpacity, paperOpacity,
            falloff, jitter,
            blendAmount, BLENDMODE, COLORSPACE, BLEND_CHANNEL_MODE
        } = resolveAnimAll(instance.config, t);

        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_cellScale: {type: "float", value: cellScale},
            u_strokeWidth: {type: "float", value: strokeWidth},
            u_arcLength: {type: "float", value: arcLength},
            u_shadeLow: {type: "float", value: shadeLow},
            u_shadeHigh: {type: "float", value: shadeHigh},
            u_falloff: {type: "float", value: falloff},
            u_jitter: {type: "float", value: jitter},
            u_scribbleColor: {type: "vec3", value: scribbleColor},
            u_blendAmount: {type: "float", value: blendAmount},
            u_paperOpacity: {type: "float", value: paperOpacity},
            u_scribbleOpacity: {type: "float", value: scribbleOpacity},
            u_paperColor: {type: "vec3", value: paperColor}
        };

        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
        };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: async (instance, renderer) => {
        await fragSources.load(instance, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
};

export const effectMeta = {
    group: "Stylize",
    tags: ["pencil", "line", "drawn"],
    description: "Shading via small arcs. Effects ranging from sketchlike to Xerox",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        scribbleColor: {"always": [0, 0, 0]},
        paperColor: {"always": [0.96, 0.95, 0.92]},
        scribbleOpacity: {"always": 1.0},
        blendAmount: {min: 0.75, max: 1},
        shadeLow: {min: 0, max: 0.2},
        shadeHigh: {min: 0.3, max: 1}
    }
};
