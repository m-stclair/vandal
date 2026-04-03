import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {webGLState} from "../../utils/webgl_state.js";
import {kernelPass} from "../layers/kernel_pass.js";
import {CalcModeEnum} from "../../utils/glsl_enums.js";
import {morphPass} from "../layers/morph_pass.js";

const includeMap = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "differences.glsl": "includes/differences.glsl"
}

const structureTensorFragSources = loadFragSrcInit("calc_pass.frag", includeMap);

export const calcPass = {
    calculate(pass, inputTex, width, height, texelSizeX,
              texelSizeY, useKernel, kernelRadius = 3,
              CALCULATE_MODE = CalcModeEnum.STRUCTURE_TENSOR,
              morphologicalKernel=false, morphologicalOperator=0,
              kernelSoftness=10) {
        initGLEffect(pass, structureTensorFragSources);
        pass.setupFBO(pass, width, height);

        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_texelSize: {value: [texelSizeX, texelSizeY], type: "vec2"},
        };
        const defines = { CALCULATE_MODE: CALCULATE_MODE }
        pass.glState.renderGL(inputTex, pass.outputFBO, uniformSpec, defines);
        let outputFBO;
        if (useKernel && !morphologicalKernel) {
            outputFBO = pass.kernelPass.calculate(
                pass.kernelPass, pass.outputFBO.texture, width, height, "gaussian",
                kernelRadius, kernelRadius, kernelSoftness
            );
        } else if (useKernel) {
            outputFBO = pass.morphPass.calculate(
                pass.morphPass, pass.outputFBO.texture, width,
                height, kernelRadius, morphologicalOperator,
                2
            )
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
        pass.morphPass = {
            initHook: morphPass.initHook,
            cleanupHook: morphPass.cleanupHook,
            setupFBO: morphPass.setupFBO,
            calculate: morphPass.calculate,
            outputFBO: null,
            width: null,
            height: null,
            id: `${pass.id}-morph-pass`
        };
        await pass.kernelPass.initHook(pass.kernelPass, renderer);
        await pass.morphPass.initHook(pass.morphPass, renderer);
    },
    cleanupHook: (pass) => {
        if (pass.outputFBO?.fbo) {
            pass.glState.renderer.deleteFrameBuffer(pass.outputFBO.fbo);
            pass.outputFBO = null;
        }
        if (pass.kernelPass) {
            pass.kernelPass.cleanupHook(pass.kernelPass);
        }
        if (pass.morphPass) {
            pass.morphPass.cleanupHook(pass.morphPass);
        }
    },
    setupFBO: (pass, width, height) => {
        if (pass.width !== width || pass.height !== height) {
            if (pass.outputFBO?.fbo) {
                pass.glState.renderer.deleteFrameBuffer(pass.outputFBO.fbo);
                pass.outputFBO = null;
            }
            pass.outputFBO = pass.glState.renderer.make_framebuffer(width, height, "calcpass", pass.id);
        }
        pass.width = width;
        pass.height = height;
    }
}