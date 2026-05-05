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

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"


#define ASSIGN_NEAREST 0
#define ASSIGN_BLEND 1

#define CYCLE_GLOBAL 0
#define CYCLE_AXIS_THIRDS 1
#define CYCLE_AXIS_MIDDLE 2
#define CYCLE_AXIS_HIGH 3
#define CYCLE_AXIS_LOW 4

#ifndef CYCLE_MODE
#define CYCLE_MODE CYCLE_GLOBAL
#endif


bool is_finite(float x) {
    return abs(x) < 1e20;
}

int positiveMod(int x, int m) {
    int r = x % m;
    return (r < 0) ? r + m : r;
}

// Palette order is selected on the CPU. Non-global cycle modes treat array thirds
// as low/middle/high bands along that active ordering axis.

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

float deltaE_bias_fast(vec3 lab, vec4 q) {
    float L = q[0];
    float C = q[1];
    float cosH = q[2];
    float sinH = q[3];

    float dL = lab.x - L;

    float C1 = length(lab.yz);
    float dC = C1 - C;

    vec2 u = (C1 > 1e-6) ? lab.yz / C1 : vec2(1.0, 0.0);

    float theta = clamp(dot(u, vec2(cosH, sinH)), -1.0, 1.0);
    float hueBias = 0.5 * (C1 + C) * (1.0 - theta);

    return (
        u_lumaWeight   * abs(dL) +
        u_chromaWeight * abs(dC) +
        u_hueWeight    * abs(hueBias)
    );
}

vec3 softAssign(vec3 labColor, int cycleOffset) {
    float dist[MAX_PALETTE_SIZE];
    int index[MAX_PALETTE_SIZE];

    for (int i = 0; i < MAX_PALETTE_SIZE; ++i) {
        if (i >= u_paletteSize) break;

        dist[i] = deltaE_bias_fast(labColor, paletteFeatures[i]);
        index[i] = i;
    }

    int k = min(u_blendK, u_paletteSize);

    // Partial bubble sort top K
    for (int i = 0; i < MAX_PALETTE_SIZE; ++i) {
        if (i >= k) break;

        for (int j = i + 1; j < MAX_PALETTE_SIZE; ++j) {
            if (j >= u_paletteSize) break;

            if (dist[j] < dist[i]) {
                float td = dist[i];
                dist[i] = dist[j];
                dist[j] = td;

                int ti = index[i];
                index[i] = index[j];
                index[j] = ti;
            }
        }
    }

    // Blend top K.
    //
    // Important bit:
    // each chosen source index cycles inside its own block.
    // So a shadow match stays a shadow. Midtone stays midtone. Highlight stays highlight.
    vec3 result = vec3(0.0);
    float totalWeight = 0.0;

    for (int i = 0; i < MAX_PALETTE_SIZE; ++i) {
        if (i >= k) break;

        float w = 1.0 / pow(dist[i] + 1e-5, u_softness);
        int cycledIndex = cyclePaletteIndex(index[i], cycleOffset);

        result += w * paletteColors[cycledIndex].rgb;
        totalWeight += w;
    }

    return result / totalWeight;
}

vec3 matchNearest(vec3 lab, int cycleOffset) {
    float minDist = 1e6;
    int best_i = 0;

    for (int i = 0; i < MAX_PALETTE_SIZE; i++) {
        if (i >= u_paletteSize) break;

        float d = deltaE_bias_fast(lab, paletteFeatures[i]);

        if (d < minDist) {
            minDist = d;
            best_i = i;
        }
    }

    return paletteColors[cyclePaletteIndex(best_i, cycleOffset)].rgb;
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
#else
    vec3 labMapped = matchNearest(lab, u_cycleOffset);
#endif

    vec3 srgbOut = linear2srgb(lab2rgb(labMapped));
    srgbOut = clamp(srgbOut, 0.0, 1.0);

    outColor = vec4(
        blendWithColorSpace(color, srgbOut, u_blendAmount),
        1.0
    );
}