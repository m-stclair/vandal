/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
import {resolveAnimAll} from "../utils/animutils.js";

/** @type {EffectModule} */
export default {
  name: "Pixelate",

  defaultConfig: {
    blockSize: 8,
    sampleStrategy: 'average', // 'average' | 'center' | 'corner'
    preserveAlpha: true
  },

  uiLayout: [
    {type: 'modSlider', key: "blockSize", label: "Block Size", min: 1, max: 64, step: 1},
    {type: 'select', key: "sampleStrategy", label: "Sample Strategy", options: ['average', 'center', 'corner']},
    {type: 'checkbox', key: 'preserveAlpha', label: "Preserve Alpha"}
  ],

  apply(instance, data, width, height, t) {
    const {blockSize, sampleStrategy, preserveAlpha} = resolveAnimAll(instance.config, t);
    const copy = new Float32Array(data);

    const getIndex = (x, y) => 4 * (y * width + x);

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;

        const xEnd = Math.min(x + blockSize, width);
        const yEnd = Math.min(y + blockSize, height);

        if (sampleStrategy === 'center') {
          const sx = x + Math.floor(blockSize / 2);
          const sy = y + Math.floor(blockSize / 2);
          const idx = getIndex(Math.min(sx, width - 1), Math.min(sy, height - 1));
          r = data[idx];
          g = data[idx + 1];
          b = data[idx + 2];
          a = data[idx + 3];
        } else if (sampleStrategy === 'corner') {
          const idx = getIndex(x, y);
          r = data[idx];
          g = data[idx + 1];
          b = data[idx + 2];
          a = data[idx + 3];
        } else {
          for (let j = y; j < yEnd; j++) {
            for (let i = x; i < xEnd; i++) {
              const idx = getIndex(i, j);
              r += data[idx];
              g += data[idx + 1];
              b += data[idx + 2];
              if (!preserveAlpha) a += data[idx + 3];
              count++;
            }
          }
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          if (!preserveAlpha) a = Math.round(a / count);
          else a = 1;
        }

        for (let j = y; j < yEnd; j++) {
          for (let i = x; i < xEnd; i++) {
            const idx = getIndex(i, j);
            copy[idx] = r;
            copy[idx + 1] = g;
            copy[idx + 2] = b;
            copy[idx + 3] = a;
          }
        }
      }
    }
    return copy;
  }
}
