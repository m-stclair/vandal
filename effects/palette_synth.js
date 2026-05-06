import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {paletteprobe} from "./probes/paletteprobe.js";
import {webGLState} from "../utils/webgl_state.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum} from "../utils/glsl_enums.js";
import {lab2Rgb, linear2SRGB, rgb2Lab, sRGB2Linear} from "../utils/colorutils.js";
import {preprocessPalette, sortPalette} from "../utils/paletteutils.js";
import {cmapLuts, resampleLut} from "../utils/colormaps.js";

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

const MANUAL_PALETTE_MAX = 42;

function normalizeHexColor(value, fallback = "#000000") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    const short = trimmed.match(/^#?([0-9a-fA-F]{3})$/);
    if (short) {
        return "#" + short[1].split("").map(ch => ch + ch).join("").toLowerCase();
    }
    const full = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
    if (full) return "#" + full[1].toLowerCase();
    return fallback;
}

function normalizeManualPalette(palette) {
    const fallback = [
        {color: "#111111", locked: false},
        {color: "#f04a2a", locked: false},
        {color: "#f6d365", locked: false},
        {color: "#2f80ed", locked: false},
        {color: "#eeeeee", locked: false}
    ];
    const source = Array.isArray(palette) && palette.length ? palette : fallback;
    return source.slice(0, MANUAL_PALETTE_MAX).map((swatch, i) => {
        if (typeof swatch === "string") {
            return {color: normalizeHexColor(swatch, fallback[i % fallback.length].color), locked: false};
        }
        return {
            color: normalizeHexColor(swatch?.color, fallback[i % fallback.length].color),
            locked: Boolean(swatch?.locked)
        };
    });
}

function hexToByteRgb(hex) {
    const safe = normalizeHexColor(hex).slice(1);
    return [0, 2, 4].map(i => Number.parseInt(safe.slice(i, i + 2), 16));
}

function byteRgbToHex(r, g, b) {
    return "#" + [r, g, b]
        .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
        .join("");
}

function hexToLab(hex) {
    const [r, g, b] = hexToByteRgb(hex).map(v => sRGB2Linear(v / 255));
    const [Ln, an, bn] = rgb2Lab(r, g, b);
    return [Ln * 100, an * 255 - 128, bn * 255 - 128];
}

function labToHex([L, a, b]) {
    const rgb = lab2Rgb(L / 100, (a + 128) / 255, (b + 128) / 255)
        .map(linear2SRGB)
        .map(v => v * 255);
    return byteRgbToHex(rgb[0], rgb[1], rgb[2]);
}

function resampleLabPalette(palette, size) {
    if (!palette.length || size <= 0) return [];
    if (palette.length === size) return clonePalette(palette);
    if (size === 1) return [palette[0]];

    const out = [];
    const maxSource = palette.length - 1;
    for (let i = 0; i < size; i++) {
        const sourceIndex = Math.round((i / (size - 1)) * maxSource);
        out.push([...palette[sourceIndex]]);
    }
    return out;
}

function manualPaletteToLab(palette) {
    return normalizeManualPalette(palette).map(swatch => hexToLab(swatch.color));
}

function labPaletteToManualSwatches(palette) {
    return palette.slice(0, MANUAL_PALETTE_MAX).map(lab => ({
        color: labToHex(lab),
        locked: false
    }));
}

function srgbaPaletteToManualSwatches(srgbaPalette, size) {
    if (!srgbaPalette?.length) return [];
    const safeSize = Math.max(1, Math.min(MANUAL_PALETTE_MAX, Math.round(size)));
    const sampled = safeSize === 1
        ? srgbaPalette.slice(0, 4)
        : resampleLut(srgbaPalette, "nearest", safeSize);
    const swatches = [];
    for (let i = 0; i < sampled.length; i += 4) {
        swatches.push({
            color: byteRgbToHex(sampled[i], sampled[i + 1], sampled[i + 2]),
            locked: false
        });
    }
    return swatches;
}

function manualInitSize(config) {
    return Math.max(1, Math.min(
        MANUAL_PALETTE_MAX,
        Math.round(config.manualInitSize ?? config.paletteSize ?? 15)
    ));
}

function invalidatePaletteCache(instance) {
    if (!instance?.auxiliaryCache) return;
    instance.auxiliaryCache.lastPaletteSettings = null;
    instance.auxiliaryCache.lastPalette = null;
}

function initManualFromGenerated(config, _emptyVal, _e, instance, requestRender, requestUIDraw) {
    config.paletteMode = "manual";
    // This button is an imperative action, not just a config edit. When we are
    // already in manual mode, paletteMode/manualPalette may not change until
    // apply() consumes the pending action. Bump a hidden config nonce so the
    // renderer cannot reuse the cached frame and skip apply() entirely.
    config.manualGeneratedCommitNonce = (config.manualGeneratedCommitNonce ?? 0) + 1;
    instance.auxiliaryCache ??= {};
    instance.auxiliaryCache.pendingManualFromGenerated = true;
    instance.auxiliaryCache.pendingManualFromGeneratedUIDraw = requestUIDraw;
    invalidatePaletteCache(instance);
    requestRender();
    requestUIDraw();
}

function initManualFromColormap(config, _emptyVal, _e, instance, requestRender, requestUIDraw) {
    const lutName = config.manualInitLut || "grayscale";
    const lut = cmapLuts[lutName];
    if (!lut) return;
    config.paletteMode = "manual";
    config.manualPalette = srgbaPaletteToManualSwatches(lut, manualInitSize(config));
    invalidatePaletteCache(instance);
    requestRender();
    requestUIDraw();
}

function importManualLut(config, _emptyVal, e, instance, requestRender, requestUIDraw) {
    const file = e instanceof File ? e : e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, 1).data;
        const lutName = file.name.replace(/\..+$/, "");
        cmapLuts[lutName] = resampleLut(data, "nearest", img.width);
        config.manualInitLut = lutName;
        config.paletteMode = "manual";
        config.manualPalette = srgbaPaletteToManualSwatches(data, manualInitSize(config));
        invalidatePaletteCache(instance);
        URL.revokeObjectURL(objectUrl);
        requestRender();
        requestUIDraw();
    };
    img.onerror = () => URL.revokeObjectURL(objectUrl);
}

function getGeneratedTargetPalette(instance, inputTex, width, height, params, desiredSize = null) {
    const probe = instance.probe;
    const selectionWeights = {
        midtone: params.selectWeights[0],
        outlier: params.selectWeights[1],
        chroma: params.selectWeights[2],
    };

    const requestedSize = desiredSize ?? params.paletteSize;
    const safePaletteSize = Math.min(
        126,
        requestedSize >= 3 ? Math.round(requestedSize / 3) * 3 : 3
    );

    let targetPalette = probe.analyze(
        probe,
        inputTex,
        width,
        height,
        safePaletteSize / 3,
        params.deltaL,
        params.gammaC,
        params.blockSize,
        params.seed,
        selectionWeights,
        params.minDistance,
        params.samplingMode
    );

    targetPalette = sortPalette(targetPalette, params.sortMode);
    if (desiredSize !== null) {
        targetPalette = resampleLabPalette(targetPalette, desiredSize);
    }

    instance.auxiliaryCache.lastGeneratedPalette = clonePalette(targetPalette);
    return targetPalette;
}

function getManualTargetPalette(instance, inputTex, width, height, params) {
    const swatches = normalizeManualPalette(params.manualPalette);
    let targetPalette = manualPaletteToLab(swatches);
    const assist = clamp01((params.generatedAssist ?? 0) / 100);

    if (assist > 0 && targetPalette.length > 0) {
        const generatedPalette = getGeneratedTargetPalette(
            instance,
            inputTex,
            width,
            height,
            params,
            targetPalette.length
        );
        targetPalette = targetPalette.map((lab, i) =>
            swatches[i]?.locked ? lab : mixLab(lab, generatedPalette[i], assist)
        );
    }

    return targetPalette;
}

const shaderPath = "palette_synth.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const OutputModeEnum = Object.freeze({
    FULL_REPLACE: 0,
    PRESERVE_LUMA: 1,
    PRESERVE_CHROMA: 2,
    HUE_WASH: 3,
    SHADOW_HIGHLIGHT: 4
});

const OutputModeOpts = [
    {label: "Full Replace", value: "fullReplace"},
    {label: "Preserve Luma", value: "preserveLuma"},
    {label: "Preserve Chroma", value: "preserveChroma"},
    {label: "Hue Wash", value: "hueWash"},
    {label: "Shadow/Highlight", value: "shadowHighlight"}
];

const OutputModeLookup = {
    fullReplace: OutputModeEnum.FULL_REPLACE,
    preserveLuma: OutputModeEnum.PRESERVE_LUMA,
    preserveChroma: OutputModeEnum.PRESERVE_CHROMA,
    hueWash: OutputModeEnum.HUE_WASH,
    shadowHighlight: OutputModeEnum.SHADOW_HIGHLIGHT
};

const DitherPatternLookup = {
    ordered2: 0,
    ordered4: 1,
    ordered8: 2,
    hash: 3,
    lines: 4,
    halftone: 5
};

function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}

function clonePalette(palette) {
    return palette.map(([L, a, b]) => [L, a, b]);
}

function labDistanceSq(a, b) {
    return (
        (a[0] - b[0]) ** 2 +
        (a[1] - b[1]) ** 2 +
        (a[2] - b[2]) ** 2
    );
}

function mixLab(a, b, amount) {
    return [
        a[0] + (b[0] - a[0]) * amount,
        a[1] + (b[1] - a[1]) * amount,
        a[2] + (b[2] - a[2]) * amount
    ];
}

function greedyPaletteMatch(currentPalette, targetPalette) {
    const pairs = [];

    for (let i = 0; i < currentPalette.length; i++) {
        for (let j = 0; j < targetPalette.length; j++) {
            pairs.push({
                currentIndex: i,
                targetIndex: j,
                distance: labDistanceSq(currentPalette[i], targetPalette[j])
            });
        }
    }

    pairs.sort((a, b) =>
        (a.distance - b.distance) ||
        (a.currentIndex - b.currentIndex) ||
        (a.targetIndex - b.targetIndex)
    );

    const currentUsed = new Array(currentPalette.length).fill(false);
    const targetUsed = new Array(targetPalette.length).fill(false);
    const matches = new Array(currentPalette.length).fill(-1);

    for (const pair of pairs) {
        if (currentUsed[pair.currentIndex] || targetUsed[pair.targetIndex]) continue;

        currentUsed[pair.currentIndex] = true;
        targetUsed[pair.targetIndex] = true;
        matches[pair.currentIndex] = pair.targetIndex;
    }

    // Defensive fallback. Should only matter if lengths get weird.
    for (let i = 0; i < matches.length; i++) {
        if (matches[i] !== -1) continue;

        const fallback = targetUsed.findIndex(used => !used);
        matches[i] = fallback === -1 ? Math.min(i, targetPalette.length - 1) : fallback;
        if (fallback !== -1) targetUsed[fallback] = true;
    }

    return matches;
}

function transitionPalette(currentPalette, targetPalette, response) {
    if (!currentPalette || currentPalette.length !== targetPalette.length) {
        return clonePalette(targetPalette);
    }

    if (response >= 1) {
        return clonePalette(targetPalette);
    }

    if (response <= 0) {
        return currentPalette;
    }

    const matches = greedyPaletteMatch(currentPalette, targetPalette);

    return currentPalette.map((lab, i) =>
        mixLab(lab, targetPalette[matches[i]], response)
    );
}

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
        const params = resolveAnimAll(instance.config, t);
        let {
            paletteSize, cycleOffset, softness, blendK,
            lumaWeight, chromaWeight, hueWeight, BLENDMODE,
            COLORSPACE, BLEND_CHANNEL_MODE, assignMode, blendAmount,
            showPalette, selectWeights,
            deltaL, gammaC, freeze,
            blockSize, seed, minDistance, CYCLE_MODE, sortMode,
            outputMode, shadowCutoff, highlightCutoff, paletteResponse,
            ditherScale, ditherPattern, ditherAngle, ditherLumaAmount,
            paletteMode = "generated", generatedAssist = 0,
        } = params;
        let {manualPalette} = params;

        let palette, paletteBlock, paletteFeatures;

        const cache = instance.auxiliaryCache;

        if (cache.pendingManualFromGenerated) {
            cache.pendingManualFromGenerated = false;
            const generated = getGeneratedTargetPalette(instance, inputTex, width, height, params);
            const generatedSwatches = labPaletteToManualSwatches(generated);
            instance.config.paletteMode = "manual";
            instance.config.manualPalette = generatedSwatches;
            params.paletteMode = "manual";
            params.manualPalette = generatedSwatches;
            paletteMode = "manual";
            manualPalette = generatedSwatches;

            const redrawUI = cache.pendingManualFromGeneratedUIDraw;
            cache.pendingManualFromGeneratedUIDraw = null;
            if (typeof redrawUI === "function") redrawUI();
        }

        const response = clamp01((paletteResponse ?? 100) / 100);
        const useManualPalette = paletteMode === "manual";
        const normalizedManualPalette = normalizeManualPalette(manualPalette);
        const generationSettings = [
            paletteSize,
            selectWeights,
            seed,
            minDistance,
            deltaL,
            gammaC,
            blockSize,
            sortMode,
            params.samplingMode
        ];

        const paletteSettings = JSON.stringify([
            paletteMode,
            useManualPalette ? normalizedManualPalette : generationSettings,
            useManualPalette ? generatedAssist : null,
            useManualPalette && generatedAssist > 0 ? generationSettings : null
        ]);

        const hasCachedPalette =
            cache.lastPalette &&
            paletteSettings === cache.lastPaletteSettings;

        const paletteSettingsChanged =
            paletteSettings !== cache.lastPaletteSettings;

        const shouldReusePalette =
            hasCachedPalette && (
                freeze ||
                response <= 0
            );

        if (shouldReusePalette) {
            palette = cache.lastPalette;
            paletteBlock = cache.lastPaletteBlock;
            paletteFeatures = cache.lastPaletteFeatures;
        } else {
            const targetPalette = useManualPalette
                ? getManualTargetPalette(instance, inputTex, width, height, params)
                : getGeneratedTargetPalette(instance, inputTex, width, height, params);

            const shouldSnap =
                paletteSettingsChanged ||
                !cache.lastPalette ||
                response >= 1 ||
                freeze;

                palette = shouldSnap
                    ? targetPalette
                    : sortPalette(
                        transitionPalette(cache.lastPalette, targetPalette, response),
                        sortMode
                      );

            let procResult = preprocessPalette(palette);
            paletteBlock = procResult["paletteBlock"];
            paletteFeatures = procResult["paletteFeatures"];

            cache.lastPalette = palette;
            cache.lastPaletteBlock = paletteBlock;
            cache.lastPaletteFeatures = paletteFeatures;
        }

        cache.lastPaletteSettings = paletteSettings;
        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            PaletteFeatures: {value: paletteFeatures, type: "UBO", binding: 0},
            PaletteBlock: {value: paletteBlock, type: "UBO", binding: 1},
            u_paletteSize: {value: palette.length, type: "int"},
            u_cycleOffset: {value: cycleOffset, type: "int"},
            u_softness: {value: softness, type: "float"},
            u_blendK: {value: blendK, type: "int"},
            u_lumaWeight: {value: lumaWeight >= 0 ? lumaWeight : 0, type: "float"},
            u_chromaWeight: {value: chromaWeight >= 0 ? chromaWeight : 0, type: "float"},
            u_hueWeight: {value: hueWeight >= 0 ? hueWeight : 0, type: "float"},
            u_blendAmount: {value: blendAmount, type: "float"},
            u_ditherScale: {value: ditherScale, type: "float"},
            u_ditherAngle: {value: ditherAngle, type: "float"},
            u_ditherLumaAmount: {value: ditherLumaAmount, type: "float"},
            u_shadowCutoff: {value: shadowCutoff, type: "float"},
            u_highlightCutoff: {value: highlightCutoff, type: "float"},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            ASSIGNMODE: {"nearest": 0, "blend": 1, "dither": 2}[assignMode],
            OUTPUT_MODE: OutputModeLookup[outputMode] ?? OutputModeEnum.FULL_REPLACE,
            SHOW_PALETTE: {"none": 0, "strip": 1}[showPalette],
            CYCLE_MODE: CYCLE_MODE,
            DITHER_PATTERN: DitherPatternLookup[ditherPattern] ?? DitherPatternLookup.ordered4,
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
            type: "select",
            key: "paletteMode",
            label: "Palette Mode",
            options: [
                {label: "Generated", value: "generated"},
                {label: "Manual", value: "manual"}
            ]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Manual Palette",
            collapsed: false,
            showIf: {key: "paletteMode", equals: "manual"},
            children: [
                {
                    type: "palette",
                    key: "manualPalette",
                    label: "Swatches",
                    max: MANUAL_PALETTE_MAX,
                    min: 1,
                    allowAdd: true,
                    allowRemove: true,
                    allowReorder: true,
                    allowLock: true,
                    allowPaste: true,
                    fallbackPalette: ["#111111", "#f04a2a", "#f6d365", "#2f80ed", "#eeeeee"]
                },
                {
                    type: "range",
                    key: "manualInitSize",
                    label: "Init Size",
                    min: 1,
                    max: MANUAL_PALETTE_MAX,
                    step: 1
                },
                {
                    type: "select",
                    key: "manualInitLut",
                    label: "Init Colormap",
                    get options() {
                        return Object.keys(cmapLuts);
                    }
                },
                {
                    type: "button",
                    key: "initManualFromColormap",
                    label: "Load Colormap",
                    func: initManualFromColormap
                },
                {
                    type: "button",
                    key: "importManualLut",
                    label: "Import LUT",
                    func: importManualLut,
                    inputType: "file",
                    accept: "image/png,image/jpeg,image/webp"
                },
                {
                    type: "button",
                    key: "initManualFromGenerated",
                    label: "Use Current Generated",
                    func: initManualFromGenerated
                },
                {
                    type: "range",
                    key: "generatedAssist",
                    label: "Generated Assist",
                    min: 0,
                    max: 100,
                    step: 1
                }
            ]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Palette Generation",
            showIf: {key: "paletteMode", equals: "generated"},
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
                    type: "select",
                    key: "samplingMode",
                    label: "Sample Placement",
                    options: [
                        {label: "Random", value: "random"},
                        {label: "Stratified + Jittered", value: "stratified"}
                    ]
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
            ]
        },
        {
            type: "select",
            key: "assignMode",
            label: "Assignment Mode",
            options: ["nearest", "blend", "dither"]
        },
        {
            type: "select",
            key: "outputMode",
            label: "Output Mode",
            options: OutputModeOpts
        },
        {
            type: "group",
            kind: "collapse",
            label: "Shadow/Highlight Cutoffs",
            showIf: {key: "outputMode", equals: "shadowHighlight"},
            children: [
                {
                    type: "modSlider",
                    key: "shadowCutoff",
                    label: "Shadow Cutoff",
                    min: 0,
                    max: 100,
                    step: 0.5
                },
                {
                    type: "modSlider",
                    key: "highlightCutoff",
                    label: "Highlight Cutoff",
                    min: 0,
                    max: 100,
                    step: 0.5
                }
            ]
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
            type: "group",
            kind: "collapse",
            label: "Dither",
            showIf: {key: "assignMode", equals: "dither"},
            children: [
                {
                    type: "select",
                    key: "ditherPattern",
                    label: "Pattern",
                    options: [
                        {label: "Ordered 2×2", value: "ordered2"},
                        {label: "Ordered 4×4", value: "ordered4"},
                        {label: "Ordered 8×8", value: "ordered8"},
                        {label: "Hash Noise", value: "hash"},
                        {label: "Lines", value: "lines"},
                        {label: "Halftone", value: "halftone"}
                    ]
                },
                {
                    type: "modSlider",
                    key: "ditherScale",
                    label: "Pattern Scale",
                    min: 1,
                    max: 12,
                    step: 1
                },
                {
                    type: "modSlider",
                    key: "ditherAngle",
                    label: "Angle",
                    min: -180,
                    max: 180,
                    step: 1,
                },
                {
                    type: "range",
                    key: "ditherLumaAmount",
                    label: "Luma Falloff",
                    min: 0,
                    max: 1,
                    step: 0.01
                }
            ]
        },
        {
            type: "range",
            key: "paletteResponse",
            label: "Palette Response",
            min: 0,
            max: 100,
            step: 1,
            showIf: {key: "freeze", notEquals: true}
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
        paletteMode: "generated",
        manualPalette: [
            {color: "#111111", locked: false},
            {color: "#f04a2a", locked: false},
            {color: "#f6d365", locked: false},
            {color: "#2f80ed", locked: false},
            {color: "#eeeeee", locked: false}
        ],
        manualInitSize: 15,
        manualInitLut: "viridis",
        generatedAssist: 0,
        manualGeneratedCommitNonce: 0,
        paletteSize: 15,
        deltaL: 30,
        gammaC: 1,
        cycleOffset: 0,
        softness: 1,
        blendK: 2,
        lumaWeight: 0.75,
        chromaWeight: 0.5,
        hueWeight: 0.5,
        selectWeights: [0.1, 0, 0],
        minDistance: 18,
        assignMode: "blend",
        outputMode: "fullReplace",
        shadowCutoff: 30,
        highlightCutoff: 70,
        blendAmount: 1,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        showPalette: "none",
        sortMode: "lightness",
        paletteResponse: 100,
        blockSize: 3,
        seed: 1,
        samplingMode: "stratified",
        freeze: false,
        CYCLE_MODE: 0,
        ditherPattern: "ordered4",
        ditherAngle: 45,
        ditherLumaAmount: 0,
        ditherScale: 1,
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
        paletteMode: {"always": "generated"},
        showPalette: {"always": "none"},
        deltaL: {"min": 18, "max": 60},
        cycleOffset: {"min": 0, "max": 0, "aniMin": 0, "aniMax": 100},
        gammaC: {"min": 0.8, "max": 1.2},
        minDistance: {"min": 12, "max": 30},
        shadowCutoff: {"min": 10, "max": 45},
        highlightCutoff: {"min": 55, "max": 90},
        outputMode: {"weights": {"fullReplace": 10}},
        paletteResponse: {"min": 10, "max": 100},
        lumaWeight: {"min": 1, "max": 3},
        size: {"aniMin": 3, "aniMax": 42},
        ditherPattern: {
        weights: {
                ordered4: 8,
                ordered8: 4,
                ordered2: 2,
                hash: 3,
                lines: 3,
                halftone: 3
            }
        },
        ditherScale: {"min": 1, "max": 4},
        ditherLumaAmount: {"min": 0, "max": 0.5}
    },
    fullOpacityChance: 0.8
};