import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {pcaProbe} from "./probes/pcaprobe.js";
import {webGLState} from "../utils/webgl_state.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";

const shaderPath = "../shaders/palette_synth.frag";
const includePaths = {
    "colorconvert.glsl": "../shaders/includes/colorconvert.glsl",
    "blend.glsl": "../shaders/includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

//
async function makeProbe(fx, renderer) {
    const prb = {
        config: structuredClone(pcaProbe.config),
        initHook: pcaProbe.initHook,
        parent: fx,
        glState: new webGLState(
            renderer, `${fx.name}-probe`, `${fx.id}-probe`
        ),
        analyze: pcaProbe.analyze
    }
    await prb.initHook();
    fx.probe = prb;
}


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Palette Synth",

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            paletteSize, pWeights, cycleOffset, softness, blendK, useFurthest,
            lumaWeight, chromaWeight, hueWeight, BLENDMODE,
            COLORSPACE, BLEND_CHANNEL_MODE, assignMode, blendAmount,
            usePCA, showPalette, refinementStrategy, balanceParamVec,
            chromaBoost
        } = resolveAnimAll(instance.config, t)
        const balanceParams = {
            'chromaBoost': balanceParamVec[0],
            'contrast': balanceParamVec[1],
            'hueWarp': balanceParamVec[2],
            'balanceShift': balanceParamVec[3],
            'paletteGamma': balanceParamVec[4]
        }
        let pSize = Math.floor(paletteSize);  // just sanitizing
        const probe = instance.probe;
        let {pca, palette} = probe.analyze(
            probe,
            inputTex,
            width,
            height,
            // NOTE: this is _target_ size. could end up smaller if there
            // are lots of empty bins.
            pSize,
            pWeights,
            useFurthest,
            refinementStrategy,
            usePCA,
            balanceParams
        );
        palette = palette.slice(0, paletteSize);
        const MAX_SIZE = 256;
        const padded = new Float32Array(MAX_SIZE * 4);

        for (let i = 0; i < palette.length; i++) {
            padded[i * 4 + 0] = palette[i][0];
            padded[i * 4 + 1] = palette[i][1];
            padded[i * 4 + 2] = palette[i][2];
            padded[i * 4 + 3] = palette[i][3];  // 'bin' weight
        }

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            PaletteBlock: {value: padded, type: "UBO"},
            u_paletteSize: {value: palette.length, type: "int"},
            u_cycleOffset: {value: cycleOffset, type: "int"},
            u_softness: {value: softness, type: "float"},
            u_blendK: {value: blendK, type: "int"},
            u_lumaWeight: {value: lumaWeight, type: "float"},
            u_chromaWeight: {value: chromaWeight, type: "float"},
            u_hueWeight: {value: hueWeight, type: "float"},
            u_blendAmount: {value: blendAmount, type: "float"},
            u_chromaBoost: {type: "float", value: chromaBoost},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            ASSIGNMODE: {"nearest": 0, "hue": 1, "blend": 2}[assignMode],
            SHOW_PALETTE: {"none": 0, "bars": 1, "strip": 2}[showPalette]
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },

    async initHook(fx, renderer) {
        await fragSources.load();
        await makeProbe(fx, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            label: "Palette Generation",
            collapsed: false,
            children: [
                {
                    type: "range",
                    key: "paletteSize",
                    label: "size",
                    min: 2,
                    max: 60,
                    step: 1
                },
                {
                    type: "select",
                    key: "refinementStrategy",
                    label: "Refinement Strategy",
                    options: ["none", "k-means", "merge"]
                },
                {
                    type: "checkbox",
                    key: "useFurthest",
                    label: "Spread"
                },
                {
                    type: "checkbox",
                    key: "usePCA",
                    label: "PCA"
                },
                {
                    type: "select",
                    key: "showPalette",
                    label: "Show Palette",
                    options: ["none", "strip", "bars"]
                },
            ]
        },
        {
            type: "group",
            label: "Palette Balance",
            kind: "collapse",
            children: [
                {
                    type: "vector",
                    length: 5,
                    key: "balanceParamVec",
                    label: "Adjustments",
                    subLabels: ["chroma", "contrast", "hue", "shift", "gamma"],
                    min: 0,
                    max: 3,
                    step: 0.01
                },
                {
                    key: "pWeights",
                    label: "Weights",
                    type: "vector",
                    subLabels: ["Luma", "Chroma", "Hue"],
                    min: 0,
                    max: 3,
                    step: 0.01,
                },
            ]
        },
        {
            type: "select",
            key: "assignMode",
            label: "Assignment Mode",
            options: ["nearest", "hue", "blend"]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Perceptual Weights",
            showIf: {key: "assignMode", notEquals: "hue"},
            children: [
                {
                    type: "modSlider",
                    key: "lumaWeight",
                    label: "Luma",
                    min: -1,
                    max: 3,
                    step: 0.01
                },
                {
                    type: "modSlider",
                    key: "chromaWeight",
                    label: "Chroma",
                    min: -1,
                    max: 3,
                    step: 0.01
                },
                {
                    type: "modSlider",
                    key: "hueWeight",
                    label: "Hue",
                    min: -1,
                    max: 3,
                    step: 0.01
                },
            ]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Palette Blending",
            showIf: {key: "assignMode", equals: "blend"},
            children: [
                {
                    type: "modSlider",
                    key: "blendK",
                    label: "Width",
                    min: 1,
                    max: 5,
                    step: 1
                },
                {
                    type: "modSlider",
                    key: "softness",
                    label: "Softness",
                    min: 0.5,
                    max: 4,
                    step: 0.05
                },
            ]
        },
        blendControls(),
        {
            type: "modSlider",
            key: "cycleOffset",
            label: "Cycle",
            min: 0,
            max: 100,
            step: 1
        },

    ],
    defaultConfig: {
        paletteSize: 14,
        pWeights: [1, 1, 1],
        cycleOffset: 0,
        softness: 1,
        blendK: 2,
        lumaWeight: 0.5,
        chromaWeight: 1,
        hueWeight: 0.5,
        useFurthest: true,
        usePCA: false,
        assignMode: "blend",
        blendAmount: 1,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        showPalette: "none",
        balanceParamVec: [1, 1, 0, 0, 1],
        refinementStrategy: "k-means",
        chromaBoost: 1
    }
}

export const effectMeta = {
    group: "Color",
    tags: ["color", "gpu", "pallette", "posterize"],
    description: "Highly configurable neoclassical posterization, controllable " +
        "on multiple perceptual axes, useful for everything from utilitarian " +
        "palette generation to brutal decimation to subtle lighting effects. ",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {"showPalette": {"always": "none"}}
};
