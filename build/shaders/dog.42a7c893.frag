#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform sampler2D u_kernelPass1;
uniform sampler2D u_kernelPass2;
uniform float u_blendAmount;
uniform float u_temperature;
uniform float u_weight;

out vec4 outColor;


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 pix1 = texture(u_kernelPass1, uv).rgb;
    vec3 pix2 = texture(u_kernelPass2, uv).rgb;
    vec3 dog = tanh(u_temperature * abs(pix1 - u_weight * pix2));
    vec3 color = texture(u_image, uv).rgb;
    outColor = vec4(blendWithColorSpace(color, dog, u_blendAmount), 1.0);
}
