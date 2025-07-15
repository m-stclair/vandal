import {valmap} from "./helpers.js";

export function resolveAnim(p, t) {
    if (typeof p !== "object" || p instanceof Array) return p;
    const {value, mod} = p;
    if (!mod || mod.type === "none") return value;
    const {type, freq = 1, phase = 0, scale = 1, offset = 0, rangeMode = "bipolar"} = mod;
    const phi = (t * freq + phase) % 1;
    let wave;
    switch (type) {
        case "sine":
            wave = Math.sin(phi * 2 * Math.PI);
            break;
        case "square":
            wave = phi < 0.5 ? 1 : -1;
            break;
        case "triangle":
            wave = 2 * Math.abs(2 * phi - 1) - 1;
            break;
        case "saw":
            wave = 2 * phi - 1;
            break;
        default:
            wave = 0;
    }
    if (rangeMode === "unipolar") wave = 0.5 * (wave + 1);

    return offset + scale * wave;
}

export const resolveAnimAll = (params, t) => valmap((p) => resolveAnim(p, t), params)

export function clampAnimationParams(min, max, bias, rangeMode) {
    if (rangeMode === "unipolar") {
        const safeDepth = Math.abs(max - bias);
        return [bias, max];
    } else {
        return [bias, max]
        // const safeDepth = Math.min(Math.abs(bias - min), Math.abs(max - bias));
        // return [bias, Math.max(0, safeDepth)];
    }
}