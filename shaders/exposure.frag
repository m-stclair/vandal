#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_exposure;

out vec4 outColor;

#include "colorconvert.glsl"

vec3 exposure(vec3 srgb) {
    vec3 lch = srgb2NormLCH(srgb);
    lch.x *= exp2(u_exposure);
    return normLCH2SRGB(lch);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);
    vec3 exposed = exposure(pix.rgb);
    outColor = vec4(clamp(exposed, 0., 1.), pix.a);
}
