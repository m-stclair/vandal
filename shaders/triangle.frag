#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_scale;
uniform float u_depth;

uniform float u_spin;
uniform float u_zoom;

uniform float u_curveStrength;
uniform float u_curveDirection;

uniform float u_chromaGamma;
uniform float u_hueSpacing;
uniform float u_startHue;
uniform float u_hueBleed;
uniform vec2 u_pan;
uniform vec2 u_origin;

uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#ifndef ITERATIONS
#define ITERATIONS 4
#endif

#define COLORING_NONE 0
#define COLORING_ITERATIONS 1
#define COLORING_BRANCH 2
#define COLORING_CORNER 3

#ifndef COLORING_MODE
#define COLORING_MODE 0
#endif

// This constant is basically a "feel" knob for the UI.
// Larger = gentler curvature for the same u_curveStrength.
#define POLE_BASE_DISTANCE 0.5

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

// -----------------------------------------
// Complex helpers
// -----------------------------------------
vec2 cMul(vec2 a, vec2 b) {
    return vec2(
        a.x * b.x - a.y * b.y,
        a.x * b.y + a.y * b.x
    );
}

vec2 cDiv(vec2 a, vec2 b) {
    float d = max(dot(b, b), 1e-8);
    return vec2(
        a.x * b.x + a.y * b.y,
        a.y * b.x - a.x * b.y
    ) / d;
}

vec2 cExpI(float a) {
    return vec2(cos(a), sin(a));
}

// Möbius bend around the origin in centered coordinates.
// f(d) = (a d) / (1 - b d)
//
// a = linear rotate/zoom part
// b = pole placement control
//
// When b == 0, this is exactly affine again.
vec2 mobiusTransform(vec2 d, vec2 a, float curveStrength, float curveDirection) {


    if (curveStrength < 1e-6) {
        return cMul(a, d);
    }

    // Pole sits at +dir * (POLE_BASE_DISTANCE / curveStrength) in centered coordinates.
    // So:
    //   strength 0.0 -> pole at infinity -> affine
    //   larger strength -> pole comes closer -> stronger bend
    vec2 b = cExpI(curveDirection + u_spin) * (curveStrength / POLE_BASE_DISTANCE);

    vec2 num = cMul(a, d);
    vec2 den = vec2(1.0, 0.0) - cMul(b, d);

    return cDiv(num, den);
}

vec2 applyStructureTransform(vec2 p) {
    vec2 center = vec2(0.5, H / 3.0);
    float z = max(u_zoom, 1e-4);

    vec2 d = p - u_pan - center;

    // Preserve local behavior at center.
    vec2 a = cExpI(u_spin) / z;

    d = mobiusTransform(d, a, u_curveStrength, u_curveDirection);

    return center + d;
}

// --------------------------------------------------
// Whole-plane mirror tiling into one upright unit triangle
// --------------------------------------------------
vec2 mirrorTileToTriangle(vec2 p) {
    vec2 cell;
    cell.x = p.x - p.y / (2.0 * H);
    cell.y = p.y / H;

    cell = fract(cell);

    if (cell.x + cell.y > 1.0) {
        cell = 1.0 - cell;
    }

    return vec2(
        cell.x + 0.5 * cell.y,
        H * cell.y
    );
}

// --------------------------------------------------
// Barycentric helpers for the upright unit triangle
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
    return vec2(p.x, p.y / H);
}

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
        vec3 u = w / s;
        u[best] = (w[best] - threshold) / s;
        q = fromBarycentric(u);
        return best;
    }

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
    int lastBranch;
    vec4 branchCount;
};

float argmax4(vec4 v) {
    vec4 m = step(v.yzww, v.xxyz) * step(v.zwww, v.xyyy); // one-hot mask
    return dot(m, vec4(0.0, 1.0, 2.0, 3.0));
}

fractalResult fractalUV(vec2 p, float s) {
    p = mirrorTileToTriangle(p);
    fractalResult result;
    result.uv = vec2(0.0);
    result.branchCount = vec4(0);
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
        result.lastBranch = branch;
        result.branchCount[branch] += 1.0;
        p = q;
    }

    result.uv += triangleResidualToUV(p) * cellScale;
    return result;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    float s = clamp(u_scale, 0.02, 0.98);

    vec2 p = vec2(
        (st.x - 0.5) * aspect + 0.5,
        (st.y - 0.5) + 0.5 * H
    );

    p = applyStructureTransform(p);

    fractalResult result = fractalUV(p, s);
    vec2 uv = mix(st, result.uv + u_origin, u_depth);
    uv = fract(uv);

    vec3 pix = texture(u_image, uv).rgb;
    vec3 original = texture(u_image, st).rgb;

#if COLORING_MODE == COLORING_NONE
    // do nothing
#elif COLORING_MODE == COLORING_ITERATIONS
    float hue = float(result.iters + 1) / float(ITERATIONS) * u_hueSpacing + u_startHue;
#elif COLORING_MODE == COLORING_BRANCH
    float hue = float(result.lastBranch) / 4.0 * u_hueSpacing + u_startHue;
#elif COLORING_MODE == COLORING_CORNER
    float hue = float(argmax4(result.branchCount)) / 4.0 * u_hueSpacing + u_startHue;
#else
    #error
#endif
#if COLORING_MODE == COLORING_NONE
    // do nothing
#else
    hue = mod(hue, 1.0);
    vec3 lch = srgb2NormLCH(pix);
    lch.y = pow(lch.y, u_chromaGamma);
    lch.z = mix(hue, lch.z, u_hueBleed);
    pix = normLCH2SRGB(lch);
#endif
    outColor = vec4(blendWithColorSpace(original, pix, u_blendamount), 1.0);
}
