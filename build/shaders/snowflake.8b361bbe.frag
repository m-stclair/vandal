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
// 3 = upper-right
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
vec2 mobiusTransform(vec2 d, vec2 a, float curveStrength, float curveDirection) {
    if (curveStrength < 1e-6) {
        return cMul(a, d);
    }

    vec2 b = cExpI(curveDirection + u_spin) * (curveStrength / POLE_BASE_DISTANCE);

    vec2 num = cMul(a, d);
    vec2 den = vec2(1.0, 0.0) - cMul(b, d);

    return cDiv(num, den);
}

vec2 applyStructureTransform(vec2 p) {
    vec2 center = vec2(0.5, H / 3.0);
    float z = max(u_zoom, 1e-4);

    vec2 d = p - u_pan - center;

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
// Segment helpers
// --------------------------------------------------
float sqDistToSegment(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
    vec2 c = a + t * ab;
    vec2 d = p - c;
    return dot(d, d);
}

// Fold the triangle point onto its nearest snowflake side.
// The returned local coordinates are:
//   x = distance along the side, normalized 0..1
//   y = perpendicular distance from side
int closestTriangleSide(vec2 p, out vec2 local) {
    vec2 a = VERTICES[0];
    vec2 b = VERTICES[1];

    float bestDist = sqDistToSegment(p, VERTICES[0], VERTICES[1]);
    int best = 0;

    float d1 = sqDistToSegment(p, VERTICES[1], VERTICES[2]);
    if (d1 < bestDist) {
        bestDist = d1;
        best = 1;
        a = VERTICES[1];
        b = VERTICES[2];
    }

    float d2 = sqDistToSegment(p, VERTICES[2], VERTICES[0]);
    if (d2 < bestDist) {
        bestDist = d2;
        best = 2;
        a = VERTICES[2];
        b = VERTICES[0];
    }

    local = cDiv(p - a, b - a);

    // Double-sided Koch address. This keeps both sides of every snowflake edge stable.
    local.y = abs(local.y);

    return best;
}

// --------------------------------------------------
// Koch generator
// --------------------------------------------------
//
// Classic Koch side:
//
// p0 ---- p1
//          \
//           p2
//          /
// p4 ---- p3
//
// Branches:
// 0: p0 -> p1
// 1: p1 -> p2
// 2: p2 -> p3
// 3: p3 -> p4
//
// u_scale controls p2 height.
// u_scale = 1.0 gives the classic equilateral Koch bump.
void kochSegment(int branch, float spike, out vec2 a, out vec2 b) {
    float h = (H / 3.0) * spike;

    vec2 p0 = vec2(0.0, 0.0);
    vec2 p1 = vec2(1.0 / 3.0, 0.0);
    vec2 p2 = vec2(0.5, h);
    vec2 p3 = vec2(2.0 / 3.0, 0.0);
    vec2 p4 = vec2(1.0, 0.0);

    if (branch == 0) {
        a = p0;
        b = p1;
    } else if (branch == 1) {
        a = p1;
        b = p2;
    } else if (branch == 2) {
        a = p2;
        b = p3;
    } else {
        a = p3;
        b = p4;
    }
}

int classifyKochBranch(vec2 p, float spike, out vec2 q, out float branchDist) {
    int best = 0;
    float bestDist = 1e20;

    vec2 bestA = vec2(0.0);
    vec2 bestB = vec2(1.0, 0.0);

    for (int m = 0; m < 4; ++m) {
        vec2 a;
        vec2 b;
        kochSegment(m, spike, a, b);

        float d = sqDistToSegment(p, a, b);

        if (d < bestDist) {
            bestDist = d;
            best = m;
            bestA = a;
            bestB = b;
        }
    }

    // Inverse affine map:
    // pull the chosen generator segment back to the unit segment.
    q = cDiv(p - bestA, bestB - bestA);

    // Keep the address double-sided and forgiving.
    q.y = abs(q.y);

    branchDist = sqrt(bestDist);

    return best;
}

vec2 kochResidualToUV(vec2 p) {
    return vec2(p.x, p.y);
}

struct fractalResult {
    vec2 uv;
    int iters;
    int lastBranch;
    vec4 branchCount;
};

float argmax4(vec4 v) {
    float bestValue = v.x;
    float bestIndex = 0.0;

    if (v.y > bestValue) {
        bestValue = v.y;
        bestIndex = 1.0;
    }

    if (v.z > bestValue) {
        bestValue = v.z;
        bestIndex = 2.0;
    }

    if (v.w > bestValue) {
        bestValue = v.w;
        bestIndex = 3.0;
    }

    return bestIndex;
}

fractalResult fractalUV(vec2 p, float spike) {
    p = mirrorTileToTriangle(p);

    fractalResult result;
    result.uv = vec2(0.0);
    result.iters = ITERATIONS;
    result.lastBranch = 0;
    result.branchCount = vec4(0.0);

    float cellScale = 1.0;

    // First symbolic level: which side of the snowflake triangle?
    vec2 local;
    int side = closestTriangleSide(p, local);

    cellScale *= 0.5;
    result.uv += UV_OFFSETS[side] * cellScale;
    result.lastBranch = side;
    result.branchCount[side] += 1.0;

    // Distance threshold for iteration coloring.
    // Smaller = thinner curve basin.
    float escapeWidth = 0.085;

    for (int i = 0; i < ITERATIONS; ++i) {
        vec2 q;
        float branchDist;

        int branch = classifyKochBranch(local, spike, q, branchDist);

        if (result.iters == ITERATIONS && branchDist > escapeWidth) {
            result.iters = i;
        }

        cellScale *= 0.5;
        result.uv += UV_OFFSETS[branch] * cellScale;

        result.lastBranch = branch;
        result.branchCount[branch] += 1.0;

        local = q;
    }

    result.uv += kochResidualToUV(local) * cellScale;

    return result;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    // For classic Koch, use u_scale near 1.0.
    // Lower values flatten the bump.
    float spike = clamp(u_scale, 0.0, 1.0);

    vec2 p = vec2(
        (st.x - 0.5) * aspect + 0.5,
        (st.y - 0.5) + 0.5 * H
    );

    p = applyStructureTransform(p);

    fractalResult result = fractalUV(p, spike);

    vec2 uv = mix(st, result.uv + u_origin, u_depth);
    uv = fract(uv);

    vec3 pix = texture(u_image, uv).rgb;
    vec3 original = texture(u_image, st).rgb;

#if COLORING_MODE == COLORING_NONE
    // do nothing
#elif COLORING_MODE == COLORING_ITERATIONS
    float hue = float(result.iters + 1) / float(ITERATIONS + 1) * u_hueSpacing + u_startHue;
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