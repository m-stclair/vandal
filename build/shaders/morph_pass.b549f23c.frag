#version 300 es

precision mediump float;

uniform sampler2D u_input;
uniform vec2 u_resolution;
uniform int u_radius;

out vec4 outColor;

#define OPERATOR_EROSION 0
#define OPERATOR_DILATION 1

#define CHANNEL_MODE_RED   0
#define CHANNEL_MODE_LUMA  1
#define CHANNEL_MODE_TENSOR4  2

#ifndef CHANNEL_MODE
#define CHANNEL_MODE CHANNEL_MODE_LUMA
#endif

#if CHANNEL_MODE == CHANNEL_MODE_LUMA
#include "colorconvert.glsl"
#endif

vec4 getValue(vec2 uv) {
    vec4 c = texture(u_input, uv);

#if CHANNEL_MODE == CHANNEL_MODE_LUMA
    float y = luminance(srgb2linear(c.rgb));
    return vec4(y, y, y, 1.0);
#elif CHANNEL_MODE == CHANNEL_MODE_RED
    return vec4(c.r, c.r, c.r, 1.0);
#elif CHANNEL_MODE == CHANNEL_MODE_TENSOR4
    return c;
#else
#error Unsupported channel mode
#endif
}

void main() {
    vec2 texelSize = 1.0 / u_resolution;
    vec2 uv = gl_FragCoord.xy / u_resolution;

#if OPERATOR == OPERATOR_EROSION
    vec4 result = vec4(1.0);
#elif OPERATOR == OPERATOR_DILATION
    vec4 result = vec4(0.0);
#else
#error Unsupported operator
#endif

    for (int y = -u_radius; y <= u_radius; y++) {
        for (int x = -u_radius; x <= u_radius; x++) {
            float dist = length(vec2(float(x), float(y)));
            if (dist > float(u_radius) + 0.5) continue;
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            vec4 val = getValue(uv + offset);
#if OPERATOR == OPERATOR_EROSION
            result = min(result, val);
#elif OPERATOR == OPERATOR_DILATION
            result = max(result, val);
#endif
        }
    }
    outColor = result;
}