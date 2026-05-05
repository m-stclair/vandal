import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {webGLState} from "../../utils/webgl_state.js";
import {generate2DKernel, subsampleKernel2D} from "../../utils/kernels.js";

const fragSources = loadFragSrcInit("clarity_sharp_pass.frag", {});

export const claritySharpPass = {
    calculate(pass, inputTex, width, height, radius, threshold, strength, knee) {
        initGLEffect(pass, fragSources);
        pass.setupFBO(pass, width, height);

        let kernelInfo;
        const MAX_KERNEL_SIZE = 255;
        if (pass.auxiliaryCache.lastKernelRadius !== radius) {
            kernelInfo = generate2DKernel("gaussian", radius, radius, radius + 0.5);
            if (kernelInfo.kernel.length > MAX_KERNEL_SIZE) {
                kernelInfo = subsampleKernel2D(kernelInfo, MAX_KERNEL_SIZE);
            }
            pass.auxiliaryCache.lastKernelRadius = radius;
            pass.auxiliaryCache.kernelInfo = kernelInfo;
        } else {
            kernelInfo = pass.auxiliaryCache.kernelInfo;
        }
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_kernel: {type: "floatArray", value: kernelInfo.kernel},
            u_threshold: {type: "float", value: threshold},
            u_strength: {type: "float", value: strength},
            u_knee: {type: "float", value: knee}
        };
        const defines = {
            KERNEL_WIDTH: kernelInfo.width,
            KERNEL_HEIGHT: kernelInfo.height,
        }
        pass.glState.renderGL(inputTex, pass.outputFBO, uniformSpec, defines);
        return pass.outputFBO;
    },
    initHook: async (pass, renderer) => {
        pass.auxiliaryCache = {}
        pass.glState = new webGLState(renderer, "kernel-pass", pass.id)
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
            pass.outputFBO = pass.glState.renderer.make_framebuffer(width, height, "kernelpass", "kernelpass");
        }
        pass.width = width;
        pass.height = height;
    }
}