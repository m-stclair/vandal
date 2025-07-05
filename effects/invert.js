import {combineChannels, splitChannels} from "../utils/imageutils.js";
import {colorSpaces} from "../utils/colorutils.js";


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Invert",

    defaultConfig: {
        invert0: true,
        invert1: true,
        invert2: true,
        mode: "rgb"
    },

    apply(instance, data, width, height) {
        const {invert0, invert1, invert2, mode} = instance.config;
        if (!(invert0 || invert1 || invert2)) return data;
        const colorspace = colorSpaces[mode];
        const {r, g, b, a} = splitChannels(data, width, height);
        const inv0 = invert0 ? -1 : 1;
        const off0 = invert0 ? 1 : 0;
        const inv1 = invert1 ? -1 : 1;
        const off1 = invert1 ? 1 : 0;
        const inv2 = invert2 ? -1 : 1;
        const off2 = invert2 ? 1 : 0;

        for (let i = 0; i < data.length; i++) {
            const cs = colorspace.to(r[i], g[i], b[i])
            const c00 = cs[0] * inv0 + off0;
            const c11 = cs[1] * inv1 + off1;
            const c22 = cs[2] * inv2 + off2;
            const rgb = colorspace.from(c00, c11, c22);
            r[i] = rgb[0];
            g[i] = rgb[1];
            b[i] = rgb[2];
        }
        return combineChannels({r, g, b, a, width, height})
    },
    uiLayout: [
        { type: "checkbox", key: "invert0", label: "R / H / L" },
        { type: "checkbox", key: "invert1", label: "G / S / a" },
        { type: "checkbox", key: "invert2", label: "B / V / b" },
        { type: "select", key: "mode", label: "Color Space", options: ["rgb", "hsl", "hsv", "lab"] },
    ]
}

export const effectMeta = {
  group: "Utility",
  tags: ["color", "luminance", "utility", "preprocessing"],
  description: "Inverts luminance and/or per-channel RGB. Useful for pre- " +
      "or post-processing",
  backend: "cpu",
  canAnimate: false,
  realtimeSafe: true,
};


