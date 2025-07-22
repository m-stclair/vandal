import {checkFrameBuffer, checkTexture} from "../../utils/gl.js";

export function subsampleTexture(probe, width, height, gl, inputTexture) {
    const probeRes = probe.config.resolution;
    const tempBuffer = probe.glState.renderer.make_framebuffer(width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tempBuffer.fbo);
    gl.viewport(0, 0, probeRes, probeRes);
    if (!probe.glState.program) {
        probe.glState.program = probe.glState.buildProgram({});
    }
    const prog = probe.glState.program;
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
    // checkTexture(gl, inputTexture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    const numPixels = probeRes * probeRes;
    const outData = new Float32Array(numPixels * 4);
    gl.readPixels(0, 0, probeRes, probeRes, gl.RGBA, gl.FLOAT, outData);
    return {tempBuffer, numPixels, outData};
}