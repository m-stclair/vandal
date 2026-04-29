#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform sampler2D u_plateMap;
uniform sampler2D u_noise;

uniform vec2 u_resolution;

uniform float u_cellsize;
uniform float u_blendamount;

uniform vec4 u_ink1Rot;
uniform vec4 u_ink1InvRot;
uniform vec4 u_ink2Rot;
uniform vec4 u_ink2InvRot;
uniform vec4 u_ink3Rot;
uniform vec4 u_ink3InvRot;

uniform vec2 u_ink1OffsetPx;
uniform vec2 u_ink2OffsetPx;
uniform vec2 u_ink3OffsetPx;

uniform float u_grainAmount;
uniform float u_paperAmount;
uniform float u_inkCoverage;
uniform float u_edgeBleed;
uniform float u_plateWobble;
uniform float u_posterizeLevels;

uniform vec3 u_paper;
uniform vec3 u_ink1;
uniform vec3 u_ink2;
uniform vec3 u_ink3;

out vec4 outColor;

#define RISOGRAPH_DUOTONE 0
#define RISOGRAPH_TRITONE 1

#ifndef RISOGRAPH_MODE
#define RISOGRAPH_MODE 0
#endif

mat2 unpackMat2(vec4 m) {
    return mat2(m.x, m.y, m.z, m.w);
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec2 risoCellData(
    vec2 frag,
    vec4 rotPacked,
    vec4 invRotPacked,
    float cellSize,
    vec2 offsetPx,
    float seed,
    out vec2 cellCenterUV,
    out vec2 cellId
) {
    vec2 pivot = 0.5 * u_resolution;
    float safeCellSize = max(cellSize, 1e-4);

    vec2 plateFrag = frag - offsetPx;

    mat2 R = unpackMat2(rotPacked);
    mat2 invR = unpackMat2(invRotPacked);

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
    return clamp(
        floor(clamp(ink, 0.0, 1.0) * levels + 0.55 + dither * 0.75) / levels,
        0.0,
        1.0
    );
}

float roughDotMaskFast(vec2 local, vec2 cellId, float cellSize, float ink, float seed) {
    float safeCellSize = max(cellSize, 1e-4);
    float maxR = 0.5 * safeCellSize * 0.98;

    float cellRough = mix(0.88, 1.16, hash21(cellId + seed * 41.3));
    float r = clamp(ink, 0.0, 1.0) * maxR * cellRough;

    float dist = length(local);
    float aa = max(fwidth(dist), 1e-4) + u_edgeBleed * 0.1 * safeCellSize;
    return clamp(1.0 - smoothstep(r - aa, r + aa, dist), 0.0, 1.0);
}

float plateInkFromMap(vec3 plateMap, int plateIndex) {
    if (plateIndex == 0) {
        return plateMap.r;
    } else if (plateIndex == 1) {
        return plateMap.g;
    }
    return plateMap.b;
}

float sampleRisoPlate(
    vec2 frag,
    vec4 rotPacked,
    vec4 invRotPacked,
    vec2 offsetPx,
    float seed,
    int plateIndex
) {
    vec2 cellCenterUV;
    vec2 cellId;
    vec2 local = risoCellData(
        frag,
        rotPacked,
        invRotPacked,
        u_cellsize,
        offsetPx,
        seed,
        cellCenterUV,
        cellId
    );

    vec3 plateMap = texture(u_plateMap, cellCenterUV).rgb;
    float ink = posterizeInk(plateInkFromMap(plateMap, plateIndex), cellId, seed);
    return roughDotMaskFast(local, cellId, u_cellsize, ink, seed);
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

    // Shared material noise from the prepass:
    // R = paper fiber, G = tooth, B = pinholes, A = dirt speckle.
    // This is deliberately shared across plates.
    vec4 materialNoise = texture(u_noise, uv);

    float paperFiber = materialNoise.r;
    float paperTooth = mix(1.0, 0.58 + 0.42 * materialNoise.g, u_grainAmount);
    float pinholes = smoothstep(0.02, 0.98, materialNoise.b);
    float sharedInkBreakup = mix(
        1.0,
        paperTooth * mix(0.86, 1.0, pinholes),
        u_grainAmount
    );

    vec3 risoResult = u_paper - (paperFiber - 0.5) * u_paperAmount * 0.11;

    float plate1 = sampleRisoPlate(frag, u_ink1Rot, u_ink1InvRot, u_ink1OffsetPx, 1.0, 0);
    float plate2 = sampleRisoPlate(frag, u_ink2Rot, u_ink2InvRot, u_ink2OffsetPx, 2.0, 1);

    plate1 *= sharedInkBreakup;
    plate2 *= sharedInkBreakup;

    risoResult = overprint(risoResult, u_ink1, plate1);
    risoResult = overprint(risoResult, u_ink2, plate2);

#if RISOGRAPH_MODE == RISOGRAPH_TRITONE
    float plate3 = sampleRisoPlate(frag, u_ink3Rot, u_ink3InvRot, u_ink3OffsetPx, 3.0, 2);
    plate3 *= sharedInkBreakup;
    risoResult = overprint(risoResult, u_ink3, plate3);
#endif

    risoResult -= smoothstep(0.992, 1.0, materialNoise.a) * u_grainAmount * 0.055;

    vec3 blended = blendWithColorSpace(inColor, clamp(risoResult, 0.0, 1.0), u_blendamount);
    outColor = vec4(clamp(blended, 0.0, 1.0), 1.0);
}
