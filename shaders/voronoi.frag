#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_cellCount;   // cells along the shorter axis
uniform float u_jitter;      // 0 = regular grid, 1 = fully randomized
uniform float u_edgeWidth;   // 0–1 relative edge thickness
uniform float u_edgeOpacity; // 0 = no edges, 1 = opaque edges
uniform vec3 u_edgeColor;
uniform float u_seed;        // shifts the hash, enables cell reshuffling
uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

// --- hash -----------------------------------------------------------
// Two-channel hash for seed jitter. u_seed shifts the pattern.
vec2 hash2(vec2 p) {
    p += u_seed * 17.31;
    p = vec2(dot(p, vec2(127.1, 311.7)),
             dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
}

// --------------------------------------------------------------------

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    // Work in aspect-corrected cell space so cells appear square.
    // X spans [0, aspect * cellCount], Y spans [0, cellCount].
    vec2 scaledUV = uv * vec2(aspect, 1.0) * u_cellCount;
    vec2 cellID   = floor(scaledUV);

    float minDist1 = 1e9;
    float minDist2 = 1e9;
    vec2  nearestSeedScaled = scaledUV; // in cell space

    // 3×3 neighborhood search — sufficient for jitter ≤ 1 cell radius
    for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
            vec2 neighbor = cellID + vec2(float(dx), float(dy));

            // Jitter: lerp between cell center (jitter=0) and random (jitter=1)
            vec2 jitterOff  = mix(vec2(0.5), hash2(neighbor), u_jitter);
            vec2 seedScaled = neighbor + jitterOff;

            vec2  diff = scaledUV - seedScaled;
            float dist = dot(diff, diff); // squared — fine for comparison

            if (dist < minDist1) {
                minDist2 = minDist1;
                minDist1 = dist;
                nearestSeedScaled = seedScaled;
            } else if (dist < minDist2) {
                minDist2 = dist;
            }
        }
    }

    // Convert winning seed back to UV space and sample image there
    vec2 seedUV     = nearestSeedScaled / (vec2(aspect, 1.0) * u_cellCount);
    vec3 mosaicRGB  = texture(u_image, clamp(seedUV, 0.0, 1.0)).rgb;
    vec3 originalRGB = texture(u_image, uv).rgb;

    // --- Edge detection -------------------------------------------
    // At a Voronoi boundary dist1 == dist2 → ratio → 1.
    // Away from the boundary ratio → 0.
    float edgeFactor = 0.0;
    if (u_edgeOpacity > 0.0 && u_edgeWidth > 0.0 && minDist2 > 0.0) {
        float ratio = sqrt(minDist1 / minDist2);          // [0, 1]
        float thresh = 1.0 - u_edgeWidth * 0.35;         // tighter = thinner
        edgeFactor   = smoothstep(thresh, 1.0, ratio) * u_edgeOpacity;
    }

    // Composite: mosaic → edge overlay
    vec3 composited = mix(mosaicRGB, u_edgeColor, edgeFactor);

    // Standard blend back onto original
    vec3 result = blendWithColorSpace(originalRGB, composited, u_blendamount);

    outColor = clamp(vec4(result, 1.0), 0.0, 1.0);
}
