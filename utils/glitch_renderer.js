// Hybrid GPU/CPU pipeline manager
import {checkFrameBuffer, checkTexture, preprocessGLSL} from "./gl.js";
import {
    getEffectStack,
    getNormedImage,
    getNormLoadID,
    renderCacheGet,
    renderCacheSet,
    clearRenderCache
} from "../state.js";
import {hashObject} from "./helpers.js";
import {isModulating} from "../glitch.js";

export class GlitchRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2');
        const version = this.gl.getParameter(this.gl.VERSION);
        console.log("WebGL version:", version);

        this.format = {
            internalFormat: this.gl.RGBA32F,
            formatEnum: this.gl.RGBA,
            typeEnum: this.gl.FLOAT,
            arrayConstructor: Float32Array,
        }
        this.framebuffers = []; // ping-pong FBOs
        this.fxbuffers = {};
        this.lutCache = new Map();
        // NOTE: I am _not_ sure why i need this. driver weirdness?
        if (!this.gl.getExtension("EXT_color_buffer_float")) {
            throw new Error("bad graphics weirdness");
        }
        this.currentFBOIndex = 0;
        this.vertexShader = null;
        this.initSharedResources();
        this.lastLoadID = null;
        this.inputTexture = null;
    }

    initSharedResources() {
        this.vao = this.createFullscreenQuad(this.gl);
        this.compileVertexShader();
    }

    compile(type, source, ppOptions) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        const processed = preprocessGLSL(source, ppOptions);

        console.log(processed);
        console.log(ppOptions?.defines)
        gl.shaderSource(shader, processed);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    compileVertexShader() {
        this.vertexShader = this.compile(this.gl.VERTEX_SHADER,
            `#version 300 es
          in vec2 a_position;
          out vec2 v_texCoord;
          void main() {
            v_texCoord = 0.5 * (a_position + 1.0);
            gl_Position = vec4(a_position, 0, 1);
          }
        `);
    }


    createFullscreenQuad(gl) {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const verts = new Float32Array([
            -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1,
            -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1
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
        // TODO: Why does this _not_ work as float?
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        checkTexture(gl, tex);
        return tex;
    }

    ensureInputTexture(f32Array, width, height) {
        const gl = this.gl;
        const tex = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            this.format.internalFormat,
            width,
            height,
            0,
            this.format.formatEnum,
            this.format.typeEnum,
            f32Array
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        checkTexture(gl, tex);
        return tex;
    }

    f32ToTex(f32Array, width, height) {
        return this.ensureInputTexture(f32Array, width, height);
    }

    getNextFBO(width, height) {
        if (!this.framebuffers[this.currentFBOIndex]) {
            this.framebuffers[this.currentFBOIndex++ % 2] = this.make_framebuffer(width, height);
        }
        return this.framebuffers[this.currentFBOIndex++ % 2];
    }


    getEffectFBO(id, width, height) {
        if (!this.fxbuffers[id]) {
            this.fxbuffers[id] = this.make_framebuffer(width, height);
        }
        return this.fxbuffers[id];
    }

    deleteEffectFBO(id) {
        if (!this.fxbuffers[id]) return;
        const fbo = this.fxbuffers[id];
        this.gl.deleteTexture(fbo.texture);
        this.gl.deleteFramebuffer(fbo.fbo);
        this.fxbuffers[id] = undefined;
    }

    make_framebuffer(width, height) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            this.format.internalFormat,
            width,
            height,
            0,
            this.format.formatEnum,
            this.format.typeEnum,
            null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        checkTexture(gl, tex);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D, tex, 0);
        checkFrameBuffer(gl);
        return {fbo, texture: tex, width, height};

    }

    readFramebufferToPixels(tex, width, height) {
        const gl = this.gl;
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        checkTexture(gl, tex);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D, tex, 0);
        checkFrameBuffer(gl);
        const pixels = new this.format.arrayConstructor(width * height * 4);
        gl.readPixels(
            0, 0, width, height, this.format.formatEnum, this.format.typeEnum, pixels);
        return pixels;
    }

    clearEffectBuffers() {
        Array.from(Object.keys(this.fxbuffers)).forEach(
            (id) => this.deleteEffectFBO(id)
        );
    }


    applyEffects(t, normedImage) {
        if (!normedImage) {
            normedImage = getNormedImage();
        }
        if (!normedImage) return;
        const loadId = getNormLoadID();
        const {data, width, height} = normedImage;
        let currentTex;
        if (this.lastLoadID !== loadId || !this.inputTexture) {
            currentTex = this.ensureInputTexture(data, width, height);
            this.inputTexture = currentTex;
            clearRenderCache();
            this.clearEffectBuffers();
        }
        this.lastLoadID = loadId;
        const effects = getEffectStack();
        const anySolo = getEffectStack().some(fx => fx.solo);
        let hashChain = `top-${width}-${height}-${loadId}`;
        let animationUpdate = false;
        let lastCacheEntry = {
            data: data,
            texture: this.inputTexture
        };
        for (const fx of effects) {
            if (!fx.apply) continue;
            if (fx.disabled || (anySolo && !fx.solo)) {
                hashChain += `${fx.name}-${fx.id}-disabled`;
                continue;
            }
            const cacheEntry = renderCacheGet(fx.id);
            const isGPU = fx.isGPU;
            const timeChanged = cacheEntry?.lastT !== t;
            animationUpdate = animationUpdate ? animationUpdate : isModulating(fx) && timeChanged;
            hashChain += hashObject(fx.config) + fx.id;
            if (isModulating(fx)) hashChain += `-${t}`;
            const hashChanged = (
                !cacheEntry
                || hashChain !== cacheEntry.hashChain
            );
            let needsUpdate = (
                (hashChanged || animationUpdate)
                || (!cacheEntry?.texture && !cacheEntry?.data)
            );
            let update = {};
            if (needsUpdate) {
                const start = performance.now()
                let input;
                if (isGPU && lastCacheEntry?.texture) {
                    input = lastCacheEntry.texture;
                } else if (isGPU && lastCacheEntry?.data) {
                    lastCacheEntry.texture = this.f32ToTex(
                        lastCacheEntry.data, width, height
                    );
                    input = lastCacheEntry.texture;
                } else if (!isGPU && lastCacheEntry?.data) {
                    input = lastCacheEntry.data;
                } else if (!isGPU && lastCacheEntry?.texture) {
                    lastCacheEntry.data = this.readFramebufferToPixels(
                        lastCacheEntry.texture, width, height
                    )
                    input = lastCacheEntry.data;
                } else {
                    throw new Error("invalid effect cache state");
                }
                if (!isGPU) {
                    update['data'] = fx.apply(fx, input, width, height, t);
                } else {
                    if (fx.glState.renderer !== this) {
                        throw new Error("GL effect not attached to this renderer")
                    }
                    const fbo = this.getEffectFBO(fx.id, width, height);
                    fx.apply(fx, input, width, height, t, fbo);
                    update['texture'] = fbo.texture;
                }
                const duration = performance.now() - start;
                // console.log(`rendered ${fx.name}-${fx.id}, ${duration} ms`);
            } else {
                update = {data: cacheEntry.data, texture: cacheEntry.texture}
            }
            lastCacheEntry = {
                config: structuredClone(fx.config),
                disabled: fx.disabled,
                hashChain: hashChain,
                lastT: t,
            }
            lastCacheEntry['texture'] = update['texture'];
            lastCacheEntry['data'] = update['data']
            renderCacheSet(fx.id, lastCacheEntry);
        }
        let finalPixels;
        if (lastCacheEntry.data) {
            finalPixels = lastCacheEntry.data
        } else if (lastCacheEntry.texture) {
            finalPixels = this.readFramebufferToPixels(lastCacheEntry.texture, width, height);
        } else {
            throw new Error("invalid pipeline output")
        }
        this.reset();
        return finalPixels;
    }

    format = {}

    reset() {
        this.currentFBOIndex = 0;
    }
}
