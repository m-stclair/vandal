#version 300 es
precision mediump float;

// stripped-down version of kernel2d.glsl, not intended
// as standalone effect

#ifndef KERNEL_WIDTH
    #error undefined kernel width
#endif

#ifndef KERNEL_HEIGHT
    #error undefined kernel height
#endif

const int KERNEL_SIZE = KERNEL_WIDTH * KERNEL_HEIGHT;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_kernel[KERNEL_SIZE];

out vec4 outColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;

    vec4 accum = vec4(0.0);
    int k = 0;

    const int halfHeight = KERNEL_HEIGHT / 2;
    const int halfWidth = KERNEL_WIDTH / 2;

    for (int y = 0; y < KERNEL_HEIGHT; y++) {
        for (int x = 0; x < KERNEL_WIDTH; x++) {
            vec2 offset = vec2(float(x - halfWidth), float(y - halfHeight)) * texel;
            vec4 samp = texture(u_image, uv + offset);
            accum += samp * u_kernel[k];
            k++;
        }
    }
    outColor = accum;
}
