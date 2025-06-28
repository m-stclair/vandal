/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
  name: "Banded Flip",

  defaultConfig: {
    bandSize: 32,
    orientation: "horizontal", // or "vertical"
    mirrorRate: 0.5,
    offset: 0
  },

  apply(imageData, config) {
    const { width, height, data } = imageData;
    const { bandSize, orientation, mirrorRate, offset } = config;

    const out = new Uint8ClampedArray(data.length);
    const getIndex = (x, y) => (y * width + x) * 4;

    const mirrorBand = (x, y, mirrored) => {
      if (orientation === "horizontal") {
        const slabY = Math.floor(y / bandSize) * bandSize;
        const within = y - slabY;
        const srcY = mirrored ? slabY + bandSize - within - 1 : y;
        const offsetX = x + (mirrored ? offset : 0);
        return [Math.max(0, Math.min(width - 1, offsetX)), Math.max(0, Math.min(height - 1, srcY))];
      } else {
        const slabX = Math.floor(x / bandSize) * bandSize;
        const within = x - slabX;
        const srcX = mirrored ? slabX + bandSize - within - 1 : x;
        const offsetY = y + (mirrored ? offset : 0);
        return [Math.max(0, Math.min(width - 1, srcX)), Math.max(0, Math.min(height - 1, offsetY))];
      }
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bandIndex = orientation === "horizontal"
          ? Math.floor(y / bandSize)
          : Math.floor(x / bandSize);

        const mirrored = Math.random() < mirrorRate;

        const [srcX, srcY] = mirrorBand(x, y, mirrored);
        const src = getIndex(srcX, srcY);
        const dst = getIndex(x, y);

        out[dst]     = data[src];
        out[dst + 1] = data[src + 1];
        out[dst + 2] = data[src + 2];
        out[dst + 3] = data[src + 3];
      }
    }

    return new ImageData(out, width, height);
  },

  uiLayout: [
    {'type': 'range', 'key': 'bandSize', 'label': 'Band Size', 'min': 4, 'max': 128, 'step': 4},
    {'type': 'select', 'key': 'orientation', 'label': 'Orientation', 'options': ['horizontal', 'vertical']},
    {'type': 'range', 'key': 'mirrorRate', 'label': 'Mirror Rate', 'min': 0, 'max': 1, 'step': 0.01},
    {'type': 'range', 'key': 'offset', 'label': 'Offset', 'min': -32, 'max': 32, 'step': 1}
  ],


};
