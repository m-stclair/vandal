/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
import {resolveAnim} from "../utils/animutils.js";

/** @type {EffectModule} */
export default {
  name: "Threshcycle",

  defaultConfig: {
    threshold: 128,
    cycle: true,
    cycleMode: "spatial",
    hueShift: 180,   // degrees
    saturation: 100, // percent
    lightness: 50    // percent
  },

apply(instance, imageData, t) {
  const { width, height, data } = imageData;
  const {
    cycle,
    saturation,
    lightness,
    cycleMode
  } = instance.config;
  const hueShift = resolveAnim(instance.config.hueShift, t);
  const threshold = resolveAnim(instance.config.threshold, t);

  const out = new Uint8ClampedArray(data.length);

  const hslToRgb = (h, s, l) => {
    h /= 360;
    s /= 100;
    l /= 100;
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1/3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1/3) * 255)
    ];
  };

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
          const norm = (intensity - threshold) / (255 - threshold);  // 0 to 1
          localHue = (hueShift + norm * 360) % 360;
        } else {
          localHue = (hueShift + x * 0.5 + y * 0.3) % 360;
        }
        const [nr, ng, nb] = hslToRgb(localHue, saturation, lightness);
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
  return new ImageData(out, width, height);
},

  uiLayout: [
    { type: "modSlider", key: "threshold", label: "Threshold", min: 0, max: 255, step: 1 },
    { type: "checkbox", key: "cycle", label: "Cycle" },
    { type: "select", key: "cycleMode", label: "Cycle Mode", options: ["spatial", "brightness"] },
    { type: "modSlider", key: "hueShift", label: "Hue Shift", min: 0, max: 360, step: 1 },
    { type: "range", key: "saturation", label: "Saturation", min: 0, max: 100, step: 1 },
    { type: "range", key: "lightness", label: "Lightness", min: 0, max: 100, step: 1 }
  ]
};