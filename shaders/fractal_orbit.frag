#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_depth;
uniform float u_zoom;
uniform float u_spin;
uniform vec2 u_center;

uniform vec2 u_juliaC;
uniform float u_escapeRadius;

uniform float u_orbitScale;
uniform float u_orbitSpin;
uniform float u_earlyOrbitBias;
uniform vec2 u_trapPoint;
uniform float u_trailDecay;

uniform float u_chromaGamma;
uniform float u_hueSpacing;
uniform float u_startHue;
uniform float u_hueBleed;

uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#ifndef ITERATIONS
#define ITERATIONS 48
#endif

#define FRACTAL_MANDELBROT 0
#define FRACTAL_JULIA 1
#ifndef FRACTAL_MODE
#define FRACTAL_MODE 1
#endif

#define TRACK_ORBIT_CENTROID 0
#define TRACK_ESCAPE_VECTOR 1
#define TRACK_TRAP_CLOSEST 2
#define TRACK_ORBIT_FOLLOW 3
#ifndef TRACK_MODE
#define TRACK_MODE 0
#endif

#define COLORING_NONE 0
#define COLORING_ESCAPE 1
#define COLORING_ANGLE 2
#define COLORING_TRAP 3
#ifndef COLORING_MODE
#define COLORING_MODE 0
#endif

#define WRAP_CARTESIAN 0
#define WRAP_POLAR 1
#ifndef WRAP_MODE
#define WRAP_MODE 0
#endif

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;

mat2 rot2(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

vec2 cSquare(vec2 z) {
    return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
}

// Compresses the infinite complex plane into a bounded disk.
// This keeps escaped orbits from blasting the UVs to nonsense while preserving direction.
vec2 boundedComplex(vec2 z) {
    float r = length(z);
    return z / (1.0 + r);
}

vec2 remapTrackToUV(vec2 track) {
#if WRAP_MODE == WRAP_CARTESIAN
    vec2 t = rot2(u_orbitSpin) * track;
    return fract(0.5 + t * u_orbitScale);

#elif WRAP_MODE == WRAP_POLAR
    vec2 t = rot2(u_orbitSpin) * track;

    float r = length(t);
    float a = atan(t.y, t.x);

    float scale = max(u_orbitScale, 0.0);

    // Smooth bounded radial fill. Since track is already bounded,
    // this mainly controls how much of the disk gets occupied.
    float s = 1.0 - exp(-2.0 * scale * r);

    // Spiral twist for more wrappiness
    float theta = a + 2.0 * scale * r;

    vec2 disk = s * vec2(cos(theta), sin(theta));

    // Map bounded disk into UV space.
    return 0.5 + 0.5 * disk;

#else
    #error invalid WRAP_MODE
#endif
}

vec2 screenToComplex(vec2 st) {
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = st - 0.5;
    p.x *= aspect;
    p = rot2(u_spin) * p;
    p /= max(u_zoom, 1e-4);
    return p + u_center;
}

struct trackResult {
    vec2 uv;
    vec2 finalZ;
    int escapedAt;
    float smoothIter;
    float trapDist;
};

float smoothEscapeValue(float iter, float r, float escapeRadius) {
    // Smooth iteration count. Safe enough for both Julia and Mandelbrot exteriors.
    float lr = max(log(max(r, 1.000001)), 1e-6);
    float le = max(log(max(escapeRadius, 2.000001)), 1e-6);
    return iter + 1.0 - log(lr / le) / log(2.0);
}

trackResult trackOrbit(vec2 p) {
    vec2 z;
    vec2 c;

#if FRACTAL_MODE == FRACTAL_MANDELBROT
    z = vec2(0.0);
    c = p;
#elif FRACTAL_MODE == FRACTAL_JULIA
    z = p;
    c = u_juliaC;
#else
    #error invalid FRACTAL_MODE
#endif

    float escapeRadius = max(u_escapeRadius, 2.0);
    float escape2 = escapeRadius * escapeRadius;

    vec2 accum = vec2(0.0);
    float totalWeight = 0.0;

    vec2 follow = boundedComplex(z);
    float trailDecay = clamp(u_trailDecay, 0.0, 0.9999);

    float bestTrap = 1e20;
    vec2 bestTrapZ = z;

    int escapedAt = ITERATIONS;
    float smoothIter = float(ITERATIONS);
    bool escaped = false;

    // These are the effective values we will actually use for output.
    // If escape happens, they get replaced by a fractional-at-escape version.
    vec2 sampleZ = z;
    vec2 sampleFollow = follow;
    vec2 sampleAccum = accum;
    float sampleWeight = totalWeight;

    // 0 = even orbit centroid, 1 = first few orbit points dominate.
    float decayBase = mix(1.0, 0.08, clamp(u_earlyOrbitBias, 0.0, 1.0));

    for (int i = 0; i < ITERATIONS; ++i) {
        vec2 prevZ = z;
        vec2 prevFollow = follow;
        vec2 prevAccum = accum;
        float prevTotalWeight = totalWeight;

        z = cSquare(z) + c;

        float r2 = dot(z, z);
        float r = sqrt(r2);
        vec2 boundedZ = boundedComplex(z);

        float w = pow(decayBase, float(i));

        follow = mix(boundedZ, prevFollow, trailDecay);
        accum = prevAccum + boundedZ * w;
        totalWeight = prevTotalWeight + w;

        float trap = dot(z - u_trapPoint, z - u_trapPoint);
        if (trap < bestTrap) {
            bestTrap = trap;
            bestTrapZ = z;
        }

        // Default to the fully updated state for this step.
        sampleZ = z;
        sampleFollow = follow;
        sampleAccum = accum;
        sampleWeight = totalWeight;

        if (!escaped && r2 > escape2) {
            escaped = true;
            escapedAt = i;
            smoothIter = smoothEscapeValue(float(i), r, escapeRadius);

            // Estimate a fractional orbit sample at the actual escape crossing.
            float prevR = max(length(prevZ), 1e-6);
            float currR = max(r, 1e-6);

            float logPrevR = log(prevR);
            float logCurrR = log(currR);
            float logEscapeR = log(escapeRadius);

            float denom = max(logCurrR - logPrevR, 1e-6);
            float a = clamp((logEscapeR - logPrevR) / denom, 0.0, 1.0);

            vec2 escapeZ = mix(prevZ, z, a);
            vec2 escapeBoundedZ = boundedComplex(escapeZ);

            // Rebuild the current-step derived trackers using the fractional sample
            // instead of the snapped integer-step sample.
            sampleZ = escapeZ;
            sampleFollow = mix(escapeBoundedZ, prevFollow, trailDecay);
            sampleAccum = prevAccum + escapeBoundedZ * w;
            sampleWeight = prevTotalWeight + w;

            break;
        }
    }

    vec2 track;

#if TRACK_MODE == TRACK_ORBIT_CENTROID
    track = sampleAccum / max(sampleWeight, 1e-6);
#elif TRACK_MODE == TRACK_ESCAPE_VECTOR
    track = boundedComplex(sampleZ);
#elif TRACK_MODE == TRACK_TRAP_CLOSEST
    track = boundedComplex(bestTrapZ - u_trapPoint);
#elif TRACK_MODE == TRACK_ORBIT_FOLLOW
    track = sampleFollow;
#else
    #error invalid TRACK_MODE
#endif

    trackResult result;
    result.uv = remapTrackToUV(track);
    result.finalZ = sampleZ;
    result.escapedAt = escapedAt;
    result.smoothIter = smoothIter;
    result.trapDist = sqrt(bestTrap);
    return result;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;
    vec2 p = screenToComplex(st);

    trackResult result = trackOrbit(p);

    vec2 uv = mix(st, result.uv, u_depth);
    uv = fract(uv);

    vec3 pix = texture(u_image, uv).rgb;
    vec3 original = texture(u_image, st).rgb;

#if COLORING_MODE == COLORING_NONE
    // do nothing
#elif COLORING_MODE == COLORING_ESCAPE
    float hue = result.smoothIter / float(ITERATIONS) * u_hueSpacing + u_startHue;
#elif COLORING_MODE == COLORING_ANGLE
    float hue = atan(result.finalZ.y, result.finalZ.x) / TAU + 0.5;
    hue = hue * u_hueSpacing + u_startHue;
#elif COLORING_MODE == COLORING_TRAP
    float hue = (1.0 - exp(-result.trapDist * 4.0)) * u_hueSpacing + u_startHue;
#else
    #error invalid COLORING_MODE
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
