#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_cellsize;
uniform float u_blendamount;

uniform float u_ink1Angle;
uniform float u_ink2Angle;
uniform float u_ink3Angle;

uniform float u_ink1Offset;
uniform float u_ink2Offset;
uniform float u_ink3Offset;

uniform float u_grainAmount;
uniform float u_paperAmount;
uniform float u_inkCoverage;
uniform float u_edgeBleed;
uniform float u_plateWobble;
uniform float u_posterizeLevels;

out vec4 outColor;

#define RISOGRAPH_DUOTONE 0
#define RISOGRAPH_TRITONE 1

#ifndef RISOGRAPH_MODE
#define RISOGRAPH_MODE 0
#endif

#define RISO_FLUORO      0
#define RISO_SUNBURN     1
#define RISO_SEAWEED     2
#define RISO_DIRTY_ZINE  3

#ifndef RISO_PALETTE
#define RISO_PALETTE 0
#endif

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise2(p);
        p *= 2.07;
        a *= 0.5;
    }
    return v;
}

float lumaFromRgb(vec3 rgb) {
    return srgb2NormLab(clamp(rgb, 0.0, 1.0)).x;
}

void risoPalette(out vec3 paper, out vec3 ink1, out vec3 ink2, out vec3 ink3) {
#if RISO_PALETTE == RISO_SUNBURN
    paper = vec3(0.985, 0.930, 0.780);
    ink1 = vec3(0.080, 0.105, 0.650); // bruised blue
    ink2 = vec3(1.000, 0.265, 0.055); // hot orange
    ink3 = vec3(0.970, 0.035, 0.285); // fluorescent red-pink
#elif RISO_PALETTE == RISO_SEAWEED
    paper = vec3(0.940, 0.950, 0.835);
    ink1 = vec3(0.055, 0.250, 0.170); // deep green
    ink2 = vec3(0.090, 0.625, 0.590); // teal
    ink3 = vec3(0.700, 0.125, 0.820); // purple pop
#elif RISO_PALETTE == RISO_DIRTY_ZINE
    paper = vec3(0.930, 0.900, 0.790);
    ink1 = vec3(0.055, 0.050, 0.060); // soft black
    ink2 = vec3(0.820, 0.060, 0.155); // cheap red
    ink3 = vec3(0.080, 0.250, 0.720); // copier blue
#else
    paper = vec3(0.985, 0.945, 0.835);
    ink1 = vec3(0.045, 0.105, 0.790); // electric blue
    ink2 = vec3(1.000, 0.055, 0.470); // fluoro pink
    ink3 = vec3(0.990, 0.770, 0.045); // yellow
#endif
}

vec2 plateOffset(float offsetPx, float seed) {
    // same slider, different plate direction. the press is not politely aligned.
    float a = seed * 2.399963;
    return vec2(cos(a), sin(a)) * offsetPx;
}

vec2 risoCellData(
    vec2 frag,
    float angle,
    float cellSize,
    vec2 offsetPx,
    float seed,
    out vec2 cellCenterUV,
    out vec2 cellId
) {
    vec2 pivot = 0.5 * u_resolution;
    float safeCellSize = max(cellSize, 1e-4);

    vec2 slowWobble = vec2(
        fbm(frag * 0.010 + seed * 13.1),
        fbm(frag * 0.012 - seed * 9.7)
    ) - 0.5;

    vec2 plateFrag = frag - offsetPx + slowWobble * u_plateWobble * safeCellSize;

    mat2 R = rot(angle);
    mat2 invR = rot(-angle);

    vec2 halftoneCoord = R * (plateFrag - pivot);
    cellId = floor(halftoneCoord / safeCellSize);

    vec2 jitter = vec2(
        hash21(cellId + seed * 19.11),
        hash21(cellId + seed * 31.73)
    ) - 0.5;
    jitter *= u_plateWobble * 0.38 * safeCellSize;

    vec2 local = halftoneCoord - (cellId + 0.5) * safeCellSize - jitter;
    vec2 cellCenterHalftoneCoord = (cellId + 0.5) * safeCellSize + jitter;
    vec2 cellCenterFrag = invR * cellCenterHalftoneCoord + pivot + offsetPx;

    cellCenterUV = clamp(cellCenterFrag / u_resolution, vec2(0.0), vec2(1.0));
    return local;
}

float posterizeInk(float ink, vec2 cellId, float seed) {
    float levels = max(u_posterizeLevels, 2.0);
    float dither = hash21(cellId + seed * 71.0) - 0.5;
    return clamp(floor(clamp(ink, 0.0, 1.0) * levels + 0.55 + dither * 0.75) / levels, 0.0, 1.0);
}

float roughDotMask(vec2 frag, vec2 local, vec2 cellId, float cellSize, float ink, float seed) {
    float safeCellSize = max(cellSize, 1e-4);
    float maxR = 0.5 * safeCellSize * 0.98;

    float cellRough = mix(0.88, 1.16, hash21(cellId + seed * 41.3));
    float edgeRough = fbm(local * 0.34 + seed * 5.0) - 0.5;
    float r = clamp(ink, 0.0, 1.0) * maxR * cellRough;
    r += edgeRough * u_edgeBleed * 0.17 * safeCellSize;

    float dist = length(local);
    float aa = max(fwidth(dist), 1e-4) + u_edgeBleed * 0.015 * safeCellSize;
    float mask = 1.0 - smoothstep(r - aa, r + aa, dist);

    float tooth = mix(1.0, 0.58 + 0.42 * fbm(frag * 0.95 + seed * 101.0), u_grainAmount);
    float pinholes = smoothstep(0.02, 0.98, fbm(frag * 2.25 + seed * 47.0));
    mask *= mix(1.0, tooth * mix(0.86, 1.0, pinholes), u_grainAmount);

    return clamp(mask, 0.0, 1.0);
}

float sampleRisoPlate(vec2 frag, float angle, float offsetPx, float seed, int plateIndex) {
    vec2 cellCenterUV;
    vec2 cellId;
    vec2 local = risoCellData(
        frag,
        angle,
        u_cellsize,
        plateOffset(offsetPx, seed),
        seed,
        cellCenterUV,
        cellId
    );

    vec3 centerColor = texture(u_image, cellCenterUV).rgb;
    float luma = lumaFromRgb(centerColor);
    float chroma = max(max(centerColor.r, centerColor.g), centerColor.b) - min(min(centerColor.r, centerColor.g), centerColor.b);

    float ink = 0.0;

#if RISOGRAPH_MODE == RISOGRAPH_TRITONE
    if (plateIndex == 0) {
        // shadow plate, with a little cool-channel appetite
        ink = (1.0 - smoothstep(0.18, 0.92, luma)) * 1.10 + max(centerColor.b - centerColor.r, 0.0) * 0.28;
    } else if (plateIndex == 1) {
        // middle plate, the loud one
        ink = (1.0 - abs(luma - 0.55) * 1.75) * 0.88 + chroma * 0.22 + centerColor.r * 0.12;
    } else {
        // highlight/tint plate, useful for that glowing cheap-paper overprint
        ink = smoothstep(0.30, 0.96, luma) * 0.62 + max(centerColor.g - centerColor.b, 0.0) * 0.25;
    }
#else
    if (plateIndex == 0) {
        // dark structural plate
        ink = (1.0 - smoothstep(0.16, 0.95, luma)) * 1.12 + max(centerColor.b - centerColor.r, 0.0) * 0.20;
    } else {
        // accent plate, lives in mids and color, not shadows
        float mids = 1.0 - smoothstep(0.62, 0.98, abs(luma - 0.52) * 1.7);
        ink = mids * 0.78 + chroma * 0.36 + centerColor.r * 0.10;
    }
#endif

    ink = posterizeInk(ink, cellId, seed);
    return roughDotMask(frag, local, cellId, u_cellsize, ink, seed);
}

vec3 overprint(vec3 base, vec3 inkColor, float amount) {
    amount = clamp(amount * u_inkCoverage, 0.0, 1.5);
    vec3 translucent = base * inkColor;
    vec3 pigment = mix(translucent, inkColor, 0.18);
    return mix(base, pigment, amount);
}

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = frag / u_resolution;
    vec3 inColor = texture(u_image, uv).rgb;

    vec3 paper;
    vec3 ink1;
    vec3 ink2;
    vec3 ink3;
    risoPalette(paper, ink1, ink2, ink3);

    float paperFiber = fbm(frag * 0.72) * 0.55 + fbm(frag * vec2(0.095, 0.43)) * 0.45;
    vec3 risoResult = paper - (paperFiber - 0.5) * u_paperAmount * 0.11;

    float plate1 = sampleRisoPlate(frag, u_ink1Angle, u_ink1Offset, 1.0, 0);
    float plate2 = sampleRisoPlate(frag, u_ink2Angle, u_ink2Offset, 2.0, 1);
    risoResult = overprint(risoResult, ink1, plate1);
    risoResult = overprint(risoResult, ink2, plate2);

    #if RISOGRAPH_MODE == RISOGRAPH_TRITONE
    float plate3 = sampleRisoPlate(frag, u_ink3Angle, u_ink3Offset, 3.0, 2);
    risoResult = overprint(risoResult, ink3, plate3);
    #endif

    // last little dirty veil so pure whites do not feel digital-clean.
    float speckle = hash21(floor(frag * 1.37));
    risoResult -= smoothstep(0.992, 1.0, speckle) * u_grainAmount * 0.055;

    vec3 blended = blendWithColorSpace(inColor, clamp(risoResult, 0.0, 1.0), u_blendamount);
    outColor = vec4(clamp(blended, 0.0, 1.0), 1.0);
}
