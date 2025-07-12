import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";

const shaderPath = "../shaders/pixelate.frag";
const includePaths = {};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @type {EffectModule} */
export default {
    name: "Pixelate",
      defaultConfig: {
        blockSize: 8,
      },
      uiLayout: [
        {type: 'modSlider', key: "blockSize", label: "Block Size", min: 1, max: 64, step: 1},
      ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {blockSize} = resolveAnimAll(instance.config, t);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blocksize: {value: blockSize, type: "float"}
        };
        const defines = {};
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
}

export const effectMeta = {
  group: "Stylize",
  tags: ["pixel", "quantize", "gpu", "lofi"],
  description: "Reduces image resolution by averaging blocks of pixels, " +
      "producing a pixelated appearance. Block size can be animated.",
  canAnimate: true,
  realtimeSafe: true,
};