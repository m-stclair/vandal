import {loadShaderSource, WebGLRunner} from "../utils/webgl_runner.js";
import {nullish} from "../utils/helpers.js";
import {MAX_TAPS} from "../utils/gl_config.js";
import {boxKernel, circularKernel, annularKernel} from "../utils/kernels.js";

let fragSource = null;
let runner = null;
const fragURL = new URL("../shaders/delayline.frag", import.meta.url);
fragURL.searchParams.set("v", Date.now());

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
  name: "Delay Line (GL)",

  defaultConfig: {
    delay: 32,
    nTaps: 1,
    window: "box"
  },

  uiLayout: [
      { key: "delay", label: "Delay", type: "range", min: 0, max: 200 },
      { type: "range", key: "nTaps", label: "Taps", min: 1, max: 15, step: 1},
      {
        type: "select",
        key: "window",
        label: "Window",
        options: [
          { value: "box", label: "Box" },
          { value: "circle", label: "Circle" },
          { value: "ring", label: "Ring" },
        ]
    },

  ],

  apply(instance, imageData) {
    const {data, width, height} = imageData;
    const {delay, window} = instance.config;
    if (delay <= 0) return imageData;
    const nTaps = Math.min(instance.config.nTaps, delay);
    let raw;
    if (window === "circle") {
      raw = circularKernel(delay, delay / nTaps * 2);
    } else if (window === "ring") {
      raw = annularKernel(Math.floor(delay * 0.5), delay, delay / nTaps * 2);
    } else {
      raw = boxKernel(nTaps, delay / nTaps);
    }
    const sorted = raw.sort(([x, y]) => x**2 + y**2);
    const taps = sorted.slice(0, MAX_TAPS);
    const offsets = new Float32Array(taps.flat());
    const weights = new Float32Array(taps.length).fill(1.0);
    console.log(taps.length);
    const uniforms = {
      u_resolution: [width, height],
      u_numTaps: taps.length,
      u_offsets: offsets,
      u_weights: weights,
    };

    const result = runner.run(fragSource, uniforms, data, width, height);
    return new ImageData(result, width, height);
  },

  initHook(_instance) {
    if (nullish(runner)) {
      runner = new WebGLRunner();
    }
    if (nullish(fragSource)) {
      return loadShaderSource(fragURL.href)
        .then(src => { fragSource = src;});
    }
    return Promise.resolve();
  },
}
