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
    vec3 mag_lx_ly = sobel3x3(tex, uv, texel);
    float lx = mag_lx_ly.y;
    float ly = mag_lx_ly.z;

    // Structure tensor components
    float Jxx = lx * lx;
    float Jxy = lx * ly;
    float Jyy = ly * ly;

    // Eigendecomposition — gives us dominant edge direction
    float D    = sqrt(max(0.0, (Jxx - Jyy)*(Jxx - Jyy) + 4.0*Jxy*Jxy));
    float lam1 = 0.5 * (Jxx + Jyy + D);
    float lam2 = 0.5 * (Jxx + Jyy - D);

    // Orientation of the dominant eigenvector
    // (perpendicular to the edge, i.e. the gradient direction)
    float angle       = 0.5 * atan(2.0 * Jxy, Jxx - Jyy);
    float angleNorm = (angle + PI * 0.5) / PI;
    float anisotropy  = (lam1 - lam2) / (lam1 + lam2 + 1e-6);
    return vec4(angleNorm, anisotropy, lx, ly);
}

vec4 isophoteCurvature(sampler2D tex, vec2 uv, vec2 texel) {
    // First-order partials
    float l = luminance(texture(tex, uv - vec2(texel.x, 0.0)).rgb);
    float r = luminance(texture(tex, uv + vec2(texel.x, 0.0)).rgb);
    float b = luminance(texture(tex, uv - vec2(0.0, texel.y)).rgb);
    float t = luminance(texture(tex, uv + vec2(0.0, texel.y)).rgb);
    float c = luminance(texture(tex, uv).rgb);

    float Ix = (r - l) / 2.0;
    float Iy = (t - b) / 2.0;

    // Second-order partials
    float Ixx = r - 2.0 * c + l;
    float Iyy = t - 2.0 * c + b;

    // Mixed partial: sample the four diagonal neighbors
    float tl = luminance(texture(tex, uv + vec2(-texel.x,  texel.y)).rgb);
    float tr = luminance(texture(tex, uv + vec2( texel.x,  texel.y)).rgb);
    float bl = luminance(texture(tex, uv + vec2(-texel.x, -texel.y)).rgb);
    float br = luminance(texture(tex, uv + vec2( texel.x, -texel.y)).rgb);
    float Ixy = (tr - tl - br + bl) / 4.0;

    // Assemble the curvature formula
    float gradSq = Ix * Ix + Iy * Iy;
    float denom = pow(gradSq, 1.5);

    float iCurvature;
    // Guard against division by zero in flat regions
    if (denom < 1e-10) {
        iCurvature = 0.0;
    }
    else {
        iCurvature = (Ixx * Iy * Iy - 2.0 * Ixy * Ix * Iy + Iyy * Ix * Ix) / denom;
    }
    return vec4(iCurvature, Ix, Iy, atan(Iy, Ix));
}


vec4 flowlineCurvature(sampler2D tex, vec2 uv, vec2 texel) {
    // First-order partials (identical setup to isophote version)
    float l = luminance(texture(tex, uv - vec2(texel.x, 0.0)).rgb);
    float r = luminance(texture(tex, uv + vec2(texel.x, 0.0)).rgb);
    float b = luminance(texture(tex, uv - vec2(0.0, texel.y)).rgb);
    float t = luminance(texture(tex, uv + vec2(0.0, texel.y)).rgb);
    float c = luminance(texture(tex, uv).rgb);

    float Ix = (r - l) / 2.0;
    float Iy = (t - b) / 2.0;

    // Second-order partials
    float Ixx = r - 2.0 * c + l;
    float Iyy = t - 2.0 * c + b;

    // Mixed partial: sample the four diagonal neighbors
    float tl = luminance(texture(tex, uv + vec2(-texel.x,  texel.y)).rgb);
    float tr = luminance(texture(tex, uv + vec2( texel.x,  texel.y)).rgb);
    float bl = luminance(texture(tex, uv + vec2(-texel.x, -texel.y)).rgb);
    float br = luminance(texture(tex, uv + vec2( texel.x, -texel.y)).rgb);
    float Ixy = (tr - tl - br + bl) / 4.0;

    float gradSq = Ix * Ix + Iy * Iy;
    float denom  = pow(gradSq, 1.5);

    float fCurvature;
    if (denom < 1e-10) {
        fCurvature = 0.0;
    } else {
        fCurvature = (Ixy * (Ix*Ix - Iy*Iy) + Ix * Iy * (Iyy - Ixx)) / denom;
    }
    return vec4(fCurvature, Ix, Iy, atan(Iy, Ix));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
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



