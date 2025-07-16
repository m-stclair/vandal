import {valmap} from "./helpers.js";

export function resolveAnim(p, t) {
    if (typeof p !== "object" || p instanceof Array) return p;
    const {value, mod} = p;
    if (!mod || mod.type === "none") return value;
    const {type, freq = 1, phase = 0, scale = 1, offset = 0} = mod;
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
    return offset + scale * wave;
}

export const resolveAnimAll = (params, t) => valmap((p) => resolveAnim(p, t), params)

// TODO: fix this
export function clampAnimationParams(min, max, bias) {
    return [bias, max];
}