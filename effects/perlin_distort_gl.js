import {WebGLRunner} from "../utils/webgl_runner.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {makeShaderInit} from "../utils/load_runner.js";

const fragURL = [
    new URL("../shaders/perlin_distort.frag", import.meta.url),
    new URL("../shaders/perlin.frag", import.meta.url),
]
fragURL[0].searchParams.set("v", Date.now());
fragURL[1].searchParams.set("v", Date.now());

const shaderStuff = makeShaderInit({
    fragURL,
    makeRunner: () => new WebGLRunner()
});


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Perlin Distort (GL)",

    defaultConfig: {
        intensityX: 0.6,
        intensityY: 0.9,
        offsetX: 0.5,
        offsetY: -1.8,
        scaleX: 1,
        scaleY: 1,
        seed: 0,
        fc: [6, 15, 10]
    },

    uiLayout: [

        {key: "seed", label: "Seed", type: "modSlider", min: 0, max: 200, step: 1},
        {key: "intensityX", label: "Intensity (X)", type: "modSlider", min: -2, max: 2, step: 0.01},
        {key: "intensityY", label: "Intensity (Y)", type: "modSlider", min: -2, max: 2, step: 0.01},
        {key: "offsetX", label: "Offset (X)", type: "modSlider", min: -2, max: 2, step: 0.01},
        {key: "offsetY", label: "Offset (Y)", type: "modSlider", min: -2, max: 2, step: 0.01},
        {key: "scaleX", label: "Scale (x)", type: "modSlider", min: 0, max: 2, step: 0.1},
        {key: "scaleY", label: "Scale (y)", type: "modSlider", min: 0, max: 2, step: 0.1},
        {
            key: "fc",
            label: "Fade Coefficients",
            type: "vector",
            subLabels: () => ["C1", "C2", "C3"],
            min: 5,
            max: 20,
            step: 0.25,
        },
    ],

    apply(instance, data, width, height, t, inputKey) {
        const {
            intensityX, intensityY, offsetX, offsetY, scaleX, scaleY,
            fc, seed
        } = resolveAnimAll(instance.config, t);
        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_intensity: {value: [intensityX, intensityY], type: "vec2"},
            u_offset: {value: [offsetX, offsetY], type: "vec2"},
            u_scale: {value: [scaleX, scaleY], type: "vec2"},
            u_seed: {value: seed, type: "float"},
            u_fc: {value: new Float32Array(fc), type: "floatArray"},
        };
        return shaderStuff.runner.run(
            shaderStuff.fragSource, uniformSpec, data, width, height, inputKey
        );
    },
    initHook: shaderStuff.initHook
}

export const effectMeta = {
  group: "Geometry",
  tags: ["noise", "distortion", "webgl"],
  description: "Projects the image onto a surface generated from Perlin noise. "
      + "Creates organic-but-retro warp and curve effects.",
  canAnimate: true,
  realtimeSafe: true,
};
