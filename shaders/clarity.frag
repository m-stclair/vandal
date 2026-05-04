#version 300 es
precision mediump float;

#ifndef KERNEL_WIDTH
    #error undefined KERNEL_WIDTH
#endif

#ifndef KERNEL_HEIGHT
    #error undefined KERNEL_HEIGHT
#endif

const int KERNEL_SIZE = KERNEL_WIDTH * KERNEL_HEIGHT;

// this is the output of the sharpening pass in 0-1 normalized Lab or Jz units
uniform sampler2D u_sharpPass;
// this is the original input image in sRGB
uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_kernel[KERNEL_SIZE];
uniform float u_intensity;
uniform float u_preserveTones;

out vec4 outColor;

#include "colorconvert.glsl"

#if (!((COLORSPACE == COLORSPACE_JZAZBZ) || (COLORSPACE == COLORSPACE_LAB)))
    #error colorspace must be JzAzBz or Lab
#endif

float softLightBlend(float base, float fx) {
    float blended = mix(
        2.0 * base * fx + base * base * (1.0 - 2.0 * fx),
        sqrt(base) * (2.0 * fx - 1.0) + 2.0 * base * (1.0 - fx),
        step(0.5, fx)
    );
    return clamp(blended, 0., 1.);
}

float tonePreserveMask(float luma, float preserve) {
    float shadowGate = smoothstep(0.08, 0.35, luma);
    float highlightGate = 1.0 - smoothstep(0.6, 0.88, luma);
    float midtoneMask = shadowGate * highlightGate;
    return mix(1.0, midtoneMask, preserve);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;

    float accumL = 0.0;
    int k = 0;

    int halfWidth = KERNEL_WIDTH / 2;
    int halfHeight = KERNEL_HEIGHT / 2;

    for (int y = 0; y < KERNEL_HEIGHT; y++) {
        for (int x = 0; x < KERNEL_WIDTH; x++) {
            vec2 offset = vec2(float(x - halfWidth), float(y - halfHeight)) * texel;
            float samp = texture(u_sharpPass, uv + offset).x;
            accumL += samp * u_kernel[k];
            k++;
        }
    }

    vec4 sharpBase = texture(u_sharpPass, uv);

    float lumaBlur = softLightBlend(sharpBase.x, accumL);
    vec3 fx = encodeColor(vec3(lumaBlur, sharpBase.y, sharpBase.z));
    vec4 original = texture(u_image, uv);
    float originalLuma = extractColor(original.rgb).x;
    float preserveMask = tonePreserveMask(originalLuma, u_preserveTones);

    outColor = vec4(mix(original.rgb, fx, u_intensity * preserveMask), original.a);
}
