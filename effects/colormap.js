import {colormaps} from "../utils/colormaps.js";

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Colormap",

    defaultConfig: {
        colormap: "orange_teal"
    },

    uiLayout: [
        {
            type: "select",
            key: "colormap",
            label: "Colormap",
            options: Object.keys(colormaps)
        }
    ],

    apply(instance, inputImageData) {
        const width = inputImageData.width;
        const height = inputImageData.height;

        const inputCanvas = new OffscreenCanvas(width, height);
        const inputCtx = inputCanvas.getContext("2d");
        inputCtx.putImageData(inputImageData, 0, 0);

        const inputData = inputCtx.getImageData(0, 0, width, height);
        const outputData = inputCtx.createImageData(width, height);

        const map = colormaps[instance.config.colormap] ?? colormaps.grayscale;

        for (let i = 0; i < inputData.data.length; i += 4) {
            const r = inputData.data[i];
            const g = inputData.data[i + 1];
            const b = inputData.data[i + 2];

            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            const [r1, g1, b1] = map(lum);

            outputData.data[i] = r1;
            outputData.data[i + 1] = g1;
            outputData.data[i + 2] = b1;
            outputData.data[i + 3] = 255;
        }

        return outputData;
    }
}
