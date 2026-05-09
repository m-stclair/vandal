#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

#define MAX_PALETTE_SIZE 128

layout(std140) uniform PaletteFeatures {
    // L, C, cosH, sinH
    vec4 paletteFeatures[MAX_PALETTE_SIZE];
};

layout(std140) uniform PaletteBlock {
    // L, a, b, _unused
    vec4 paletteColors[MAX_PALETTE_SIZE];
};

uniform int u_paletteSize;
uniform int u_cycleOffset;
uniform int u_blendK;
uniform float u_softness;
uniform float u_lumaWeight;
uniform float u_chromaWeight;
uniform float u_hueWeight;
uniform float u_blendAmount;
uniform float u_shadowCutoff;
uniform float u_highlightCutoff;
uniform float u_ditherAngle;
uniform float u_ditherLumaAmount;
uniform float u_ditherScale;


out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"


#define ASSIGN_NEAREST 0
#define ASSIGN_BLEND 1
#define ASSIGN_DITHER 2

#define OUTPUT_FULL_REPLACE 0
#define OUTPUT_PRESERVE_LUMA 1
#define OUTPUT_PRESERVE_CHROMA 2
#define OUTPUT_HUE_WASH 3
#define OUTPUT_SHADOW_HIGHLIGHT 4

#define CYCLE_GLOBAL 0
#define CYCLE_AXIS_THIRDS 1
#define CYCLE_AXIS_MIDDLE 2
#define CYCLE_AXIS_HIGH 3
#define CYCLE_AXIS_LOW 4

#ifndef CYCLE_MODE
#define CYCLE_MODE CYCLE_GLOBAL
#endif

#ifndef OUTPUT_MODE
#define OUTPUT_MODE OUTPUT_FULL_REPLACE
#endif

#define DITHER_ORDERED_2 0
#define DITHER_ORDERED_4 1
#define DITHER_ORDERED_8 2
#define DITHER_HASH      3
#define DITHER_LINES     4
#define DITHER_HALFTONE  5

#ifndef DITHER_PATTERN
#define DITHER_PATTERN DITHER_ORDERED_4
#endif

bool is_finite(float x) {
    return abs(x) < 1e20;
}

int positiveMod(int x, int m) {
    int r = x % m;
    return (r < 0) ? r + m : r;
}

mat2 rot2(float degrees) {
    float a = radians(degrees);
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Palette order (which may be luminance, hue clusters, tint/shade groups, etc.)
// is selected on the CPU. Non-global cycle modes treat array thirds
// as low/middle/high bands along that ordering axis.

int cyclePaletteIndex(int idx, int cycleOffset) {
    if (u_paletteSize <= 1) {
        return 0;
    }

#if (CYCLE_MODE != CYCLE_GLOBAL)
    int n = u_paletteSize;

    int lowEnd = n / 3;
    int highStart = (2 * n) / 3;

    #if CYCLE_MODE == CYCLE_AXIS_MIDDLE
        if (idx < lowEnd || idx >= highStart) {
            return idx;
        }
        int lo = lowEnd;
        int hi = highStart;
    #elif CYCLE_MODE == CYCLE_AXIS_HIGH
        if (idx < highStart) {
            return idx;
        }
        int lo = highStart;
        int hi = n;
    #elif CYCLE_MODE == CYCLE_AXIS_LOW
        if (idx >= lowEnd) {
            return idx;
        }
        int lo = 0;
        int hi = lowEnd;
    #else
        int lo = 0;
        int hi = n;

        if (idx < lowEnd) {
            // Low band
            lo = 0;
            hi = lowEnd;
        } else if (idx < highStart) {
            // Middle band
            lo = lowEnd;
            hi = highStart;
        } else {
            // High band
            lo = highStart;
            hi = n;
        }
    #endif

    int len = hi - lo;

    if (len <= 1) {
        return idx;
    }

    return lo + positiveMod((idx - lo) + cycleOffset, len);
#else
    return positiveMod(idx + cycleOffset, u_paletteSize);
#endif
}

float deltaE_bias_fast(float labL, float labC, vec2 labHue, vec4 q) {
    float L = q.x;
    float C = q.y;
    vec2 hue = q.zw;

    float dL = labL - L;
    float dC = labC - C;

    float theta = clamp(dot(labHue, hue), -1.0, 1.0);
    float hueBias = 0.5 * (labC + C) * (1.0 - theta);

    return (
        u_lumaWeight   * abs(dL) +
        u_chromaWeight * abs(dC) +
        u_hueWeight    * abs(hueBias)
    );
}

void insertTop5(
    float d,
    int idx,

    inout float d0,
    inout float d1,
    inout float d2,
    inout float d3,
    inout float d4,

    inout int i0,
    inout int i1,
    inout int i2,
    inout int i3,
    inout int i4
) {
    if (d >= d4) {
        return;
    }

    if (d < d0) {
        d4 = d3; i4 = i3;
        d3 = d2; i3 = i2;
        d2 = d1; i2 = i1;
        d1 = d0; i1 = i0;
        d0 = d;  i0 = idx;
    } else if (d < d1) {
        d4 = d3; i4 = i3;
        d3 = d2; i3 = i2;
        d2 = d1; i2 = i1;
        d1 = d;  i1 = idx;
    } else if (d < d2) {
        d4 = d3; i4 = i3;
        d3 = d2; i3 = i2;
        d2 = d;  i2 = idx;
    } else if (d < d3) {
        d4 = d3; i4 = i3;
        d3 = d;  i3 = idx;
    } else {
        d4 = d;  i4 = idx;
    }
}

vec3 softAssign(vec3 labColor, int cycleOffset) {
    if (u_paletteSize <= 0) {
        return labColor;
    }

    float labC = length(labColor.yz);
    vec2 labHue = (labC > 1e-6) ? labColor.yz / labC : vec2(1.0, 0.0);

    float d0 = 1e20;
    float d1 = 1e20;
    float d2 = 1e20;
    float d3 = 1e20;
    float d4 = 1e20;

    int i0 = 0;
    int i1 = 0;
    int i2 = 0;
    int i3 = 0;
    int i4 = 0;

    for (int i = 0; i < MAX_PALETTE_SIZE; ++i) {
        if (i >= u_paletteSize) break;

        float d = deltaE_bias_fast(
            labColor.x,
            labC,
            labHue,
            paletteFeatures[i]
        );

        insertTop5(
            d,
            i,
            d0, d1, d2, d3, d4,
            i0, i1, i2, i3, i4
        );
    }

    int k = min(min(max(u_blendK, 1), u_paletteSize), 5);

    vec3 result = vec3(0.0);
    float totalWeight = 0.0;

    if (k >= 1) {
        float w = 1.0 / pow(d0 + 1e-5, u_softness);
        result += w * paletteColors[cyclePaletteIndex(i0, cycleOffset)].rgb;
        totalWeight += w;
    }

    if (k >= 2) {
        float w = 1.0 / pow(d1 + 1e-5, u_softness);
        result += w * paletteColors[cyclePaletteIndex(i1, cycleOffset)].rgb;
        totalWeight += w;
    }

    if (k >= 3) {
        float w = 1.0 / pow(d2 + 1e-5, u_softness);
        result += w * paletteColors[cyclePaletteIndex(i2, cycleOffset)].rgb;
        totalWeight += w;
    }

    if (k >= 4) {
        float w = 1.0 / pow(d3 + 1e-5, u_softness);
        result += w * paletteColors[cyclePaletteIndex(i3, cycleOffset)].rgb;
        totalWeight += w;
    }

    if (k >= 5) {
        float w = 1.0 / pow(d4 + 1e-5, u_softness);
        result += w * paletteColors[cyclePaletteIndex(i4, cycleOffset)].rgb;
        totalWeight += w;
    }

    return result / max(totalWeight, 1e-5);
}

vec3 matchNearest(vec3 lab, int cycleOffset) {
    if (u_paletteSize <= 0) {
        return lab;
    }

    float labC = length(lab.yz);
    vec2 labHue = (labC > 1e-6) ? lab.yz / labC : vec2(1.0, 0.0);

    float minDist = 1e20;
    int best_i = 0;

    for (int i = 0; i < MAX_PALETTE_SIZE; ++i) {
        if (i >= u_paletteSize) break;

        float d = deltaE_bias_fast(
            lab.x,
            labC,
            labHue,
            paletteFeatures[i]
        );

        if (d < minDist) {
            minDist = d;
            best_i = i;
        }
    }

    return paletteColors[cyclePaletteIndex(best_i, cycleOffset)].rgb;
}

float orderedDither8x8(vec2 fragCoord, float scale) {
    vec2 cell = floor(fragCoord / max(scale, 1.0));
    int x = int(mod(cell.x, 8.0));
    int y = int(mod(cell.y, 8.0));
    int index = y * 8 + x;

    float thresholds[64] = float[](
         0.0/64.0, 32.0/64.0,  8.0/64.0, 40.0/64.0,  2.0/64.0, 34.0/64.0, 10.0/64.0, 42.0/64.0,
        48.0/64.0, 16.0/64.0, 56.0/64.0, 24.0/64.0, 50.0/64.0, 18.0/64.0, 58.0/64.0, 26.0/64.0,
        12.0/64.0, 44.0/64.0,  4.0/64.0, 36.0/64.0, 14.0/64.0, 46.0/64.0,  6.0/64.0, 38.0/64.0,
        60.0/64.0, 28.0/64.0, 52.0/64.0, 20.0/64.0, 62.0/64.0, 30.0/64.0, 54.0/64.0, 22.0/64.0,
         3.0/64.0, 35.0/64.0, 11.0/64.0, 43.0/64.0,  1.0/64.0, 33.0/64.0,  9.0/64.0, 41.0/64.0,
        51.0/64.0, 19.0/64.0, 59.0/64.0, 27.0/64.0, 49.0/64.0, 17.0/64.0, 57.0/64.0, 25.0/64.0,
        15.0/64.0, 47.0/64.0,  7.0/64.0, 39.0/64.0, 13.0/64.0, 45.0/64.0,  5.0/64.0, 37.0/64.0,
        63.0/64.0, 31.0/64.0, 55.0/64.0, 23.0/64.0, 61.0/64.0, 29.0/64.0, 53.0/64.0, 21.0/64.0
    );

    return thresholds[index];
}

float orderedDither4x4(vec2 fragCoord, float scale) {
    vec2 cell = floor(fragCoord / max(scale, 1.0));
    int x = int(mod(cell.x, 4.0));
    int y = int(mod(cell.y, 4.0));
    int index = y * 4 + x;
    float thresholds[16] = float[](
        0.0,  0.5,    0.125,  0.625,
        0.75, 0.25,   0.875,  0.375,
        0.1875, 0.6875, 0.0625, 0.5625,
        0.9375, 0.4375, 0.8125, 0.3125
    );
    return thresholds[index];
}

float orderedDither2x2(vec2 fragCoord, float scale) {
    vec2 cell = floor(fragCoord / max(scale, 1.0));
    int x = int(mod(cell.x, 2.0));
    int y = int(mod(cell.y, 2.0));
    int index = y * 2 + x;

    float thresholds[4] = float[](
        0.0, 0.5,
        0.75, 0.25
    );

    return thresholds[index];
}

float hashDither(vec2 fragCoord, float scale) {
    vec2 cell = floor(fragCoord / max(scale, 1.0));
    return hash12(cell);
}

float lineDither(vec2 fragCoord, float scale, float angle) {
    vec2 pivot = 0.5 * u_resolution;
    vec2 p = rot2(angle) * (fragCoord - pivot);

    float period = max(scale, 1.0) * 4.0;
    float phase = fract(p.y / period);

    // triangle wave: 0 at stripe center, 1 at gap center
    return abs(phase - 0.5) * 2.0;
}

float halftoneDither(vec2 fragCoord, float scale, float angle) {
    vec2 pivot = 0.5 * u_resolution;
    vec2 p = rot2(angle) * (fragCoord - pivot);

    float cellSize = max(scale, 1.0) * 6.0;
    vec2 cell = floor(p / cellSize);
    vec2 local = p - (cell + 0.5) * cellSize;

    float maxR = 0.5 * cellSize;
    float r = length(local) / max(maxR, 1e-5);

    // 0 in dot center, 1 outside/near corners.
    return clamp(r, 0.0, 1.0);
}

float applyLumaDitherFalloff(float chooseSecond, float labL) {
    float luma01 = clamp(labL / 100.0, 0.0, 1.0);

    // 0 at black/white, 1 in midtones.
    float midtone = 1.0 - abs(luma01 * 2.0 - 1.0);

    float scale = mix(1.0, midtone, clamp(u_ditherLumaAmount, 0.0, 1.0));
    return chooseSecond * scale;
}

float ditherThreshold(vec2 fragCoord, float scale) {
#if DITHER_PATTERN == DITHER_ORDERED_2
    return orderedDither2x2(fragCoord, scale);
#elif DITHER_PATTERN == DITHER_ORDERED_8
    return orderedDither8x8(fragCoord, scale);
#elif DITHER_PATTERN == DITHER_HASH
    return hashDither(fragCoord, scale);
#elif DITHER_PATTERN == DITHER_LINES
    return lineDither(fragCoord, scale, u_ditherAngle);
#elif DITHER_PATTERN == DITHER_HALFTONE
    return halftoneDither(fragCoord, scale, u_ditherAngle);
#else
    return orderedDither4x4(fragCoord, scale);
#endif
}

vec3 ditherAssign(vec3 lab, int cycleOffset) {
    if (u_paletteSize <= 0) {
        return lab;
    }

    float labC = length(lab.yz);
    vec2 labHue = (labC > 1e-6) ? lab.yz / labC : vec2(1.0, 0.0);

    float bestDist = 1e20;
    float secondDist = 1e20;

    int bestIndex = 0;
    int secondIndex = 0;

    for (int i = 0; i < MAX_PALETTE_SIZE; ++i) {
        if (i >= u_paletteSize) break;

        float d = deltaE_bias_fast(
            lab.x,
            labC,
            labHue,
            paletteFeatures[i]
        );

        if (d < bestDist) {
            secondDist = bestDist;
            secondIndex = bestIndex;

            bestDist = d;
            bestIndex = i;
        } else if (d < secondDist) {
            secondDist = d;
            secondIndex = i;
        }
    }

    if (u_paletteSize <= 1 || u_blendK <= 1) {
        return paletteColors[cyclePaletteIndex(bestIndex, cycleOffset)].rgb;
    }

    float bestWeight = 1.0 / pow(bestDist + 1e-5, u_softness);
    float secondWeight = 1.0 / pow(secondDist + 1e-5, u_softness);

    float chooseSecond = secondWeight / max(bestWeight + secondWeight, 1e-5);
    chooseSecond = applyLumaDitherFalloff(chooseSecond, lab.x);

    float threshold = ditherThreshold(gl_FragCoord.xy, u_ditherScale);

    int chosenIndex = bestIndex;

    if (chooseSecond >= 0.0625 && threshold < chooseSecond) {
        chosenIndex = secondIndex;
    }

    return paletteColors[cyclePaletteIndex(chosenIndex, cycleOffset)].rgb;
}

vec2 safeHueUnit(vec2 ab, vec2 fallback) {
    float c = length(ab);
    return c > 1e-6 ? ab / c : fallback;
}

vec3 applyOutputMode(vec3 sourceLab, vec3 paletteLab) {
#if OUTPUT_MODE == OUTPUT_PRESERVE_LUMA
    return vec3(sourceLab.x, paletteLab.yz);
#elif OUTPUT_MODE == OUTPUT_PRESERVE_CHROMA
    float sourceChroma = length(sourceLab.yz);
    vec2 sourceHue = safeHueUnit(sourceLab.yz, vec2(1.0, 0.0));
    vec2 paletteHue = safeHueUnit(paletteLab.yz, sourceHue);
    return vec3(paletteLab.x, paletteHue * sourceChroma);
#elif OUTPUT_MODE == OUTPUT_HUE_WASH
    float sourceChroma = length(sourceLab.yz);
    vec2 sourceHue = safeHueUnit(sourceLab.yz, vec2(1.0, 0.0));
    vec2 paletteHue = safeHueUnit(paletteLab.yz, sourceHue);
    return vec3(sourceLab.x, paletteHue * sourceChroma);
#elif OUTPUT_MODE == OUTPUT_SHADOW_HIGHLIGHT
    float lo = min(u_shadowCutoff, u_highlightCutoff);
    float hi = max(u_shadowCutoff, u_highlightCutoff);
    float inBand = max(step(sourceLab.x, lo), step(hi, sourceLab.x));
    return mix(sourceLab, paletteLab, inBand);
#else
    return paletteLab;
#endif
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

#if SHOW_PALETTE != 0
    int idx = int(round(uv.x * float(u_paletteSize - 1)));
    idx = clamp(idx, 0, u_paletteSize - 1);

    vec4 pcolor = paletteColors[cyclePaletteIndex(idx, u_cycleOffset)];

    if (uv.y < 0.1) {
        outColor = vec4(linear2srgb(lab2rgb(pcolor.rgb)), 1.0);
        return;
    }
#endif

    vec3 color = texture(u_image, uv).rgb;
    vec3 lab = rgb2lab(srgb2linear(color));

#if ASSIGNMODE == ASSIGN_BLEND
    vec3 labMapped = softAssign(lab, u_cycleOffset);
#elif ASSIGNMODE == ASSIGN_DITHER
    vec3 labMapped = ditherAssign(lab, u_cycleOffset);
#else
    vec3 labMapped = matchNearest(lab, u_cycleOffset);
#endif

    labMapped = applyOutputMode(lab, labMapped);

    vec3 srgbOut = linear2srgb(lab2rgb(labMapped));
    srgbOut = clamp(srgbOut, 0.0, 1.0);

    outColor = vec4(
        blendWithColorSpace(color, srgbOut, u_blendAmount),
        1.0
    );
}
