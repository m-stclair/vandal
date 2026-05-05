import { resolveAnimAll } from "../utils/animutils.js";
import { initGLEffect, loadFragSrcInit } from "../utils/gl.js";
import { blendControls } from "../utils/ui_configs.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum
} from "../utils/glsl_enums.js";

const shaderPath = "temporal_delay.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl"
};

const fragSources = loadFragSrcInit(shaderPath, includePaths);

const MAX_DELAY_KERNEL_RADIUS = 4;
const MAX_DELAY_KERNEL_TAPS = MAX_DELAY_KERNEL_RADIUS * 2 + 1;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function ensureDelayFBOs(instance, width, height, bufferLength) {

    const needsRebuild =
        !instance.delayFBOs ||
        instance.delayWidth !== width ||
        instance.delayHeight !== height ||
        instance.delayBufferLength !== bufferLength;

    if (!needsRebuild) return;

    cleanupDelayFBOs(instance);

    instance.delayFBOs = [];
    instance.delayWidth = width;
    instance.delayHeight = height;
    instance.delayBufferLength = bufferLength;
    instance.writeIndex = 0;
    instance.framesSeen = 0;

    for (let i = 0; i < bufferLength; i++) {
        const fboId = `${instance.id}-temporal-delay-${i}`;


        const fbo = instance.glState.renderer.make_framebuffer(
            width, height, "delay-buffer", `${instance.id}-delay-buffer-${i}`
        );

        instance.delayFBOs.push({
            id: fboId,
            fbo
        });
    }
}

function cleanupDelayFBOs(instance) {
    if (!instance.delayFBOs || !instance.glState?.renderer) return;

    const renderer = instance.glState.renderer;

    for (const entry of instance.delayFBOs) {
        renderer.deleteFramebufferTarget(entry.fbo.fbo);
    }

    instance.delayFBOs = null;
}

function positiveModulo(n, m) {
    return ((n % m) + m) % m;
}

function getDelayTextureForAge(instance, inputTex, writeSlot, ringLength, ageFrames) {
    if (ageFrames < 0) return null;
    if (ageFrames === 0) return inputTex;
    if (instance.framesSeen < ageFrames) return null;

    const slot = positiveModulo(writeSlot - ageFrames, ringLength);
    return instance.delayFBOs[slot].fbo.texture;
}

function buildDelayKernelUniforms(instance, inputTex, writeSlot, ringLength, delay, radius, sigma) {
    const textures = [];
    const weights = [];
    const safeSigma = Math.max(0.001, sigma);

    for (let offset = -radius; offset <= radius; offset++) {
        const ageFrames = delay + offset;
        const texture = getDelayTextureForAge(
            instance,
            inputTex,
            writeSlot,
            ringLength,
            ageFrames
        );

        if (!texture) continue;

        const weight = radius === 0
            ? 1
            : Math.exp(-0.5 * Math.pow(offset / safeSigma, 2));

        textures.push(texture);
        weights.push(weight);
    }

    if (textures.length === 0) {
        textures.push(inputTex);
        weights.push(1);
    }

    const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    const uniforms = {};

    for (let i = 0; i < MAX_DELAY_KERNEL_TAPS; i++) {
        uniforms[`u_delayTex${i}`] = {
            value: textures[i] || inputTex,
            type: "texture2D"
        };
        uniforms[`u_delayWeight${i}`] = {
            value: i < weights.length ? weights[i] / weightSum : 0,
            type: "float"
        };
    }

    return uniforms;
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */

/** @type {EffectModule} */
export default {
    name: "Temporal Delay Line",

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);

        const {
            BLENDMODE,
            COLORSPACE,
            BLEND_CHANNEL_MODE,
            blendAmount,
            delayFrames,
            delayKernelRadius,
            delayKernelSigma,
            feedback,
        } = resolveAnimAll(instance.config, t);

        const delay = Math.max(0, Math.floor(delayFrames));
        const rawKernelRadius = Number.isFinite(delayKernelRadius)
            ? delayKernelRadius
            : 0;
        const rawKernelSigma = Number.isFinite(delayKernelSigma)
            ? delayKernelSigma
            : 1;
        const kernelRadius = clamp(
            Math.floor(rawKernelRadius),
            0,
            MAX_DELAY_KERNEL_RADIUS
        );
        const kernelSigma = Math.max(0.001, rawKernelSigma);
        const ringLength = Math.max(1, delay + kernelRadius + 1);

        ensureDelayFBOs(instance, width, height, ringLength);

        const writeSlot = instance.writeIndex;
        const writeFBO = instance.delayFBOs[writeSlot].fbo;
        const delayKernelUniforms = buildDelayKernelUniforms(
            instance,
            inputTex,
            writeSlot,
            ringLength,
            delay,
            kernelRadius,
            kernelSigma
        );
        /**
         * 1. Render visible output using current frame + delayed frame.
         */
        const outputUniforms = {
            u_resolution: { value: [width, height], type: "vec2" },
            ...delayKernelUniforms,
            u_blendamount: { value: blendAmount, type: "float" },
            u_feedback: { value: feedback, type: "float" },
            u_writeMode: { value: 0, type: "int" }
        };

        const defines = {
            BLENDMODE,
            COLORSPACE,
            BLEND_CHANNEL_MODE
        };

        instance.glState.renderGL(inputTex, outputFBO, outputUniforms, defines);

        /**
         * 2. Write this frame into the ring buffer.
         *
         * Important: this happens AFTER reading the delayed slot.
         * Otherwise delayFrames = 1 collapses into "current frame",
         * which is the classic off-by-one temporal bug.
         */
        const writeUniforms = {
            u_resolution: { value: [width, height], type: "vec2" },
            ...delayKernelUniforms,
            u_blendamount: { value: 0, type: "float" },
            u_feedback: { value: feedback, type: "float" },
            u_writeMode: { value: 1, type: "int" }
        };

        instance.glState.renderGL(inputTex, writeFBO, writeUniforms, defines);

        instance.writeIndex = positiveModulo(instance.writeIndex + 1, ringLength);
        instance.framesSeen += 1;
    },

    initHook: async (instance, renderer) => {
        await fragSources.load();

        instance.delayFBOs = null;
        instance.delayWidth = null;
        instance.delayHeight = null;
        instance.delayBufferLength = null;
        instance.writeIndex = 0;
        instance.framesSeen = 0;
    },

    cleanupHook(instance) {
        cleanupDelayFBOs(instance);
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },

    glState: null,
    isGPU: true,
    pass: null,

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        delayFrames: 1,
        delayKernelRadius: 0,
        delayKernelSigma: 1,
        feedback: 0.5
    },

    uiLayout: [
        {
            key: "delayFrames",
            label: "Delay Frames",
            type: "range",
            min: 0,
            max: 64,
            step: 1
        },
        {
            key: "delayKernelRadius",
            label: "Delay Spread",
            type: "range",
            min: 0,
            max: MAX_DELAY_KERNEL_RADIUS,
            step: 1
        },
        {
            key: "delayKernelSigma",
            label: "Spread Softness",
            type: "modSlider",
            min: 0.1,
            max: 4,
            steps: 100
        },
        {
            key: "feedback",
            label: "Feedback",
            type: "modSlider",
            min: 0,
            max: 1,
            steps: 100
        },
        blendControls()
    ]
};

export const effectMeta = {
    group: "Temporal",
    tags: ["delay", "feedback", "frame", "fbo", "ring-buffer", "kernel", "smear"],
    description: "Frame-based temporal delay using a ring buffer of FBOs, with optional kernel-weighted neighboring delay samples.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        delayFrames: { min: 1, max: 32 },
        delayKernelRadius: { min: 0, max: MAX_DELAY_KERNEL_RADIUS },
        delayKernelSigma: { min: 0.35, max: 2.5 },
        feedback: { min: 0.1, max: 0.85 }
    },
    notInRandom: false
};