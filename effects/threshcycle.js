/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
import { resolveAnimAll} from "../utils/animutils.js";
import {hsl2Rgb, rgb2Hsl} from "../utils/colorutils.js";

/** @type {EffectModule} */
export default {
  name: "Threshcycle",

  defaultConfig: {
    threshold: 0.45,
    cycle: true,
    cycleMode: "spatial",
    hueShift: 180,
    saturation: 100,
    lightness: 50,
    hueSpread: 1,
    bleed: 0
  },

apply(instance, data, width, height, t) {
  const {
    cycle,
    saturation,
    lightness,
    cycleMode,
    hueShift,
    hueSpread,
    threshold,
    bleed
  } = resolveAnimAll(instance.config, t);
  const satNorm = saturation / 100;
  const lightNorm = lightness / 100;
  const out = new Float32Array(data.length);
  const period = 360 * hueSpread;
  const hsNorm = hueShift * hueSpread;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      const intensity = 0.299 * r + 0.587 * g + 0.114 * b;

      if (intensity < threshold) {
        out[i] = out[i + 1] = out[i + 2] = 0;
        out[i + 3] = a;
      } else if (cycle) {
        let localHue;
        if (cycleMode === "brightness") {
          const norm = (intensity - threshold) / (1 - threshold);
          localHue = (hsNorm + norm * period) % period;
        } else {
          localHue = (
              hsNorm
              + ((x - width / 2) ** 2 + (y - height / 2) ** 2) ** 0.5
          ) % period;
        }
        localHue /= period;
        if (bleed) {
          localHue = localHue * (1 - bleed) + rgb2Hsl(r, g, b)[0] * bleed;
        }
        const [nr, ng, nb] = hsl2Rgb(localHue, satNorm, lightNorm);
        out[i] = nr;
        out[i + 1] = ng;
        out[i + 2] = nb;
        out[i + 3] = a;
      } else {
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
        out[i + 3] = a;
      }
    }
  }
  return out;
},

  uiLayout: [
    { type: "modSlider", key: "threshold", label: "Threshold", min: 0, max: 1, step: 0.005 },
    { type: "checkbox", key: "cycle", label: "Cycle" },
    { type: "select", key: "cycleMode", label: "Cycle Mode", options: ["spatial", "brightness"] },
    { type: "modSlider", key: "hueShift", label: "Hue Shift", min: 0, max: 360, step: 1 },
    { type: "modSlider", key: "hueSpread", label: "Hue Spread", min: 0.05, max: 4, step: 0.05 },
    { type: "range", key: "saturation", label: "Saturation", min: 0, max: 100, step: 1 },
    { type: "range", key: "lightness", label: "Lightness", min: 0, max: 100, step: 1 },
    { type: "range", key: "bleed", label: "Bleed", min: 0, max: 1, step: 0.01 },
  ]
};