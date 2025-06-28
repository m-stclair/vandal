/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: 'Blur',

    defaultConfig: {
        intensity: 1
    },

    apply(instance, imgData) {
        const {width, height, data} = imgData;
        const output = new Uint8ClampedArray(data);
        const getIndex = (x, y) => 4 * (y * width + x);
        const radius = instance.config.intensity;

        for (let y = radius; y < height - radius; y++) {
            for (let x = radius; x < width - radius; x++) {
                let r = 0, g = 0, b = 0, a = 0, count = 0;
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const i = getIndex(x + dx, y + dy);
                        r += data[i];
                        g += data[i + 1];
                        b += data[i + 2];
                        a += data[i + 3];
                        count++;
                    }
                }
                const i = getIndex(x, y);
                output[i] = r / count;
                output[i + 1] = g / count;
                output[i + 2] = b / count;
                output[i + 3] = a / count;
            }
        }

        return new ImageData(output, width, height);
    },

    uiLayout: [
      { type: "range", key: "intensity", label: "Intensity", min: 1, max: 5, step: 1 }
    ],
}