#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform int u_magnitudeChannel;
uniform float u_warpStrength;
uniform float u_magnitudeGamma;
uniform float u_magnitudePolarity;
uniform float u_threshLow;
uniform float u_threshHigh;
uniform int u_directionChannel;
uniform float u_directionStrength;
uniform float u_directionPolarity;

out vec4 outColor;

#include "colorconvert.glsl"

float getChannelValue(vec3 color, int selector, vec3 lch) {
    if (selector == 0) return luminance(srgb2linear(color));
    if (selector == 1) return color.r;
    if (selector == 2) return color.g;
    if (selector == 3) return color.b;
    if (selector == 4) return lch.z;
    if (selector == 5) return lch.y;
    return 0.0;
}

float softBandpass(float x, float a, float b, float fuzz) {
    float low = smoothstep(a - fuzz, a + fuzz, x);
    float high = 1.0 - smoothstep(b - fuzz, b + fuzz, x);
    return x * low * high;
}


vec2 computeOffset(vec2 uv) {
    vec3 c = texture(u_image, uv).rgb;
    bool magNeedsLCH = (u_magnitudeChannel == 4 || u_magnitudeChannel == 5);
    bool dirNeedsLCH = (u_directionChannel == 4 || u_directionChannel == 5);
    vec3 lch = vec3(0.0);
    if (magNeedsLCH || dirNeedsLCH) {
        lch = srgb2NormLCH(c);
    }
    float m = getChannelValue(c, u_magnitudeChannel, lch);
    m = m + u_magnitudePolarity * (1. - 2. * m);
    const float CUTOFF_SMOOTHNESS = 0.01;
    m = softBandpass(m, u_threshLow, u_threshHigh, CUTOFF_SMOOTHNESS);
    m = pow(m, u_magnitudeGamma) * u_warpStrength;
    float d = getChannelValue(c, u_directionChannel, lch);
    d = d + u_directionPolarity * (1. - 2. * d);
    float a = d * u_directionStrength;
    return m * vec2(cos(a), sin(a));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    outColor = vec4(computeOffset(uv), 0.0, 0.0);
}