import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {blockSample} from "./probeutils.js";
import {clamp} from "../../utils/mathutils.js";

const shaderPath = "blockprobe.frag"
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


function expandSwatchVariants([L, a, b], deltaL = 10, chromaExp = 1.0) {
    const C = Math.hypot(a, b);
    const h = Math.atan2(b, a);
    const Cmod = Math.pow(C, chromaExp);
    const anew = Math.cos(h) * Cmod;
    const bnew = Math.sin(h) * Cmod;
    return [
        [L, anew, bnew],
        [clamp(L + deltaL, 0, 100), anew, bnew],
        [clamp(L - deltaL, 0, 100), anew, bnew]
    ];
}

function seededNotVeryRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return () => {
        x = Math.sin(x) * 10000;
        return x - Math.floor(x);
    };
}

function meanLab(samples) {
    const sum = [0, 0, 0];
    for (const [L, a, b] of samples) {
        sum[0] += L;
        sum[1] += a;
        sum[2] += b;
    }
    const n = samples.length || 1;
    return [sum[0] / n, sum[1] / n, sum[2] / n];
}

function labDist([L1, a1, b1], [L2, a2, b2]) {
    return Math.sqrt(
        (L1 - L2) ** 2 +
        (a1 - a2) ** 2 +
        (b1 - b2) ** 2
    );
}

/**
 * Simple intrinsic score:
 * - prefer chromatic colors
 * - prefer colors somewhat far from the image average
 * - mildly prefer midtones over extremes
 *
 * All terms are normalized enough to be tunable without theater.
 */
function baseScore(
    lab,
    center,
    weights = { chroma: 1.0, outlier: 0.7, midtone: 0.25 },
    chromaCap = 100,
    outlierCap = 80
) {
    const [L, a, b] = lab;

    const C = Math.hypot(a, b);
    const chroma = clamp(C / chromaCap, 0, 1);

    const outlier = clamp(labDist(lab, center) / outlierCap, 0, 1);

    const midtone = 1 - Math.abs(L - 50) / 50; // 0..1

    return (
        weights.chroma * chroma +
        weights.outlier * outlier +
        weights.midtone * midtone
    );
}

function scoreAndSortPalette(
    candidates,
    weights = { chroma: 1.0, outlier: 0.7, midtone: 0.25 }
) {
    const center = meanLab(candidates);
    return candidates
        .map(lab => ({
            lab,
            score: baseScore(lab, center, weights)
        }))
        .sort((a, b) => b.score - a.score);
}

/**
 * Greedy selection with a minimum LAB spacing constraint.
 * This is the part your earlier version was missing.
 */
function selectTopNScoredSwatches(
    candidates,
    weights,
    N,
    minDistance = 14
) {
    const scored = scoreAndSortPalette(candidates, weights);
    const selected = [];

    for (const entry of scored) {
        const tooClose = selected.some(s => labDist(entry.lab, s) < minDistance);
        if (!tooClose) {
            selected.push(entry.lab);
            if (selected.length >= N) break;
        }
    }

    // Fallback: if the candidate pool is too clustered, fill remaining slots by score.
    for (const entry of scored) {
        if (selected.length >= N) break;
        if (!selected.includes(entry.lab)) {
            selected.push(entry.lab);
        }
    }

    return selected;
}

export const paletteprobe = {
    config: {blockSize: null, paletteSize: null, patchOrigins: null},
    analyze(
        probe,
        inputTexture,
        width,
        height,
        paletteSize,
        deltaL,
        gammaC,
        blockSize,
        seed,
        selectionWeights,
        minDistance
    ) {
        initGLEffect(probe, fragSources);
        const gl = probe.glState.gl;
        probe.config.blockSize = blockSize;
        // x10 oversampling for scoring
        probe.config.paletteSize = paletteSize * 5;
        probe.config.patchOrigins = []
        const rng = seededNotVeryRandom(seed);
        for (let p = 0; p < paletteSize * 5; p++) {
            const pX = rng() * width;
            const pY = rng() * height
            probe.config.patchOrigins.push([pX, pY])
        }
        const outData = blockSample(
            probe, width, height, gl, inputTexture, seed
        );
        const baseSwatches = [];
        for (let i = 0; i < outData.length / 4; i++) {
            const idx = i * 4;
            const L = outData[idx]
            const a = outData[idx + 1];
            const b = outData[idx + 2];
            baseSwatches.push([L, a, b]);
        }
        const selected = selectTopNScoredSwatches(baseSwatches, selectionWeights, paletteSize, minDistance);
        const expanded = selected.map(s => expandSwatchVariants(s, deltaL, gammaC)).flat();
        return expanded.sort((a, b) => a[0] - b[0]);
    },
    initHook: fragSources.load,
}
