#version 300 es
precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;

struct TearParams {
    float amount;
    float ghostOffset;
    float chunks;
};

struct ModulationParams {
    float seed;
    float scale;
    float t;
    float bias;
    float jitter;
    float flickerAmount;
    float noiseAmount;
    float scanlineAmount;
    float ghostAmount;
    float blendAmount;
};

uniform TearParams u_tear;
uniform ModulationParams u_mod;

out vec4 outColor;

// --- Mode constants ---
#define TEAR_WAVE   0
#define TEAR_JUMP   1
#define TEAR_BAND   2
#define TEAR_CHUNK  3
#define TEAR_GHOST  4


float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec2 saturate(vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }
vec3 saturate(vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }

// --- Hash function ---
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

// --- Value noise ---
float valueNoise(vec2 uv) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    f = f * f * (3.0 - 2.0 * f); // smoothstep

    float u = mix(a, b, f.x);
    float v = mix(c, d, f.x);
    return mix(u, v, f.y);
}

vec2 guardUV(vec2 uv) {
    // Cheap TVs smear sideways before they reveal dead borders.
    return vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999));
}

vec3 texRGB(vec2 uv) {
    return texture(u_image, guardUV(uv)).rgb;
}

// --- Tearing logic ---
vec2 applyTear(vec2 uv, TearParams tp, float time) {
#if TEARMODE == TEAR_WAVE
    uv.x += sin(uv.y * 60.0 * tp.chunks + time * 3.0) * 0.07;

#elif TEARMODE == TEAR_JUMP
    float tearLine = fract(time * 0.2);
    float jump = step(abs(uv.y - tearLine), 0.001 * sqrt(tp.chunks));
    uv.x += jump * 0.2;

#elif TEARMODE == TEAR_BAND
    float band = smoothstep(0.45, 0.46, uv.y) - smoothstep(0.46, 0.47, uv.y);
    uv.x += band * (fract(sin(time * 12.9898) * 43758.5453) - 0.5) * 0.5;

#elif TEARMODE == TEAR_CHUNK
    float chunk = floor(uv.y * tp.chunks);
    float offset = fract(sin(dot(vec2(chunk, time), vec2(12.9898, 78.233))) * 43758.5453);
    uv.x += (offset - 0.5) * 0.2;

#elif TEARMODE == TEAR_GHOST
    uv.x += tp.ghostOffset * smoothstep(fract(time), 0.1 + fract(time), uv.y);
#endif

    return uv;
}

// --- Bad modulation ---
float badModulation(vec2 uv, ModulationParams mp) {
    vec2 warpedUV = uv;
    warpedUV.x *= max(0.001, 1.0 - mp.bias);
    warpedUV.y *= max(0.001, mp.bias);

    warpedUV.y += (hash(vec2(mp.t, floor(uv.y * 100.0))) - 0.5) * 0.01 * mp.jitter;

    return valueNoise(warpedUV * mp.scale + mp.seed * 7.77);
}

// --- TV helpers ---
float frameHold(ModulationParams mp) {
    return floor((mp.t + mp.seed * 0.013) * 30.0);
}

float lineJitter(vec2 uv, ModulationParams mp, TearParams tp) {
    float frame = frameHold(mp);
    float line = floor(gl_FragCoord.y);
    float chunk = floor(uv.y * max(tp.chunks, 1.0));

    float fine = hash(vec2(line, frame + mp.seed * 11.73)) - 0.5;
    float coarse = hash(vec2(chunk, frame * 0.37 + mp.seed * 3.19)) - 0.5;

    return (fine * 0.004 + coarse * 0.014) * mp.jitter;
}

float tvSnow(vec2 uv, ModulationParams mp) {
    float frame = frameHold(mp);
    float perPixel = hash(gl_FragCoord.xy + vec2(frame * 17.13, mp.seed * 29.91));
    float shaped = badModulation(uv, mp);

    // Per-pixel snow gives the television fizz; shaped noise keeps the older
    // broad RF/hash texture without turning the whole image into gray milk.
    return mix(perPixel, shaped, 0.35) * 2.0 - 1.0;
}

float scanlineMask(ModulationParams mp) {
    float line = mod(floor(gl_FragCoord.y), 2.0);
    return 1.0 - line * 0.22 * mp.scanlineAmount;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 tearUV = mix(uv, applyTear(uv, u_tear, u_mod.t), u_tear.amount);
    tearUV.x += lineJitter(uv, u_mod, u_tear);

    float snow = tvSnow(tearUV, u_mod);
    float flickerVal = sin(u_mod.t * 3.0 + tearUV.y * 2.0) * 0.05 * u_mod.flickerAmount;

    vec3 sampled = texRGB(tearUV);
    vec3 ghost = texRGB(tearUV - vec2(u_tear.ghostOffset, 0.0));

    vec3 noised = sampled + vec3(snow) * u_mod.noiseAmount * 0.38;
    noised = noised * (1.0 - 0.08 * u_mod.ghostAmount) + ghost * (0.28 * u_mod.ghostAmount);
    noised += flickerVal;
    noised *= scanlineMask(u_mod);
    noised = saturate(noised);

    vec3 inColor = texture(u_image, uv).rgb;
    vec3 blended = blendWithColorSpace(inColor, noised, u_mod.blendAmount);

    outColor = vec4(blended, texture(u_image, uv).a);
}