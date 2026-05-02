#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_reflections;
uniform float u_tube_length;
uniform float u_magnification;
uniform float u_mirrors;
uniform float u_depth;
uniform float u_twist;

uniform float u_blendamount;

uniform float u_phase;
uniform float u_prism;
uniform float u_warp;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#define PI 3.14159265358979
#define MAX_ITERATIONS 20

#define MODE_CLASSIC        0
#define MODE_PRISM   1
#define MODE_CELLULAR  2

#ifndef MODE
#define MODE MODE_CLASSIC
#endif

vec2 rotate2(vec2 p, float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c) * p;
}

vec2 safeNormalize(vec2 p) {
    return p / max(length(p), 0.00001);
}

vec2 afold(vec2 p, float n) {
    float a = atan(p.y, p.x);
    float r = length(p);
    float slice = PI / n;
    a = mod(a, 2.0 * slice);
    a = abs(a - slice);
    return vec2(cos(a), sin(a)) * r;
}

float rfold(float r, float period) {
    r = mod(r, period * 2.0);
    return abs(r - period);
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx + p3.yz) * p3.zy);
}

vec2 hexCell(vec2 p, out vec2 center, out vec2 key) {
    const vec2 hex = vec2(1.0, 1.73205080757);

    vec2 ia = floor(p / hex);
    vec2 ib = floor((p - hex * 0.5) / hex);

    vec2 ca = (ia + 0.5) * hex;
    vec2 cb = (ib + 1.0) * hex;

    vec2 a = p - ca;
    vec2 b = p - cb;

    if (dot(a, a) < dot(b, b)) {
        center = ca;
        key = ia * 2.0;
        return a;
    } else {
        center = cb;
        key = ib * 2.0 + 1.0;
        return b;
    }
}

float hexMask(vec2 p) {
    p = abs(p);
    float d = max(p.x * 0.8660254 + p.y * 0.5, p.y);
    return smoothstep(0.58, 0.42, d);
}

vec2 prismChunkyGlassCoord(vec2 uv, vec2 p, out float seam, out float facet) {
    float chunks = mix(5.0, 11.0, clamp(u_prism, 0.0, 1.0));
    vec2 q = p * chunks;

    vec2 cell = floor(q);
    vec2 f = fract(q) - 0.5;
    vec2 rnd = hash22(cell);

    float ang = (rnd.x - 0.5) * 1.8 + (rnd.y - 0.5) * 0.8;
    vec2 g = rotate2(f, ang);

    float edge = max(abs(g.x), abs(g.y));
    float d = length(g);

    float thickness = 0.75 + rnd.y * 1.4;

    // center bulge / edge compression = lumpy cheap-glass refraction
    float bulge = (0.34 - d) * (0.18 + 0.12 * rnd.x) * u_prism * thickness;
    g += safeNormalize(g + vec2(0.0001, 0.0)) * bulge;

    // unequal internal scale per chunk
    g *= 1.0 + (rnd.y - 0.5) * 0.45 * u_prism;

    // whole facet drifts slightly
    g += (rnd - 0.5) * 0.06 * u_prism;

    // seam = stronger near the facet edge
    seam  = smoothstep(0.26, 0.50, edge);

    // facet = stronger toward the facet center
    facet = smoothstep(0.48, 0.08, d);

    vec2 warpedP = (cell + g + 0.5) / chunks;
    vec2 delta = warpedP - p;

    float bend = (0.06 + 0.10 * u_prism) * (0.5 + seam * 0.75);
    return uv + delta * bend;
}

vec3 samplePrismatic(vec2 uv, vec2 p, float seam, float facet) {
    vec2 dir = safeNormalize(p + vec2(0.0001, 0.0));
    vec2 tangent = vec2(-dir.y, dir.x);

    float radius = length(p);

    float spread = u_prism * (0.004 + 0.032 * radius);
    spread *= 1.0 + seam * 1.4;

    vec2 offsetA = (dir + tangent * 0.45) * spread;
    vec2 offsetB = (dir * 0.35 + tangent * 1.25) * spread * 1.7;

    vec3 primary = vec3(
        texture(u_image, uv + offsetA).r,
        texture(u_image, uv).g,
        texture(u_image, uv - offsetA).b
    );

    vec3 ghost = vec3(
        texture(u_image, uv + offsetB).r,
        texture(u_image, uv + tangent * spread * 0.20).g,
        texture(u_image, uv - offsetB).b
    );

    vec3 chunky = mix(primary, ghost, clamp(0.25 + seam * 0.55, 0.0, 0.85));

    // little center lift, slight seam shimmer
    chunky *= 0.94 + facet * 0.12;
    chunky += seam * u_prism * 0.05;

    return chunky;
}


vec2 classicCoord(vec2 uv) {
    uv = afold(uv, u_mirrors);

    float r = length(uv);
    float a = atan(uv.y, uv.x);
    r = rfold(r, u_tube_length);
    uv = vec2(cos(a), sin(a)) * r;

    int iters_lo = int(floor(u_reflections));
    int iters_hi = int(ceil(u_reflections));
    float frac = fract(u_reflections);

    vec2 uv_lo = uv;
    vec2 uv_hi = uv;

    for (int i = 0; i < MAX_ITERATIONS; i++) {
        if (i >= iters_hi) break;

        uv_hi *= u_magnification;
        uv_hi  = afold(uv_hi, u_mirrors);
        uv_hi  = abs(uv_hi) - u_twist;

        if (i + 1 == iters_lo) {
            uv_lo = uv_hi;
        }
    }

    return mix(uv_lo, uv_hi, frac);
}


vec2 prismSpiralCoord(vec2 p) {
    float mirrors = max(abs(u_mirrors), 1.0);
    float tube = max(abs(u_tube_length), 0.001);

    vec2 q = rotate2(p, u_phase);

    float r = length(q);
    float a = atan(q.y, q.x);

    a += u_phase;
    a += log(1.0 + r * max(u_magnification, 0.0)) * u_warp;
    a += r * u_twist;

    float slice = PI / mirrors;
    a = mod(a, 2.0 * slice);
    a = abs(a - slice);

    r = rfold(r + u_phase * tube * 0.25, tube);
    q = vec2(cos(a), sin(a)) * r;

    int iters_lo = int(floor(u_reflections));
    int iters_hi = int(ceil(u_reflections));
    float frac = fract(u_reflections);

    vec2 q_lo = q;
    vec2 q_hi = q;

    for (int i = 0; i < MAX_ITERATIONS; i++) {
        if (i >= iters_hi) break;

        float k = float(i) + 1.0;

        float turn = u_phase * 0.35
                   + k * 0.23
                   + length(q_hi) * u_warp;

        q_hi = rotate2(q_hi * u_magnification, turn);

        q_hi = afold(
            q_hi + vec2(sin(k * 1.618), cos(k * 1.414)) * u_twist * 0.15,
            mirrors
        );

        q_hi = vec2(abs(q_hi.x), q_hi.y)
             - vec2(
                u_twist * 0.35,
                u_twist * (0.65 + 0.25 * sin(u_phase + k))
             );

        if (i + 1 == iters_lo) {
            q_lo = q_hi;
        }
    }

    return mix(q_lo, q_hi, frac);
}

vec2 cellularLensCoord(vec2 p, out float cellShade) {
    float tube = max(abs(u_tube_length), 0.03);
    float mirrors = max(abs(u_mirrors), 1.0);

    vec2 q = rotate2(p, u_phase) / tube;

    vec2 id;
    vec2 key;
    vec2 cell = hexCell(q, id, key);
    vec2 originalCell = cell;

    float seed = hash21(key + vec2(37.0, 113.0));
    seed = 0.001 + seed * 0.998;

    cell = rotate2(
        cell,
        (seed - 0.5) * 2.0 * PI + u_phase * (0.25 + seed)
    );

    float d = length(cell);

    // Local glass bulge. Center expands or contracts against the cell edge.
    float lens = 1.0 + u_warp * (0.45 - d) * 1.75;
    cell *= max(lens, 0.05);

    cell = afold(cell, mirrors);

    int iters_lo = int(floor(u_reflections));
    int iters_hi = int(ceil(u_reflections));
    float frac = fract(u_reflections);

    vec2 cell_lo = cell;
    vec2 cell_hi = cell;

    for (int i = 0; i < MAX_ITERATIONS; i++) {
        if (i >= iters_hi) break;

        float k = float(i) + 1.0;

        cell_hi *= u_magnification;

        cell_hi = abs(cell_hi)
                - vec2(
                    u_twist * (0.35 + seed * 0.35),
                    u_twist * (0.85 - seed * 0.25)
                );

        cell_hi = rotate2(
            cell_hi,
            (seed - 0.5) * 0.8 + u_phase * 0.15 + k * 0.04
        );

        cell_hi = afold(cell_hi, mirrors + seed * 2.0);

        if (i + 1 == iters_lo) {
            cell_lo = cell_hi;
        }
    }

    cell = mix(cell_lo, cell_hi, frac);

    // Edge darkening: makes the hex optics visible without replacing the blend.
    cellShade = mix(0.62, 1.0, hexMask(originalCell));

    return rotate2(id + cell, -u_phase) * tube;
}

void main() {
    vec2 baseUV = gl_FragCoord.xy / u_resolution;

    vec2 centeredUV =
        (gl_FragCoord.xy - u_resolution * 0.5)
        / min(u_resolution.x, u_resolution.y);

    vec3 inColor = texture(u_image, baseUV).rgb;
    vec3 kaleido;

#if MODE == MODE_CLASSIC

    vec2 uv = classicCoord(centeredUV);
    vec2 remappedUV = uv * 0.5 + 0.5;
    vec2 mixedUV = mix(baseUV, remappedUV, u_depth);

    kaleido = texture(u_image, mixedUV).rgb;

#elif MODE == MODE_PRISM

    vec2 uv = prismSpiralCoord(centeredUV);
    vec2 remappedUV = uv * 0.5 + 0.5;
    vec2 mixedUV = mix(baseUV, remappedUV, u_depth);

    float seam = 0.0;
    float facet = 0.0;

    vec2 glassUV = prismChunkyGlassCoord(mixedUV, uv, seam, facet);
    kaleido = samplePrismatic(glassUV, uv, seam, facet);

#elif MODE == MODE_CELLULAR

    float cellShade = 1.0;

    vec2 uv = cellularLensCoord(centeredUV, cellShade);
    vec2 remappedUV = uv * 0.5 + 0.5;
    vec2 mixedUV = mix(baseUV, remappedUV, u_depth);

    kaleido = texture(u_image, mixedUV).rgb;
    kaleido *= cellShade;

#else
#error invalid MODE
#endif

    outColor = vec4(
        blendWithColorSpace(inColor, kaleido, u_blendamount),
        1.0
    );
}