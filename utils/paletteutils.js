import {hashObject} from "./helpers.js";
import {rgb2Lab} from "./colorutils.js";

const TAU = Math.PI * 2;
const NEUTRAL_CHROMA_EPSILON = 2.0;

function paletteChroma([_L, a, b]) {
    return Math.hypot(a, b);
}

function paletteHue([_L, a, b]) {
    const h = Math.atan2(b, a);
    return h < 0 ? h + TAU : h;
}

function compareLightness(a, b) {
    return (a[0] - b[0]) || (paletteChroma(a) - paletteChroma(b)) || (paletteHue(a) - paletteHue(b));
}

function compareHueThenLightness(a, b) {
    const ca = paletteChroma(a);
    const cb = paletteChroma(b);
    const aNeutral = ca < NEUTRAL_CHROMA_EPSILON;
    const bNeutral = cb < NEUTRAL_CHROMA_EPSILON;

    // Hue is undefined for near-neutrals. Keep them stable and sober instead of
    // letting atan2 noise shove greys into arbitrary pigment families.
    if (aNeutral || bNeutral) {
        if (aNeutral !== bNeutral) return aNeutral ? -1 : 1;
        return compareLightness(a, b);
    }

    return (paletteHue(a) - paletteHue(b)) || (a[0] - b[0]) || (ca - cb);
}

function labDistance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function sortLabWalk(palette) {
    return sortLabWalkRecords(
        palette.map(lab => ({lab, value: lab})),
        record => record.lab
    ).map(record => record.value);
}

function sortLabWalkRecords(records, labForRecord) {
    const remaining = [...records];
    if (remaining.length <= 1) return remaining;

    // Dark anchor keeps the walk stable across frames/config changes and avoids
    // a path whose first third is arbitrary garbage. After that: greedy nearest
    // neighbor in LAB, with deterministic tie breakers.
    remaining.sort((a, b) => compareLightness(labForRecord(a), labForRecord(b)));
    const path = [remaining.shift()];

    while (remaining.length) {
        const lastLab = labForRecord(path[path.length - 1]);
        let bestIndex = 0;
        let bestDistance = Infinity;

        for (let i = 0; i < remaining.length; i++) {
            const candidateLab = labForRecord(remaining[i]);
            const d = labDistance(lastLab, candidateLab);
            if (
                d < bestDistance - 1e-9 ||
                (Math.abs(d - bestDistance) <= 1e-9 &&
                    compareLightness(candidateLab, labForRecord(remaining[bestIndex])) < 0)
            ) {
                bestDistance = d;
                bestIndex = i;
            }
        }

        path.push(remaining.splice(bestIndex, 1)[0]);
    }

    return path;
}

function sortVariantBands(palette) {
    // The probe emits expanded swatches in base/tint/shade triplets. Preserve
    // that family metadata long enough to build explicit variant bands:
    // all shades, then all bases, then all tints. Each band uses the same
    // LAB-walk ordering of base colors, so low/middle/high cycle bands line up.
    if (palette.length % 3 !== 0) return [...palette].sort(compareLightness);

    const families = [];
    for (let i = 0; i < palette.length; i += 3) {
        const base = palette[i];
        const tint = palette[i + 1];
        const shade = palette[i + 2];
        families.push({base, tint, shade});
    }

    const orderedFamilies = sortLabWalkRecords(families, family => family.base);

    return [
        ...orderedFamilies.map(family => family.shade),
        ...orderedFamilies.map(family => family.base),
        ...orderedFamilies.map(family => family.tint)
    ];
}

export function sortPalette(palette, mode = "lightness") {
    switch (mode) {
        case "variantBands":
            return sortVariantBands(palette);
        case "hueFamilies":
            return [...palette].sort(compareHueThenLightness);
        case "labWalk":
            return sortLabWalk(palette);
        case "lightness":
        default:
            return [...palette].sort(compareLightness);
    }
}


export function extractFakePCAPalette(imageData, nColors = 6, mode = "chroma",
                                      lWeight = 0.5) {
    const {data} = imageData;
    const labPixels = [];

    for (let i = 0; i < data.length; i += 4) {
        const rgb = [data[i], data[i + 1], data[i + 2]];
        labPixels.push({lab: rgb2Lab(...rgb), rgb});
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

    const selected = [labPixels.reduce(
        (a, b) => distance(a.lab, b.lab) > distance(b.lab, a.lab) ? a : b)];
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
    const configHash = hashObject(instance.config)
    if (cache.configHash !== configHash) {
        cache.configHash = configHash;
        cache.palette = extractFakePCAPalette(instance.auxiliaryCache.referenceImage,
            instance.config.nColors, instance.config.mode, instance.config.lWeight);
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
        mean: channels.map(ch => ch.reduce((a, b) => a + b, 0) / ch.length), std: channels.map((ch, i) => {
            const m = ch.reduce((a, b) => a + b, 0) / ch.length;
            const v = ch.reduce((sum, x) => sum + (x - m) ** 2, 0) / ch.length;
            return Math.sqrt(v);
        })
    };
}


export function preprocessPalette(palette) {
    const MAX_SIZE = 128;
    const STRIDE = 4;
    const paletteBlock = new Float32Array(MAX_SIZE * STRIDE);

    for (let i = 0; i < palette.length; i++) {
        paletteBlock[i * 4 + 0] = palette[i][0];
        paletteBlock[i * 4 + 1] = palette[i][1];
        paletteBlock[i * 4 + 2] = palette[i][2];
        paletteBlock[i * 4 + 3] = 0;
    }

    // each L, C, cosH, sinH is a vec4, so 4 4-byte elements each
    const paletteFeatures = new Float32Array(MAX_SIZE * STRIDE);
    for (let i = 0; i < palette.length; i++) {
        const [L, a, b] = palette[i];
        const C = Math.hypot(a, b);
        const h = Math.atan2(b, a);
        const cosH = Math.cos(h);
        const sinH = Math.sin(h);
        const start = i * STRIDE;
        paletteFeatures[start] = L;
        paletteFeatures[start + 1] = C;
        paletteFeatures[start + 2] = cosH;
        paletteFeatures[start + 3] = sinH;
    }
    return {paletteBlock, paletteFeatures};
}