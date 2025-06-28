import {makeConfigHash} from "../utils.js";


export function rgb2lab_A(data) {
    const labData = [];
    for (let i = 0; i < data.length; i += 4) {
        const rgb = [data[i], data[i + 1], data[i + 2]];
        labData.push(...rgb2lab(...rgb), data[i + 3]);
    }
    return labData
}

export function lab2rgb_A(data) {
    const rgbData = [];
    for (let i = 0; i < data.length; i += 4) {
        const lab = [data[i], data[i + 1], data[i + 2]];
        rgbData.push(...lab2rgb(...lab), data[i + 3]);
    }
    return rgbData;
}


export function rgb2lab(r, g, b) {
    // Convert sRGB to linear RGB
    const srgb = [r, g, b].map(v => v / 255);
    const rgb = srgb.map(v =>
        v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    );

    // Linear RGB to XYZ (D65)
    const [rl, gl, bl] = rgb;
    const x = rl * 0.4124 + gl * 0.3576 + bl * 0.1805;
    const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
    const z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505;

    // Normalize by D65 white point
    const xn = x / 0.95047;
    const yn = y;
    const zn = z / 1.08883;

    const f = t => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116);

    const fx = f(xn);
    const fy = f(yn);
    const fz = f(zn);

    const L = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const b_ = 200 * (fy - fz);

    return [L, a, b_];
}

export function lab2rgb(L, a, b_) {
    const fy = (L + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - b_ / 200;

    const fInv = t =>
        Math.pow(t, 3) > 0.008856 ? Math.pow(t, 3) : (t - 16 / 116) / 7.787;

    const x = fInv(fx) * 0.95047;
    const y = fInv(fy);
    const z = fInv(fz) * 1.08883;

    // XYZ to linear RGB
    let rl = x * 3.2406 + y * -1.5372 + z * -0.4986;
    let gl = x * -0.9689 + y * 1.8758 + z * 0.0415;
    let bl = x * 0.0557 + y * -0.2040 + z * 1.0570;

    const toSRGB = c =>
        c <= 0.0031308
            ? 12.92 * c
            : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

    // Clamp and scale to [0, 255]
    return [
        Math.min(255, Math.max(0, Math.round(toSRGB(rl) * 255))),
        Math.min(255, Math.max(0, Math.round(toSRGB(gl) * 255))),
        Math.min(255, Math.max(0, Math.round(toSRGB(bl) * 255)))
    ];
}

export function extractFakePCAPalette(imageData, nColors = 6, mode = "chroma", lWeight = 0.5) {
    const {data} = imageData;
    const labPixels = [];

    for (let i = 0; i < data.length; i += 4) {
        const rgb = [data[i], data[i + 1], data[i + 2]];
        labPixels.push({lab: rgb2lab(...rgb), rgb});
    }

    // Sort by L*
    labPixels.sort((a, b) => a.lab[0] - b.lab[0]);
    if (mode === "lightness") {
        // Simple spread across lightness range
        const palette = [];
        for (let i = 0; i < nColors; i++) {
            const ix = Math.floor(i * (labPixels.length - 1) / (nColors - 1));
            palette.push(labPixels[ix].rgb);
        }
        return palette;
    }

    const distance = {
        chroma: (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2]),
        lab: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
        weighted: (a, b) => Math.hypot((a[0] - b[0]) * lWeight, a[1] - b[1], a[2] - b[2])
    }[mode];

    const selected = [labPixels.reduce((a, b) => distance(a.lab, b.lab) > distance(b.lab, a.lab) ? a : b)];
    const used = new Set([selected[0]]);

    while (selected.length < nColors) {
        let best = null;
        let bestDist = -Infinity;

        for (const cand of labPixels) {
            if (used.has(cand)) continue;

            const minDist = Math.min(...selected.map(p => distance(cand.lab, p.lab)));

            if (minDist > bestDist) {
                bestDist = minDist;
                best = cand;
            }
        }

        if (!best) break;
        selected.push(best);
        used.add(best);
    }
    return selected.map(p => p.rgb);
}

export function getPalette(instance) {
    const cache = instance.auxiliaryCache;
    const configHash = makeConfigHash(instance.config)
    if (cache.configHash !== configHash) {
        cache.configHash = configHash;
        cache.palette = extractFakePCAPalette(instance.auxiliaryCache.referenceImage, instance.config.nColors,
                                              instance.config.mode, instance.config.lWeight);
    }
    return cache.palette;
}


export function getImageStats(data) {
    const channels = [[], [], []];

    for (let i = 0; i < data.length; i += 4) {
        channels[0].push(data[i]);
        channels[1].push(data[i + 1]);
        channels[2].push(data[i + 2]);
    }

    return {
        mean: channels.map(ch => ch.reduce((a, b) => a + b, 0) / ch.length),
        std: channels.map((ch, i) => {
            const m = ch.reduce((a, b) => a + b, 0) / ch.length;
            const v = ch.reduce((sum, x) => sum + (x - m) ** 2, 0) / ch.length;
            return Math.sqrt(v);
        })
    };
}
