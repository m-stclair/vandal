import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {webGLState} from "../../utils/webgl_state.js";
import {kernelPass} from "../layers/kernel_pass.js";
import {CalcModeEnum} from "../../utils/glsl_enums.js";

const structureTensorFragSources = loadFragSrcInit("calc_pass.frag", {});

export const calcPass = {
    calculate(pass, inputTex, width, height, texelSizeX,
              texelSizeY, useKernel, kernelRadius = 3,
              CALCULATE_MODE = CalcModeEnum.STRUCTURE_TENSOR) {
        initGLEffect(pass, structureTensorFragSources);
        pass.setupFBO(pass, width, height);

        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_texelSize: {value: [texelSizeX, texelSizeY], type: "vec2"},
        };
        const defines = { CALCULATE_MODE: CALCULATE_MODE }
        pass.glState.renderGL(inputTex, pass.outputFBO, uniformSpec, defines);
        let outputFBO;
        if (useKernel) {
            outputFBO = pass.kernelPass.calculate(
                pass.kernelPass, pass.outputFBO.texture, width, height, "gaussian",
                kernelRadius, kernelRadius, 10
            );
        } else {
            outputFBO = pass.outputFBO;
        }
        return outputFBO;
    },
    initHook: async (pass, renderer) => {
        pass.glState = new webGLState(renderer, "calc-pass", pass.id)
        await structureTensorFragSources.load(pass, renderer);
        pass.kernelPass = {
            initHook: kernelPass.initHook,
            cleanupHook: kernelPass.cleanupHook,
            setupFBO: kernelPass.setupFBO,
            calculate: kernelPass.calculate,
            outputFBO: null,
            width: null,
            height: null,
            id: `${pass.id}-kernel-pass`
        };
        await pass.kernelPass.initHook(pass.kernelPass, renderer);
    },
    cleanupHook: async(pass) => {
        if (pass.outputFBO?.fbo) {
            pass.glState.renderer.deleteFrameBuffer(pass.outputFBO.fbo);
            pass.outputFBO = null;
        }
        if (pass.kernelPass) {
            await pass.kernelPass.cleanupHook(pass.kernelPass);
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