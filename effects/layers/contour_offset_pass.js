// special-purpose pass: precomputes gradient/contour offset field for contourFlow()

import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {webGLState} from "../../utils/webgl_state.js";

const includeMap = {"colorconvert.glsl": "includes/colorconvert.glsl"};

const fragSources = loadFragSrcInit("contour_offset_pass.frag", includeMap);

export const contourOffsetPass = {
    calculate(pass, inputTex, width, height, uniforms, defines) {
        initGLEffect(pass, fragSources);
        pass.setupFBO(pass, width, height);

        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            ...uniforms
        };
        pass.glState.renderGL(inputTex, pass.outputFBO, uniformSpec, defines);
        return pass.outputFBO;
    },
    initHook: async (pass, renderer) => {
        pass.glState = new webGLState(renderer, "contour-offset-pass", pass.id)
        await fragSources.load(pass, renderer);
    },
    cleanupHook: (pass) => {
        if (pass.outputFBO?.fbo) {
            pass.glState.renderer.deleteFrameBuffer(pass.outputFBO.fbo);
            pass.outputFBO = null;
        }
    },
    setupFBO: (pass, width, height) => {
        if (pass.width !== width || pass.height !== height) {
            if (pass.outputFBO?.fbo) {
                pass.glState.renderer.deleteFrameBuffer(pass.outputFBO.fbo);
                pass.outputFBO = null;
            }
            pass.outputFBO = pass.glState.renderer.make_framebuffer(width, height, "contour-offset-pass", "contour-offset-pass");
        }
        pass.width = width;
        pass.height = height;
    }
}
