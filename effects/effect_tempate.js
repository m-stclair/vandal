import {WebGLRunner} from "../utils/webgl_runner.js";
import {loadFragInit} from "../utils/load_runner.js";

// Replace with actual shader file URL
const fragURL = new URL("../shaders/yourShaderFile.frag", import.meta.url);
fragURL.searchParams.set("v", Date.now());
const shaderStuff = loadFragInit({
    fragURL,
    makeRunner: () => new WebGLRunner()
});

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Your Effect Name",

    defaultConfig: {
        // Your default parameters here
    },

    apply(instance, data, width, height, t, inputKey) {
        const {config} = instance;
        const resolved = config;  // Simplify for now

        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            // Other uniforms based on config
        };
        const {fragSource, runner} = shaderStuff;
        return runner.run(fragSource, uniforms, data, width, height, inputKey);
    },

    uiLayout: [
        // UI layout for parameters
    ],

    initHook: shaderStuff.initHook,
};

export const effectMeta = {
  group: "Your Effect Group",
  tags: ["tag1", "tag2"],  // Add relevant tags
  description: "Description of the effect.",
  canAnimate: false,
  realtimeSafe: true,
};
