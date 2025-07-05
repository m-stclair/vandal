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
        pitchX: -0.25,
        pitchY: 0.25,
        rollX: 0.25,
        rollY: -0.25,
        yawX: 1.5,
        yawY: 0.5,
        seed: 0,
        depth: 0.5,
        rate: 4,
        rateDrive: 0.5,
        fc: [6, 15, 10]
    },

    uiLayout: [

        {key: "seed", label: "Seed", type: "range", min: 0, max: 200, step: 1},
        {key: "depth", label: "Depth", type: "modSlider", min: 0, max: 1, step: 0.01},
        {key: "rate", label: "Rate", type: "modSlider", min: 0, max: 100, steps: 200, scale: "log"},
        {key: "rateDrive", label: "Rate Drive", type: "modSlider", min: 0, max: 1, step: 0.01},
        {key: "pitchX", label: "pitch (X)", type: "modSlider", min: -2, max: 2, step: 0.01},
        {key: "pitchY", label: "pitch (Y)", type: "modSlider", min: -2, max: 2, step: 0.01},
        {key: "rollX", label: "roll (X)", type: "modSlider", min: -2, max: 2, step: 0.01},
        {key: "rollY", label: "roll (Y)", type: "modSlider", min: -2, max: 2, step: 0.01},
        {key: "yawX", label: "yaw (x)", type: "modSlider", min: 0, max: 2, step: 0.01},
        {key: "yawY", label: "yaw (y)", type: "modSlider", min: 0, max: 2, step: 0.01},
        {key: 'boundMode', label: 'Boundary Mode', type: 'Select', options: ['fract', 'free', 'clamp']},
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
            pitchX, pitchY, rollX, rollY, yawX, yawY,
            fc, seed, depth, boundMode, rate, rateDrive
        } = resolveAnimAll(instance.config, t);
        const boundCode = {'fract': 0, 'free': 1, 'clamp': 2}[boundMode];
        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_pitch: {value: [pitchX, pitchY], type: "vec2"},
            u_roll: {value: [rollX, rollY], type: "vec2"},
            u_yaw: {value: [yawX, yawY], type: "vec2"},
            u_seed: {value: seed, type: "float"},
            u_fc: {value: new Float32Array(fc), type: "floatArray"},
            u_depth: {value: depth, type: "float"},
            u_rate: {value: rate, type: "float"},
            u_ratedrive: {value: rateDrive, type: "float"},
            u_boundmode: {value: boundCode, type: "int"},

        };
        return shaderStuff.runner.run(
            shaderStuff.fragSource, uniformSpec, data, width, height, inputKey
        );
    },
    initHook: shaderStuff.initHook
}

export const effectMeta = {
  group: "Distortion",
  tags: ["noise", "distortion", "webgl"],
  description: "Projects the image onto a surface generated from Perlin noise. "
      + "Creates organic-but-retro warps, curves, and plastic tumbler patterns.",
  canAnimate: true,
  realtimeSafe: true,
};
