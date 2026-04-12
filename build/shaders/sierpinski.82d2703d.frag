#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_scale;
uniform float u_depth;

uniform float u_spin;
uniform float u_zoom;
uniform float u_chromaGamma;
uniform float u_hueSpacing;
uniform float u_startHue;
uniform float u_hueBleed;

uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#ifndef ITERATIONS
#define ITERATIONS 4
#endif

#define COLORING_NONE 0
#define COLORING_TINT_ITERS 1

#ifndef COLORING_MODE
#define COLORING_MODE 0
#endif

const float H = 0.8660254037844386; // sqrt(3)/2

const vec2 VERTICES[3] = vec2[3](
    vec2(0.0, 0.0),
    vec2(1.0, 0.0),
    vec2(0.5, H)
);

// Symbolic UV layout:
// 0 = lower-left
// 1 = lower-right
// 2 = upper-left
// 3 = upper-right (void)
const vec2 UV_OFFSETS[4] = vec2[4](
    vec2(0.0, 0.0),
    vec2(1.0, 0.0),
    vec2(0.0, 1.0),
    vec2(1.0, 1.0)
);

mat2 rot2(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

vec2 applyStructureTransform(vec2 p) {
    vec2 center = vec2(0.5, H / 3.0);
    float z = max(u_zoom, 1e-4);

    vec2 d = p - center;

    d = rot2(u_spin) * (d / z);

    return center + d;
}

// --------------------------------------------------
// Whole-plane mirror tiling into one upright unit triangle
// --------------------------------------------------
vec2 mirrorTileToTriangle(vec2 p) {
    // lattice coordinates in basis:
    // e1 = (1, 0)
    // e2 = (0.5, H)
    vec2 cell;
    cell.x = p.x - p.y / (2.0 * H);
    cell.y = p.y / H;

    // wrap into one rhombus cell
    cell = fract(cell);

    // reflect upper half into lower half
    if (cell.x + cell.y > 1.0) {
        cell = 1.0 - cell;
    }

    // back to Cartesian
    return vec2(
        cell.x + 0.5 * cell.y,
        H * cell.y
    );
}

// --------------------------------------------------
// Barycentric helpers for the upright unit triangle
// bary = (w0, w1, w2) for vertices:
//   v0 = (0,0), v1 = (1,0), v2 = (0.5,H)
// --------------------------------------------------
vec3 toBarycentric(vec2 p) {
    float w2 = p.y / H;
    float w1 = p.x - 0.5 * w2;
    float w0 = 1.0 - w1 - w2;
    return vec3(w0, w1, w2);
}

vec2 fromBarycentric(vec3 w) {
    return vec2(
        w.y + 0.5 * w.z,
        H * w.z
    );
}

vec2 triangleResidualToUV(vec2 p) {
    // Simple square parameterization of the residual
    return vec2(p.x, p.y / H);
}

// --------------------------------------------------
// Branch classification for arbitrary scale s.
//
// Corner branch m is valid when w[m] >= 1 - s.
// In overlap regions, choose the strongest valid branch.
// If no corner branch is valid, use a stylized "void" branch
// built from normalized barycentric deficits.
// --------------------------------------------------
int classifyBranch(vec2 p, float s, out vec2 q) {
    vec3 w = toBarycentric(p);
    float threshold = 1.0 - s;

    int best = -1;
    float bestWeight = -1.0;

    for (int m = 0; m < 3; ++m) {
        if (w[m] >= threshold && w[m] > bestWeight) {
            best = m;
            bestWeight = w[m];
        }
    }

    if (best >= 0) {
        // Invert corner map m in barycentric form
        vec3 u = w / s;
        u[best] = (w[best] - threshold) / s;
        q = fromBarycentric(u);
        return best;
    }

    // Stylized void branch:
    // map the "missing mass" relative to threshold back into
    // a canonical upright triangle.
    vec3 deficit = max(vec3(0.0), vec3(threshold) - w);
    float sumDeficit = deficit.x + deficit.y + deficit.z;

    if (sumDeficit < 1e-6) {
        deficit = vec3(1.0 / 3.0);
        sumDeficit = 1.0;
    }

    vec3 u = deficit / sumDeficit;
    q = fromBarycentric(u);
    return 3;
}


struct fractalResult {
    vec2 uv;
    int iters;
};

// Fractal UV built from symbolic address
fractalResult fractalUV(vec2 p, float s) {
    p = mirrorTileToTriangle(p);
    fractalResult result;
    result.uv = vec2(0.0);
    result.iters = -1;
    float cellScale = 1.0;

    for (int i = 0; i < ITERATIONS; ++i) {
        vec2 q;
        int branch = classifyBranch(p, s, q);
        if (result.iters == -1 && branch != 3) {
            result.iters = i;
        }
        cellScale *= 0.5;
        result.uv += UV_OFFSETS[branch] * cellScale;
        p = q;
    }

    result.uv += triangleResidualToUV(p) * cellScale;
    return result;
}

// later

//vec2 euclidToPoincare(vec2 p) {
//    // map the unit disk to hyperbolic plane
//    float r = length(p);
//    float scale = 2.0 / (1.0 - r * r + 1e-5);
//    return p * scale;
//}
//
//vec2 cx_mul(vec2 a, vec2 b) {
//    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
//}
//
//vec2 cx_div(vec2 a, vec2 b) {
//    return vec2(
//        ((a.x * b.x + a.y * b.y) / (b.x * b.x + b.y * b.y)),
//        ((a.y * b.x - a.x * b.y) / (b.x * b.x + b.y * b.y))
//    );
//}
//
//vec2 mobius(vec2 z, vec2 a, vec2 b, vec2 c, vec2 d) {
//    // z -> (az + b) / (cz + d)
//    vec2 num = cx_mul(a, z) + b;
//    vec2 den = cx_mul(c, z) + d;
//    return cx_div(num, den);
//}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    // Clamp away from pathological ends.
    float s = clamp(u_scale, 0.02, 0.98);

    // Full-plane coordinates, aspect-correct so the mirrored
    // lattice stays equilateral.
    vec2 p = vec2(
        (st.x - 0.5) * aspect + 0.5,
        (st.y - 0.5) + 0.5 * H
    );
    p = applyStructureTransform(p);
    fractalResult result = fractalUV(p, s);
    vec2 uv = mix(st, result.uv, u_depth);
    uv = fract(uv);
    vec3 pix = texture(u_image, uv).rgb;
#if COLORING_MODE == COLORING_TINT_ITERS
    vec3 lch = srgb2NormLCH(pix);
    lch.y = pow(lch.y, u_chromaGamma);
    float hue = float(result.iters + 1) / float(ITERATIONS) * u_hueSpacing + u_startHue;
    hue = mod(hue, 1.0);
    lch.z = mix(hue, lch.z, u_hueBleed);
    pix = normLCH2SRGB(lch);
#elif COLORING_MODE == COLORING_NONE
    // do nothing
#else
#error
#endif
    vec3 original = texture(u_image, st).rgb;
    outColor = vec4(blendWithColorSpace(original, pix, u_blendamount), 1.0);
}