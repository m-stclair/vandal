import {combineChannels, splitChannels} from "../channelutils.js";

function adjustColorChannels(r, g, b, config) {
    const { brightness, contrast, saturation } = config;

    const outR = new Uint8ClampedArray(r.length);
    const outG = new Uint8ClampedArray(g.length);
    const outB = new Uint8ClampedArray(b.length);

    for (let i = 0; i < r.length; i++) {
        // Normalize input if needed
        const rin = r[i] / 255;
        const gin = g[i] / 255;
        const bin = b[i] / 255;

        // Brightness + contrast
        let rr = (rin - 0.5) * contrast + 0.5 + brightness;
        let gg = (gin - 0.5) * contrast + 0.5 + brightness;
        let bb = (bin - 0.5) * contrast + 0.5 + brightness;

        // Luminance (still in [0,1])
        const lum = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;

        // Saturation blend
        rr = lum + (rr - lum) * saturation;
        gg = lum + (gg - lum) * saturation;
        bb = lum + (bb - lum) * saturation;

        // Clamp and scale to 0–255
        outR[i] = Math.round(Math.min(1, Math.max(0, rr)) * 255);
        outG[i] = Math.round(Math.min(1, Math.max(0, gg)) * 255);
        outB[i] = Math.round(Math.min(1, Math.max(0, bb)) * 255);
    }

    return { r: outR, g: outG, b: outB };
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Brightness/Contrast/Saturation",

    defaultConfig: {
        brightness: 0.0,   // -1 to 1
        contrast: 1.0,     // 0 to 4
        saturation: 1.0,   // 0 to 4
     },

    apply(imageData, config) {
        const {data, width, height} = imageData;
        const {r, g, b, a} = splitChannels(data, width, height);
        const adjusted = adjustColorChannels(r, g, b, config);
        return new ImageData(
            combineChannels({...adjusted, a, width, height}), width, height
        )
    },

    uiLayout: [
        {
            key: "brightness",
            label: "Brightness",
            type: "range",
            min: -1,
            max: 1,
            step: 0.01,
        },
        {
            key: "contrast",
            label: "Contrast",
            type: "range",
            min: 0,
            max: 4,
            step: 0.01,
        },
        {
            key: "saturation",
            label: "Saturation",
            type: "range",
            min: 0,
            max: 4,
            step: 0.01,
        },
    ]

}

