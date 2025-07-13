#version 300 es

precision mediump float;

#include "zones.glsl"
#include "colorconvert.glsl"
#include "noise.glsl"
#include "blend.glsl"
#include "psrdnoise2.glsl"

uniform sampler2D u_image;
uniform sampler2D u_cmap;
uniform float u_freqx;
uniform float u_freqy;
uniform float u_seed;
uniform vec2 u_resolution;
uniform float u_uniform;
uniform float u_perlin;
uniform float u_simplex;
uniform float u_gauss;
uniform float u_pink;
uniform float u_fc[3];
uniform vec3 u_tint;
uniform float u_blendamount;

// mask parameters
uniform vec2 u_zoneMin; // normalized [0,1]
uniform vec2 u_zoneMax; // normalized [0,1]
uniform float u_zoneSoftness; // softness scalar
uniform float u_param_a;
uniform float u_param_b;
uniform float u_warpAngle; // in radians
uniform float u_zoneAngle; // radians
uniform float u_zoneEllipseN;

// gate parameters
uniform float u_threshold;
uniform float u_cutoffHigh;
uniform float u_burstFreq;
uniform float u_burstThreshold;


out vec4 outColor;

#define GATE_NONE 0
#define GATE_SOFT 1
#define GATE_HARD 2
#define GATE_BURST 3

void main() {
    vec2 uv = (gl_FragCoord.xy + vec2(0.5)) / u_resolution;
    vec2 uvs = uv + uniformNoise(u_seed);
    float xScl = uvs.x * u_freqx;
    float yScl = uvs.y * u_freqy;
    float noiseVal = 0.0;

    noiseVal += uniformNoise(uvs.x * uvs.y) * u_uniform;

    float pVecs[4];
    pVecs[0] = 1.0;
    pVecs[1] = 0.0;
    pVecs[2] = 0.0;
    pVecs[3] = 1.0;

    noiseVal += perlinNoise2D(vec2(xScl, yScl), u_fc, pVecs, u_seed).x * u_perlin * 2.0;

    vec2 gradientOut = vec2(0.0, 0.0); // scratch
    noiseVal += psrdnoise(vec2(xScl, yScl), vec2(0.0), 0.0, gradientOut) * u_simplex * 1.3;
    noiseVal += gaussianNoise(vec2(xScl, yScl)) * u_gauss;
    noiseVal += pinkNoise(vec2(xScl, yScl)) * u_pink;
    noiseVal = clamp(noiseVal, 0.0, 1.0);

#if GATE_MODE != GATE_NONE

#if GATE_MODE == GATE_SOFT
    float gateVal = noiseVal;

#elif GATE_MODE == GATE_HARD
    float gateVal = 1.0;

#elif GATE_MODE == GATE_BURST
    // TODO: expose rotation angle
    float theta = 0.52;
    mat2 rot = mat2(cos(theta), -sin(theta), sin(theta), cos(theta));
    vec2 burstUV = rot * (uv * u_burstFreq);
    float burstField = perlinNoise2D(burstUV, u_fc, pVecs, u_seed * 7.77).x;
    float gateVal = 1.0;

#endif

#if GATE_MODE == GATE_BURST
    bool burstPass = burstField > u_burstThreshold;
#else
    bool burstPass = true;
#endif

#if USE_WINDOW == 1
    noiseVal = (noiseVal > u_threshold && noiseVal < u_cutoffHigh && burstPass)
        ? gateVal : 0.0;
#else
    noiseVal = (noiseVal > u_threshold && burstPass)
        ? gateVal : 0.0;
#endif

#endif
#if USE_CMAP == 0
    vec3 noisePx = noiseVal * u_tint;
#else
    vec3 noisePx = texture(u_cmap, vec2(clamp(noiseVal, 0.0, 1.0), 0.5)).rgb;
#endif
    vec3 inColor = texture(u_image, uv).rgb;
#if APPLY_MASK == 1
    float maskFactor = boundedMask(
        uv,
        u_zoneMin,
        u_zoneMax,
        u_zoneSoftness,
        u_zoneAngle,
        u_zoneEllipseN
    );
    vec3 blended = blendWithColorSpace(
        inColor,
        mix(inColor, noisePx, maskFactor),
        u_blendamount
    );
#else
    vec3 blended = blendWithColorSpace(inColor, noisePx, u_blendamount);
#endif
    outColor = vec4(clamp(blended, 0.0, 1.0), texture(u_image, uv).a);
}
