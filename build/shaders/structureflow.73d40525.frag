#version 300 es

precision mediump float;

#define PI     3.14159265358979

uniform sampler2D u_image;
uniform sampler2D u_calcPass;
uniform vec2 u_resolution;
uniform float u_magnitude;
uniform float u_anisoDrag;
uniform float u_angle;
uniform float u_blendAmount;
uniform vec2 u_texelSize;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#define CALCULATE_MODE_ISOPHOTE 1
#define CALCULATE_MODE_STRUCTURE_TENSOR 2
#define CALCULATE_MODE_FLOWLINE 3

#ifndef CALCULATE_MODE
#define CALCULATE MODE 2
#endif

vec4 structureTensorFlow(vec2 uv) {
    vec2 structureTensor = texture(u_calcPass, uv).rg;
    // structure tensor angle comes in normed to [0, 1]
    float angleRadians = structureTensor.r * PI - PI * 0.5;
    float angleRot = angleRadians + u_angle;
    vec2 flow = vec2(cos(angleRot), sin(angleRot));
    float anisotropy = structureTensor.g;
    // by intent, u_anisoDrag can be > 1 for artistic reasons
    float push = clamp(anisotropy * u_anisoDrag + 1.0 - u_anisoDrag, 0.0, 1.0);
    return texture(u_image, uv + flow * push * u_magnitude * u_texelSize);
}

// these two cases are packed the same way
vec4 isophoteOrFlowlineFlow(vec2 uv) {
    // curvature, length(dx, dy), atan(dy, dx), 0
    vec4 isophote = texture(u_calcPass, uv);
    float angleRot = isophote.z + u_angle;
    vec2 flow = vec2(cos(angleRot), sin(angleRot));
    return texture(u_image, uv + flow * tanh(isophote.r) * u_magnitude * u_texelSize);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 color = texture(u_image, uv);
#if CALCULATE_MODE == CALCULATE_MODE_STRUCTURE_TENSOR
    vec4 colorShifted = structureTensorFlow(uv);
#elif CALCULATE_MODE == CALCULATE_MODE_ISOPHOTE
    vec4 colorShifted = isophoteOrFlowlineFlow(uv);
#elif CALCULATE_MODE_FLOWLINE == CALCULATE_MODE_FLOWLINE
    vec4 colorShifted = isophoteOrFlowlineFlow(uv);
#else
    #error
#endif
    outColor = vec4(blendWithColorSpace(color.rgb, colorShifted.rgb, u_blendAmount), 1.0);
}
