/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Scanlines",
    defaultConfig: {
        lineSpacing: 4,
        intensity: 0.3,
    },

    apply(instance, imageData) {
        const {lineSpacing, intensity} = instance.config;
        const {width, height, data} = imageData;
        const copy = new Uint8ClampedArray(data);

        for (let y = 0; y < imageData.height; y++) {
            if (y % lineSpacing === 0) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    copy[i] = data[i] * (1 - intensity);
                    copy[i + 1] = data[i + 1] * (1 - intensity);
                    copy[i + 2] = data[i + 2] * (1 - intensity);
                }
            }
        }
        return new ImageData(copy, width, height)
    },

    uiLayout: [
        {type: "range", key: "lineSpacing", label: "Line Spacing", min: 1, max: 20, step: 1},
        {type: "range", key: "intensity", label: "Intensity", min: 0.1, max: 1, step: 0.1}
    ]
}