#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_texelSize;
uniform vec2 u_resolution;

out vec4 outColor;

#define PI     3.14159265358979

#define CALCULATE_MODE_ISOPHOTE 1
#define CALCULATE_MODE_STRUCTURE_TENSOR 2
#define CALCULATE_MODE_FLOWLINE 3
#define CALCULATE_MODE_SOBEL 4

#ifndef CALCULATE_MODE
#define CALCULATE_MODE 2
#endif

#include "colorconvert.glsl"
#include "differences.glsl"

vec4 structureTensor(sampler2D tex, vec2 uv, vec2 texel) {
    // NOTE: this is just the first pass.
    //  eigendecomposition is performed in a subsequent pass
    //  (optionally after a blur step). the JS handler orchestrates this.

    vec3 mag_lx_ly = sobel3x3(tex, uv, texel);
    float lx = mag_lx_ly.y;
    float ly = mag_lx_ly.z;

    float Jxx = lx * lx;
    float Jxy = lx * ly;
    float Jyy = ly * ly;

    return vec4(Jxx, Jxy, Jyy, 0.0);

}

struct ImageDerivatives {
    float Ix;
    float Iy;
    float Ixx;
    float Iyy;
    float Ixy;
    float gradMag;
    float gradSq;
    float denom;
};

ImageDerivatives sampleImageDerivatives(sampler2D tex, vec2 uv, vec2 texel) {
    ImageDerivatives d;

    // Axis-aligned samples
    float l = luminance(srgb2linear(texture(tex, uv - vec2(texel.x, 0.0)).rgb));
    float r = luminance(srgb2linear(texture(tex, uv + vec2(texel.x, 0.0)).rgb));
    float b = luminance(srgb2linear(texture(tex, uv - vec2(0.0, texel.y)).rgb));
    float t = luminance(srgb2linear(texture(tex, uv + vec2(0.0, texel.y)).rgb));
    float c = luminance(srgb2linear(texture(tex, uv).rgb));

    // First-order partials
    d.Ix = 0.5 * (r - l);
    d.Iy = 0.5 * (t - b);

    // Second-order partials
    d.Ixx = r - 2.0 * c + l;
    d.Iyy = t - 2.0 * c + b;

    // Diagonal samples for mixed partial
    float tl = luminance(srgb2linear(texture(tex, uv + vec2(-texel.x,  texel.y)).rgb));
    float tr = luminance(srgb2linear(texture(tex, uv + vec2( texel.x,  texel.y)).rgb));
    float bl = luminance(srgb2linear(texture(tex, uv + vec2(-texel.x, -texel.y)).rgb));
    float br = luminance(srgb2linear(texture(tex, uv + vec2( texel.x, -texel.y)).rgb));
    d.Ixy = 0.25 * (tr - tl - br + bl);

    d.gradSq  = d.Ix * d.Ix + d.Iy * d.Iy;
    d.gradMag = sqrt(d.gradSq);
    d.denom   = d.gradMag * d.gradSq;  // i.e. d.gradSq ** 1.5

    return d;
}

vec4 isophoteCurvature(sampler2D tex, vec2 uv, vec2 texel) {
    ImageDerivatives d = sampleImageDerivatives(tex, uv, texel);

    float k = 0.0;
    if (d.denom >= 1e-10) {
        k = (d.Ixx * d.Iy * d.Iy
           - 2.0 * d.Ixy * d.Ix * d.Iy
           + d.Iyy * d.Ix * d.Ix) / d.denom;
    }

    return vec4(k, d.gradMag, d.Ix, d.Iy);
}

vec4 flowlineCurvature(sampler2D tex, vec2 uv, vec2 texel) {
    ImageDerivatives d = sampleImageDerivatives(tex, uv, texel);

    float k = 0.0;
    if (d.denom >= 1e-10) {
        k = (d.Ixy * (d.Ix * d.Ix - d.Iy * d.Iy)
           + d.Ix * d.Iy * (d.Iyy - d.Ixx)) / d.denom;
    }

    return vec4(k, d.gradMag, d.Ix, d.Iy);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    // u_texelSize is in pixel-space size, for intentional
    // texel stretching
    vec2 texel = u_texelSize / u_resolution;
#if CALCULATE_MODE == CALCULATE_MODE_STRUCTURE_TENSOR
    outColor = structureTensor(u_image, uv, texel);
#elif CALCULATE_MODE == CALCULATE_MODE_ISOPHOTE
    outColor = isophoteCurvature(u_image, uv, texel);
#elif CALCULATE_MODE == CALCULATE_MODE_FLOWLINE
    outColor = flowlineCurvature(u_image, uv, texel);
#elif CALCULATE_MODE == CALCULATE_MODE_SOBEL
    // sobel magnitude, x component, y component, 0.0
    outColor = vec4(sobel3x3(u_image, uv, texel), 0.0);
#else
    #error
#endif
}
