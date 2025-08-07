import {cmapLuts, colormaps, LUTSIZE, resampleLut} from "../utils/colormaps.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";
import {rgb2Lab, sRGB2Linear} from "../utils/colorutils.js";

const shaderPath = "palette_synth.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


function importLut(config, _emptyVal, e, fx, requestRender, requestUIDraw) {
    let file;
    if (!(e instanceof File)) {
        file = e.target.files[0];
    } else {
        file = e;
    }
    if (!file) return;
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, 1).data;
        const lutArr = resampleLut(data, "nearest", img.width);
        cmapLuts[file.name.replace(/\..+$/, '')] = lutArr;
        config['lut'] = file.name.replace(/\..+$/, '');
        fx.auxiliaryCache.lastLut = null;
        requestRender();
        requestUIDraw();
    }
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Apply Lut",
    defaultConfig: {
        lut: "grayscale",
        chromaBoost: 1,
        blendAmount: 1,
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        softness: 1,
        blendK: 2,
        lumaWeight: 0.75,
        chromaWeight: 0.75,
        hueWeight: 0.25,
        showPalette: "none",
        assignMode: "blend",
        cycleOffset: 0
    },
    uiLayout: [
        {
            type: "select",
            key: "lut",
            label: "Lut",
            get options() {
                return Object.keys(cmapLuts);
            }
        },
        {
            type: "button",
            key: "importLut",
            label: "Import Lut",
            func: importLut,
            inputType: "file"
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
                    min: -0.2,
                    max: 3,
                    step: 0.01
                },
                {
                    type: "modSlider",
                    key: "chromaWeight",
                    label: "Chroma",
                    min: -0.2,
                    max: 3,
                    step: 0.01
                },
                {
                    type: "modSlider",
                    key: "hueWeight",
                    label: "Hue",
                    min: -0.2,
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
        {
            type: "select",
            key: "showPalette",
            label: "Show Palette",
            options: ["none", "strip"]
        },
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            BLENDMODE, BLEND_CHANNEL_MODE, COLORSPACE, blendAmount,
            chromaBoost, lut, cycleOffset, softness, blendK,
            lumaWeight, chromaWeight, hueWeight, assignMode, showPalette
        } = resolveAnimAll(instance.config, t);
        if (instance.auxiliaryCache.lastLut !== lut) {
            let palette = cmapLuts[lut];
            const MAX_SIZE = 256;
            const MAX_PRACTICAL_SIZE = 42
            if (palette.length > MAX_PRACTICAL_SIZE) {
                palette = resampleLut(palette, "nearest", MAX_PRACTICAL_SIZE);
            }
            const padded = new Float32Array(MAX_SIZE * 4);
            for (let i = 1; i < palette.length / 4; i++) {
                const r = palette[i * 4] / 255;
                const g = palette[i * 4 + 1] / 255;
                const b = palette[i * 4 + 2] / 255;
                // yes, we ignore alpha
                const rgb = [r, g, b].map(sRGB2Linear);
                const [Ln, an, b_n] = rgb2Lab(...rgb);
                padded[i * 4] = Ln * 100;
                padded[i * 4 + 1] = an * 255 - 128;
                padded[i * 4 + 2] = b_n * 255 - 128;
                padded[i * 4 + 3] = 0;
            }
            instance.auxiliaryCache.palette = padded;
            instance.auxiliaryCache.paletteSize = palette.length / 4;
        }
        instance.auxiliaryCache.lastLut = lut;
        const paletteSize = instance.auxiliaryCache.paletteSize;
        const palette = instance.auxiliaryCache.palette;
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendAmount: {value: blendAmount, type: "float"},
            u_chromaBoost: {type: "float", value: chromaBoost},
            PaletteBlock: {value: palette, type: "UBO"},
            u_paletteSize: {value: paletteSize, type: "int"},
            u_cycleOffset: {value: cycleOffset, type: "int"},
            u_softness: {value: softness, type: "float"},
            u_blendK: {value: blendK, type: "int"},
            u_lumaWeight: {value: lumaWeight, type: "float"},
            u_chromaWeight: {value: chromaWeight, type: "float"},
            u_hueWeight: {value: hueWeight, type: "float"},
        };
        const defines = {
            APPLY_CHROMA_BOOST: 0,
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            COLORSPACE: COLORSPACE,
            ASSIGNMODE: {"nearest": 0, "hue": 1, "blend": 2}[assignMode],
            SHOW_PALETTE: {"none": 0, "bars": 1, "strip": 2}[showPalette]
        };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: async (instance, renderer) => {
        instance.auxiliaryCache = {};
        await fragSources.load(instance, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
};

export const effectMeta = {
    group: "Color",
    tags: ["color", "colormap", "gpu", "lookup", "palette"],
    description: "Applies a colormap transformation using a 1D palette LUT. "
        + "Useful for remapping luminance or applying false color.",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        BLEND_CHANNEL_MODE: {"always": BlendTargetEnum.ALL},
        blendAmount: {"min": 0.85, "max": 1}
    }
};
