import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {webGLState} from "../../utils/webgl_state.js";
import {kernelPass} from "../layers/kernel_pass.js";
import {CalcModeEnum, MorphChannelEnum, MorphEnum} from "../../utils/glsl_enums.js";
import {morphPass} from "../layers/morph_pass.js";
import {eigenPass} from "../layers/eigen_pass.js";

const includeMap = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "differences.glsl": "includes/differences.glsl"
}

const calcPassFragSources = loadFragSrcInit("calc_pass.frag", includeMap);

function setupPass(pass, id) {
    return {
        initHook: pass.initHook,
        cleanupHook: pass.cleanupHook,
        setupFBO: pass.setupFBO,
        calculate: pass.calculate,
        outputFBO: null,
        width: null,
        height: null,
        id: id
    }
}

export const calcPass = {
    calculate(
        pass,
        inputTex,
        width,
        height,
        texelSizeX,
        texelSizeY,
        CALCULATE_MODE = CalcModeEnum.STRUCTURE_TENSOR,
        useConvolutionKernel = false,
        convolutionKernelRadius = 3,
        useMorphologicalKernel = false,
        morphologicalKernelRadius = 3,
        morphologicalOperator = MorphEnum.EROSION,
        kernelSoftness = 10
  ) {
        initGLEffect(pass, calcPassFragSources);
        pass.setupFBO(pass, width, height);

        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_texelSize: {value: [texelSizeX, texelSizeY], type: "vec2"},
        };
        const defines = { CALCULATE_MODE: CALCULATE_MODE }
        pass.glState.renderGL(inputTex, pass.outputFBO, uniformSpec, defines);
        let outputFBO = pass.outputFBO;
        if (useMorphologicalKernel) {
            outputFBO = pass.morphPass.calculate(
                pass.morphPass, outputFBO.texture, width,
                height, morphologicalKernelRadius, morphologicalOperator,
                MorphChannelEnum.TENSOR4
            )
        }
        if (useConvolutionKernel) {
            outputFBO = pass.kernelPass.calculate(
                pass.kernelPass, outputFBO.texture, width, height, "gaussian",
                convolutionKernelRadius, convolutionKernelRadius, kernelSoftness
            )
        }
        if (CALCULATE_MODE === CalcModeEnum.STRUCTURE_TENSOR) {
            outputFBO = pass.eigenPass.calculate(pass.eigenPass, outputFBO.texture, width, height)
        }
        return outputFBO;
    },
    initHook: async (pass, renderer) => {
        pass.glState = new webGLState(renderer, "calc-pass", pass.id)
        await calcPassFragSources.load(pass, renderer);
        pass.kernelPass = setupPass(kernelPass, `${pass.id}-kernel-pass`)
        pass.morphPass = setupPass(morphPass, `${pass.id}-morph-pass`)
        pass.kernelPass = setupPass(kernelPass, `${pass.id}-kernel-pass`)
        pass.eigenPass = setupPass(eigenPass, `${pass.id}-eigen-pass`)
        await pass.kernelPass.initHook(pass.kernelPass, renderer);
        await pass.morphPass.initHook(pass.morphPass, renderer);
        await pass.eigenPass.initHook(pass.eigenPass, renderer);
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