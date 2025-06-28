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

function fastPercentileClip(data, percentileLow = 1, percentileHigh = 99) {

    const hist = new Uint32Array(256);  // assumes 8-bit input
    for (let i = 0; i < data.length; i++) hist[data[i]]++;

    const total = data.length;
    const loThresh = (percentileLow / 100) * total;
    const hiThresh = (percentileHigh / 100) * total;

    let sum = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i++) {
        sum += hist[i];
        if (sum >= loThresh) { lo = i; break; }
    }
    sum = 0;
    for (let i = 255; i >= 0; i--) {
        sum += hist[i];
        if (sum >= total - hiThresh) { hi = i; break; }
    }

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
    fastPercentileClip,
    stddevClip,
    minmaxClip,
    channelwise
};
