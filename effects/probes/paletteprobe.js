import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {blockSample} from "./probeutils.js";
import {clamp} from "../../utils/mathutils.js";

const shaderPath = "blockprobe.frag"
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const CANDIDATE_SAMPLE_COUNT = 255;
const SHADOW_L_CUTOFF = 35;
const HIGHLIGHT_L_CUTOFF = 65;
const TONAL_NEED_BONUS = 0.22;
const TONAL_CROWDING_PENALTY = 0.12;
const RANGE_EXPANSION_BONUS = 0.18;
const NOVELTY_BONUS = 0.16;
const SELECTION_NOISE_AMOUNT = 0.08;
const TOP_BAND_RATIO = 0.92;
const TOP_BAND_ABS_WINDOW = 0.08;


function expandSwatchVariants([L, a, b], deltaL = 10, chromaExp = 1.0) {
    const C = Math.hypot(a, b);
    const h = Math.atan2(b, a);
    const chromaRef = 100;
    const Cn = clamp(C / chromaRef, 0, 2);
    const Cmod = chromaRef * Math.pow(Cn, chromaExp);
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


function buildRandomPatchOrigins(sampleCount, width, height, rng) {
    const patchOrigins = [];
    for (let p = 0; p < sampleCount; p++) {
        patchOrigins.push([rng() * width, rng() * height]);
    }
    return patchOrigins;
}

function buildStratifiedJitteredPatchOrigins(sampleCount, width, height, rng) {
    if (sampleCount <= 0) return [];

    const aspect = Math.max(width, 1) / Math.max(height, 1);
    let cols = Math.max(1, Math.round(Math.sqrt(sampleCount * aspect)));
    let rows = Math.max(1, Math.ceil(sampleCount / cols));

    while (cols * rows < sampleCount) {
        if ((cols / rows) < aspect) cols += 1;
        else rows += 1;
    }

    const cellW = width / cols;
    const cellH = height / rows;
    const patchOrigins = [];
    for (let i = 0; i < sampleCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const pX = (col + rng()) * cellW;
        const pY = (row + rng()) * cellH;
        patchOrigins.push([Math.min(pX, width), Math.min(pY, height)]);
    }
    return patchOrigins;
}

function buildPatchOrigins(sampleCount, width, height, seed, samplingMode = "random") {
    const rng = seededNotVeryRandom(seed);
    if (samplingMode === "stratified") {
        return buildStratifiedJitteredPatchOrigins(sampleCount, width, height, rng);
    }
    return buildRandomPatchOrigins(sampleCount, width, height, rng);
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

function tonalBandIndex(L) {
    if (L < SHADOW_L_CUTOFF) return 0;
    if (L > HIGHLIGHT_L_CUTOFF) return 2;
    return 1;
}

function targetBandCounts(N) {
    if (N <= 1) return [0, 1, 0];
    if (N === 2) return [1, 0, 1];
    return [1, N - 2, 1];
}

function weightedPick(entries, rng) {
    if (entries.length === 0) return null;
    let total = 0;
    const weights = entries.map(entry => {
        const weight = Math.max(entry.marginalScore - entry.bandThreshold, 0) + 1e-4;
        total += weight;
        return weight;
    });
    let draw = rng() * total;
    for (let i = 0; i < entries.length; i++) {
        draw -= weights[i];
        if (draw <= 0) return entries[i];
    }
    return entries[entries.length - 1];
}

/**
 * Iterative marginal selection with a minimum LAB spacing constraint, soft
 * tonal-balance pressure, range expansion preference, and light seeded
 * stochasticity so seed changes produce alternate good palettes rather than
 * merely different sample coverage.
 */
function selectTopNScoredSwatches(
    candidates,
    weights,
    N,
    minDistance = 14,
    seed = 1
) {
    const center = meanLab(candidates);
    const baseScored = candidates.map((lab, index) => ({
        lab,
        index,
        baseScore: baseScore(lab, center, weights)
    }));

    const rng = seededNotVeryRandom(seed + 97.1337);
    const selected = [];
    const used = new Set();
    const bandCounts = [0, 0, 0];
    const desiredBandCounts = targetBandCounts(N);

    for (let slot = 0; slot < N; slot++) {
        const remaining = baseScored.filter(entry => !used.has(entry.index));
        if (!remaining.length) break;

        const farEnough = remaining.filter(entry =>
            selected.every(swatch => labDist(entry.lab, swatch) >= minDistance)
        );
        const pool = farEnough.length ? farEnough : remaining;

        const currentLows = selected.map(([L]) => L);
        const minL = currentLows.length ? Math.min(...currentLows) : null;
        const maxL = currentLows.length ? Math.max(...currentLows) : null;

        const ranked = pool.map(entry => {
            const [L] = entry.lab;
            const band = tonalBandIndex(L);

            const bandTarget = desiredBandCounts[band];
            const bandCount = bandCounts[band];
            const bandNeed = bandTarget > 0
                ? clamp((bandTarget - bandCount) / bandTarget, 0, 1)
                : 0;
            const crowding = bandTarget > 0
                ? Math.max(0, bandCount - bandTarget + 1) / Math.max(1, N)
                : bandCount > 0 ? bandCount / Math.max(1, N) : 0;

            let rangeExpansion = 0;
            if (minL !== null && maxL !== null) {
                if (L < minL) rangeExpansion = clamp((minL - L) / 50, 0, 1);
                else if (L > maxL) rangeExpansion = clamp((L - maxL) / 50, 0, 1);
            }

            let novelty = 0;
            if (selected.length) {
                const nearest = Math.min(...selected.map(swatch => labDist(entry.lab, swatch)));
                novelty = clamp(nearest / 40, 0, 1);
            }

            const marginalScore =
                entry.baseScore +
                bandNeed * TONAL_NEED_BONUS -
                crowding * TONAL_CROWDING_PENALTY +
                rangeExpansion * RANGE_EXPANSION_BONUS +
                novelty * NOVELTY_BONUS +
                rng() * SELECTION_NOISE_AMOUNT;

            return {
                ...entry,
                band,
                marginalScore
            };
        }).sort((a, b) =>
            (b.marginalScore - a.marginalScore) ||
            (b.baseScore - a.baseScore) ||
            (a.index - b.index)
        );

        const bestScore = ranked[0].marginalScore;
        const threshold = Math.max(bestScore * TOP_BAND_RATIO, bestScore - TOP_BAND_ABS_WINDOW);
        const topBand = ranked
            .filter(entry => entry.marginalScore >= threshold)
            .map(entry => ({...entry, bandThreshold: threshold}));

        const picked = weightedPick(topBand, rng) ?? ranked[0];
        selected.push(picked.lab);
        used.add(picked.index);
        bandCounts[picked.band] += 1;
    }

    if (selected.length >= N) return selected;

    for (const entry of baseScored.sort((a, b) => b.baseScore - a.baseScore)) {
        if (selected.length >= N) break;
        if (used.has(entry.index)) continue;
        selected.push(entry.lab);
        used.add(entry.index);
    }

    return selected;
}

export const paletteprobe = {
    config: {blockSize: null, paletteSize: null, patchOrigins: null, samplingMode: null},
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
        minDistance,
        samplingMode = "random"
    ) {
        initGLEffect(probe, fragSources);
        const gl = probe.glState.gl;
        probe.config.blockSize = blockSize;
        probe.config.samplingMode = samplingMode;
        // Sample a fixed, driver-friendly candidate budget so palette size
        // only controls the final selection count, not how hard we look.
        probe.config.paletteSize = CANDIDATE_SAMPLE_COUNT;
        probe.config.patchOrigins = buildPatchOrigins(
            probe.config.paletteSize,
            width,
            height,
            seed,
            samplingMode
        );
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
        const selected = selectTopNScoredSwatches(baseSwatches, selectionWeights, paletteSize, minDistance, seed);
        // Keep base/tint/shade triplets intact. Downstream sort modes may use
        // that generated-family structure before flattening to the shader.
        return selected.map(s => expandSwatchVariants(s, deltaL, gammaC)).flat();
    },
    initHook: fragSources.load,
}