import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {webGLState} from "../../utils/webgl_state.js";
import {generate2DKernel, subsampleKernel2D} from "../../utils/kernels.js";

const fragSources = loadFragSrcInit("kernel_pass.glsl", {});

export const kernelPass = {
    calculate(pass, inputTex, width, height, kernelName, kernelRadiusX, kernelRadiusY, kernelSoftness) {
        initGLEffect(pass, fragSources);
        pass.setupFBO(pass, width, height);

        let kernelInfo;
        const kernelSettings = [kernelName, kernelRadiusX, kernelRadiusY, kernelSoftness];
        const MAX_KERNEL_SIZE = 255;
        if (String(pass.auxiliaryCache.lastKernelSettings) !== String(kernelSettings)) {
            kernelInfo = generate2DKernel(kernelName, kernelRadiusX, kernelRadiusY, kernelSoftness);
            if (kernelInfo.kernel.length > MAX_KERNEL_SIZE) {
                kernelInfo = subsampleKernel2D(kernelInfo, MAX_KERNEL_SIZE);
            }
            pass.auxiliaryCache.lastKernelSettings = kernelSettings;
            pass.auxiliaryCache.kernelInfo = kernelInfo;
        } else {
            kernelInfo = pass.auxiliaryCache.kernelInfo;
        }
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_kernel: {type: "floatArray", value: kernelInfo.kernel},
        };
        const defines = {
            KERNEL_WIDTH: kernelInfo.width,
            KERNEL_HEIGHT: kernelInfo.height
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
        pass.width = width;
        pass.height = height;
    }
}