import {splitChannels, combineChannels} from "./channelutils.js";

function arrMin(arr) {
    return arr.reduce((a, b) => Math.min(a, b), Infinity);
}

function arrMax(arr) {
    return arr.reduce((a, b) => Math.max(a, b), -Infinity);
}

function normalizeRange(data, lo, hi, targetMin = 0, targetMax = 255) {
    if (hi === undefined) hi = arrMax(data);
    if (lo === undefined) lo = arrMin(data);
    const range = hi - lo;
    const scale = (targetMax - targetMin) / range;
    const output = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i++) {
        const val = Math.min(Math.max(data[i], lo), hi);
        output[i] = ((val - lo) * scale + targetMin);
    }
    return output;
}

function percentileClip(data, percentileLow = 1, percentileHigh = 99) {
    const sorted = Array.from(data).sort((a, b) => a - b);
    const lo = sorted[Math.floor((percentileLow / 100) * (sorted.length - 1))];
    const hi = sorted[Math.ceil((percentileHigh / 100) * (sorted.length - 1))];
    return normalizeRange(data, lo, hi);
}

function stddevClip(data, sigma = 1) {
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(data.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const lo = mean - sigma * std;
    const hi = mean + sigma * std;
    return normalizeRange(data, lo, hi);
}

function minmaxClip(data, stretch = [0, 0]) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min;
    const lo = min + stretch[0] * span;
    const hi = max - stretch[1] * span;
    return normalizeRange(data, lo, hi);
}

function channelwise(data, width, height, stretchFunc, ...stretchArgs) {
    const { r, g, b, a } = splitChannels(data, width, height);
    const [rNew, gNew, bNew] = [r, g, b].map(c => stretchFunc(c, ...stretchArgs));
    return combineChannels({ r: rNew, g: gNew, b: bNew, a, width, height });
}

export {
    normalizeRange,
    percentileClip,
    stddevClip,
    minmaxClip,
    channelwise
};
