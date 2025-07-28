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

function normalizeLab(Lab) {
    const [L, a, b] = Lab;
    return [L / 100, (a + 128.0) / 255.0, (b + 128.0) / 255.0];
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
        seed
    ) {
        initGLEffect(probe, fragSources);
        const gl = probe.glState.gl;
        probe.config.blockSize = blockSize;
        probe.config.paletteSize = paletteSize;

        probe.config.patchOrigins = []
        const rng = seededNotVeryRandom(seed);
        for (let p = 1; p < paletteSize; p++) {
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
        const expanded = baseSwatches.map(s => expandSwatchVariants(s, deltaL, gammaC)).flat();
        // const normalized = expanded.map(e => normalizeLab(e));
        return expanded.sort();

    },

    initHook: fragSources.load
}
