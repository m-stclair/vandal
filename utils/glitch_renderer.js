// Hybrid GPU/CPU pipeline manager
class GlitchRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
        this.framebuffers = []; // ping-pong FBOs
        this.lutCache = new Map();
        this.currentFBOIndex = 0;
        this.initSharedResources();
    }

    initSharedResources() {
        this.vao = this.createFullscreenQuad(this.gl);
    }

    createFullscreenQuad(gl) {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const verts = new Float32Array([
            -1, -1, 0, 0,  1, -1, 1, 0,  -1, 1, 0, 1,
            -1, 1, 0, 1,   1, -1, 1, 0,   1, 1, 1, 1
        ]);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
        return vao;
    }

    getOrCreateLUT(name, data) {
        if (this.lutCache.has(name)) return this.lutCache.get(name);
        const tex = this.createLUTTexture(data);
        this.lutCache.set(name, tex);
        return tex;
    }

    createLUTTexture(data) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    }

    ensureInputTexture(floatData, width, height) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,
                      gl.RGBA, gl.FLOAT, floatData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        return tex;
    }

    uploadFloat32ArrayToTexture(floatData, width, height) {
        return this.ensureInputTexture(floatData, width, height);
    }

    getNextFBO(width, height) {
        const gl = this.gl;
        if (!this.framebuffers[this.currentFBOIndex]) {
            const fbo = gl.createFramebuffer();
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,
                          gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                    gl.TEXTURE_2D, tex, 0);
            this.framebuffers[this.currentFBOIndex] = { fbo, texture: tex, width, height };
        }
        return this.framebuffers[this.currentFBOIndex++ % 2];
    }

    readFramebufferToPixels(tex, width, height) {
        const gl = this.gl;
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                gl.TEXTURE_2D, tex, 0);
        const pixels = new Float32Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixels);
        return pixels;
    }

    applyEffects(effects, normedImage, t) {
        const gl = this.gl;
        const { width, height, data } = normedImage;
        let currentTex = this.ensureInputTexture(data, width, height);
        let currentData = null;
        let onGPU = true;

        for (const fx of effects) {
            if (fx.disabled) continue;
            const isGPU = typeof fx.renderGL === 'function';

            if (onGPU && !isGPU) {
                currentData = this.readFramebufferToPixels(currentTex, width, height);
                onGPU = false;
            }

            if (!isGPU) {
                currentData = fx.apply(fx, currentData, width, height, t);
                currentTex = this.uploadFloat32ArrayToTexture(currentData, width, height);
                onGPU = true;
            } else {
                const fbo = this.getNextFBO(width, height);
                fx.renderGL(gl, currentTex, fbo, fx.config, t);
                currentTex = fbo.texture;
                onGPU = true;
            }
        }

        const finalPixels = this.readFramebufferToPixels(currentTex, width, height);
        this.reset();
        return finalPixels;
    }

    reset() {
        this.currentFBOIndex = 0;
    }
}
