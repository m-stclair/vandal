#version 300 es

precision mediump float;

#ifndef KERNEL_WIDTH
    #error
#endif

#ifndef KERNEL_HEIGHT
    #error
#endif

const int KERNEL_SIZE = KERNEL_WIDTH * KERNEL_HEIGHT;

uniform vec2 u_texelSize;
uniform float u_blendamount;
uniform float u_kernel[KERNEL_SIZE];
uniform sampler2D u_image;
uniform sampler2D u_offsets;
uniform vec2 u_resolution;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

vec2 blurOffset(vec2 uv) {
    vec2 accum = vec2(0.0);
    int k = 0;
    const int halfWidth = KERNEL_WIDTH / 2;
    const int halfHeight = KERNEL_HEIGHT / 2;

    for (int y = 0; y < KERNEL_HEIGHT; y++) {
        for (int x = 0; x < KERNEL_WIDTH; x++) {
            vec2 kernelOffset = vec2(float(x - halfWidth), float(y - halfHeight)) * u_texelSize;
            vec2 offset = texture(u_offsets, uv + kernelOffset).xy;
            accum += offset * u_kernel[k];
            k++;
        }
    }
    return accum;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 uvOff = fract(uv + blurOffset(uv));
    vec3 warpColor = texture(u_image, uvOff).rgb;
    vec3 color = texture(u_image, uv).rgb;
    outColor = vec4(
        blendWithColorSpace(color, warpColor, u_blendamount), 1.0
    );
}
