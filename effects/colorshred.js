import {shred} from "./shredutils.js";
import {hist1D, val2Bin} from "../utils/mathutils.js";

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Colorshred",

    defaultConfig: {
        density: 0.2,
        flip: false
    },

    apply(instance, data, _width, _height, _t) {
        const {density} = instance.config;

        // Separate channels
        const channels = [[], [], []]; // R, G, B

        for (let i = 0; i < data.length; i += 4) {
            channels[0].push(data[i]);
            channels[1].push(data[i + 1]);
            channels[2].push(data[i + 2]);
        }

        // Shred each channel
        const shredded = channels.map(channel => {
            const binsToReplace = new Set;
            const counts = new Map(hist1D(channel, 512, 0, 1).entries());
            for (let b = 0; b < 512; b++) {
                if (Math.random() < density) {
                    binsToReplace.add(b);
                }
            }
            const binIxs = channel.map((v) => val2Bin(v, 0, 512));
            return shred(binIxs, binsToReplace, counts).map((v) => v / 512);
        });

        const result = new Float32Array(data.length);
        // Reassemble into RGBA
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            result[i] = shredded[0][j];
            result[i + 1] = shredded[1][j];
            result[i + 2] = shredded[2][j];
            result[i + 3] = data[i + 3]; // preserve alpha
        }
        return result
    },

    uiLayout: [
        {type: "modSlider", key: "density", label: "Density", min: 0, max: 1, step: 0.02},
        {type: "checkbox", key: "flip", label: "Flip"}
    ]
}



