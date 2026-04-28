#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_warpStrength;
uniform float u_magnitudeGamma;
uniform float u_magnitudePolarity;
uniform float u_threshLow;
uniform float u_threshHigh;
uniform float u_directionStrength;
uniform float u_directionPolarity;
uniform float u_chromaDragAmount;

out vec4 outColor;

#include "colorconvert.glsl"


float getMagnitudeChannelValue(vec3 color, float luma, vec3 lch) {
#if MAGNITUDE_CHANNEL == 0
    return luma;
#elif MAGNITUDE_CHANNEL == 1
    return color.r;
#elif MAGNITUDE_CHANNEL == 2
    return color.g;
#elif MAGNITUDE_CHANNEL == 3
    return color.b;
#elif MAGNITUDE_CHANNEL == 4
    return lch.z;
#elif MAGNITUDE_CHANNEL == 5
    return lch.y;
#elif MAGNITUDE_CHANNEL == 6
    return 0.1;
#else
    #error invalid magnitude channel
#endif
}

const float ARBITRARY_THETA = 2.0 * 3.14159265 / 20.0;

float getDirectionChannelValue(vec3 color, float luma, vec3 lch) {
#if DIRECTION_CHANNEL == 0
    return luma;
#elif DIRECTION_CHANNEL == 1
    return color.r;
#elif DIRECTION_CHANNEL == 2
    return color.g;
#elif DIRECTION_CHANNEL == 3
    return color.b;
#elif DIRECTION_CHANNEL == 4
    return lch.z;
#elif DIRECTION_CHANNEL == 5
    return lch.y;
#elif DIRECTION_CHANNEL == 6
    return ARBITRARY_THETA;
#else
    #error invalid direction channel
#endif
}

float softBandpass(float x, float a, float b, float fuzz) {
    float low = smoothstep(a - fuzz, a + fuzz, x);
    float high = 1.0 - smoothstep(b - fuzz, b + fuzz, x);
    return x * low * high;
}


vec2 computeOffset(vec2 uv) {
    vec3 c = texture(u_image, uv).rgb;
    float luma = 0.0;
    vec3 lch = vec3(0.0);
#if MAGNITUDE_CHANNEL == 0 || DIRECTION_CHANNEL == 0
    luma = luminance(srgb2linear(c));
#endif
#if MAGNITUDE_CHANNEL == 4 || DIRECTION_CHANNEL == 4 || MAGNITUDE_CHANNEL == 5 || DIRECTION_CHANNEL == 5 || USE_CHROMA_DRAG == 1
    lch = srgb2NormLCH(c);
#endif
    float m = getMagnitudeChannelValue(c, luma, lch);
#if USE_CHROMA_DRAG == 1
    m = mix(m, m * lch.y, u_chromaDragAmount);
#endif
    m = m + u_magnitudePolarity * (1. - 2. * m);
    const float CUTOFF_SMOOTHNESS = 0.01;
#if MAGNITUDE_CHANNEL != 6
    m = softBandpass(m, u_threshLow, u_threshHigh, CUTOFF_SMOOTHNESS);
#endif
    m = pow(m, u_magnitudeGamma) * u_warpStrength;
    float d = getDirectionChannelValue(c, luma, lch);
    d = d + u_directionPolarity * (1. - 2. * d);
    float a = d * u_directionStrength;
    return m * vec2(cos(a), sin(a));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    outColor = vec4(computeOffset(uv), 0.0, 0.0);
}