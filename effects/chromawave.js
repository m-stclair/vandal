/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
import {resolveAnimAll} from "../utils/animutils.js";
import {hsl2Rgb, rgb2Hsl} from "../utils/colorutils.js";
import {clamp} from "../utils/mathutils.js";

function sigmoid(x, center = 0.5, sharpness = 1) {
    return 1 / (1 + Math.exp(-sharpness * (x - center)));
}

function apply_constant_chromawave(
    data, width, height, out, threshold, hueShift, hueSpread,
    saturation, lightness, bleed
) {
    const satNorm = (saturation * 2 - 100) / 100;
    const lightNorm = (lightness * 2 - 100) / 100;
    const shiftNorm = (hueShift + 180) / 90;
    const spreadNorm = (hueSpread / 8);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            const intensity = 0.299 * r + 0.587 * g + 0.114 * b;
            if (intensity < threshold) {
                out[i] = out[i + 1] = out[i + 2] = 0;
                out[i + 3] = a;
            } else {
                const [h, s, l] = rgb2Hsl(r, g, b);
                let h0 = (sigmoid(h + shiftNorm, h, spreadNorm) - h) % 1;
                h0 = h0 * (1 - bleed) + h * bleed;
                const s0 = clamp(satNorm + s, 0, 1);
                const l0 = lightNorm + l;
                const [r0, g0, b0] = hsl2Rgb(h0, s0, l0);
                out[i] = r0;
                out[i + 1] = g0;
                out[i + 2] = b0;
                out[i + 3] = a;
            }
        }
    }
}

function apply_cycling_chromawave(
    data, width, height, out, threshold, hueShift, hueSpread,
    saturation, lightness, cycleMode, bleed
) {
    const satNorm = saturation / 100;
    const lightNorm = lightness / 100;
    let hsNorm, period;
    if (cycleMode === "brightness") {
        hsNorm = hueShift / 180 - 1;
        period = hueSpread ** 0.8;
    } else {
        hsNorm = hueShift / 360 * (width + height) / 2;
        period = 360 * hueSpread;
    }
    const halfHeight = height / 2;
    const halfWidth = width / 2;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            const intensity = 0.299 * r + 0.587 * g + 0.114 * b;

            if (intensity < threshold) {
                out[i] = out[i + 1] = out[i + 2] = 0;
                out[i + 3] = a;
            } else {
                let localHue;
                if (cycleMode === "brightness") {
                    const norm = (intensity - threshold) / (1 - threshold);
                    localHue = (hsNorm + norm) % period;
                } else {
                    localHue = (
                        hsNorm
                        + ((x - halfWidth) ** 2 + (y - halfHeight) ** 2) ** 0.5
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
            }
        }
    }
}

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
        const out = new Float32Array(data.length);
        if (!cycle) {
            apply_constant_chromawave(
                data, width, height, out, threshold, hueShift, hueSpread,
                saturation, lightness, bleed
            );
        } else {
            apply_cycling_chromawave(
                data, width, height, out, threshold, hueShift, hueSpread,
                saturation, lightness, cycleMode, bleed
            );
        }
        return out;
    },

    uiLayout: [
        {type: "modSlider", key: "threshold", label: "Threshold", min: 0, max: 1, step: 0.005},
        {type: "checkbox", key: "cycle", label: "Cycle"},
        {type: "select", key: "cycleMode", label: "Cycle Mode", options: ["spatial", "brightness"]},
        {type: "modSlider", key: "hueShift", label: "Hue Shift", min: 0, max: 360, step: 1},
        {type: "modSlider", key: "hueSpread", label: "Hue Spread", min: 0.05, max: 4, step: 0.05},
        {type: "range", key: "saturation", label: "Saturation", min: 0, max: 100, step: 1},
        {type: "range", key: "lightness", label: "Lightness", min: 0, max: 100, step: 1},
        {type: "range", key: "bleed", label: "Bleed", min: 0, max: 1, step: 0.01},
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