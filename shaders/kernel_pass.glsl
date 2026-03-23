#version 300 es
precision mediump float;

// stripped-down version of kernel2d.glsl, not intended
// as standalone effect

#ifndef KERNEL_SIZE
#define KERNEL_SIZE 9
#endif

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_kernel[KERNEL_SIZE];
uniform int u_kernelWidth;
uniform int u_kernelHeight;

out vec4 outColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;

    vec4 accum = vec4(0.0);
    int k = 0;

    int halfWidth = u_kernelWidth / 2;
    int halfHeight = u_kernelHeight / 2;

    for (int y = 0; y < KERNEL_SIZE; y++) {
        if (y >= u_kernelHeight) break;
        for (int x = 0; x < KERNEL_SIZE; x++) {
            if (x >= u_kernelWidth) break;
            vec2 offset = vec2(float(x - halfWidth), float(y - halfHeight)) * texel;
            vec4 samp = texture(u_image, uv + offset);
            accum += samp * u_kernel[k];
            k++;
        }
    }
    outColor = accum;
}
