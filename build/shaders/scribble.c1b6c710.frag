#version 300 es
precision mediump float;
precision highp int;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_blendAmount;
uniform vec3 u_scribbleColor;

uniform float u_scribbleOpacity;
uniform float u_paperOpacity;
uniform vec3 u_paperColor;
uniform float u_cellScale;
uniform float u_strokeWidth;
uniform float u_arcLength;
uniform float u_shadeLow;
uniform float u_shadeHigh;
uniform float u_falloff;
uniform float u_jitter;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

// using integer hashes to reduce banding

uint hash_u32(uint x) {
    x ^= x >> 16;
    x *= 0x7feb352du;
    x ^= x >> 15;
    x *= 0x846ca68bu;
    x ^= x >> 16;
    return x;
}

uint hash_ivec2(ivec2 p, uint seed) {
    uvec2 v = uvec2(p);

    uint h = seed;
    h ^= hash_u32(v.x + 0x9e3779b9u);
    h ^= hash_u32(v.y + 0x85ebca6bu);
    return hash_u32(h);
}

float hash01(ivec2 p, uint seed) {
    return float(hash_ivec2(p, seed)) * (1.0 / 4294967295.0);
}

vec2 hash02(ivec2 p, uint seed) {
    return vec2(
        hash01(p, seed),
        hash01(p, seed ^ 0x68bc21ebu)
    );
}
// ---- single arc fragment ----
// distance-to-ring masked to an angular wedge.

float arcStroke(vec2 pos, vec2 center, float radius,
                float arcStart, float arcSpan, float thickness) {
    vec2 d = pos - center;
    float dist = length(d);
    float ringDist = abs(dist - radius);
    float angle = atan(d.y, d.x);
    float a = mod(angle - arcStart, 6.2831853);
    float taper = 0.25;
    float arcMask = smoothstep(0.0, taper, a)
                  * smoothstep(arcSpan, arcSpan - taper, a);

    float line = 1.0 - smoothstep(thickness * 0.35, thickness, ringDist);
    return line * arcMask;
}

// ---- scribble pattern ----
// 4 layers of arc grids; darker shade activates more layers.

float scribblePattern(vec2 pixel, float shade) {
    float cellSize = u_cellScale;     // in pixels
    float strokePx = u_strokeWidth;   // in pixels
    float jitterCell = u_jitter / cellSize;

    float ink = 0.0;

    for (int layer = 0; layer < 4; layer++) {
        float threshold = float(layer) * u_falloff;
        if (shade < threshold + 0.05) continue;

        float layerOpacity = smoothstep(threshold, threshold + 0.2, sqrt(shade)) * (float(layer) + 3.0) / 6.0;

        vec2 layerOffset = vec2(float(layer) * 0.37,
                                float(layer) * 0.71);

        vec2 scaled = pixel / cellSize + layerOffset;
        ivec2 cellID = ivec2(floor(scaled));
        vec2 cellUV = fract(scaled) - 0.5;

        uint layerSeed = uint(layer) * 0x9e3779b9u + 0x243f6a88u;

        for (int dx = -1; dx <= 1; dx++) {
            for (int dy = -1; dy <= 1; dy++) {
                ivec2 offsetID = ivec2(dx, dy);
                ivec2 nID = cellID + offsetID;
                vec2 neighbor = vec2(float(dx), float(dy));

                vec2 h = hash02(nID, layerSeed);

                vec2 center = neighbor + h * 0.6 - 0.3;
                float radius = 0.2 + h.x * 0.5;

                float arcStart = hash01(nID, layerSeed ^ 0xa511e9b3u) * 6.2831853;
                float arcSpan =
                    (1.0 + hash01(nID, layerSeed ^ 0x63d83595u) * 3.5) * u_arcLength;

                float tw =
                    strokePx *
                    (0.6 + 0.8 * hash01(nID, layerSeed ^ 0xb5297a4du));

                vec2 centerJitter =
                    (hash02(nID, layerSeed ^ 0x1b56c4e9u) * 2.0 - 1.0) * jitterCell;

                float radiusJitter =
                    (hash01(nID, layerSeed ^ 0x7f4a7c15u) * 2.0 - 1.0) * (jitterCell * 0.5);

                float angleJitter =
                    (hash01(nID, layerSeed ^ 0xd35a2d97u) * 2.0 - 1.0) * (jitterCell * 1.5);

                ink += arcStroke(
                    cellUV,
                    center + centerJitter,
                    max(0.01, radius + radiusJitter),
                    arcStart + angleJitter,
                    arcSpan,
                    tw / cellSize
                ) * layerOpacity;
            }
        }
    }

    return clamp(ink, 0.0, 1.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 original = texture(u_image, uv).rgb;

    float lum = luminance(srgb2linear(original));
    // don't invert at weird parameter values
    float lowClamp = clamp(u_shadeLow, 0.0, u_shadeHigh);
    float shade = 1.0 - smoothstep(lowClamp, u_shadeHigh, lum);

    float scribble = scribblePattern(gl_FragCoord.xy, shade);
    // Normalize / compress accumulated scribble a bit
    scribble = 1.0 - exp(-scribble * shade * 2.25);
    scribble *= u_scribbleOpacity;

    // "Paper" can either be the original image, a flat paper tone,
    // or something between. This keeps the effect usable as either
    // an overlay or a full stylization pass.
    vec3 paper = mix(original, u_paperColor, u_paperOpacity);
    vec3 result = mix(paper, u_scribbleColor, scribble);

    vec3 blended = blendWithColorSpace(original, result, u_blendAmount);
    outColor = vec4(blended, 1.0);
}
