import {float32ToUint8Array} from "./imageutils.js";
import {UniformSetters} from "./gl.js";

function allocateTexture(gl, format, width, height, buffer) {
    const {internalFormat, formatEnum, typeEnum, arrayConstructor} = format;
    if (buffer && !(buffer instanceof arrayConstructor)) {
        throw new Error("Mismatched buffer type for texture format");
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, formatEnum, typeEnum, buffer);
    return buffer;
}

export class WebGLRunner {
    constructor() {
        this.canvas = document.createElement("canvas");
        this.gl = this.canvas.getContext("webgl");
        if (!this.gl.getExtension("OES_texture_float")) {
            throw new Error("OES_texture_float not supported")
        }
        this.initQuad();
        this.framebuffer = this.gl.createFramebuffer();
        this.outputTexture = null;
        this.outputTextureWidth = 0;
        this.outputTextureHeight = 0;
        this.inputTexture = null;
        this.lastInputKey = null;
        this.format = {
            internalFormat: this.gl.RGBA,
            formatEnum: this.gl.RGBA,
            typeEnum: this.gl.UNSIGNED_BYTE,
            arrayConstructor: Uint8Array,
        }
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
        gl.shaderSource(shader, source)
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    run(fragmentSource, uniformSpec, texture, width, height, inputKey) {
        const gl = this.gl;
        // Resize canvas and output texture if necessary
        this.canvas.width = width;
        this.canvas.height = height;
        if (!this.outputTexture ||
            this.outputTextureWidth !== width ||
            this.outputTextureHeight !== height) {
            // console.log("loading output texture")
            this.outputTextureWidth = width;
            this.outputTextureHeight = height;
            if (this.outputTexture) gl.deleteTexture(this.outputTexture);
            this.outputTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.outputTexture);
            const outBuffer = new Uint8Array(width * height * 4);
            allocateTexture(this.gl, this.format, width, height, outBuffer);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }

        // Compile fragment shader and link program
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

        const texLoc = gl.getUniformLocation(program, "u_image");
        const reloadInput = this.lastInputKey !== inputKey;
        if (!this.inputTexture || reloadInput || width !== this.lastInputWidth || height !== this.lastInputHeight) {
            if (texture instanceof Float32Array) {
                texture = float32ToUint8Array(texture);
            } else if (!(texture instanceof Uint8Array)) {
                throw new Error("This runner only accepts textures as Float32Array or Uint8Array.")
            }
            if (!this.inputTexture) this.inputTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.inputTexture);
            allocateTexture(this.gl, this.format, width, height, texture);
            this.lastInputWidth = width;
            this.lastInputHeight = height;
        }
        this.lastInputKey = inputKey;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.inputTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(texLoc, 0);
        let throwawayTexture = null;
        // Upload other uniforms
        Object.entries(uniformSpec).forEach(([name, {value, type, width, height}]) => {
            const loc = gl.getUniformLocation(program, name);
            if (type === "texture2D") {
                // TODO: don't like the width/height name shadowing in this block
                // TODO: terrible to unconditionally pick texture1!
                // NOTE: anything we're passing this way should be small,
                //  so uploading it should be _relatively_ cheap, but we still
                //  might want to consider a shared context across the render pipeline
                //  -- which might also help with shader chaining
                gl.activeTexture(gl.TEXTURE1);
                throwawayTexture = gl.createTexture()
                gl.bindTexture(gl.TEXTURE_2D, throwawayTexture);
                allocateTexture(this.gl, this.format, width, height, value);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                if (!gl.isTexture(throwawayTexture)) {
                    throw new Error("bad sideloaded texture")
                }
                UniformSetters[type](gl, loc, 1);
            } else {
                UniformSetters[type](gl, loc, value);
            }
        });

        // Render to framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D, this.outputTexture, 0);
        gl.viewport(0, 0, width, height);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error("Framebuffer incomplete:", status.toString(16));
            throw new Error("Incomplete framebuffer");
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Read result
        const outBuf = new this.format.arrayConstructor(width * height * 4);
        gl.readPixels(0, 0, width, height, this.format.internalFormat, this.format.typeEnum, outBuf);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteShader(fragShader);
        gl.deleteProgram(program);
        gl.disableVertexAttribArray(posLoc);
        if (outBuf instanceof Float32Array) return outBuf;
        const floatBuf = new Float32Array(outBuf.length);
        for (let i = 0; i < outBuf.length; ++i) {
          floatBuf[i] = outBuf[i] / 255;
        }
        if (throwawayTexture) gl.deleteTexture(throwawayTexture);
        return floatBuf;
    }
}

export async function loadShaderSource(url) {
    if (url instanceof Array) return await collectShaderSource(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load shader: ${url}`);
    return await res.text();
}

export async function collectShaderSource(urls) {
    const shaderPromises = urls.map(async (url) => {
        return await loadShaderSource(url);
    });
    const shaders = await Promise.all(shaderPromises);
    return shaders.join("\n\n");
}

