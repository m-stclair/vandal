export const UniformSetters = {
    float: (gl, loc, val) => gl.uniform1f(loc, val),
    int: (gl, loc, val) => gl.uniform1i(loc, val),
    bool: (gl, loc, val) => gl.uniform1i(loc, val ? 1 : 0),
    vec2: (gl, loc, val) => gl.uniform2fv(loc, val),
    vec3: (gl, loc, val) => gl.uniform3fv(loc, val),
    vec4: (gl, loc, val) => gl.uniform4fv(loc, val),
    mat2: (gl, loc, val) => gl.uniformMatrix2fv(loc, false, val),
    mat3: (gl, loc, val) => gl.uniformMatrix3fv(loc, false, val),
    mat4: (gl, loc, val) => gl.uniformMatrix4fv(loc, false, val),
    intArray: (gl, loc, val) => gl.uniform1iv(loc, val),
    floatArray: (gl, loc, val) => gl.uniform1fv(loc, val),
    vec2Array: (gl, loc, val) => gl.uniform2fv(loc, val),
    vec3Array: (gl, loc, val) => gl.uniform3fv(loc, val),
    vec4Array: (gl, loc, val) => gl.uniform4fv(loc, val),
    texture2D: (gl, loc, val) => gl.uniform1i(loc, val)
};

export function checkFrameBuffer(gl) {
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`could not construct framebuffer, status ${status}`)
    }
}

export function checkTexture(gl, tex) {
    if (!gl.isTexture(tex)) {
        throw new Error("invalid texture")
    }
}