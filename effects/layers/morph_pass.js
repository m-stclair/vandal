import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {webGLState} from "../../utils/webgl_state.js";

const fragSources = loadFragSrcInit("morph_pass.frag", {});

export const morphPass = {
    calculate(pass, inputTex, width, height, seRadius, operator, REDUCE_TO_GRAYSCALE) {
        initGLEffect(pass, fragSources);
        pass.setupFBO(pass, width, height);

        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_radius: {type: "int", value: seRadius},
        };
        const defines = {
            // 0: erosion; 1: dilation
            OPERATOR: operator,
            REDUCE_TO_GRAYSCALE: REDUCE_TO_GRAYSCALE
        }
        pass.glState.renderGL(inputTex, pass.outputFBO, uniformSpec, defines);
        return pass.outputFBO;
    },
    initHook: async (pass, renderer) => {
        pass.glState = new webGLState(renderer, "morph-pass", pass.id)
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
            pass.outputFBO = pass.glState.renderer.make_framebuffer(width, height, "kernelpass", "kernelpass");
        }
    }
}