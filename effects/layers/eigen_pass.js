// special-purpose pass: performs eigendecomposition on first pass of
// (possibly blurred) structure tensor

import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {webGLState} from "../../utils/webgl_state.js";

const includeMap = {};

const fragSources = loadFragSrcInit("eigen_decomp.frag", includeMap);

export const eigenPass = {
    calculate(pass, inputTex, width, height) {
        initGLEffect(pass, fragSources);
        pass.setupFBO(pass, width, height);

        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
        };
        const defines = {}
        pass.glState.renderGL(inputTex, pass.outputFBO, uniformSpec, defines);
        return pass.outputFBO;
    },
    initHook: async (pass, renderer) => {
        pass.glState = new webGLState(renderer, "eigen-pass", pass.id)
        await fragSources.load(pass, renderer);
    },
    cleanupHook: (pass) => {
        if (pass.outputFBO?.fbo) {
            pass.glState.renderer.deleteFramebufferTarget(pass.outputFBO.fbo);
            pass.outputFBO = null;
        }
    },
    setupFBO: (pass, width, height) => {
        if (pass.width !== width || pass.height !== height) {
            if (pass.outputFBO?.fbo) {
                pass.glState.renderer.deleteFramebufferTarget(pass.outputFBO.fbo);
                pass.outputFBO = null;
            }
            pass.outputFBO = pass.glState.renderer.make_framebuffer(width, height, "eigen-pass", "eigen-pass");
        }
        pass.width = width;
        pass.height = height;
    }
}