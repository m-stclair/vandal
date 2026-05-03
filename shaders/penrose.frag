#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_depth;
uniform float u_spin;
uniform float u_zoom;

uniform float u_seedRadius;
uniform float u_phiWrap;

uniform float u_warpAmount;
uniform float u_localScale;
uniform float u_addressSpread;

uniform float u_edgeAmount;
uniform float u_edgeWidth;

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
#define ITERATIONS 7
#endif

#define COLORING_NONE 0
#define COLORING_SEED 1
#define COLORING_BRANCH 2
#define COLORING_TILE_TYPE 3
#define COLORING_ORIENTATION 4

#ifndef COLORING_MODE
#define COLORING_MODE 3
#endif

#define UV_ADDRESS 0
#define UV_LOCAL 1
#define UV_DISPLACE 2

#ifndef UV_MODE
#define UV_MODE 2
#endif

#define TRI_THICK_HALF 0
#define TRI_THIN_HALF 1

// P3 Penrose constants.
// Thick rhomb halves are 36-72-72 Robinson triangles.
// Thin rhomb halves are 108-36-36 Robinson triangles.
const float PI = 3.1415926535897932384626433832795;
const float TWO_PI = 6.283185307179586476925286766559;
const float PHI = 1.6180339887498948482045868343656;
const float INV_PHI = 0.6180339887498948482045868343656;
const float SECTOR = PI / 5.0; // 36 degrees
const float COS36 = 0.8090169943749475;
const float SIN36 = 0.5877852522924731;
const float COS108 = -0.30901699437494734;
const float SIN108 = 0.9510565162951536;

// This constant is basically a "feel" knob for the UI.
// Larger = gentler curvature for the same u_curveStrength.
#define POLE_BASE_DISTANCE 0.5

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

// Möbius bend around the origin in centered Penrose-space coordinates.
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

    // Pole sits at +dir * (POLE_BASE_DISTANCE / curveStrength).
    // So:
    //   strength 0.0 -> pole at infinity -> affine
    //   larger strength -> pole comes closer -> stronger bend
    vec2 b = cExpI(curveDirection + u_spin) * (curveStrength / POLE_BASE_DISTANCE);

    vec2 num = cMul(a, d);
    vec2 den = vec2(1.0, 0.0) - cMul(b, d);

    return cDiv(num, den);
}

vec2 applyStructureTransform(vec2 p) {
    float z = max(u_zoom, 1e-4);

    vec2 d = p - u_pan;

    // Preserve local behavior at origin.
    vec2 a = cExpI(u_spin) / z;

    return mobiusTransform(d, a, u_curveStrength, u_curveDirection);
}

// --------------------------------------------------
// Triangle helpers
// --------------------------------------------------
vec3 barycentricTri(vec2 p, vec2 a, vec2 b, vec2 c) {
    vec2 v0 = b - a;
    vec2 v1 = c - a;
    vec2 v2 = p - a;

    float d00 = dot(v0, v0);
    float d01 = dot(v0, v1);
    float d11 = dot(v1, v1);
    float d20 = dot(v2, v0);
    float d21 = dot(v2, v1);

    float denom = d00 * d11 - d01 * d01;
    denom = abs(denom) < 1e-9 ? (denom < 0.0 ? -1e-9 : 1e-9) : denom;

    float v = (d11 * d20 - d01 * d21) / denom;
    float w = (d00 * d21 - d01 * d20) / denom;
    float u = 1.0 - v - w;

    return vec3(u, v, w);
}

float outsideScore(vec3 w) {
    // Barycentrics sum to 1. Negative components are the amount by which
    // the point has leaked outside a candidate child triangle.
    vec3 leak = max(vec3(0.0), -w);
    return dot(leak, leak);
}

vec2 canonicalTriPoint(vec3 w, int triType) {
    vec2 a = vec2(0.0, 0.0);
    vec2 b = vec2(1.0, 0.0);
    vec2 c = triType == TRI_THICK_HALF
        ? vec2(COS36, SIN36)
        : vec2(COS108, SIN108);

    vec2 p = a * w.x + b * w.y + c * w.z;

    // Put both Robinson triangle types into a mostly common positive UV frame.
    if (triType == TRI_THIN_HALF) {
        p.x += 0.30901699437494734;
    }

    return p;
}

vec2 canonicalTriPointToUnit(vec2 p, int triType) {
    // canonicalTriPoint() already makes X mostly 0..1 for both triangle kinds.
    // Y spans SIN36 for thick halves and SIN108 for thin halves.
    float yMax = triType == TRI_THICK_HALF ? SIN36 : SIN108;
    return clamp(vec2(p.x, p.y / max(yMax, 1e-6)), vec2(0.0), vec2(1.0));
}

vec2 branchUV(int branch) {
    if (branch == 0) return vec2(0.0, 0.0);
    if (branch == 1) return vec2(1.0, 0.0);
    if (branch == 2) return vec2(0.0, 1.0);
    return vec2(1.0, 1.0);
}

vec2 seedHash(float k) {
    return fract(vec2(
        0.11369 + k * INV_PHI,
        0.27183 + k * INV_PHI * INV_PHI
    ));
}

float argmax4(vec4 v) {
    vec4 m = step(v.yzww, v.xxyz) * step(v.zwww, v.xyyy); // one-hot-ish mask
    return dot(m, vec4(0.0, 1.0, 2.0, 3.0));
}

void considerChild(
    vec2 p,

    vec2 ca,
    vec2 cb,
    vec2 cc,
    int cType,
    int cBranch,

    inout float bestScore,
    inout vec2 bestA,
    inout vec2 bestB,
    inout vec2 bestC,
    inout int bestType,
    inout int bestBranch
) {
    vec3 w = barycentricTri(p, ca, cb, cc);
    float score = outsideScore(w);

    // Tiny tie-breaker. Without this, points exactly on recursive boundaries
    // can flicker between siblings as uniforms animate.
    score += float(cBranch) * 1e-7;

    if (score < bestScore) {
        bestScore = score;
        bestA = ca;
        bestB = cb;
        bestC = cc;
        bestType = cType;
        bestBranch = cBranch;
    }
}

// One inverse substitution step in Robinson-triangle form.
// This is P3 rhomb deflation expressed through triangle halves:
//
//   thick rhomb half, 36-72-72:
//       -> one thick half + one thin half
//
//   thin rhomb half, 108-36-36:
//       -> two thin halves + one thick half
//
// Two matching halves form the familiar thick/thin Penrose rhombs.
void classifyPenroseChild(
    vec2 p,

    vec2 a,
    vec2 b,
    vec2 c,
    int triType,

    out vec2 nextA,
    out vec2 nextB,
    out vec2 nextC,
    out int nextType,
    out int branch
) {
    float bestScore = 1e20;
    vec2 bestA = a;
    vec2 bestB = b;
    vec2 bestC = c;
    int bestType = triType;
    int bestBranch = 0;

    if (triType == TRI_THICK_HALF) {
        // Golden acute triangle split.
        vec2 pAB = a + (b - a) * INV_PHI;

        // Child 0: thick half
        considerChild(
            p,
            c, pAB, b,
            TRI_THICK_HALF,
            0,
            bestScore, bestA, bestB, bestC, bestType, bestBranch
        );

        // Child 1: thin half
        considerChild(
            p,
            pAB, c, a,
            TRI_THIN_HALF,
            1,
            bestScore, bestA, bestB, bestC, bestType, bestBranch
        );
    } else {
        // Golden obtuse triangle split.
        vec2 qBA = b + (a - b) * INV_PHI;
        vec2 rBC = b + (c - b) * INV_PHI;

        // Child 0: thin half
        considerChild(
            p,
            rBC, c, a,
            TRI_THIN_HALF,
            0,
            bestScore, bestA, bestB, bestC, bestType, bestBranch
        );

        // Child 1: thin half
        considerChild(
            p,
            qBA, rBC, b,
            TRI_THIN_HALF,
            1,
            bestScore, bestA, bestB, bestC, bestType, bestBranch
        );

        // Child 2: thick half
        considerChild(
            p,
            rBC, qBA, a,
            TRI_THICK_HALF,
            2,
            bestScore, bestA, bestB, bestC, bestType, bestBranch
        );
    }

    nextA = bestA;
    nextB = bestB;
    nextC = bestC;
    nextType = bestType;
    branch = bestBranch;
}

// Compress very distant points back into the seed star by powers of phi.
// This is not a periodic repeat. It is a scale-periodic Penrose-space wrap,
// so zooming breathes through phi shells instead of square cells.
vec2 phiWrapPoint(vec2 p) {
    float r = length(p);
    float safeR = max(r, 1e-6);
    float target = max(u_seedRadius * 0.82, 1e-4);

    float shell = max(0.0, ceil(log(safeR / target) / log(PHI)));
    vec2 wrapped = p * pow(INV_PHI, shell);

    return mix(p, wrapped, clamp(u_phiWrap, 0.0, 1.0));
}

// Fold Penrose-space into one of ten 36-degree seed triangles.
// Ten acute Robinson triangles around the origin form the classic decagonal
// seed patch. Repeated deflation then yields the P3 rhomb hierarchy.
void seedPenroseTriangle(
    inout vec2 p,
    out vec2 a,
    out vec2 b,
    out vec2 c,
    out int triType,
    out int seedBranch
) {
    p = phiWrapPoint(p);

    float ang = atan(p.y, p.x);
    float kf = floor((ang + PI) / SECTOR);
    kf = clamp(kf, 0.0, 9.0);

    float a0 = -PI + kf * SECTOR;
    float a1 = a0 + SECTOR;
    float r = max(u_seedRadius, 1e-4);

    a = vec2(0.0);
    b = r * vec2(cos(a0), sin(a0));
    c = r * vec2(cos(a1), sin(a1));

    // Alternating mirrored triangles give the seed star matching orientation,
    // which keeps branch coloring less rotationally mushy.
    if (mod(kf, 2.0) > 0.5) {
        vec2 tmp = b;
        b = c;
        c = tmp;
    }

    triType = TRI_THICK_HALF;
    seedBranch = int(kf);
}

struct PenroseResult {
    vec2 addressUV;
    vec2 localUV;
    vec2 displacement;
    int seedBranch;
    int lastBranch;
    int tileType;
    float orientation;
    float edge;
    vec4 branchCount;
};

PenroseResult penroseUV(vec2 p) {
    PenroseResult result;

    vec2 a;
    vec2 b;
    vec2 c;
    int triType;
    int seedBranch;

    seedPenroseTriangle(p, a, b, c, triType, seedBranch);

    // This is the old symbolic address idea, but spread across the full image
    // instead of being trapped in a small quadrant. Useful as a glitch mode.
    vec2 addressUV = seedHash(float(seedBranch)) * max(u_addressSpread, 0.0);

    result.seedBranch = seedBranch;
    result.lastBranch = seedBranch;
    result.tileType = triType;
    result.orientation = 0.0;
    result.edge = 0.0;
    result.branchCount = vec4(0.0);

    float cellScale = 1.0;

    for (int i = 0; i < ITERATIONS; ++i) {
        vec2 na;
        vec2 nb;
        vec2 nc;
        int nt;
        int branch;

        classifyPenroseChild(p, a, b, c, triType, na, nb, nc, nt, branch);

        cellScale *= 0.5;
        addressUV += branchUV(branch) * cellScale;

        result.lastBranch = branch;
        result.branchCount[min(branch, 3)] += 1.0;
        a = na;
        b = nb;
        c = nc;
        triType = nt;
    }

    vec3 w = barycentricTri(p, a, b, c);
    vec3 wc = clamp(w, vec3(0.0), vec3(1.0));
    wc /= max(wc.x + wc.y + wc.z, 1e-6);

    vec2 residual = canonicalTriPoint(wc, triType);
    vec2 local01 = canonicalTriPointToUnit(residual, triType);

    result.addressUV = fract(addressUV + local01 * cellScale);

    // Local mode maps every final Penrose cell across the whole source image.
    // This is aggressive, but it does not collapse into one tiny source patch.
    float localScale = max(u_localScale, 1e-5);
    result.localUV = fract((local01 - vec2(0.5)) * localScale + vec2(0.5));

    result.tileType = triType;

    vec2 edgeDir = normalize(b - a);
    float edgeAngle = atan(edgeDir.y, edgeDir.x);
    result.orientation = fract(edgeAngle / TWO_PI + 1.0);

    // Displace mode is the image-preserving version:
    // keep the original UV as the carrier, then add a bounded Penrose-local
    // displacement. The tiling bends the image instead of replacing the image
    // with a symbolic branch address. This is the thing you wanted. The image
    // survives; the Penrose structure rides on top of it like a cracked lens.
    result.displacement = rot2(edgeAngle) * (local01 - vec2(0.5));

    float edgeCoord = min(min(wc.x, wc.y), wc.z);
    float ew = max(u_edgeWidth, 1e-5);
    result.edge = 1.0 - smoothstep(ew, ew * 2.5, edgeCoord);

    return result;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    vec2 p = vec2(
        (st.x - 0.5) * aspect,
        (st.y - 0.5)
    );

    p = applyStructureTransform(p);

    PenroseResult result = penroseUV(p);

#if UV_MODE == UV_ADDRESS
    vec2 warpedUV = result.addressUV + u_origin;
#elif UV_MODE == UV_LOCAL
    vec2 warpedUV = result.localUV + u_origin;
#elif UV_MODE == UV_DISPLACE
    vec2 disp = vec2(
        result.displacement.x / max(aspect, 1e-6),
        result.displacement.y
    );
    vec2 warpedUV = st + disp * u_warpAmount + u_origin;
#else
    #error
#endif

    vec2 uv = mix(st, warpedUV, u_depth);
    uv = fract(uv);

    vec3 pix = texture(u_image, uv).rgb;
    vec3 original = texture(u_image, st).rgb;

#if COLORING_MODE == COLORING_NONE
    // do nothing
#elif COLORING_MODE == COLORING_SEED
    float hue = float(result.seedBranch) / 10.0 * u_hueSpacing + u_startHue;
#elif COLORING_MODE == COLORING_BRANCH
    float hue = float(result.lastBranch) / 3.0 * u_hueSpacing + u_startHue;
#elif COLORING_MODE == COLORING_TILE_TYPE
    float hue = float(result.tileType) * 0.5 * u_hueSpacing + u_startHue;
#elif COLORING_MODE == COLORING_ORIENTATION
    float hue = result.orientation * u_hueSpacing + u_startHue;
#else
    #error
#endif

#if COLORING_MODE == COLORING_NONE
    // do nothing
#else
    hue = mod(hue, 1.0);
    vec3 lch = srgb2NormLCH(pix);
    lch.y = pow(max(lch.y, 0.0), u_chromaGamma);
    lch.z = mix(hue, lch.z, u_hueBleed);
    pix = normLCH2SRGB(lch);
#endif

    // Optional recursive edge overlay. This draws the Robinson subdivision edges;
    // set Edge Amount to 0 for a pure image-folding Penrose remap.
    if (u_edgeAmount > 1e-5) {
        float e = clamp(result.edge * u_edgeAmount, 0.0, 1.0);
        pix = mix(pix, pix * 0.22, e);
    }

    outColor = vec4(blendWithColorSpace(original, pix, u_blendamount), 1.0);
}
