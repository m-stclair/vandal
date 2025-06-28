import {getImageStats, rgb2lab_A, lab2rgb_A} from "./paletteutils.js";

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Reinhard Transfer",
    defaultConfig: {
        referenceImageId: null,
        strength: 1.0
    },
    uiLayout: [
        {
            type: "referenceImage",
            key: "referenceImageId",
            label: "Style Source"
        },
        {
            type: "range",
            key: "strength",
            label: "Transfer Strength",
            min: 0,
            max: 1,
            step: 0.01
        }
    ],

    apply(instance, imageData) {
        const {referenceImageId, strength} = instance.config;
        const referenceImage = instance.auxiliaryCache.referenceImage;
        if (!referenceImageId || !referenceImage) {
            return imageData; // No style source: passthrough
        }
        const cacheKey = `stats-${referenceImageId}`;
        if (!instance.auxiliaryCache[cacheKey]) {
            const reflab = rgb2lab_A(referenceImage.data);
            instance.auxiliaryCache[cacheKey] = getImageStats(reflab);
        }
        const sourceStats = instance.auxiliaryCache[cacheKey];
        const inputLabA = rgb2lab_A(imageData.data);
        const inputStats = getImageStats(inputLabA);
        const outLabA = [];

        for (let i = 0; i < inputLabA.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                const x = inputLabA[i + c];
                const centered = x - inputStats.mean[c];
                const scaled = centered * (sourceStats.std[c] / inputStats.std[c]);
                const shifted = scaled + sourceStats.mean[c];
                outLabA[i + c] = (1 - strength) * x + strength * shifted;
            }
            outLabA[i + 3] = inputLabA[i + 3]; // Alpha passthrough
        }
        const outRGBA = new Uint8ClampedArray(lab2rgb_A(outLabA));
        return new ImageData(outRGBA, imageData.width, imageData.height);
    },

    initHook(instance) {
        instance.auxiliaryCache = {
            referenceImage: null
        };
    },

    cleanupHook(instance) {
        instance.auxiliaryCache.referenceImage = null;
    }
}
