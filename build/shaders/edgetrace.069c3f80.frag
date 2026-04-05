#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_threshold;
uniform float u_blendamount;
uniform vec3 u_tint;
uniform float u_baseOpacity;
uniform sampler2D u_sobel;
uniform float u_softness;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

float luminanceAt(vec2 offset) {
    return luminance(srgb2linear(texture(u_image, offset).rgb));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    // sobel magnitude, x component, y component
    float edgeStrength = texture(u_sobel, uv).x;
    float edgeMask = smoothstep(u_threshold - u_softness, u_threshold + u_softness, edgeStrength);
    vec3 original = texture(u_image, uv).rgb;
    vec3 bleed = original * u_baseOpacity;
    vec3 result = mix(bleed, u_tint, edgeMask);

    vec3 blended = blendWithColorSpace(original, result, u_blendamount);
    outColor = vec4(blended, 1);
}