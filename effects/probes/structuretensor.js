import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {webGLState} from "../../utils/webgl_state.js";
import {generate2DKernel, KernelTypeEnum, subsampleKernel2D} from "../../utils/kernels.js";

const structureTensorFragSources = loadFragSrcInit("structure_tensor.frag", {});

export const structureTensorPass = {
    calculate(pass, inputTex, width, height, texelSizeX, texelSizeY, USE_KERNEL, kernelRadius = 3) {
        initGLEffect(pass, structureTensorFragSources);
        pass.setupFBO(pass, width, height);

        let kernelInfo;
        const MAX_KERNEL_SIZE = 255;
        const kernelSettings = [KernelTypeEnum.GAUSSIAN, kernelRadius, kernelRadius]
            kernelInfo = generate2DKernel(...kernelSettings, 1);
            if (kernelInfo.kernel.length > MAX_KERNEL_SIZE) {
                kernelInfo = subsampleKernel2D(...kernelSettings, MAX_KERNEL_SIZE);
            }

        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_texelSize: {value: [texelSizeX, texelSizeY], type: "vec2"},
            u_kernel: {type: "floatArray", value: kernelInfo.kernel},
            u_kernelRadius: {type: "int", value: kernelInfo.width},
        };
        const defines = {
            USE_KERNEL:  USE_KERNEL ? 1 : 0,
            KERNEL_SIZE: kernelInfo.kernel.length
        }
        pass.glState.renderGL(inputTex, pass.outputFBO, uniformSpec, defines);
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