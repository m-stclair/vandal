#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_strength;
uniform float u_radius;
uniform float u_softness;
uniform float u_roundness;
uniform float u_blendAmount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);

    vec2 centered = uv * 2.0 - 1.0;
    float aspect = u_resolution.x / u_resolution.y;

    vec2 scale = mix(vec2(aspect, 1.0), vec2(1.0), u_roundness);
    float dist = length(centered * scale);

    float vignette = 1.0 - smoothstep(u_radius, u_radius + u_softness, dist);
    vec3 result = pix.rgb * mix(1.0, vignette, u_strength);

    outColor = vec4(blendWithColorSpace(pix.rgb, result, u_blendAmount), pix.a);
}