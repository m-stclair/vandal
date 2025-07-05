/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
import { resolveAnimAll} from "../utils/animutils.js";
import {hsl2Rgb, rgb2Hsl} from "../utils/colorutils.js";

/** @type {EffectModule} */
export default {
  name: "Chromawave",

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
  let hsNorm, period;
  if (cycleMode === "brightness") {
    hsNorm = hueShift / 180 - 1;
    period = hueSpread ** 0.8;
  } else {
    hsNorm = hueShift / 360 * (width + height) / 2;
    period = 360 * hueSpread;
  }
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
          localHue = (hsNorm + norm) % period;
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

export const effectMeta = {
  group: "Glitch",
  tags: ["threshold", "chromatic", "cpu"],
  description: "Recolors light areas of the image using a synthetic hue gradient, " +
      "based on either spatial distance from the center or relative brightness. Dark areas are " +
      "masked out. The hue field can radiate in concentric cycles (spatial mode) or encode " +
      "brightness levels (brightness mode), with optional interpolation toward the original hue. " +
      "Useful for creating radiant overlays, ink-on-pastel, false-color maps, or psychedelic sunburst effects.",
  canAnimate: true,
  realtimeSafe: true,
};