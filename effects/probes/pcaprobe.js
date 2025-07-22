import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {subsampleTexture} from "./probeutils.js";
import {clamp} from "../../utils/mathutils.js";
import {ColorspaceEnum} from "../../utils/glsl_enums.js";

const shaderPath = "../shaders/pcaprobe.frag"
const includePaths = {"colorconvert.glsl": "../shaders/includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


function applyChromaBoost(Lab, chromaBoost = 1.0) {
  const [L, a, b] = Lab;
  return [L, a * chromaBoost, b * chromaBoost];
}

function applyContrastStretch(Lab, contrast = 1.0) {
  const [L, a, b] = Lab;
  const Lcentered = (L - 0.5) * contrast + 0.5;
  return [Lcentered, a, b];
}


function applyHueWarp(Lab, warp = 0.0) {
  const [L, a, b] = Lab;
  const hue = Math.atan2(b, a);
  const chroma = Math.sqrt(a * a + b * b);
  const warpedHue = hue + warp * Math.sin(0.3 * hue);  // 3-lobe warp
  return [L, chroma * Math.cos(warpedHue), chroma * Math.sin(warpedHue)];
}

function applyBalanceShift(Lab, amount = 0.0) {
  const [L, a, b] = Lab;
  return [
    clamp(L + amount * (L - 0.5), 0, 1),
    clamp(a + amount * a, 0, 1),
    clamp(b + amount * b, 0, 1)
  ];
}

function applyPaletteGamma(Lab, gamma = 1.0) {
  const [L, a, b] = Lab;
  const Lnorm = Math.pow(L, gamma);
  return [Lnorm, a, b];
}

function applyBalanceParams(lab, params) {
    return lab.map(color => {
        let c = color;
        c = applyChromaBoost(c, params.chromaBoost);
        c = applyContrastStretch(c, params.contrast);
        c = applyHueWarp(c, params.hueWarp);
        c = applyBalanceShift(c, params.balanceShift);
        c = applyPaletteGamma(c, params.paletteGamma);
        return c;
    });
}


function eigenDecompose3x3(m) {
    // Input: flat row-major array of 9 floats, symmetric matrix
    // m = [a, b, c, d, e, f, g, h, i] with symmetry assumed:
    // [ a  b  c ]
    // [ b  e  f ]
    // [ c  f  i ]

    const a = m[0], b = m[1], c = m[2];
    const e = m[4], f = m[5];
    const i = m[8];

    // Characteristic polynomial: |A - λI| = 0 → cubic
    const p1 = b * b + c * c + f * f;
    if (p1 === 0) {
        // Diagonal matrix
        return {
            values: [a, e, i],
            vectors: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        };
    }

    const q = (a + e + i) / 3;
    const p2 = (a - q) ** 2 + (e - q) ** 2 + (i - q) ** 2 + 2 * p1;
    const p = Math.sqrt(p2 / 6);

    // B = (1/p)(A - qI)
    const B = [
        (a - q) / p, b / p, c / p,
        b / p, (e - q) / p, f / p,
        c / p, f / p, (i - q) / p
    ];

    // det(B) / 2
    const detB = (
        B[0] * B[4] * B[8] + 2 * B[1] * B[5] * B[2]
        - B[0] * B[5] * B[5] - B[4] * B[2] * B[2] - B[8] * B[1] * B[1]
    ) / 2;

    const phi = Math.acos(Math.max(-1, Math.min(1, detB))) / 3;

    // The eigenvalues satisfy λ1 ≥ λ2 ≥ λ3
    const eig1 = q + 2 * p * Math.cos(phi);
    const eig3 = q + 2 * p * Math.cos(phi + (2 * Math.PI / 3));
    const eig2 = 3 * q - eig1 - eig3;

    const values = [eig1, eig2, eig3];

    // Now compute eigenvectors by inverse iteration or simple linear solve
    // For speed, use basic method: (A - λI)v = 0, solve via cross product trick
    const vectors = values.map(lambda => {
        const A = [
            [a - lambda, b, c],
            [b, e - lambda, f],
            [c, f, i - lambda]
        ];

        // Use rows of A to get cross product (approximate null vector)
        const v = cross(A[0], A[1]);
        const norm = Math.hypot(v[0], v[1], v[2]) || 1;
        return [v[0] / norm, v[1] / norm, v[2] / norm];
    });

    return {values, vectors};
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function batchProject(points, mean, basis) {
    const result = new Array(points.length);
    for (let i = 0; i < points.length; i++) {
        const [r, g, b] = points[i];
        const x = r - mean[0];
        const y = g - mean[1];
        const z = b - mean[2];

        result[i] = [
            x * basis[0][0] + y * basis[1][0] + z * basis[2][0],
            x * basis[0][1] + y * basis[1][1] + z * basis[2][1],
            x * basis[0][2] + y * basis[1][2] + z * basis[2][2],
        ];
    }
    return result;
}

function inverseProject(pcaVec, mean, basis) {
    const [c1, c2, c3] = pcaVec;

    return [
        mean[0] + c1 * basis[0][0] + c2 * basis[0][1] + c3 * basis[0][2],
        mean[1] + c1 * basis[1][0] + c2 * basis[1][1] + c3 * basis[1][2],
        mean[2] + c1 * basis[2][0] + c2 * basis[2][1] + c3 * basis[2][2],
    ];
}


function computePCA(data) {
    const N = data.length / 4; // RGBA, ignore A
    const mean = [0, 0, 0];

    // First pass: compute mean
    for (let i = 0; i < N; i++) {
        mean[0] += data[i * 4];
        mean[1] += data[i * 4 + 1];
        mean[2] += data[i * 4 + 2];
    }
    mean[0] /= N;
    mean[1] /= N;
    mean[2] /= N;

    // Compute covariance matrix (3x3, symmetric)
    const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // row-major
    for (let i = 0; i < N; i++) {
        const r = data[i * 4] - mean[0];
        const g = data[i * 4 + 1] - mean[1];
        const b = data[i * 4 + 2] - mean[2];

        cov[0] += r * r;
        cov[1] += r * g;
        cov[2] += r * b;
        cov[4] += g * g;
        cov[5] += g * b;
        cov[8] += b * b;
    }

    cov[0] /= N;
    cov[1] /= N;
    cov[2] /= N;
    cov[4] /= N;
    cov[5] /= N;
    cov[8] /= N;

    // Fill in symmetry
    cov[3] = cov[1];
    cov[6] = cov[2];
    cov[7] = cov[5];

    // Eigenvalue decomposition (use numeric.js, or hand-code power iteration for top-1)
    const eig = eigenDecompose3x3(cov); // You'll need to define or import this

    return {
        mean: mean,
        components: eig.vectors,  // Array of 3 vectors (eigenvectors)
        variances: eig.values     // Array of 3 eigenvalues
    };
}

function pcaToColor(pcaVec, mean, basis) {
    return inverseProject(pcaVec, mean, basis);
}

function deltaE(lab1, lab2) {
    const dL = (lab1[0] - lab2[0]);
    const da = lab1[1] - lab2[1];
    const db = lab1[2] - lab2[2];
    return Math.sqrt(dL * dL + da * da + db * db);
}

function deltaE_weighted(p1, p2, weights) {
  const [L1, a1, b1] = p1;
  const [L2, a2, b2] = p2;

  const dL = L1 - L2;
  const C1 = Math.sqrt(a1*a1 + b1*b1);
  const C2 = Math.sqrt(a2*a2 + b2*b2);
  const dC = C1 - C2;

  const h1 = Math.atan2(b1, a1);
  const h2 = Math.atan2(b2, a2);
  let dH = h1 - h2;
  while (dH > Math.PI) dH -= 2 * Math.PI;
  while (dH < -Math.PI) dH += 2 * Math.PI;
  dH = dH * 180 / Math.PI;  // convert to degrees

  const wL = weights[0];
  const wC = weights[1];
  const wH = weights[2];

  return Math.sqrt(
    wL * dL*dL +
    wC * dC*dC +
    wH * dH*dH
  );
}


function mergeClosest(bins, targetCount, pWeights) {
    bins = bins.slice(); // clone

    while (bins.length > targetCount) {
        let minDist = Infinity;
        let minI = -1, minJ = -1;

        for (let i = 0; i < bins.length - 1; i++) {
            for (let j = i + 1; j < bins.length; j++) {
                const d = deltaE_weighted(bins[i], bins[j], pWeights);
                if (d < minDist) {
                    minDist = d;
                    minI = i;
                    minJ = j;
                }
            }
        }

        const a = bins[minI], b = bins[minJ];
        const totalCount = a[3] + b[3];

        const merged = [
            (a[0] * a[3] + b[0] * b[3]) / totalCount,
            (a[1] * a[3] + b[1] * b[3]) / totalCount,
            (a[2] * a[3] + b[2] * b[3]) / totalCount,
            totalCount
        ];

        bins.splice(minJ, 1);
        bins.splice(minI, 1);
        bins.push(merged);
    }

    return bins;
}

function furthestSpread(bins, N, pWeights) {
    if (bins.length <= N) return bins.slice(0, N);

    const selected = [bins[0]];

    while (selected.length < N) {
        let bestBin = null;
        let bestMinDist = -Infinity;

        for (const candidate of bins) {
            const minDist = Math.min(...selected.map(s => deltaE_weighted(candidate, s, pWeights)));
            if (minDist > bestMinDist) {
                bestMinDist = minDist;
                bestBin = candidate;
            }
        }

        selected.push(bestBin);
    }

    return selected;
}

function KMeans1p(bins, K, pWeights) {
    if (bins.length <= K) return bins;
    bins.sort((a, b) => b[3] - a[3]);  // descending by count
    const centroids = bins.slice(0, K).map(([L,a,b]) => [L,a,b]);
    const assignments = new Array(bins.length);
    for (let i = 0; i < bins.length; i++) {
        const [L, a, b] = bins[i];
        let bestDist = Infinity, bestK = -1;
        for (let k = 0; k < K; k++) {
            const [cL, ca, cb] = centroids[k];
            const dist = deltaE_weighted([L, a, b], [cL, ca, cb], pWeights);
            if (dist < bestDist) {
                bestDist = dist;
                bestK = k;
            }
        }
        assignments[i] = bestK;
    }
    const newCentroids = Array.from({length: K}, () => [0, 0, 0, 0]);  // [Lsum, asum, bsum, totalWeight]

    for (let i = 0; i < bins.length; i++) {
        const k = assignments[i];
        const [L, a, b, weight] = bins[i];
        newCentroids[k][0] += L * weight;
        newCentroids[k][1] += a * weight;
        newCentroids[k][2] += b * weight;
        newCentroids[k][3] += weight;
    }

    for (let k = 0; k < K; k++) {
        const [Lsum, asum, bsum, w] = newCentroids[k];
        if (w > 0) {
            centroids[k] = [Lsum / w, asum / w, bsum / w, w];
        }
    }
    return centroids
}

function refineCentroids(rawBins, finalCount, pWeights, useFurthest, refinementStrategy) {
    if ((refinementStrategy === "none") && !useFurthest) {
        rawBins.sort((b1, b2) => b1[3] - b2[3]);
        return rawBins.slice(0, finalCount);
    }

    let merged = rawBins;
    const iScale = useFurthest ? 2 : 1;
    if (refinementStrategy === "k-means") {
        const iCount = Math.min(rawBins.length, finalCount * iScale);
        merged = KMeans1p(rawBins, iCount, pWeights);
    } else if (refinementStrategy === "merge") {
        const iCount = Math.min(rawBins.length, finalCount * iScale);
        merged = mergeClosest(rawBins, iCount, pWeights);
    }
    if (!useFurthest) {
        return merged;
    }
    return furthestSpread(merged, finalCount, pWeights);
}

function labHueAngle(a, b) {
    return Math.atan2(b, a); // [-PI, PI]
}

function lightnessSort(c1, c2) {
    // TODO: extend
    return c1[0] - c2[0];
}

function histogram3d(N, pcaCoords, resolution) {
    const cellMap = new Map();
    const cellCounts = new Map();

    for (let i = 0; i < N; i++) {
        const [x, y, z] = pcaCoords[i];
        const key = [
            Math.floor(x * resolution),
            Math.floor(y * resolution),
            Math.floor(z * resolution),
        ].join(',');

        if (!cellMap.has(key)) {
            cellMap.set(key, [0, 0, 0]);
            cellCounts.set(key, 0);
        }

        const acc = cellMap.get(key);
        acc[0] += x;
        acc[1] += y;
        acc[2] += z;
        cellCounts.set(key, cellCounts.get(key) + 1);
    }

    const bins = [];
    const flatCounts = [];
    for (const [key, sum] of cellMap.entries()) {
        const count = cellCounts.get(key);
        // if (count < minCountThreshold) continue;
        bins.push([
            sum[0] / count,
            sum[1] / count,
            sum[2] / count,
        ]);
        flatCounts.push(count);
    }
    return {bins: bins, counts: flatCounts};
}

export const pcaProbe = {
    config: {
        resolution: 92,
    },
    analyze(
        probe,
        inputTexture,
        width,
        height,
        paletteSize,
        pWeights,
        useFurthest,
        refinementStrategy,
        usePCA,
        balanceParams,
    ) {
        initGLEffect(probe, fragSources, {COLORSPACE: ColorspaceEnum.Lab});
        const gl = probe.glState.gl;
        const {tempBuffer, numPixels, outData} = subsampleTexture(
            probe, width, height, gl, inputTexture
        );
        let pca = null;
        const points = [];
        const N = outData.length / 4;
        for (let i = 0; i < N; i++) {
            points.push([outData[i], outData[i + 1], outData[i + 2]])
        }
        const resolution = 16;
        let coords;
        if (usePCA) {
            pca = computePCA(outData);
            coords = batchProject(points, pca.mean, pca.components);
        } else {
            coords = points;
        }
        coords = applyBalanceParams(coords, balanceParams);
        const {bins, counts} = histogram3d(N, coords, resolution);
        let colorBins;
        if (usePCA) {
            colorBins = bins.map(p => pcaToColor(p, pca.mean, pca.components));
        } else {
            colorBins = bins;
        }
        const colorBinsCount = colorBins.map(([X, Y, Z], i) => [X, Y, Z, counts[i]]);
        const mergedBins = refineCentroids(colorBinsCount, paletteSize, pWeights, useFurthest, refinementStrategy);
        const totalPx = mergedBins.reduce((v, b) => v + b[3], 0);
        mergedBins.forEach((b) => b[3] = b[3] / totalPx);
        mergedBins.sort(lightnessSort);
        return {
            pca: pca,
            palette: mergedBins
        };

    },
    initHook: fragSources.load
}