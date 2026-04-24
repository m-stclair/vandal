import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, hasChromaBoostImplementation
} from "../utils/glsl_enums.js";
import {blendControls, group} from "../utils/ui_configs.js";

const shaderPath = "contour_synth.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Contour Synth",

    defaultConfig: {
        freq: 2,
        freqScale: 1,
        phaseScale: 1,
        phaseOff: 0,
        blendAmount: 0.6,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        chromaBoost: 1,
        waveform: "Sine",
        spatialWaveform: "Radial",
        COLOR_MODE: 0,
        hueOff: 0,
        hueScale: 1,
        chromaGamma: 1,
        phaseGamma: 1
    },
    uiLayout: [
        group("Waveform Modulation", [
            {
                type: "modSlider",
                key: "phaseOff",
                label: "Phase Offset",
                min: -180,
                max: 180,
                step: 1
            },
            {
                type: "modSlider",
                key: "phaseScale",
                label: "Phase Scale",
                min: 0,
                max: 10,
                steps: 100,
                scale: "log",
                scaleFactor: 2
            },
            {
                type: "modSlider",
                key: "phaseGamma",
                label: "Phase Gamma",
                min: 0,
                max: 3,
                steps: 100,
            },
            {
                type: "Select",
                key: "waveform",
                label: "Waveform",
                options: ["Sine", "Saw", "Square", "Tri"]
            }
        ], {color: "#110011"}),


        group("Spatial Settings", [
            {
                type: "Select",
                key: "spatialWaveform",
                label: "Spatial Mode",
                options: ["None", "Bands", "Checkerboard", "Radial", "Arc"]
            },
            {
                type: "modSlider",
                key: "freq",
                label: "Spatial Freq",
                min: 0,
                max: 5,
                step: 0.01,
                showIf: {key: "spatialWaveform", notEquals: "None"},
            },
            {
                type: "modSlider",
                key: "freqScale",
                label: "Spatial Freq Scale",
                min: 0,
                max: 10,
                step: 0.25,
                showIf: {key: "spatialWaveform", notEquals: "None"},
            }
        ],
            {color: "#002011"}
        ),
        group("Color", [
            {
                type: "Select",
                key: "COLOR_MODE",
                label: "Color Mode",
                options: [
                    {'label': 'Grayscale', 'value': 0},
                    {'label': 'Luma', value: 1},
                    {'label': 'Color', value: 2}
                ]
            },
            {
                type: "modSlider",
                key: "hueOff",
                label: "Hue Offset",
                min: 0,
                max: 1,
                steps: 100,
                showIf: {key: "COLOR_MODE", equals: 2}
            },
            {
                type: "modSlider",
                key: "hueScale",
                label: "Hue Scale",
                min: 0,
                max: 3,
                steps: 100,
                showIf: {key: "COLOR_MODE", equals: 2}
            },
            {
                type: "modSlider",
                key: "chromaGamma",
                label: "Chroma Gamma",
                min: 0,
                max: 3,
                steps: 100,
                showIf: {key: "COLOR_MODE", equals: 2}
            }
        ]),
        blendControls()
    ],


    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            freq, freqScale, phaseOff, phaseScale, blendAmount, BLENDMODE,
            waveform, spatialWaveform, BLEND_CHANNEL_MODE, COLORSPACE,
            hueOff, hueScale, chromaGamma, phaseGamma, COLOR_MODE
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blend: {type: "float", value: blendAmount},
            u_freq: {type: "float", value: freq},
            u_freqScale: {type: "float", value: freqScale},
            u_phaseOff: {type: "float", value: phaseOff * Math.PI / 180},
            u_phaseScale: {type: "float", value: phaseScale},
            u_phaseGamma: {type: "float", value: phaseGamma},
            u_hueScale: {type: "float", value: hueScale},
            u_hueOff: {type: "float", value: hueOff},
            u_chromaGamma: {type: "float", value: chromaGamma}
        };
        const wavecode = {
            "Sine": 0, "Saw": 1, "Square": 2, "Tri": 3
        }[waveform]
        const spacecode = {
            "Bands": 0, "Checkerboard": 1, "Radial": 2, "Rings": 3, "None": 4
        }[spatialWaveform]
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            WAVEFORM_MODE: wavecode,
            SPATIAL_MODE: spacecode,
            COLOR_MODE: COLOR_MODE
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
    tags: ["synth", "contour", "pattern", "topography"],
    description: "A synthetic topography generator that overlays " +
      "contour-line patterns by modulating spatial " +
      "derivatives of luminance. Contour spacing and directionality are driven " +
      "by waveforms or spatial fields, enabling results that range from " +
      "stark monochrome etchings to vibrant interference textures to " +
      "hallucinatory landscape modulations. Behaves like a hybrid between an " +
      "edge detector, a terrain visualizer, and an FM synth. Also suitable " +
      "as a standalone pattern generator.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
}