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

// Larger = gentler curvature for the same u_curveStrength.
#define POLE_BASE_DISTANCE 0.5

// Symbolic UV layout, row-major:
// 0 1 2
// 3 4 5
// 6 7 8
//
// Vicsek keeps: 1, 3, 4, 5, 7
// Corners 0, 2, 6, 8 are the void.
const vec2 UV_OFFSETS[9] = vec2[9](
    vec2(0.0, 0.0),
    vec2(1.0, 0.0),
    vec2(2.0, 0.0),

    vec2(0.0, 1.0),
    vec2(1.0, 1.0),
    vec2(2.0, 1.0),

    vec2(0.0, 2.0),
    vec2(1.0, 2.0),
    vec2(2.0, 2.0)
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

// Möbius bend around the square center in centered coordinates.
// f(d) = (a d) / (1 - b d)
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
    vec2 center = vec2(0.5, 0.5);
    float z = max(u_zoom, 1e-4);

    vec2 d = p - center;

    // Preserve local behavior at center.
    vec2 a = cExpI(u_spin) / z;

    d = mobiusTransform(d, a, u_curveStrength, u_curveDirection);

    return center + d;
}

// --------------------------------------------------
// Whole-plane mirror tiling into one unit square
// --------------------------------------------------
vec2 mirrorTileToSquare(vec2 p) {
    vec2 cell = fract(p);
    vec2 tile = mod(floor(p), 2.0);

    if (tile.x > 0.5) cell.x = 1.0 - cell.x;
    if (tile.y > 0.5) cell.y = 1.0 - cell.y;

    return cell;
}

// --------------------------------------------------
// 3-band axis classifier
//
// left   = [0, s]
// center = [0.5 - s/2, 0.5 + s/2]
// right  = [1 - s, 1]
//
// Exact Vicsek is s = 1/3.
// --------------------------------------------------
int classifyAxis(float x, float s, out float qx) {
    float starts[3];
    starts[0] = 0.0;
    starts[1] = 0.5 - 0.5 * s;
    starts[2] = 1.0 - s;

    // Territory boundaries from band-center midpoints.
    // For s = 1/3 these are exactly 1/3 and 2/3.
    float bounds[4];
    bounds[0] = 0.0;
    bounds[1] = 0.25 + 0.25 * s;
    bounds[2] = 0.75 - 0.25 * s;
    bounds[3] = 1.0;

    // Inside an actual band: exact local coordinate.
    for (int i = 0; i < 3; ++i) {
        if (x >= starts[i] && x <= starts[i] + s) {
            qx = (x - starts[i]) / max(s, 1e-6);
            return i;
        }
    }

    // Outside the kept bands: still map cleanly into the symbolic 3-way split.
    int region = 0;
    if (x >= bounds[1]) region = 1;
    if (x >= bounds[2]) region = 2;

    float w = max(bounds[region + 1] - bounds[region], 1e-6);
    qx = clamp((x - bounds[region]) / w, 0.0, 1.0);
    return region;
}

bool isVicsekActiveCell(int branch) {
    return branch == 1 || branch == 3 || branch == 4 || branch == 5 || branch == 7;
}

int classifyBranch(vec2 p, float s, out vec2 q) {
    float qx, qy;
    int ix = classifyAxis(p.x, s, qx);
    int iy = classifyAxis(p.y, s, qy);
    q = vec2(qx, qy);
    return ix + 3 * iy;
}

struct fractalResult {
    vec2 uv;
    int iters;
    int lastBranch;
    float branchCount[9];
};

int argmax9(in float v[9]) {
    int bestIdx = 0;
    float bestVal = v[0];

    for (int i = 1; i < 9; ++i) {
        if (v[i] > bestVal) {
            bestVal = v[i];
            bestIdx = i;
        }
    }

    return bestIdx;
}

fractalResult fractalUV(vec2 p, float s) {
    p = mirrorTileToSquare(p);

    fractalResult result;
    result.uv = vec2(0.0);
    result.iters = ITERATIONS;
    result.lastBranch = 4;

    for (int k = 0; k < 9; ++k) {
        result.branchCount[k] = 0.0;
    }

    float cellScale = 1.0;

    for (int i = 0; i < ITERATIONS; ++i) {
        vec2 q;
        int branch = classifyBranch(p, s, q);

        // First time we land in one of the 5 kept Vicsek cells.
        if (result.iters == ITERATIONS && isVicsekActiveCell(branch)) {
            result.iters = i + 1;
        }

        cellScale /= 3.0;
        result.uv += UV_OFFSETS[branch] * cellScale;
        result.lastBranch = branch;
        result.branchCount[branch] += 1.0;
        p = q;
    }

    result.uv += p * cellScale;
    return result;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    // Clamp to <= 1/3 so the three bands do not overlap.
    float s = clamp(u_scale, 0.02, 1.0 / 3.0);

    vec2 p = vec2(
        (st.x - 0.5) * aspect + 0.5,
        st.y
    );

    p = applyStructureTransform(p);

    fractalResult result = fractalUV(p, s);
    vec2 uv = mix(st, result.uv, u_depth);
    uv = fract(uv);

    vec3 pix = texture(u_image, uv).rgb;
    vec3 original = texture(u_image, st).rgb;

#if COLORING_MODE == COLORING_NONE
    // do nothing
#elif COLORING_MODE == COLORING_ITERATIONS
    float hue = float(result.iters) / float(ITERATIONS) * u_hueSpacing + u_startHue;
#elif COLORING_MODE == COLORING_BRANCH
    float hue = float(result.lastBranch) / 9.0 * u_hueSpacing + u_startHue;
#elif COLORING_MODE == COLORING_CORNER
    float hue = float(argmax9(result.branchCount)) / 9.0 * u_hueSpacing + u_startHue;
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