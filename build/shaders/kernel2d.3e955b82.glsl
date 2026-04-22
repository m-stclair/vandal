#version 300 es
precision mediump float;

#ifndef KERNEL_WIDTH
    #error
#endif

#ifndef KERNEL_HEIGHT
    #error
#endif

const int KERNEL_SIZE = KERNEL_WIDTH * KERNEL_HEIGHT;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_kernel[KERNEL_SIZE];
uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;

    vec3 accum = vec3(0.0);
    int k = 0;

    int halfWidth = KERNEL_WIDTH / 2;
    int halfHeight = KERNEL_HEIGHT / 2;

    for (int y = 0; y < KERNEL_HEIGHT; y++) {
        for (int x = 0; x < KERNEL_WIDTH; x++) {
            vec2 offset = vec2(float(x - halfWidth), float(y - halfHeight)) * texel;
            vec3 samp = texture(u_image, uv + offset).rgb;
            accum += samp * u_kernel[k];
            k++;
        }
    }
    vec3 base = texture(u_image, uv).rgb;
    outColor = vec4(blendWithColorSpace(base, accum, u_blendamount), 1.0);
}
