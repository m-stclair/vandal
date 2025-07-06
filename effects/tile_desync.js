/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
import {resolveAnimAll} from "../utils/animutils.js";

/** @type {EffectModule} */
export default {
    name: "Desync Tiles",

    defaultConfig: {
        tileSize: 32,
        corruptionRate: 0.3,
        maxOffset: 10,
        freezeTiles: false  // placeholder; not used yet
    },

    apply(instance, data, width, height, t) {
        const {
            tileSize,
            corruptionRate,
            maxOffset
        } = resolveAnimAll(instance.config);

        const output = new Float32Array(data.length);
        const getIndex = (x, y) => (y * width + x) * 4;

        // Copy each tile individually
        for (let tileY = 0; tileY < height; tileY += tileSize) {
            for (let tileX = 0; tileX < width; tileX += tileSize) {
                const corrupt = Math.random() < corruptionRate;

                let srcX = tileX;
                let srcY = tileY;


                if (corrupt) {
                    const dx = Math.floor((Math.random() * 2 - 1) * maxOffset);
                    const dy = Math.floor((Math.random() * 2 - 1) * maxOffset);
                    srcX = Math.max(0, Math.min(width - tileSize, tileX + dx));
                    srcY = Math.max(0, Math.min(height - tileSize, tileY + dy));
                }

                // Copy tile
                for (let y = 0; y < tileSize; y++) {
                    for (let x = 0; x < tileSize; x++) {
                        const srcPx = getIndex(srcX + x, srcY + y);
                        const dstPx = getIndex(tileX + x, tileY + y);

                        if ((tileX + x) < width && (tileY + y) < height) {
                            output[dstPx] = data[srcPx];
                            output[dstPx + 1] = data[srcPx + 1];
                            output[dstPx + 2] = data[srcPx + 2];
                            output[dstPx + 3] = data[srcPx + 3];
                        }
                    }
                }
            }
        }

        return output;
    },

    uiLayout: [
        {type: "modSlider", key: "tileSize", label: "Tile Size", min: 4, max: 64, step: 4},
        {type: "modSlider", key: "corruptionRate", label: "Corruption Rate", min: 0, max: 1, step: 0.01},
        {type: "modSlider", key: "maxOffset", label: "Max Offset", min: 0, max: 32, step: 1},
        {type: "checkbox", key: "freezeTiles", label: "Freeze Tiles"}
    ],
};

export const effectMeta = {
  group: "Glitch",
  tags: ["tile", "offset", "glitch", "cpu", "displacement"],
  description: "Divides the image into tiles and desynchronizes their positions. " +
      "Can produce glassy noise, jittery breakup effects, and geometric confusion.",
  canAnimate: true,
  realtimeSafe: true,
};