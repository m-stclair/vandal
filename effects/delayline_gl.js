import {WebGLRunner} from "../utils/webgl_runner.js";
import {
    boxKernel,
    circularKernel,
    annularKernel,
    normalizeWeights,
    centerKernel
} from "../utils/kernellib.js";
import {deg2rad, multiplyMat2, rotationMatrix2D, scaleMatrix2D, shearMatrix2D} from "../utils/mathutils.js";
import {MAX_TAPS} from "../utils/gl_config.js";
import {weightFns} from "../utils/weightings.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {makeShaderInit} from "../utils/load_runner.js";

const fragURL = new URL("../shaders/delayline.frag", import.meta.url);
fragURL.searchParams.set("v", Date.now());
const shaderStuff = makeShaderInit({
    fragURL,
    makeRunner: () => new WebGLRunner()
});


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Delay Line (GL)",

    defaultConfig: {
        delay: 32,
        window: "box",
        falloff: "uniform",
        density: 2,
        angle: 0,
        shearX: 0,
        shearY: 0,
        scaleX: 1,
        scaleY: 1
    },

    uiLayout: [
        {key: "delay", label: "Delay (px)", type: "modSlider", min: 0, max: 200},
        {key: "density", label: "Tap Density", type: "modSlider", min: 1, max: 8, step: 0.1},
        {
            type: "select",
            key: "window",
            label: "Window",
            options: [
                {value: "box", label: "Box"},
                {value: "circle", label: "Circle"},
                {value: "ring", label: "Ring"},
            ]
        },
        {
            key: "falloff",
            label: "Falloff",
            type: "select",
            options: Object.keys(weightFns),
        },
        {key: "angle", label: "Angle", type: "modSlider", min: -180, max: 180},
        {key: "shearX", label: "Shear (x)", type: "modSlider", min: -5, max: 5, step: 0.1},
        {key: "shearY", label: "Shear (y)", type: "modSlider", min: -5, max: 5, step: 0.1},
        {key: "scaleX", label: "Scale (x)", type: "modSlider", min: 0.1, max: 3, step: 0.1},
        {key: "scaleY", label: "Scale (y)", type: "modSlider", min: 0.1, max: 3, step: 0.1}
    ],

    apply(instance, data, width, height, t, inputKey) {
        const {
            delay, window, density, angle, falloff, shearX, shearY,
            scaleX, scaleY
        } = resolveAnimAll(instance.config, t);
        if (delay <= 0) return data;
        let kernelFn;
        let shapeArgs = [delay];
        if (window === "circle") {
            kernelFn = circularKernel;
        } else if (window === "ring") {
            kernelFn = annularKernel;
            shapeArgs = [delay * 0.5, delay];
        } else {
            kernelFn = boxKernel;
        }
        let {taps, weights} = kernelFn(
            ...shapeArgs,
            {
                spacing: delay / density,
                maxTaps: MAX_TAPS,
                weightFn: weightFns[falloff],
            }
        );
        weights = normalizeWeights(weights);
        taps = centerKernel(taps);
        const rot = rotationMatrix2D(deg2rad(angle));
        const shear = shearMatrix2D(shearX, shearY);
        const scale = scaleMatrix2D(scaleX, scaleY);
        const affine = multiplyMat2(rot, multiplyMat2(shear, scale));

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_numTaps: {value: taps.length, type: "int"},
            u_offsets: {value: new Float32Array(taps.flat()), type: "vec2"},
            u_weights: {value: new Float32Array(weights), type: "floatArray"},
            u_transformMatrix: {value: affine, type: "mat2"}
        };
        return shaderStuff.runner.run(
            shaderStuff.fragSource, uniformSpec, data, width, height, inputKey
        );
    },

    initHook: shaderStuff.initHook
}

export const effectMeta = {
  group: "Geometry",
  tags: ["blur", "delay", "temporal", "webgl", "kernel", "animated"],
  description: "Applies a multi-sample spatial delay using a configurable kernel on GPU. " +
      "Capable of motion blur, kaleidoscoping, and echoic distortion.",
  canAnimate: true,
  realtimeSafe: true,
};
