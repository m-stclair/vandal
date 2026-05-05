import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {paletteprobe} from "./probes/paletteprobe.js";
import {webGLState} from "../utils/webgl_state.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum} from "../utils/glsl_enums.js";
import {lab2Rgb, linear2SRGB} from "../utils/colorutils.js";
import {preprocessPalette, sortPalette} from "../utils/paletteutils.js";

function exportPalette(_config, _k, _e, instance) {
  if (!instance.auxiliaryCache?.lastPalette) return;
  const palette = instance.auxiliaryCache.lastPalette;
  const canvas = document.createElement("canvas");
  canvas.width = palette.length;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(palette.length, 1);

  // `palette` is a nested array like [[L, a, b_], [L, a, b_]],
  // with L, a, b in CIELAB units.
  for (let i = 0; i < palette.length; i++) {
      const L = palette[i][0] / 100;
      const a = (palette[i][1] + 128) / 255;
      const b_ = (palette[i][2] + 128) / 255;
      const [r, g, b] = lab2Rgb(L, a, b_).map((c) => Math.round(linear2SRGB(c) * 255));
      imageData.data.set([r, g, b, 255], i * 4);
  }
  ctx.putImageData(imageData, 0, 0);
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lut.png";
    link.click();
    URL.revokeObjectURL(url);
  });
}

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
            deltaL, gammaC, freeze,
            blockSize, seed, minDistance, CYCLE_MODE, sortMode
        } = resolveAnimAll(instance.config, t)

        let palette, paletteBlock, paletteFeatures;

        let paletteSettings = String([paletteSize, selectWeights, seed,
                                      minDistance, deltaL, gammaC, blockSize, sortMode]);
        if (
            freeze
            && instance.auxiliaryCache.lastPalette
            && paletteSettings === instance.auxiliaryCache.lastPaletteSettings
        ) {
            palette = instance.auxiliaryCache.lastPalette;
            paletteBlock = instance.auxiliaryCache.lastPaletteBlock;
            paletteFeatures = instance.auxiliaryCache.lastPaletteFeatures;
        } else {
            const probe = instance.probe;
            const selectionWeights = {
                midtone: selectWeights[0],
                outlier: selectWeights[1],
                chroma: selectWeights[2],
            };
            const safePaletteSize = Math.min(
                126,
                paletteSize >= 3 ? Math.round(paletteSize / 3) * 3 : 3
            );
            palette = probe.analyze(
                probe,
                inputTex,
                width,
                height,
                safePaletteSize / 3,
                deltaL,
                gammaC,
                blockSize,
                seed,
                selectionWeights,
                minDistance
            );
            palette = sortPalette(palette, sortMode);

            let procResult = preprocessPalette(palette);
            paletteBlock = procResult['paletteBlock']
            paletteFeatures = procResult['paletteFeatures']

            instance.auxiliaryCache.lastPalette = palette;
            instance.auxiliaryCache.lastPaletteBlock = paletteBlock;
            instance.auxiliaryCache.lastPaletteFeatures = paletteFeatures;
        }
        instance.auxiliaryCache.lastPaletteSettings = paletteSettings;
        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            PaletteFeatures: {value: paletteFeatures, type: "UBO", binding: 0},
            PaletteBlock: {value: paletteBlock, type: "UBO", binding: 1},
            u_paletteSize: {value: palette.length, type: "int"},
            u_cycleOffset: {value: cycleOffset, type: "int"},
            u_softness: {value: softness, type: "float"},
            u_blendK: {value: blendK < 1 ? 1 : Math.floor(blendK), type: "int"},
            u_lumaWeight: {value: lumaWeight >= 0 ? lumaWeight : 0, type: "float"},
            u_chromaWeight: {value: chromaWeight >= 0 ? chromaWeight : 0, type: "float"},
            u_hueWeight: {value: hueWeight >= 0 ? hueWeight : 0, type: "float"},
            u_blendAmount: {value: blendAmount, type: "float"},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            ASSIGNMODE: {"nearest": 0, "blend": 1}[assignMode],
            SHOW_PALETTE: {"none": 0, "strip": 1}[showPalette],
            CYCLE_MODE: CYCLE_MODE
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },

    async initHook(fx, renderer) {
        await fragSources.load();
        await makeProbe(fx, renderer);
        fx.auxiliaryCache = {};
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
                    max: 42,
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
                    min: 1,
                    max: 500,
                    step: 1
                },
                {
                    type: "vector",
                    key: "selectWeights",
                    label: "Selection Weights",
                    min: 0,
                    max: 1.5,
                    step: 0.1,
                    length: 3,
                    subLabels: ["midtone", "outlier", "chroma"]
                },
                {
                    type: "range",
                    key: "minDistance",
                    label: "Min Distance",
                    min: 1,
                    max: 30,
                    step: 1
                },
                {
                    type: "select",
                    key: "showPalette",
                    label: "Show Palette",
                    options: ["none", "strip"]
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
            children: [
                {
                    type: "modSlider",
                    key: "lumaWeight",
                    label: "Luma",
                    min: 0,
                    max: 3,
                    step: 0.01
                },
                {
                    type: "modSlider",
                    key: "chromaWeight",
                    label: "Chroma",
                    min: 0,
                    max: 3,
                    step: 0.01
                },
                {
                    type: "modSlider",
                    key: "hueWeight",
                    label: "Hue",
                    min: 0,
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
        {
            type: "checkbox",
            key: "freeze",
            label: "Freeze"
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
        {
            type: "select",
            key: "sortMode",
            label: "Sort",
            options: [
                {"label": "Lightness", value: "lightness"},
                {"label": "Variant Bands", value: "variantBands"},
                {"label": "Hue Families", value: "hueFamilies"},
                {"label": "LAB Walk", value: "labWalk"}
            ]
        },
        {
            type: "select",
            key: "CYCLE_MODE",
            label: "Cycle Region",
            options: [
                {"label": "global", value: 0},
                {"label": "thirds", value: 1},
                {"label": "middle band", value: 2},
                {"label": "high band", value: 3},
                {"label": "low band", value: 4}
            ],
        },
        {
            type: 'button',
            key: 'exportPalette',
            label: "Export Palette",
            func: exportPalette
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
        selectWeights: [0.25, 0.5, 0.1],
        minDistance: 18,
        assignMode: "blend",
        blendAmount: 1,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        showPalette: "none",
        sortMode: "lightness",
        chromaBoost: 1,
        blockSize: 3,
        seed: 1,
        freeze: false,
        CYCLE_MODE: 0
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
    parameterHints: {
        BLEND_CHANNEL_MODE: {"always": BlendTargetEnum.ALL},
        showPalette: {"always": "none"},
        cycleOffset: {"min": 0, "max": 0, "aniMin": 0, "aniMax": 100},
        gammaC: {"min": 0.8, "max": 1.2},
        minDistance: {"min": 12, "max": 30}
    },
    fullOpacityChance: 0.8
};