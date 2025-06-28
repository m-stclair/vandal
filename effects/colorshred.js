import {shred, histogram} from "./shredutils.js";

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Colorshred",

    defaultConfig: {
        density: 0.2,
        flip: false
    },

    apply(instance, imageData) {
        const {density, flip} = instance.config;
        const {width, height, data} = imageData;

        // Separate channels
        const channels = [[], [], []]; // R, G, B

        for (let i = 0; i < data.length; i += 4) {
            channels[0].push(data[i]);
            channels[1].push(data[i + 1]);
            channels[2].push(data[i + 2]);
        }

        // Shred each channel
        const shredded = channels.map(channel => {
            const counts = histogram(channel);
            const allValues = Array.from(counts.keys());
            const valuesToReplace = new Set;
            for (let v of allValues) {
                if (Math.random() < density) {
                    valuesToReplace.add(v);
                }
            }
            return shred(channel, valuesToReplace, counts, flip);
        });

        const result = new Uint8ClampedArray(data.length);
        // Reassemble into RGBA
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            result[i] = shredded[0][j];
            result[i + 1] = shredded[1][j];
            result[i + 2] = shredded[2][j];
            result[i + 3] = data[i + 3]; // preserve alpha
        }

        return new ImageData(result, width, height);
    },

    uiLayout: [
        {type: "range", key: "density", label: "Density", min: 0, max: 1, step: 0.02},
        {type: "checkbox", key: "flip", label: "Flip"}
    ]
}



