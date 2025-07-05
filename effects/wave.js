/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
import {resolveAnimAll} from "../utils/animutils.js";

/** @type {EffectModule} */
export default {
    name: "Wave Distortion",
    defaultConfig: {
        amplitude: 10,
        frequency: 1,
        direction: "horizontal"
    },

    apply(instance, data, width, height, t) {
        const {amplitude, frequency, direction} = resolveAnimAll(instance.config, t);
        const copy = new Float32Array(data);

        const getOffset = (x, y) => {
            const angle = direction === "horizontal" ? y * frequency * 0.1 : x * frequency * 0.1;
            return Math.round(Math.sin(angle) * amplitude);
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const offset = getOffset(x, y);
                let srcX = direction === "horizontal" ? x + offset : x;
                let srcY = direction === "vertical" ? y + offset : y;

                if (srcX < 0 || srcX >= width || srcY < 0 || srcY >= height) continue;

                const srcIndex = (srcY * width + srcX) * 4;
                const dstIndex = (y * width + x) * 4;
                copy[dstIndex] = data[srcIndex];
                copy[dstIndex + 1] = data[srcIndex + 1];
                copy[dstIndex + 2] = data[srcIndex + 2];
                copy[dstIndex + 3] = data[srcIndex + 3];
            }
        }
        return copy;
    },

    uiLayout: [
        {type: "select", key: "direction", label: "Direction", options: ["horizontal", "vertical"]},
        {type: "modSlider", key: "amplitude", label: "Amplitude", min: 1, max: 50, step: 1},
        {type: "modSlider", key: "frequency", label: "Frequency", min: 0.1, max: 5, step: 0.1}
    ]
}

export const effectMeta = {
  group: "Distortion",
  tags: ["patterns", "distortion"],
  description: "Distorts the image in regular wave patterns.",
  canAnimate: true,
  realtimeSafe: true,
};