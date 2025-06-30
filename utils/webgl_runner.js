const UniformSetters = {
    float:        (gl, loc, val) => gl.uniform1f(loc, val),
    int:          (gl, loc, val) => gl.uniform1i(loc, val),
    bool:         (gl, loc, val) => gl.uniform1i(loc, val ? 1 : 0),
    vec2:         (gl, loc, val) => gl.uniform2fv(loc, val),
    vec3:         (gl, loc, val) => gl.uniform3fv(loc, val),
    vec4:         (gl, loc, val) => gl.uniform4fv(loc, val),
    mat2:         (gl, loc, val) => gl.uniformMatrix2fv(loc, false, val),
    mat3:         (gl, loc, val) => gl.uniformMatrix3fv(loc, false, val),
    mat4:         (gl, loc, val) => gl.uniformMatrix4fv(loc, false, val),
    intArray:     (gl, loc, val) => gl.uniform1iv(loc, val),
    floatArray:   (gl, loc, val) => gl.uniform1fv(loc, val),
    vec2Array:    (gl, loc, val) => gl.uniform2fv(loc, val),
    vec3Array:    (gl, loc, val) => gl.uniform3fv(loc, val),
    vec4Array:    (gl, loc, val) => gl.uniform4fv(loc, val),
  };

export class WebGLRunner {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.gl = this.canvas.getContext("webgl");
    this.initQuad();
  }

  initQuad() {
    const gl = this.gl;
    this.vertexShader = this.compile(gl.VERTEX_SHADER, `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = 0.5 * (a_position + 1.0);
        gl_Position = vec4(a_position, 0, 1);
      }
    `);
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1, 1, 1
    ]), gl.STATIC_DRAW);
  }

  compile(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  run(fragmentSource, uniformSpec, texture, width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    const gl = this.gl;
    const fragShader = this.compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, this.vertexShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(program));
        throw new Error("Program linking failed");
    }
    gl.useProgram(program);

    // Fullscreen quad
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Texture input
    const texLoc = gl.getUniformLocation(program, "u_image");
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height,
                  0, gl.RGBA, gl.UNSIGNED_BYTE, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(texLoc, 0);
    Object.entries(uniformSpec).forEach(([name, {value, type}]) => {
      const loc = gl.getUniformLocation(program, name);
      UniformSetters[type](gl, loc, value);
    });
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const pixelBuffer = new Uint8Array(this.canvas.width * this.canvas.height * 4);
    gl.readPixels(
      0, 0, this.canvas.width, this.canvas.height,
      gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer
    );
      gl.deleteShader(fragShader);
      gl.deleteProgram(program);
      gl.deleteTexture(tex);
      gl.disableVertexAttribArray(posLoc); // optional, but polite
    return new Uint8ClampedArray(pixelBuffer.buffer);
  }
}

export async function loadShaderSource(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load shader: ${url}`);
    return await res.text();
}

