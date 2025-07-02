import {colormaps} from "../utils/colormaps.js";

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Colormap",

    defaultConfig: {
        colormap: "orange_teal",
        reverse: false
    },

    uiLayout: [
        {
            type: "select",
            key: "colormap",
            label: "Colormap",
            options: Object.keys(colormaps)
        },
        {
            type: "checkbox",
            key: "reverse",
            label: "Reverse",
        }

    ],

    apply(instance, data, _width, _height) {
        let base = colormaps[instance.config.colormap] ?? colormaps.grayscale;
        let map = base;
        if (instance.config.reverse) map = (l) => base(1 - l);
        const out = new Float32Array(data.length);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Standard luminance from linear RGB
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            const [r1, g1, b1] = map(lum);

            out[i] = r1;
            out[i + 1] = g1;
            out[i + 2] = b1;
            out[i + 3] = 1.0; // fully opaque
        }

        return out;
    }
};
