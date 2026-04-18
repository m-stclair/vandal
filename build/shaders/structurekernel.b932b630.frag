#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform sampler2D u_calcPass;
uniform vec2 u_resolution;

#ifndef KERNEL_WIDTH
    #error
#endif

#ifndef KERNEL_HEIGHT
    #error
#endif

#define CALCULATE_MODE_ISOPHOTE 1
#define CALCULATE_MODE_SOBEL 4

#ifndef CALCULATE_MODE
    #define CALCULATE_MODE CALCULATE_MODE_SOBEL
#endif

#if CALCULATE_MODE == CALCULATE_MODE_ISOPHOTE
#elif CALCULATE_MODE == CALCULATE_MODE_SOBEL
#else
    #error
#endif

const int KERNEL_SIZE = KERNEL_WIDTH * KERNEL_HEIGHT;

uniform float u_kernel[KERNEL_SIZE];
uniform float u_blendamount;
uniform float u_intensity;
uniform float u_temperature;
uniform float u_stretchAmount;
uniform vec2 u_texelSize;

out vec4 outColor;

#define MODE_PULLBACK 0
#define MODE_APPLY 1

#ifndef STRUCTURE_MODE
#define STRUCTURE_MODE MODE_PULLBACK
#endif

#include "colorconvert.glsl"
#include "blend.glsl"

vec2 stretchKernelOffset(
    vec2 local,
    float angle,
    float gradMag,
    float stretchAmount
) {
    // angle axis
    vec2 axis = vec2(-sin(angle), cos(angle));
    vec2 ortho = vec2(-axis.y, axis.x);

    float stretchMask = clamp(tanh(max(gradMag, 0.0)), 0.0, 1.0);

    float stretchScale = max(0.001, 1.0 + stretchAmount * stretchMask);

    // decompose into rotated kernel basis
    float along  = dot(local, axis);
    float across = dot(local, ortho);

    vec2 stretchedLocal = axis * (along * stretchScale) + ortho * across;

    // fade back toward the original kernel shape in low-gradient regions
    // to avoid gross noisy behavior
    return mix(local, stretchedLocal, stretchMask);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
#if CALCULATE_MODE == CALCULATE_MODE_SOBEL
    vec3 mag_lx_ly = texture(u_calcPass, uv).xyz;
    vec2 lxy = mag_lx_ly.yz;
    float mag = mag_lx_ly.x;
    float gradMag = length(lxy);
    float gradAngle = atan(mag_lx_ly.z, mag_lx_ly.y);
#elif CALCULATE_MODE == CALCULATE_MODE_ISOPHOTE
    vec4 isophote = texture(u_calcPass, uv);
    float mag = isophote.x;
    float gradMag = isophote.y;
    float gradAngle = isophote.z;
#else
    #error
#endif
    vec3 accum = vec3(0.0);
    int k = 0;
    const int halfWidth = KERNEL_WIDTH / 2;
    const int halfHeight = KERNEL_HEIGHT / 2;
    for (int y = 0; y < KERNEL_HEIGHT; y++) {
        for (int x = 0; x < KERNEL_WIDTH; x++) {
            vec2 local = vec2(float(x - halfWidth), float(y - halfHeight));
            vec2 warpedLocal = stretchKernelOffset(
                local,
                gradAngle,
                gradMag,
                u_stretchAmount
            );
            vec2 offset = warpedLocal * u_texelSize;
            vec3 samp = texture(u_image, uv + offset).rgb;            // Do something in kernel space to calculate an offset stretched
            accum += samp * u_kernel[k];
            k++;
        }
    }
    vec3 base = texture(u_image, uv).rgb;
    float strength = tanh(abs(u_intensity));
    float highMask = tanh(mag * u_temperature);
    float lowMask  = 1.0 - highMask;
    float dir = 0.5 + 0.5 * tanh(u_intensity * u_temperature);
    float regionMask = mix(lowMask, highMask, dir);
    float effectLevel = strength * regionMask;
#if STRUCTURE_MODE == MODE_PULLBACK
    accum = mix(accum, base, effectLevel);
#elif STRUCTURE_MODE == MODE_APPLY
    accum = mix(base, accum, effectLevel);
#else
    #error
#endif
    outColor = vec4(blendWithColorSpace(base, accum, u_blendamount), 1.0);
}
