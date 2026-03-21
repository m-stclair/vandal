import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {webGLState} from "../../utils/webgl_state.js";

const structureTensorFragSources = loadFragSrcInit("structure_tensor.frag", {});

export const structureTensorPass = {
    calculate(pass, inputTex, width, height, texelSizeX, texelSizeY) {
        initGLEffect(pass, structureTensorFragSources);
        pass.setupFBO(pass, width, height);
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_texelSize: {value: [texelSizeX, texelSizeY], type: "vec2"}
        };
        pass.glState.renderGL(inputTex, pass.outputFBO, uniformSpec);
    },
    initHook: async (pass, renderer) => {
        pass.glState = new webGLState(renderer, "none", "none")
        await structureTensorFragSources.load(pass, renderer);
    },
    cleanupHook: async(pass) => {
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
            pass.outputFBO = pass.glState.renderer.make_framebuffer(width, height, "kuwaharaStructureTensor", "kuwaharaStructureTensor");
        }
    }
}