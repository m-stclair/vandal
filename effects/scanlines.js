/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
import {resolveAnimAll} from "../utils/animutils.js";

/** @type {EffectModule} */
export default {
    name: "Scanlines",
    defaultConfig: {
        lineSpacing: 4,
        intensity: 0.3,
        phase: 0
    },

    apply(instance, data, width, height, t) {
        const {lineSpacing, intensity, phase} = resolveAnimAll(instance.config, t);
        const phaseNorm = Math.round(phase * height);
        const copy = new Float32Array(data);

        for (let y = 0; y < height; y++) {
            if ((y + phaseNorm) % lineSpacing === 0) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    copy[i] = data[i] * (1 - intensity);
                    copy[i + 1] = data[i + 1] * (1 - intensity);
                    copy[i + 2] = data[i + 2] * (1 - intensity);
                }
            }
        }
        return copy;
    },

    uiLayout: [
        {type: "modSlider", key: "lineSpacing", label: "Line Spacing", min: 1, max: 20, step: 1},
        {type: "modSlider", key: "phase", label: "Phase", min: -1, max: 1, step: 0.01},
        {type: "modSlider", key: "intensity", label: "Intensity", min: 0.1, max: 1, step: 0.1}
    ]
}


export const effectMeta = {
  group: "Stylize",
  tags: ["scanlines", "retro", "overlay", "cpu", "patterns"],
  description: "Adds horizontal scanlines simulate CRT-style rendering artifacts.",
  canAnimate: true,
  realtimeSafe: true,
};

