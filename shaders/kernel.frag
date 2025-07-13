#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_kernel[49]; // max 7x7
uniform int u_kernelWidth;
uniform int u_kernelHeight;
uniform float u_kernelWeight;

out vec4 outColor;

#import "colorconvert.glsl"

vec3 sampleLinear(vec2 coord) {
    vec3 srgb = texture(u_image, coord).rgb;
    return srgb2linear(srgb);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;

    int kw = u_kernelWidth;
    int kh = u_kernelHeight;
    int kx = kw / 2;
    int ky = kh / 2;

    vec3 acc = vec3(0.0);
    int idx = 0;

    for (int j = 0; j < 7; ++j) {
        if (j >= kh) break;
        for (int i = 0; i < 7; ++i) {
            if (i >= kw) break;
            vec2 offset = vec2(float(i - kx), float(j - ky)) * texel;
            vec2 sampleUV = uv + offset;
            acc += sampleLinear(sampleUV) * u_kernel[idx];
            idx += 1;
        }
    }
    vec3 lin = acc / u_kernelWeight;
    outColor = vec4(linear2srgb(lin), 1.0);
}
