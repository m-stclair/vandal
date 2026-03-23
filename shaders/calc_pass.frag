#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_texelSize;
uniform vec2 u_resolution;

out vec4 outColor;

#define PI     3.14159265358979

#define CALCULATE_MODE_ISOPHOTE 1
#define CALCULATE_MODE_STRUCTURE_TENSOR 2

#ifndef CALCULATE_MODE
#define CALCULATE_MODE 2
#endif

const vec3 luma = vec3(0.299, 0.587, 0.114);

vec4 structureTensor(sampler2D tex, vec2 uv, vec2 texel) {
// Sobel 3x3
    vec3 tl = texture(u_image, uv + vec2(-1,-1) * texel).rgb;
    vec3 tc = texture(u_image, uv + vec2( 0,-1) * texel).rgb;
    vec3 tr = texture(u_image, uv + vec2( 1,-1) * texel).rgb;
    vec3 ml = texture(u_image, uv + vec2(-1, 0) * texel).rgb;
    vec3 mr = texture(u_image, uv + vec2( 1, 0) * texel).rgb;
    vec3 bl = texture(u_image, uv + vec2(-1, 1) * texel).rgb;
    vec3 bc = texture(u_image, uv + vec2( 0, 1) * texel).rgb;
    vec3 br = texture(u_image, uv + vec2( 1, 1) * texel).rgb;

    vec3 gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    vec3 gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;

    // Collapse to luminance gradient
    float lx = dot(gx, luma);
    float ly = dot(gy, luma);

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
    float l = texture(tex, uv - vec2(texel.x, 0.0)).r;
    float r = texture(tex, uv + vec2(texel.x, 0.0)).r;
    float b = texture(tex, uv - vec2(0.0, texel.y)).r;
    float t = texture(tex, uv + vec2(0.0, texel.y)).r;
    float c = texture(tex, uv).r;

    float Ix = (r - l) / 2.0;
    float Iy = (t - b) / 2.0;

    // Second-order partials
    float Ixx = r - 2.0 * c + l;
    float Iyy = t - 2.0 * c + b;

    // Mixed partial: sample the four diagonal neighbors
    float tl = texture(tex, uv + vec2(-texel.x,  texel.y)).r;
    float tr = texture(tex, uv + vec2( texel.x,  texel.y)).r;
    float bl = texture(tex, uv + vec2(-texel.x, -texel.y)).r;
    float br = texture(tex, uv + vec2( texel.x, -texel.y)).r;
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
    return vec4(iCurvature, Ix, Iy, atan(Ix, Iy));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = u_texelSize / u_resolution;
#if CALCULATE_MODE == CALCULATE_MODE_STRUCTURE_TENSOR
    outColor = structureTensor(u_image, uv, texel);
#elif CALCULATE_MODE == CALCULATE_MODE_ISOPHOTE
    outColor = isophoteCurvature(u_image, uv, texel);
#endif
}



