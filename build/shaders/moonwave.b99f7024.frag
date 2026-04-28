#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_shiftNorm;
uniform float u_spreadNorm;
uniform float u_threshold;
uniform float u_bleed;
uniform float u_satNorm;
uniform float u_lightNorm;
uniform float u_blendamount;
uniform float u_facetSteps;
uniform float u_softness;
uniform float u_refraction;
uniform vec2 u_origin;
uniform float u_baseHue;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"\

const float TAU = 6.28318530718;

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float facetCount() {
    return max(floor(u_facetSteps + 1.0), 1.0);
}

float quantizeFacet(float v) {
    float count = facetCount();
    return floor(clamp(v, 0.0, 0.999999) * count) / max(count - 1.0, 1.0);
}

float facetShape(float signal, vec2 p) {
    float spread = max(u_spreadNorm, 1e-5);
    float softness = clamp(u_softness, 0.01, 1.0);
    float phase = fract(signal * spread + u_shiftNorm);

#if FACETTYPE == 0
    // Glass: a wide translucent shelf with feathered seams.
    float edge = mix(0.02, 0.34, softness);
    return smoothstep(0.0, edge, phase) * (1.0 - smoothstep(1.0 - edge, 1.0, phase));
#elif FACETTYPE == 1
    // Fold: a clean triangular crease, less rainbow, more folded acetate.
    float ridge = 1.0 - abs(phase * 2.0 - 1.0);
    return pow(clamp(ridge, 0.0, 1.0), mix(3.2, 0.75, softness));
#elif FACETTYPE == 2
    // Ripple: interference rings with an internal wobble.
    float wobble = 0.085 * sin(TAU * phase * 3.0 + p.x * 2.0 - p.y * 1.5);
    return 0.5 + 0.5 * cos(TAU * (phase + wobble));
#elif FACETTYPE == 3
    // Cell: cracked-glass cells. Same modulation family, different handwriting.
    float scale = 5.0 + spread * 6.0;
    vec2 gp = (p + vec2(1.0)) * scale;
    vec2 id = floor(gp);
    vec2 f = fract(gp) - 0.5;
    float jitter = hash21(id) * 0.18;
    float cell = length(f + vec2(hash21(id + 3.1), hash21(id + 7.7)) * 0.16 - 0.08);
    float seam = smoothstep(mix(0.16, 0.38, softness), 0.52, cell + jitter);
    float pulse = 0.5 + 0.5 * sin(TAU * (phase + hash21(id)));
    return clamp(mix(seam, pulse, 0.28), 0.0, 1.0);
#else
    #error invalid facet type
#endif
}

vec3 paletteHSV(float tone, float baseHue) {
    float base = fract(baseHue);
    float t = clamp(tone, 0.0, 1.0);

#if PALETTE_MODE == 0
    // Opal: narrow pastel drift, pearly rather than chromatic.
    float h = base + mix(-0.070, 0.105, t) + 0.018 * sin(TAU * t * 2.0);
    return vec3(fract(h), mix(0.48, 0.82, t), mix(1.08, 0.92, t));
#elif PALETTE_MODE == 1
    // Mineral: cyan, jade, violet pressure points.
    float h = base + mix(-0.16, 0.20, t);
    h += (t > 0.72) ? 0.12 : 0.0;
    return vec3(fract(h), mix(0.62, 1.08, t), mix(0.82, 1.02, t));
#elif PALETTE_MODE == 2
    // Bruise: mauve/green interference. A little ugly on purpose.
    float h = base + mix(0.30, -0.18, t);
    h += 0.055 * sin(TAU * t * 4.0);
    return vec3(fract(h), mix(0.52, 0.96, t), mix(0.70, 1.00, t));
#elif PALETTE_MODE == 3
    // Ember: warm veil with cold spectral flashes.
    float h = mix(base - 0.055, base + 0.080, t);
    h = (t > 0.82) ? base + 0.52 : h;
    return vec3(fract(h), mix(0.72, 1.10, t), mix(0.74, 1.06, t));
#else
    #error invalid palette mode
#endif
}

float spatialField(vec2 frag, vec2 p) {
    vec2 delta = frag - u_origin;
    vec2 n = delta / max(min(u_resolution.x, u_resolution.y), 1.0);

#if SPATIAL_PATTERN == 0
    // radial
    return length(n);
#elif SPATIAL_PATTERN == 1
    // horizontal
    return n.x;
#elif SPATIAL_PATTERN == 2
    // vertical
    return n.y;
#elif SPATIAL_PATTERN == 3
    // diagonal
    return dot(n, normalize(vec2(0.92, 0.38)));
#elif SPATIAL_PATTERN == 4
    // folded mirror field
    vec2 q = abs(n) - vec2(0.18, 0.08);
    return length(q) + 0.18 * sin((n.x - n.y) * 7.0);
#elif SPATIAL_PATTERN == 5
    // vortex
    float a = atan(n.y, n.x) / TAU;
    return a + length(n) * 0.72;
#elif SPATIAL_PATTERN == 6
    // loose lattice / moire
    return 0.30 * sin(p.x * 7.0) + 0.34 * sin(p.y * 9.0) + 0.20 * sin((p.x + p.y) * 13.0);
#else
    #error invalid spatial pattern
#endif
}

vec3 refractSource(vec2 uv, float tone) {
    vec2 dir = vec2(cos(TAU * (tone + u_shiftNorm)), sin(TAU * (tone + u_shiftNorm)));
    vec2 px = dir * u_refraction * 0.015;
    vec2 uvR = clamp(uv + px, vec2(0.0), vec2(1.0));
    vec2 uvB = clamp(uv - px, vec2(0.0), vec2(1.0));

    return vec3(
        texture(u_image, uvR).r,
        texture(u_image, uv).g,
        texture(u_image, uvB).b
    );
}

vec4 prismveil(vec2 uv) {
    vec3 srgb = texture(u_image, uv).rgb;
    float luma = luminance(srgb2linear(srgb));

#if PRISMVEIL_CYCLE == 0
    vec3 inHSV = rgb2hsv(srgb);
#elif PRISMVEIL_BLEED == 1
    vec3 inHSV = rgb2hsv(srgb);
#endif

    vec2 frag = gl_FragCoord.xy;
    vec2 p = (frag - 0.5 * u_resolution) / max(min(u_resolution.x, u_resolution.y), 1.0);

#if PRISMVEIL_CYCLE == 0
    float signal = inHSV.x + luma * 0.18;
#elif PRISMVEIL_CYCLE == 1
    float threshold = clamp(u_threshold, 0.0, 0.99);
    float signal = clamp((luma - threshold) / (1.0 - threshold), 0.0, 1.0);
#else
    float signal = spatialField(frag, p);
#endif

    float tone = clamp(facetShape(signal, p), 0.0, 1.0);

#if USE_FACET_STEPS == 1
    tone = quantizeFacet(tone);
#endif

    vec3 pal = paletteHSV(tone, u_baseHue);
    float sat = clamp(u_satNorm * pal.y, 0.0, 1.0);
    float val = clamp(u_lightNorm * pal.z + tone * 0.10 - 0.035, 0.0, 1.0);
    float hue = pal.x;

#if PRISMVEIL_BLEED == 1
    hue = mix(hue, inHSV.x, clamp(u_bleed, 0.0, 1.0));
#endif

    vec3 fx = hsv2rgb(vec3(hue, sat, val));

#if PRISMVEIL_REFRACT == 1
    vec3 prismSrc = refractSource(uv, tone);
    fx = mix(fx, prismSrc, clamp(u_refraction * 0.24, 0.0, 0.28));
#endif

    float feather = mix(0.01, 0.30, clamp(u_softness, 0.01, 1.0));
    float gate = smoothstep(u_threshold, min(1.0, u_threshold + feather), luma);
    fx = mix(srgb, fx, gate);
    return vec4(blendWithColorSpace(srgb, fx, u_blendamount), 1.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    outColor = clamp(prismveil(uv), 0.0, 1.0);
}
