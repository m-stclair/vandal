import { makeSampler } from './shredutils.js';

function shredTuples(imageData, valuesToReplace, counts, flip = false) {
    const { data, width, height } = imageData;
    const valueSet = new Set(valuesToReplace.map(v => v.join(',')));
    const result = new Uint8ClampedArray(data.length);

    const allKeys = Array.from(counts.keys());
    const replacementPool = flip
        ? allKeys.filter(k => valueSet.has(k))
        : allKeys.filter(k => !valueSet.has(k));

    const weights = replacementPool.map(k => counts.get(k));
    const total = weights.reduce((a, b) => a + b, 0);
    const sampler = makeSampler(weights.map(w => w / total));

    for (let i = 0; i < data.length; i += 4) {
        const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
        const match = valueSet.has(key);
        const shouldReplace = match !== flip;

        if (shouldReplace) {
            const [r, g, b] = sampler(replacementPool).split(',').map(Number);
            result[i]     = r;
            result[i + 1] = g;
            result[i + 2] = b;
        } else {
            result[i]     = data[i];
            result[i + 1] = data[i + 1];
            result[i + 2] = data[i + 2];
        }

        result[i + 3] = data[i + 3]; // preserve alpha
    }

    return new ImageData(result, width, height);
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "JointShred",

    defaultConfig: {
        density: 0.25,
        flip: false
    },

    apply(instance, imageData) {
        const { data } = imageData;
        const counts = new Map();

        for (let i = 0; i < data.length; i += 4) {
            const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        const valuesToReplace = [];
        for (let key of counts.keys()) {
            if (Math.random() < instance.config.density) {
                valuesToReplace.push(key.split(',').map(Number));
            }
        }

        return shredTuples(imageData, valuesToReplace, counts, instance.config.flip);
    },

    uiLayout: [
        { type: "range", key: "density", label: "Density", min: 0, max: 1, step: 0.02 },
        { type: "checkbox", key: "flip", label: "Flip" }
    ]
};