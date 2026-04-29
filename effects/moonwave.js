import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {blendControls, group} from "../utils/ui_configs.js";

const shaderPath = "moonwave.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Moonwave",
    defaultConfig: {
        threshold: 0.28,
        cycle: true,
        cycleMode: "spatial",
        hueShift: 0,
        saturation: 48,
        lightness: 68,
        hueSpread: 1,
        bleed: 0.16,
        COLORSPACE: 0,
        BLENDMODE: 1,
        BLEND_CHANNEL_MODE: 0,
        blendAmount: 1,
        facetSteps: 0,
        facetType: "fold",
        softness: 0.38,
        refraction: 0.24,
        originX: 0.5,
        originY: 0.5,
        spatialPattern: "fold",
        baseHue: 0.58,
        paletteMode: "opal",
    },
    uiLayout: [
        {type: "modSlider", key: "threshold", label: "Thresh", min: 0, max: 1, step: 0.01},
        {type: "range", key: "softness", label: "Softness", min: 0.01, max: 1, step: 0.01},
        {
            type: "select",
            key: "cycleMode",
            label: "Cycle Mode",
            options: ["hue", "luma", "spatial"]
        },

        group("Veil Mapping", [
            {type: "modSlider", key: "hueShift", label: "Drift", min: 0, max: 2, step: 0.01},
            {
                type: "modSlider",
                key: "hueSpread",
                label: "Density",
                min: 0,
                max: 10,
                steps: 200,
                scale: "log",
                scaleFactor: 3
            },
        ]),

        group("Spatial Field", [
            {
                type: "select",
                key: "spatialPattern",
                label: "Pattern",
                options: ["radial", "horizontal", "vertical", "diagonal", "fold", "vortex", "lattice"]
            },
            {type: "modSlider", key: "originX", label: "X Origin", min: 0, max: 1, step: 0.01},
            {type: "modSlider", key: "originY", label: "Y Origin", min: 0, max: 1, step: 0.01}
        ], {
            showIf: {key: "cycleMode", equals: "spatial"},
        }),

        group("Glass Color", [
            {type: "range", key: "saturation", label: "Saturation", min: 0, max: 100, step: 1},
            {type: "range", key: "lightness", label: "Lightness", min: 0, max: 100, step: 1},
            {type: "range", key: "bleed", label: "Source Bleed", min: 0, max: 1, step: 0.01},
            {type: "range", key: "refraction", label: "Refraction", min: 0, max: 1, step: 0.01},
            {type: "modSlider", key: "baseHue", label: "Base Hue", min: 0, max: 1, steps: 100},
            {type: "select", key: "paletteMode", label: "Palette", options: ["opal", "mineral", "bruise", "ember"]}
        ]),

        group("Facet Controls", [
            {type: "select", key: "facetType", label: "Facet", options: ["glass", "fold", "ripple", "cell"]},
            {type: "range", key: "facetSteps", label: "Cuts", min: 0, max: 7, step: 1},
        ]),

        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            saturation,
            lightness,
            cycleMode,
            hueShift,
            hueSpread,
            threshold,
            bleed,
            COLORSPACE,
            BLENDMODE,
            blendAmount,
            facetSteps,
            facetType,
            softness,
            refraction,
            originX,
            originY,
            spatialPattern,
            BLEND_CHANNEL_MODE,
            baseHue,
            paletteMode,
        } = resolveAnimAll(instance.config, t);

        let satNorm, lightNorm, shiftNorm, spreadNorm;
        const PRISMVEIL_CYCLE = {"hue": 0, "luma": 1, "spatial": 2}[cycleMode] ?? 2;
        if (PRISMVEIL_CYCLE === 0) {
            satNorm = saturation / 100;
            lightNorm = lightness / 100;
            shiftNorm = hueShift;
            spreadNorm = ((hueSpread * 2.5) ** 0.45);
        } else if (PRISMVEIL_CYCLE === 1) {
            satNorm = saturation / 100;
            lightNorm = lightness / 100;
            shiftNorm = (hueShift / 4) ** 0.7;
            spreadNorm = (hueSpread / 1.8) ** 0.55;
        } else {
            satNorm = saturation / 100;
            lightNorm = lightness / 100;
            shiftNorm = hueShift / 2;
            spreadNorm = (hueSpread * 2.35) ** 0.78;
        }

        const facetCode = {"glass": 0, "fold": 1, "ripple": 2, "cell": 3}[facetType] ?? 1;
        const patternCode = {
            "radial": 0, "horizontal": 1, "vertical": 2,
            "diagonal": 3, "fold": 4, "vortex": 5, "lattice": 6
        }[spatialPattern] ?? 4;
        const paletteCode = {
            "opal": 0, "mineral": 1, "bruise": 2, "ember": 3
        }[paletteMode] ?? 0;

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_blendamount: {type: "float", value: blendAmount},
            u_resolution: {type: "vec2", value: [width, height]},
            u_threshold: {type: "float", value: threshold},
            u_shiftNorm: {type: "float", value: shiftNorm},
            u_spreadNorm: {type: "float", value: spreadNorm},
            u_bleed: {type: "float", value: bleed},
            u_satNorm: {type: "float", value: satNorm},
            u_lightNorm: {type: "float", value: lightNorm},
            u_facetSteps: {type: "float", value: facetSteps},
            u_softness: {type: "float", value: softness},
            u_refraction: {type: "float", value: refraction},
            u_origin: {type: "vec2", value: [originX * width, originY * height]},
            u_baseHue: {type: "float", value: baseHue},
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            PRISMVEIL_CYCLE: PRISMVEIL_CYCLE,
            PRISMVEIL_BLEED: Number(bleed > 0),
            PRISMVEIL_REFRACT: Number(refraction > 0),
            USE_FACET_STEPS: Number(facetSteps > 0),
            FACETTYPE: facetCode,
            SPATIAL_PATTERN: patternCode,
            PALETTE_MODE: paletteCode
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
    group: "Synthesis",
    tags: ["color", "synth", "glass", "threshold", "interference", "facet"],
    description: "Builds a translucent prism field from hue, brightness, or image-space coordinates. " +
        "Soft contour veils, mineral palettes, optional facet cuts, and subtle RGB refraction. ",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        threshold: {min: 0.02, max: 0.3},
        saturation: {min: 20, max: 75},
        lightness: {min: 45, max: 85},
        refraction: {min: 0, max: 0.45},
        softness: {min: 0, max: 0.2}
    }
}
