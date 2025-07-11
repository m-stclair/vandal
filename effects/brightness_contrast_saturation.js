import {combineChannels, splitChannels} from "../utils/imageutils.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {clamp} from "../utils/mathutils.js";

function adjustColorChannels(r, g, b, config) {
    const {brightness, contrast, saturation} = config;

    const outR = new Float32Array(r.length);
    const outG = new Float32Array(g.length);
    const outB = new Float32Array(b.length);

    for (let i = 0; i < r.length; i++) {
        let rr = (r[i] - 0.5) * contrast + 0.5 + brightness;
        let gg = (g[i] - 0.5) * contrast + 0.5 + brightness;
        let bb = (b[i] - 0.5) * contrast + 0.5 + brightness;

        const lum = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;

        rr = lum + (rr - lum) * saturation;
        gg = lum + (gg - lum) * saturation;
        bb = lum + (bb - lum) * saturation;

        outR[i] = clamp(rr, 0, 1);
        outG[i] = clamp(gg, 0, 1);
        outB[i] = clamp(bb, 0, 1);
    }

    return {r: outR, g: outG, b: outB};
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Slow B/C/S",

    defaultConfig: {
        brightness: 0.0,
        contrast: 1.0,
        saturation: 1.0,
    },

    apply(instance, data, width, height, t) {
        const {config} = instance;
        const {r, g, b, a} = splitChannels(data, width, height);
        const adjusted = adjustColorChannels(r, g, b, resolveAnimAll(config, t));
        return combineChannels({...adjusted, a, width, height})
    },

    uiLayout: [
        {
            key: "brightness",
            label: "Brightness",
            type: "modSlider",
            min: -1,
            max: 1,
            step: 0.01,
        },
        {
            key: "contrast",
            label: "Contrast",
            type: "modSlider",
            min: 0,
            max: 4,
            step: 0.01,
        },
        {
            key: "saturation",
            label: "Saturation",
            type: "modSlider",
            min: 0,
            max: 4,
            step: 0.01,
        },
    ]
}

export const effectMeta = {
  group: "Utility",
  tags: ["color", "brightness", "contrast", "saturation"],
  description: "Adjusts brightness, contrast, and saturation. Slow. Use the other one.",
  backend: "cpu",
  canAnimate: true,
  realtimeSafe: true,
};
