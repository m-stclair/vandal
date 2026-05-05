import {UniformSetters, checkTexture, checkFrameBuffer} from "./gl.js";
import {isEqual} from "./helpers.js";

export class webGLState {
    constructor(renderer, name, id) {
        this.renderer = renderer;
        this.fragSrc = null;
        this.initialized = false;
        this.name = name;
        this.id = id;
        this.includeMap = null;
        this.last_defines = {};
        this.last_uniforms = {};
    }

    get gl() {
        return this.renderer.gl;
    }

    get format() {
        return this.renderer.format;
    }

    get vao() {
        return this.renderer.vao;
    }

    getOrCreateLUT(name, data) {
        return this.renderer.getOrCreateLUT(name, data);
    }

    init(defines) {
        if (!this.fragSrc) {
            throw new Error(`${this.name}-${this.id} GL init called with unloaded frag source`)
        }
        if (this.fragSrc instanceof Promise || Object.values(this.includeMap).some((x) => x instanceof Promise)) {
            // We're going too fast! Soft fault.
            return false;
        }
        this.program = this.buildProgram(defines);
        this.uniforms = this.getUniformLocations(this.program);
        this.initialized = true;
        return true;
    }

    allocateTexture(format, width, height, buffer) {
        const {internalFormat, formatEnum, typeEnum, arrayConstructor} = this.renderer.format;
        const gl = this.gl;
        if (buffer && !(buffer instanceof arrayConstructor)) {
            throw new Error("Mismatched buffer type for texture format");
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, formatEnum, typeEnum, buffer);
        return buffer;
    }

    definesChanged(defines) {
        if (!defines) return false;
        if (!this.last_defines) return true;
        for (let k of Object.keys(defines)) {
            if (isEqual(defines[k], this.last_defines[k])) continue;
            if (defines[k] === this.last_defines[k]) continue;
            if (defines[k] instanceof Number && defines[k] === Number.parseInt(this.last_defines[k])) continue;
            return true;
        }
        return false;
    }

    buildProgram(defines) {
        const gl = this.gl;
        const start = performance.now();
        const fs = this.renderer.compile(
            gl.FRAGMENT_SHADER,
            this.fragSrc,
            {includeMap: this.includeMap, defines: defines}
        );
        const prog = gl.createProgram();
        gl.attachShader(prog, this.renderer.vertexShader);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(prog);
            throw new Error(`Could not compile WebGL program. \n\n${info}`);
        }
        this.last_defines = defines;
        console.log(`compilation time ${performance.now() - start} for ${this.name}-${this.id}`)
        return prog;
    }

    getUniformLocations(program) {
        const gl = this.gl;
        const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        const locations = {};
        for (let i = 0; i < count; i++) {
            const info = gl.getActiveUniform(program, i);
            locations[info.name] = gl.getUniformLocation(program, info.name);
        }

        return locations;
    }

    renderGL(inputTex, outputFBO, uniformSpec, defines) {
        const undef = (Object.entries(uniformSpec).filter(v => v[1].value === undefined))
        if (undef.length > 0) {
            console.warn(
                `some uniforms undefined in ${this.name}-${this.id}: ${undef.map(o => o)}`
            )
        }
        if (!this.initialized) {
            // this should always mean the frag source isn't ready yet --
            // machine gun preset loading or something. soft fault, skip a frame.
            if (!this.init(defines)) return inputTex;
        }
        const gl = this.gl;
        // this will result in a double compilation on the very first frame
        // in some cases, which is probably not a huge deal.
        if (this.definesChanged(defines)) {
            gl.deleteProgram(this.program);
            this.program = this.buildProgram(defines);
            this.uniforms = this.getUniformLocations(this.program);
        }
        gl.useProgram(this.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(this.uniforms["u_image"], 0);
        this.uploadUniforms(uniformSpec);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO.fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,
            outputFBO.texture, 0
        );
        gl.viewport(0, 0, outputFBO.width, outputFBO.height);
        gl.bindVertexArray(this.renderer.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this.last_uniforms = uniformSpec;
    }

    uploadUniforms(uniformSpec) {
        const gl = this.gl;

        this.last_uniform_values ??= {};
        this.uboCache ??= new Map();
        this.textureUniformCache ??= new Map();
        this.uniformBlockIndexCache ??= new Map();

        // Uniform values live on the program. If the program changed, the GPU-side
        // uniform state is gone even if the JS values are "the same".
        const programChanged = this._uniformCacheProgram !== this.program;
        if (programChanged) {
            this._uniformCacheProgram = this.program;
            this.last_uniform_values = {};
            this.uniformBlockIndexCache.clear();
        }

        const cloneUniformValue = (value) => {
            if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
                return new value.constructor(value);
            }
            if (Array.isArray(value)) {
                return value.map(v => (
                    Array.isArray(v) ||
                    (ArrayBuffer.isView(v) && !(v instanceof DataView))
                ) ? cloneUniformValue(v) : v);
            }
            return value;
        };

        const getUniformLocation = (name) => {
            if (!(name in this.uniforms)) {
                this.uniforms[name] = gl.getUniformLocation(this.program, name);
            }
            return this.uniforms[name];
        };

        const rememberUniformValue = (name, value) => {
            this.last_uniform_values[name] = cloneUniformValue(value);
        };

        const uniformValueUnchanged = (name, value) => {
            return isEqual(this.last_uniform_values[name], value);
        };

        const isArrayTextureData = (value) => {
            return Array.isArray(value) ||
                (ArrayBuffer.isView(value) && !(value instanceof DataView));
        };

        const bindTextureUniformValue = (name, value, width, height) => {
            if (!isArrayTextureData(value)) {
                gl.bindTexture(gl.TEXTURE_2D, value);
                return;
            }

            if (!width || !height) {
                throw new Error(`texture2D uniform ${name} needs width and height`);
            }

            const data = Array.isArray(value)
                ? new this.format.arrayConstructor(value)
                : value;

            let cached = this.textureUniformCache.get(name);

            if (!cached || cached.width !== width || cached.height !== height) {
                if (cached?.texture) {
                    gl.deleteTexture(cached.texture);
                }

                cached = {
                    texture: gl.createTexture(),
                    width,
                    height,
                    lastValue: null
                };

                this.textureUniformCache.set(name, cached);
            }

            gl.bindTexture(gl.TEXTURE_2D, cached.texture);

            if (!isEqual(cached.lastValue, data)) {
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    this.format.internalFormat,
                    width,
                    height,
                    0,
                    this.format.formatEnum,
                    this.format.typeEnum,
                    data
                );

                cached.lastValue = cloneUniformValue(data);
            }
        };

        let textureIndex = 0;

        for (const [name, spec] of Object.entries(uniformSpec)) {
            const {value, type, width, height, binding} = spec;

            if (value === undefined) {
                continue;
            }

            if (type === "texture2D") {
                const loc = getUniformLocation(name);

                textureIndex++;
                gl.activeTexture(gl.TEXTURE0 + textureIndex);

                bindTextureUniformValue(name, value, width, height);

                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

                if (loc !== null) {
                    UniformSetters[type](gl, loc, textureIndex);
                }

                continue;
            }

            if (type === "UBO") {
                const blockBinding = binding ?? 0;

                let blockIndex = this.uniformBlockIndexCache.get(name);
                if (blockIndex === undefined) {
                    blockIndex = gl.getUniformBlockIndex(this.program, name);
                    this.uniformBlockIndexCache.set(name, blockIndex);
                }

                if (blockIndex === gl.INVALID_INDEX) {
                    continue;
                }

                gl.uniformBlockBinding(this.program, blockIndex, blockBinding);

                let cached = this.uboCache.get(name);
                if (!cached) {
                    cached = {
                        buffer: gl.createBuffer(),
                        byteLength: 0
                    };
                    this.uboCache.set(name, cached);
                }

                gl.bindBufferBase(gl.UNIFORM_BUFFER, blockBinding, cached.buffer);
                gl.bindBuffer(gl.UNIFORM_BUFFER, cached.buffer);

                const data = ArrayBuffer.isView(value)
                    ? value
                    : new Float32Array(value);

                if (!uniformValueUnchanged(name, data)) {
                    if (cached.byteLength !== data.byteLength) {
                        gl.bufferData(gl.UNIFORM_BUFFER, data, gl.DYNAMIC_DRAW);
                        cached.byteLength = data.byteLength;
                    } else {
                        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
                    }

                    rememberUniformValue(name, data);
                }

                continue;
            }

            const loc = getUniformLocation(name);

            // Uniform may be optimized out or #defined away.
            if (loc === null) {
                continue;
            }

            if (uniformValueUnchanged(name, value)) {
                continue;
            }

            const setter = UniformSetters[type];
            if (!setter) {
                throw new Error(`Unknown uniform type "${type}" for ${name}`);
            }

            setter(gl, loc, value);
            rememberUniformValue(name, value);
        }
    }

}
