#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_gamma;

out vec4 outColor;

#include "colorconvert.glsl"

vec3 gamma(vec3 srgb) {
    vec3 lab = srgb2NormLab(srgb);
    lab.x = pow(lab.x, 1.0 / u_gamma);
    return normLab2SRGB(lab);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);
    vec3 gammafied = gamma(pix.rgb);
    outColor = vec4(clamp(gammafied, 0., 1.), pix.a);
}
