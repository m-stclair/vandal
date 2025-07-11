/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
import {resolveAnimAll} from "../utils/animutils.js";

/** @type {EffectModule} */
export default {
    name: "Slow Posterize",

    defaultConfig: {
        levels: 6,
        perChannel: true,
        mode: 'uniform', // 'uniform' | 'log' | 'gamma' | 'threshold'
        gamma: 2.2, // only used if mode === 'gamma'
        preserveAlpha: true
    },

    apply(instance, data, width, height, t) {
        const {levels, perChannel, mode, gamma, preserveAlpha} = resolveAnimAll(instance.config, t);

        const copy = new Float32Array(data);

        const quantize = (value, levels) => {
            switch (mode) {
                case 'log': {
                    const compressed = Math.pow(value, 0.8);
                    const step = 1 / levels;
                    return Math.round(compressed / step) * step;
                }
                case 'gamma': {
                    const gammaCorrected = Math.pow(value, gamma);
                    const step = 1 / levels;
                    const quant = Math.round(gammaCorrected / step) * step;
                    return Math.pow(quant, 1 / gamma)
                }
                case 'threshold': {
                    return value <= 0.5 ? 0 : 1;
                }
                case 'uniform':
                default: {
                    const step = 1 / levels;
                    return Math.floor(value / step) * step;
                }
            }
        };

        for (let i = 0; i < data.length; i += 4) {
            if (perChannel) {
                copy[i] = quantize(data[i], levels);
                copy[i + 1] = quantize(data[i + 1], levels);
                copy[i + 2] = quantize(data[i + 2], levels);
            } else {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                const q = quantize(avg, levels);
                copy[i] = copy[i + 1] = copy[i + 2] = q;
            }
            if (!preserveAlpha) {
                copy[i + 3] = quantize(data[i + 3], levels);
            }
        }
        return copy;
    },

    uiLayout: [
        {
            key: 'levels',
            type: 'modSlider',
            label: 'Levels',
            min: 2,
            max: 32,
            step: 1,
        },
        {
            key: 'perChannel',
            type: 'checkbox',
            label: 'Separate Channels',
        },
        {
            key: 'mode',
            type: 'select',
            label: 'Quantization Mode',
            options: [
                {value: 'uniform', label: 'Uniform'},
                {value: 'log', label: 'Logarithmic'},
                {value: 'gamma', label: 'Gamma-Corrected'},
                {value: 'threshold', label: 'Binary Threshold'}
            ],
        },
        {
            key: 'gamma',
            type: 'modSlider',
            label: 'Gamma (for Gamma mode)',
            min: 0.1,
            max: 5,
            step: 0.1,
            showIf: config => config.mode === 'gamma'
        },
        {
            key: 'preserveAlpha',
            type: 'checkbox',
            label: 'Preserve Alpha',
        }
    ],
}

export const effectMeta = {
  group: "Color",
  tags: ["quantize", "posterize", "color", "cpu"],
  description: "Configurable classic posterization. Reduces the number of " +
      "available luminance or channel levels, with various quantization options. " +
      "Slow. Use the GL one.",
  canAnimate: true,
  realtimeSafe: true,
};