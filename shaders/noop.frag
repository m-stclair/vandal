#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_blendAmount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 pix = texture(u_image, uv).rgb;
    outColor = vec4(blendWithColorSpace(pix, pix, u_blendAmount), 1.0);
}
