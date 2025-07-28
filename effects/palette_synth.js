import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {paletteprobe} from "./probes/paletteprobe.js";
import {webGLState} from "../utils/webgl_state.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";

const shaderPath = "palette_synth.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

//
async function makeProbe(fx, renderer) {
    const prb = {
        config: structuredClone(paletteprobe.config),
        initHook: paletteprobe.initHook,
        parent: fx,
        glState: new webGLState(
            renderer, `${fx.name}-probe`, `${fx.id}-probe`
        ),
        analyze: paletteprobe.analyze
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
            paletteSize, cycleOffset, softness, blendK,
            lumaWeight, chromaWeight, hueWeight, BLENDMODE,
            COLORSPACE, BLEND_CHANNEL_MODE, assignMode, blendAmount,
            showPalette, selectWeights,
            chromaBoost, deltaL, gammaC,
            blockSize, seed
        } = resolveAnimAll(instance.config, t)
        const probe = instance.probe;
        const selectionWeights = {
            midtone: selectWeights[0],
            outlier: selectWeights[1],
            luma: selectWeights[2],
            hue: selectWeights[3],
        }
        let palette = probe.analyze(
            probe,
            inputTex,
            width,
            height,
            paletteSize / 3,
            deltaL,
            gammaC,
            blockSize,
            seed,
            selectionWeights
        );
        const MAX_SIZE = 256;
        const padded = new Float32Array(MAX_SIZE * 4);

        for (let i = 0; i < palette.length; i++) {
            padded[i * 4 + 0] = palette[i][0];
            padded[i * 4 + 1] = palette[i][1];
            padded[i * 4 + 2] = palette[i][2];
            padded[i * 4 + 3] = 0;
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
                    type: "modSlider",
                    key: "paletteSize",
                    label: "size",
                    min: 3,
                    max: 90,
                    step: 3
                },
                {
                    type: "range",
                    key: "deltaL",
                    label: "Tint/Shade Delta",
                    min: 1,
                    max: 60,
                    step: 0.5
                },
                {
                    type: "range",
                    key: "gammaC",
                    label: "Chroma Gamma",
                    min: 0.1,
                    max: 2,
                    step: 0.1
                },
                {
                    type: "range",
                    key: "blockSize",
                    label: "Sample Width",
                    min: 1,
                    max: 5,
                    step: 1
                },
                {
                    type: "range",
                    key: "seed",
                    label: "Seed",
                    min: 0,
                    max: 500,
                    step: 1
                },
                {
                    type: "vector",
                    key: "selectWeights",
                    label: "Selection Weights",
                    min: 0,
                    max: 5,
                    step: 0.1,
                    length: 4,
                    subLabels: ["midtone", "outlier", "luma", "hue"]
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
            type: "select",
            key: "assignMode",
            label: "Assignment Mode",
            options: ["nearest", "blend"]
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
        paletteSize: 15,
        deltaL: 30,
        gammaC: 1,
        cycleOffset: 0,
        softness: 1,
        blendK: 2,
        lumaWeight: 0.75,
        chromaWeight: 0.75,
        hueWeight: 0.25,
        selectWeights: [0, 0, 0.1, 0.2],
        assignMode: "blend",
        blendAmount: 1,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        showPalette: "none",
        chromaBoost: 1,
        blockSize: 3,
        seed: 1
    }
}

export const effectMeta = {
    group: "Color",
    tags: ["color", "gpu", "palette", "posterize"],
    description: "Highly configurable neoclassical posterization, controllable " +
        "on multiple perceptual axes, useful for everything from utilitarian " +
        "palette generation to brutal decimation to subtle lighting effects. ",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {"showPalette": {"always": "none"}}
};
