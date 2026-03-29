#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_rotation;

out vec4 outColor;

#include "colorconvert.glsl"

vec3 rotate(vec3 srgb) {
    vec3 lch = srgb2NormLCH(srgb);
    lch.z += u_rotation;
    return normLCH2SRGB(lch);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);
    vec3 rotated = rotate(pix.rgb);
    outColor = vec4(clamp(rotated, 0., 1.), pix.a);
}
