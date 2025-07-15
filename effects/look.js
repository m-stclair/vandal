import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {group} from "../utils/ui_configs.js";

const shaderPath = "../shaders/look.frag";
const includePaths = {"colorconvert.glsl": "../shaders/includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Look",
    defaultConfig: {
        exposure: 0.0,
        toneShoulder: -2,
        toneCenter: 1,
        chromaWeight: 1.0,
        chromaFadeLow: -3,
        chromaFadeHigh: 2,
        tintAxis: [1.27, 0.57, 0],
        tintStrength: 0
    },
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            exposure,
            chromaWeight,
            gamma,
            tintAxis,
            tintStrength,
            chromaFadeLow,
            chromaFadeHigh,
            toneShoulder,
            toneCenter
        } = resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_exposure: {value: exposure, type: "float"},
            u_chroma_weight: {value: chromaWeight, type: "float"},
            u_center: {value: toneShoulder, type: "float"},
            u_shoulder: {value: toneCenter, type: "float"},
            u_chroma_fade_low: {value: chromaFadeLow, type: "float"},
            u_chroma_fade_high: {value: chromaFadeHigh, type: "float"},
            u_sh: {value: gamma, type: "float"},
            u_tint_axis: {value: new Float32Array(tintAxis), type: "vec3"},
            u_tint_strength: {value: tintStrength, type: "float"},
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
    uiLayout: [
        group("Tone Mapping", [
            {
                key: "exposure",
                label: "Exposure",
                type: "modSlider",
                min: -5,
                max: 5,
                step: 0.05
            },
            {
                key: "toneShoulder",
                label: "Tone Shoulder",
                type: "modSlider",
                min: -6,
                max: 6,
                step: 0.05
            },
            {
                key: "toneCenter",
                label: "Tone Center",
                type: "modSlider",
                min: -0.5,
                max: 2,
                step: 0.01
            }
        ], {color: "#201000"}),

        group("Chroma Rolloff", [
            {
                key: "chromaWeight",
                label: "Chroma Weight",
                type: "modSlider",
                min: 0,
                max: 4,
                step: 0.01
            },
            {
                key: "chromaFadeLow",
                label: "Chroma Fade Low Stop",
                type: "modSlider",
                min: -6,
                max: 6,
                step: 0.1
            },
            {
                key: "chromaFadeHigh",
                label: "Chroma Fade High Stop",
                type: "modSlider",
                min: -6,
                max: 6,
                step: 0.1
            }
        ], {color: "#001020"}),

        group("Tint", [
            {
                key: "tintStrength",
                label: "Tint Strength",
                type: "modSlider",
                min: 0,
                max: 1,
                step: 0.01
            },
            {
                key: "tintAxis",
                label: "Tint Axis",
                type: "vector",
                subLabels: ["R", "G", "B"],
                min: -2,
                max: 2,
                step: 0.01
            }
        ], {color: "#200020"})
    ]

}

export const effectMeta = {
    group: "Utility",
    tags: ["color", "brightness", "contrast", "saturation", "chroma",
        "exposure", "warm", "lut", "chroma", "luma", "cool", "tint"],
    description: "Adjusts luma, chroma, tone, and tint. Kind of like a " +
        "procedurally-generated LUT. You might want this instead of B/C/S.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
};
