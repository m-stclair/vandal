#version 300 es
precision mediump float;

#include "kernel_utils.glsl"
#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;

uniform float u_bloomThreshold;
uniform float u_bloomSoftness;
uniform float u_bloomStrength;
uniform vec3 u_chromaOffset;
uniform float u_blendamount;

out vec4 outColor;

#define BLOOM_LUMA 0
#define BLOOM_SATURATION 1

#ifndef BLOOM_MODE
#define BLOOM_MODE 0
#endif

#ifndef BLOOM_CHROMA_TAIL
#define BLOOM_CHROMA_TAIL 0
#endif

#ifndef KERNEL_SIZE
    #error kernel size undefined
#endif


float computeGlowMask(vec3 lch) {
    float maskVal;
#if BLOOM_MODE == BLOOM_LUMA
    maskVal = lch.x;
#elif BLOOM_MODE == BLOOM_SATURATION
    maskVal = lch.y;
#endif
    return smoothstep(u_bloomThreshold, u_bloomThreshold + u_bloomSoftness, maskVal);
}

vec3 glowMaskedColor(vec2 uv) {
    vec3 srgb = texture(u_image, uv).rgb;
    float glowMask = computeGlowMask(srgb2NormLCH(srgb));
    return srgb * glowMask;
}

vec3 applyChromaticGlowBlur(vec2 uv, vec2 direction) {
        int halfSize = KERNEL_SIZE / 2;
        vec3 result = vec3(0.0);
        vec2 texelSize = direction / u_resolution;

    for (int i = 0; i < KERNEL_SIZE; ++i) {
        int offset = i - halfSize;
        vec2 sampleR = uv + float(offset) * texelSize * u_chromaOffset.r;
        vec2 sampleG = uv + float(offset) * texelSize * u_chromaOffset.g;
        vec2 sampleB = uv + float(offset) * texelSize * u_chromaOffset.b;

        float k = u_kernel[i];
        result.r += glowMaskedColor(sampleR).r * k;
        result.g += glowMaskedColor(sampleG).g * k;
        result.b += glowMaskedColor(sampleB).b * k;
    }
    return result;
}

vec3 applyGlowBlur(vec2 uv, vec2 direction) {
    vec3 result = vec3(0.0);
    vec2 texelSize = direction / u_resolution;

    int halfSize = KERNEL_SIZE / 2;
    for (int i = 0; i < KERNEL_SIZE; ++i) {
        int offset = i - halfSize;
        vec2 sampleUV = uv + float(offset) * texelSize;
        result += glowMaskedColor(sampleUV) * u_kernel[i];
    }
    return result;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
#if BLOOM_CHROMA_TAIL == 0
    vec3 blurH = applyGlowBlur(uv, vec2(1.0, 0.0));
    vec3 blurV = applyGlowBlur(uv, vec2(0.0, 1.0));
#else
    vec3 blurH = applyChromaticGlowBlur(uv, vec2(1.0, 0.0));
    vec3 blurV = applyChromaticGlowBlur(uv, vec2(0.0, 1.0));
#endif
    vec3 blurredGlow = 0.5 * (blurH + blurV);

    vec3 base = texture(u_image, uv).rgb;
    vec3 finalColor = clamp(base + u_bloomStrength * blurredGlow, 0.0, 1.0);
    outColor = vec4(blendWithColorSpace(base, finalColor, u_blendamount), 1.0);
}

