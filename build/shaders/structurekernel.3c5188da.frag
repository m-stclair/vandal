#version 300 es
precision mediump float;

#ifndef KERNEL_SIZE
#define KERNEL_SIZE 9
#endif

uniform sampler2D u_image;
uniform sampler2D u_calcPass;
uniform vec2 u_resolution;

uniform float u_kernel[KERNEL_SIZE];
uniform int u_kernelWidth;
uniform int u_kernelHeight;
uniform float u_blendamount;
uniform float u_intensity;
uniform float u_temperature;
uniform float u_stretchAmount;
uniform vec2 u_texelSize;

out vec4 outColor;

#define MODE_PULLBACK 0
#define MODE_APPLY 1

#ifndef STRUCTURE_MODE
#define STRUCTURE_MODE 0
#endif

#include "colorconvert.glsl"
#include "blend.glsl"

const float PI_HALF = 1.57079632679;

vec2 stretchKernelOffset(
    vec2 local,
    float angle,
    float gradMag,
    float stretchAmount
) {
    // angle axis
    vec2 axis = vec2(cos(angle), sin(angle));
    vec2 ortho = vec2(-axis.y, axis.x);

    float stretchMask = clamp(tanh(max(gradMag, 0.0)), 0.0, 1.0);

    // > 1.0 stretches, < 1.0 compresses, never let it flip sign
    float stretchScale = max(0.001, 1.0 + stretchAmount * stretchMask);

    // decompose into rotated kernel basis
    float along  = dot(local, axis);
    float across = dot(local, ortho);

    // stretch only along the chosen axis
    vec2 stretchedLocal = axis * (along * stretchScale) + ortho * across;

    // fade back toward the original kernel shape in low-gradient regions
    // to avoid gross noisy behavior
    return mix(local, stretchedLocal, stretchMask);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 isophote = texture(u_calcPass, uv);
    float curveMag = isophote.x;
    float gradMag = isophote.y;
    float gradAngle = isophote.z;
    vec3 accum = vec3(0.0);
    int k = 0;
    int halfWidth = u_kernelWidth / 2;
    int halfHeight = u_kernelHeight / 2;
    for (int y = 0; y < KERNEL_SIZE; y++) {
        if (y >= u_kernelHeight) break;
        for (int x = 0; x < KERNEL_SIZE; x++) {
            if (x >= u_kernelWidth) break;
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
    float mag = abs(u_intensity);
    float strength = tanh(mag);
    float highMask = tanh(curveMag * u_temperature);
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
