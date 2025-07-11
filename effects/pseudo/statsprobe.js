import {checkFrameBuffer, checkTexture, initGLEffect, loadFragSrcInit} from "../../utils/gl.js";

const shaderPath = "../shaders/statsprobe.frag"
const includePaths = {"colorconvert.glsl": "../shaders/includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

export const statsProbe = {
    config: {
        resolution: 128,
        numBins: 256,
    },
    analyze(
        probe,
        inputTexture,
        width,
        height,
        paramA,  // sigma or low percentile
        paramB   // high percentile
    ) {
        initGLEffect(probe, fragSources);
        const gl = probe.glState.gl;
        const probeRes = probe.config.resolution;
        const tempBuffer = probe.glState.renderer.make_framebuffer(width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, tempBuffer.fbo);
        gl.viewport(0, 0, probeRes, probeRes);
        const prog = probe.glState.buildProgram({});
        gl.useProgram(prog);
        gl.uniform1i(gl.getUniformLocation(prog, "u_image"), 0);
        gl.uniform1f(gl.getUniformLocation(prog, "u_proberes"), probeRes);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        checkFrameBuffer(gl);
        checkTexture(gl, inputTexture);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        const numPixels = probeRes * probeRes;
        const outData = new Float32Array(numPixels * 4);
        gl.readPixels(0, 0, probeRes, probeRes, gl.RGBA, gl.FLOAT, outData);
        const chanBounds = [
            [Infinity, -Infinity, null],
            [Infinity, -Infinity, null],
            [Infinity, -Infinity, null],
            [Infinity, -Infinity, null]
        ]
        // TODO: we _might_ be able to get away with doing a single pass over
        //  the array and just not caring about how many bins we actually fill,
        //  but it's much safer to explicitly compute the transform
        for (let i = 0; i < numPixels; i++) {
            for (let c = 0; c < 4; c++) {
                const v = outData[i * 4 + c];
                chanBounds[c][0] = chanBounds[c][0] > v ? v : chanBounds[c][0];
                chanBounds[c][1] = chanBounds[c][1] < v ? v : chanBounds[c][1];
            }
        }
        const nbins = probe.config.numBins;
        const hists = [
            new Uint32Array(nbins),
            new Uint32Array(nbins),
            new Uint32Array(nbins),
            new Uint32Array(nbins),
        ]
        chanBounds.forEach(
            ([vMin, vMax], i) => chanBounds[i][2] = nbins / (vMax - vMin + 1e-15)
        );
        for (let i = 0; i < numPixels; i++) {
            for (let c = 0; c < 4; c++) {
                const v = outData[i * 4 + c];
                const [vMin, _vMax, scale] = chanBounds[c];
                const ix = Math.floor((v - vMin) * scale);
                hists[c][ix]++;
            }
        }
        const cdfs = [[], [], [], []];
        let cumsums = [0, 0, 0, 0];
        for (let i = 0; i < nbins; i++) {
            for (let c = 0; c < 4; c++) {
                cumsums[c] += hists[c][i];
                cdfs[c][i] = cumsums[c] / numPixels;
            }
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteTexture(tempBuffer.texture);
        gl.deleteFramebuffer(tempBuffer.fbo);
        const boundsOut = []
        for (let c = 0; c < 4; c++) {
            let lowIx = cdfs[c].findIndex(v => v >= paramA / 100)
            let highIx = cdfs[c].findIndex(v => v >= paramB / 100)
            lowIx = lowIx === -1 ? nbins - 1 : lowIx;
            highIx = highIx === -1 ? nbins - 1 : highIx;
            const [vMin, _vMax, scale] = chanBounds[c];
            boundsOut.push([
                lowIx / scale + vMin, highIx / scale + vMin
            ]);
        }
        return boundsOut;
    },
    initHook: fragSources.load
}