// Hybrid GPU/CPU pipeline manager
import { checkFrameBuffer, checkTexture, preprocessGLSL} from "./gl.js";
import { getEffectStack } from "../state.js";
import { hashObject } from "./helpers.js";
import { isModulating } from "../glitch.js";
import { monkeyPatchBindTexture, monkeyPatchDrawArrays } from "../tools/gl_bs.js";
import { clamp } from "./mathutils.js";

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
uniform vec2 u_center;
uniform vec2 u_viewSpan;

void main() {
    vec2 srcUV = clamp(u_center + (v_uv - 0.5) * u_viewSpan, 0.0, 1.0);
    outColor = texture(u_image8bit, srcUV);
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
        const [upsampleProgram, upsampleUniforms] = this.compileUpsampleProgram();
        this.upsampleProgram = upsampleProgram;
        this.upsampleUniforms = upsampleUniforms;
        this.renderCache = new Map();
        this.outputVert = null;
        this.outputFrag = null;
        this.outputProg = null;
        this.cachedImage = null;
        this.inputDirty = true;
        this.defaultFBO = this.gl.createFramebuffer();
        this.locked = false;
        this.sourceTexture = null;
        this.zoom = 1.0
        this.centerX = 0.5
        this.centerY = 0.5
        console.log(this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE))
    }

    lock() {
        this.locked = true;
    }

    unlock() {
        this.locked = false;
    }

    getCachedImageSize() {
        if (!this.cachedImage) return null;
        const img = this.cachedImage;
        return [
            img.naturalWidth ?? img.videoWidth ?? img.width,
            img.naturalHeight ?? img.videoHeight ?? img.height,
        ];
    }

    setCachedImage(img) {
        this.cachedImage = img;
        if (this.sourceTexture) {
            this.gl.deleteTexture(this.sourceTexture);
        }
        this.sourceTexture = null;
        if (this.inputTexture) {
            this.gl.deleteTexture(this.inputTexture);
        }
        this.inputTexture = null;
        this.loadImage();
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
        if (!gl.getShaderParameter(upfrag, gl.COMPILE_STATUS)) {
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
        gl.useProgram(upProg);
        const upsampleUniforms = {
            image: gl.getUniformLocation(upProg, "u_image8bit"),
            viewSpan: gl.getUniformLocation(upProg, "u_viewSpan"),
            center: gl.getUniformLocation(upProg, "u_center")
        }
        return [upProg, upsampleUniforms];
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
        this.deleteFrameBuffer(fbo.fbo);
        this.gl.deleteTexture(fbo.texture);
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
        const pixels = new this.format.arrayConstructor(width * height * 4);
        gl.readPixels(0, 0, width, height, this.format.formatEnum,
                      this.format.typeEnum, pixels);
        this.deleteFrameBuffer(fbo);
        return pixels;
    }

    deleteFrameBuffer(fbo) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.defaultFBO);
        gl.deleteFramebuffer(fbo);
    }

    unbindFramebuffer(fbo) {
        const gl = this.gl;
        if (gl.getParameter(gl.FRAMEBUFFER_BINDING) === fbo) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.defaultFBO);
        }
    }

    clearEffectBuffers() {
        Array.from(Object.keys(this.fxbuffers)).forEach(
            (id) => this.deleteEffectFBO(id)
        );
    }

    async applyFullRes(t) {
        const gl = this.gl;
        const iw = this.inputWidth
        const ih = this.inputHeight;
        const w = this.cachedImage.width;
        const h = this.cachedImage.height;
        this.inputWidth = w;
        this.inputHeight = h;
        this.gl.canvas.width = w;
        this.gl.canvas.height = h;
        this.loadImage();
        const tex = this.applyEffects(t);
        const pixels = this.readFramebufferToPixels(tex, gl.canvas.width, gl.canvas.height);
        [this.inputWidth, this.inputHeight] = [iw, ih];
        this.inputDirty = true;
        this.gl.canvas.width = iw;
        this.gl.canvas.height = ih;

        return pixels;
    }


    applyEffects(t) {
        if (this.inputDirty) {
            if (!this.cachedImage) return;
            const success = this.loadImage();
            if (!success) {
                console.error("failed to initialize input texture");
                return;
            }
            this.inputDirty = false;
        }
        if (this.locked) return;
        const effects = getEffectStack();
        const anySolo = getEffectStack().some(fx => fx.solo);

        const viewRect = this.getViewRect();
        const width = viewRect.w;
        const height = viewRect.h;
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
        if (!lastCacheEntry.texture) {
            return this.f32ToTex(lastCacheEntry.data, width, height);
        }
        return lastCacheEntry.texture;
    }

    reset_pipeline() {
        this.renderCache.clear();
        this.clearEffectBuffers();
        getEffectStack().forEach((fx) => {
            if (!fx.glState) return;
            fx.glState.last_uniforms = {};
        });
    }

    buildSourceTexture() {
        if (!this.cachedImage) return false;
        const gl = this.gl;
        if (this.sourceTexture) {
            gl.deleteTexture(this.sourceTexture);
            this.sourceTexture = null;
        }
            const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);

        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, false);

        // Mip-capable filtering on the source texture.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            this.cachedImage
        );

        gl.generateMipmap(gl.TEXTURE_2D);

        gl.bindTexture(gl.TEXTURE_2D, null);

        this.sourceTexture = tex;
        return true;
    }

    getViewRect() {
        const canvasW = this.gl.canvas.width;
        const canvasH = this.gl.canvas.height;
        const [imageW, imageH] = this.getCachedImageSize();

        if (imageH === undefined) {
            throw new Error("oops")
        }
        const imageAspect = imageW / imageH;
        const canvasAspect = canvasW / canvasH;

        let fitW, fitH;

        if (canvasAspect > imageAspect) {
            fitH = canvasH;
            fitW = Math.round(fitH * imageAspect);

            const w = Math.min(canvasW, Math.round(fitW * this.zoom));
            const h = fitH;
            const x = Math.floor((canvasW - w) / 2);
            const y = 0;
            return { x, y, w, h };
        } else {
            fitW = canvasW;
            fitH = Math.round(fitW / imageAspect);

            const w = fitW;
            const h = Math.min(canvasH, Math.round(fitH * this.zoom));
            const x = 0;
            const y = Math.floor((canvasH - h) / 2);
            return { x, y, w, h };
        }
    }

    getViewSpan(viewW, viewH) {
        const [imageW, imageH] = this.getCachedImageSize();

        const viewAspect = viewW / viewH;
        const imageAspect = imageW / imageH;

        const base = 1 / this.zoom;

        let spanX, spanY;

        if (viewAspect > imageAspect) {
            spanY = base;
            spanX = base * (viewAspect / imageAspect);
        } else {
            spanX = base;
            spanY = base * (imageAspect / viewAspect);
        }

        return [Math.min(spanX, 1), Math.min(spanY, 1)];
    }

    loadImage(size) {
        if (!this.cachedImage) {
            return false;
        }
        this.reset_pipeline();

        const gl = this.gl;

        const viewRect = this.getViewRect();

        let w, h;
        if (!size) {
            w = viewRect.w;
            h = viewRect.h;
        } else {
            [w, h] = size;
        }
        if (!this.sourceTexture) {
            this.buildSourceTexture();
        }

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
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            floatTex,
            0
        );

        gl.viewport(0, 0, viewRect.w, viewRect.h);
        gl.useProgram(this.upsampleProgram);
        gl.bindVertexArray(this.vao);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);

        const [spanX, spanY] = this.getViewSpan(viewRect.w, viewRect.h);
        gl.uniform1i(this.upsampleUniforms.image, 0);
        gl.uniform2f(this.upsampleUniforms.viewSpan, spanX, spanY);
        gl.uniform2f(this.upsampleUniforms.center, this.centerX, this.centerY);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.defaultFBO);
        gl.deleteFramebuffer(fbo);

        if (this.inputTexture !== null) {
            gl.deleteTexture(this.inputTexture);
        }

        this.inputTexture = floatTex;
        this.inputWidth = w;
        this.inputHeight = h;
        return true;
    }

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
        const viewRect = this.getViewRect();
        gl.viewport(viewRect.x, viewRect.y, viewRect.w, viewRect.h);
        gl.bindVertexArray(this.vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(this.outputProg, 'u_image'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    clampCenter() {
        const viewRect = this.getViewRect();
        const [spanX, spanY] = this.getViewSpan(viewRect.w, viewRect.h);

        const halfW = 0.5 * spanX;
        const halfH = 0.5 * spanY;

        this.centerX = clamp(this.centerX, halfW, 1.0 - halfW);
        this.centerY = clamp(this.centerY, halfH, 1.0 - halfH);
    }

    setZoom(deltaY) {
        const factor = Math.exp(-deltaY * 0.001);
        this.zoom = Math.max(1.0, Math.min(this.zoom * factor, 32.0));
        this.clampCenter();
        this.inputDirty = true;
    }

    panByPixels(dx, dy) {
        const rect = this.gl.canvas.getBoundingClientRect();

        const viewRect = this.getViewRect();
        const [spanX, spanY] = this.getViewSpan(viewRect.w, viewRect.h);

        this.centerX -= (dx / rect.width) * spanX;
        this.centerY += (dy / rect.height) * spanY;

        this.clampCenter();

        this.inputDirty = true;
    }

}
