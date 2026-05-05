// special-purpose pass: precomputes Risograph plate separation into RGB

import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {webGLState} from "../../utils/webgl_state.js";

const fragSources = loadFragSrcInit("riso_plate_pass.frag", {});

export const risoPlatePass = {
    calculate(pass, inputTex, width, height, uniforms = {}, defines = {}) {
        initGLEffect(pass, fragSources);
        pass.setupFBO(pass, width, height);

        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            ...uniforms,
        };

        pass.glState.renderGL(inputTex, pass.outputFBO, uniformSpec, defines);
        return pass.outputFBO;
    },

    initHook: async (pass, renderer) => {
        pass.glState = new webGLState(renderer, "riso-plate-pass", pass.id);
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
            pass.outputFBO = pass.glState.renderer.make_framebuffer(
                width,
                height,
                "riso-plate-pass",
                "riso-plate-pass"
            );
        }

        pass.width = width;
        pass.height = height;
    },
};
