// affine_transform.js

import {deg2rad, rotationMatrix2D, shearMatrix2D, scaleMatrix2D, multiplyMat2} from "../utils/mathutils.js";
import {loadFragInit} from "../utils/load_runner.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect} from "../utils/gl.js";

const fragURL = new URL("../shaders/affine_transform.frag", import.meta.url);
fragURL.searchParams.set("v", Date.now());
const fragSource = loadFragInit(fragURL);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Affine Transform (GL)",

    defaultConfig: {
        angle: 0,
        shearX: 0,
        shearY: 0,
        scaleX: 1,
        scaleY: 1,
        translateX: 0,
        translateY: 0,
        wrap: false
    },

    uiLayout: [
        {key: "angle", label: "Rotate (°)", type: "modSlider", min: -180, max: 180},
        {
            key: "scaleX",
            label: "Scale X",
            type: "modSlider",
            min: 0.1,
            max: 10,
            step: 0.05,
            scale: "log",
            scaleFactor: 3
        },
        {
            key: "scaleY",
            label: "Scale Y",
            type: "modSlider",
            min: 0.1,
            max: 10,
            step: 0.05,
            scale: "log",
            scaleFactor: 3
        },
        {key: "shearX", label: "Shear X", type: "modSlider", min: -3, max: 3, step: 0.02},
        {key: "shearY", label: "Shear Y", type: "modSlider", min: -3, max: 3, step: 0.02},
        {key: "translateX", label: "Translate X", type: "modSlider", min: -1, max: 1, step: 0.01},
        {key: "translateY", label: "Translate Y", type: "modSlider", min: -1, max: 1, step: 0.01},
        {key: "wrap", label: "Wrap", type: "checkbox"}
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSource);
        const {
            angle,
            shearX,
            shearY,
            scaleX,
            scaleY,
            translateX,
            translateY,
            wrap
        } = resolveAnimAll(instance.config, t);

        const rot = rotationMatrix2D(deg2rad(angle));
        const shear = shearMatrix2D(shearX, shearY);
        const scale = scaleMatrix2D(scaleX, scaleY);
        const affine = multiplyMat2(rot, multiplyMat2(shear, scale));

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_affine: {value: affine, type: "mat2"},
            u_offset: {value: [translateX, translateY], type: "vec2"},
            u_wrap: {value: wrap, type: "bool"},
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec);
    },
    initHook: fragSource.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
}

export const effectMeta = {
  group: "Geometry",
  tags: ["webgl", "geometry", "transform", "realtime"],
  description: "Applies a GPU-accelerated affine transformation using a " +
      "configurable matrix.",
  canAnimate: true,
  realtimeSafe: true,
}
