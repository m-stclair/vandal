// Example GPU effect module using GlitchRenderer pipeline
export class webGLState {
    constructor(renderer, name, id) {
        this.vertexSrc = renderer.vao;
        this.gl = renderer.gl;
        this.renderer = renderer;
        this.fragmentSrc = null;
        this.initialized = false;
        this.name = name;
        this.id = id;
    }

    init() {
        if (!this.fragmentSrc) {
            throw new Error(`${this.name}-${this.id} GL init called with unloaded frag source`)
        }
        this.program = this.buildProgram(this.vertexSrc, this.fragmentSrc);
        this.uniforms = this.getUniformLocations(this.gl, this.program);
        this.initialized = true;
    }

    buildProgram(vsrc, fsrc) {
        const gl = this.gl;
        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vsrc);
        gl.compileShader(vs);
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fsrc);
        gl.compileShader(fs);
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
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

    renderGL(gl, inputTex, outputFBO, config, t) {
        if (!this.initialized) this.init(this.gl, this.renderer);
        gl.useProgram(this.program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO.fbo);
        gl.viewport(0, 0, outputFBO.width, outputFBO.height);
        gl.bindVertexArray(this.renderer.vao);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(this.uniforms.u_image, 0);

        // Add any config-based uniforms here
        // e.g., gl.uniform1f(this.uniforms.u_strength, config.strength || 0.5);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}
