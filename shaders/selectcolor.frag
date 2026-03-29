#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_hueCenter;
uniform float u_hueWidth;
uniform float u_knee;
uniform float u_blendAmount;

out vec4 outColor;

#ifndef FLIP
#define FLIP 0
#endif

#include "colorconvert.glsl"
#include "blend.glsl"

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 inColor = texture(u_image, uv).rgb;
    vec3 lch = srgb2NormLCH(inColor);
    float d = abs(mod(lch.z - u_hueCenter + 0.5, 1.0) - 0.5);
    float t = smoothstep(u_hueWidth - u_knee, u_hueWidth, d);
#if FLIP == 0
    lch.y *= (1.0 - t);
#else
    lch.y *= t;
#endif
    outColor = vec4(blendWithColorSpace(inColor, normLCH2SRGB(lch), u_blendAmount), 1.0);
}