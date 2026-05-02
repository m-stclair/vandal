#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

out vec4 outColor;

#include "colorconvert.glsl"

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);
    outColor = vec4(extractColor(pix.rgb), pix.a);
}
