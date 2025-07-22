// Hybrid GPU/CPU pipeline manager
import {checkFrameBuffer, checkTexture, preprocessGLSL} from "./gl.js";
import {
    getEffectStack, renderer,
} from "../state.js";
import {hashObject} from "./helpers.js";
import {isModulating} from "../glitch.js";
import {monkeyPatchBindTexture, monkeyPatchDrawArrays} from "../tools/gl_bs.js";

const uploadVertSrc = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}`

const uploadFragSrc = `#version 300 es
precision mediump float;

uniform sampler2D u_image8bit;
in vec2 v_uv;
out vec4 outColor;

void main() {
    vec4 srgba = texture(u_image8bit, v_uv);
    // If input is sRGB-encoded, decode it manually
    // Otherwise just pass through (depends on texture setup)
    outColor = srgba; // Linear-ish float now in [0,1]
}`

const outputFragSrc = `#version 300 es
    precision mediump float;
    uniform sampler2D u_image;
    in vec2 v_uv;
    out vec4 outColor;
            
    void main() {
        vec2 flippedUV = vec2(v_uv.x, 1.0 - v_uv.y);
        outColor = texture(u_image, flippedUV);
    }`

const outputVertSrc = `#version 300 es
    in vec2 a_position;
    out vec2 v_uv;
    void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`

export class GlitchRenderer {
    constructor(ctx) {
        this.gl = ctx;
        // monkeyPatchDrawArrays(this.gl);
        // monkeyPatchBindTexture(this.gl);
        const version = this.gl.getParameter(this.gl.VERSION);
        console.log("WebGL version:", version);
        this.format = {
            internalFormat: this.gl.RGBA16F,
            formatEnum: this.gl.RGBA,
            typeEnum: this.gl.FLOAT,
            arrayConstructor: Float32Array,
        }
        this.fxbuffers = {};
        this.lutCache = new Map();
        // NOTE: I am _not_ sure why i need this. driver weirdness?
        if (!this.gl.getExtension("EXT_color_buffer_float")) {
            throw new Error("bad graphics weirdness");
        }
        this.vertexShader = null;
        this.initSharedResources();
        this.inputTexture = null;
        this.inputHeight = null;
        this.inputWidth = null;
        this.upsampleProgram = this.compileUpsampleProgram();
        this.renderCache = new Map();
        this.outputVert = null;
        this.outputFrag = null;
        this.outputProg = null;
    }

    compileUpsampleProgram() {
        const gl = this.gl;
        const upvert = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(upvert, uploadVertSrc);
        gl.compileShader(upvert);
        if (!gl.getShaderParameter(upvert, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(upvert));
        }
        const upfrag = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(upfrag, uploadFragSrc);
        gl.compileShader(upfrag);
        if (!gl.getShaderParameter(upvert, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(upfrag));
        }
        const upProg = gl.createProgram();
        gl.attachShader(upProg, upvert);
        gl.attachShader(upProg, upfrag);
        gl.linkProgram(upProg);
        if (!gl.getProgramParameter(upProg, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(upProg);
            throw new Error(`Could not compile WebGL program. \n\n${info}`);
        }
        return upProg;
    }

    initSharedResources() {
        this.vao = this.createFullscreenQuad(this.gl);
        this.compileVertexShader();
    }

    compile(type, source, ppOptions) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        const processed = preprocessGLSL(source, ppOptions);

        // console.log(processed);
        // console.log(ppOptions?.defines)
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
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // checkTexture(gl, tex);
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
        // checkTexture(gl, tex);
        return tex;
    }

    f32ToTex(f32Array, width, height) {
        return this.ensureInputTexture(f32Array, width, height);
    }

    getEffectFBO(id, width, height, name) {
        if (!this.fxbuffers[id]) {
            this.fxbuffers[id] = this.make_framebuffer(width, height, id, name);
        }
        return this.fxbuffers[id];
    }

    deleteEffectFBO(id) {
        if (!this.fxbuffers[id]) return;
        const fbo = this.fxbuffers[id];
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo.fbo);
        this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER,
            this.gl.COLOR_ATTACHMENT0,
            this.gl.TEXTURE_2D,
            null,
            0
        );
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        setTimeout(() => {
            this.gl.deleteTexture(fbo.texture);
        }, 0);
        setTimeout(() => {
            this.gl.deleteFramebuffer(fbo.fbo);
        }, 0);

        this.fxbuffers[id] = undefined;
    }

    make_framebuffer(width, height, id, name) {
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
        // checkTexture(gl, tex);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D, tex, 0);
        // checkFrameBuffer(gl);
        tex._id = id;
        tex._name = name;
        fbo._id = id;
        fbo._name = name;
        return {fbo, texture: tex, width, height};

    }

    readFramebufferToPixels(tex, width, height) {
        const gl = this.gl;
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        // checkTexture(gl, tex);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D, tex, 0);
        // checkFrameBuffer(gl);
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


    applyEffects(t) {
        const effects = getEffectStack();
        const anySolo = getEffectStack().some(fx => fx.solo);
        const width = this.inputWidth;
        const height = this.inputHeight;
        let hashChain = `top`;
        let animationUpdate = false;
        let lastCacheEntry = {
            data: null,
            texture: this.inputTexture
        };
        for (const fx of effects) {
            if (!fx.apply) continue;
            if (fx.disabled || (anySolo && !fx.solo)) {
                hashChain += `${fx.name}-${fx.id}-disabled`;
                continue;
            }
            const cacheEntry = this.renderCache.get(fx.id);
            const isGPU = fx.isGPU;
            const timeChanged = cacheEntry?.lastT !== t;
            animationUpdate = animationUpdate ? animationUpdate : isModulating(fx) && timeChanged;
            const configHash = hashObject(fx.config);
            hashChain += configHash + fx.id;
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
                    const fbo = this.getEffectFBO(fx.id, width, height, fx.name);
                    if (fx.glState) {
                        fx.glState.uniformsDirty = !(configHash === this.renderCache.get(fx.id)?.configHash);
                    }
                    fx.apply(fx, input, width, height, t, fbo);
                    update['texture'] = fbo.texture;
                }
                const duration = performance.now() - start;
                // console.log(`rendered ${fx.name}-${fx.id}, ${duration} ms`);
            } else {
                update = {data: cacheEntry.data, texture: cacheEntry.texture}
            }
            lastCacheEntry = {
                configHash: configHash,
                disabled: fx.disabled,
                hashChain: hashChain,
                lastT: t,
            }
            lastCacheEntry['texture'] = update['texture'];
            lastCacheEntry['data'] = update['data']
            this.renderCache.set(fx.id, lastCacheEntry);
        }
        return lastCacheEntry.texture;
    }

    reset() {
        this.renderCache.clear();
        this.clearEffectBuffers();
        getEffectStack().forEach((fx) => {
            if (!fx.glState) return;
            fx.glState.last_uniforms = {};
        });
    }

    async loadImage(img) {
        this.reset();
        const gl = this.gl

        const w = gl.canvas.width;
        const h = gl.canvas.height;

        const cpuCanvas = document.createElement("canvas");
        cpuCanvas.width = w;
        cpuCanvas.height = h;
        const ctx = cpuCanvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);

        const inputTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            cpuCanvas
        );

        // --- Step 4: Allocate float texture + FBO ---
        const floatTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, floatTex);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA16F,
            w,
            h,
            0,
            gl.RGBA,
            gl.HALF_FLOAT,
            null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, floatTex, 0);
        gl.viewport(0, 0, w, h);
        gl.useProgram(this.upsampleProgram); // assumes it's compiled already
        gl.bindVertexArray(this.vao);        // fullscreen quad
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(this.upsampleProgram, 'u_image8bit'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fbo);
        if (this.inputTexture !== null) {
            gl.deleteTexture(this.inputTexture);
        }
        this.inputTexture = floatTex;
        this.inputWidth = w;
        this.inputHeight = h;
    };

    writeToCanvas(tex) {
        const gl = this.gl;
        const canvas = gl.canvas;
        if (this.outputVert === null) {
            this.outputVert = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(this.outputVert, outputVertSrc)
            gl.compileShader(this.outputVert);
            if (!gl.getShaderParameter(this.outputVert, gl.COMPILE_STATUS)) {
                throw new Error(gl.getShaderInfoLog(this.outputVert));
            }
        }
        if (this.outputFrag === null) {
            this.outputFrag = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(this.outputFrag, outputFragSrc)
            gl.compileShader(this.outputFrag);
            if (!gl.getShaderParameter(this.outputFrag, gl.COMPILE_STATUS)) {
                throw new Error(gl.getShaderInfoLog(this.outputFrag));
            }
        }
        if (this.outputProg === null) {
            this.outputProg = gl.createProgram();
            gl.attachShader(this.outputProg, this.outputVert);
            gl.attachShader(this.outputProg, this.outputFrag);
            gl.linkProgram(this.outputProg);
            if (!gl.getProgramParameter(this.outputProg, gl.LINK_STATUS)) {
                const info = gl.getProgramInfoLog(this.outputProg);
                throw new Error(`Could not compile WebGL program. \n\n${info}`);
            }
        }
        gl.useProgram(this.outputProg);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.bindVertexArray(this.vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(this.outputProg, 'u_image'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }


    format = {}

}
