#version 300 es
precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_chromaBoost;

struct TapeParams {
    float warpAmount;
    float smearAmount;
    float chromaLag;
    float dropoutAmount;
    float tracking;
    float scanlineAmount;
    float rollAmount;
    float headSwitch;
    float grainAmount;
    float blendAmount;
    float seed;
    float t;
};

uniform TapeParams u_tape;

out vec4 outColor;

// --- Mode constants ---
#define DAMAGE_DRIFT    0
#define DAMAGE_DROPOUT  1
#define DAMAGE_HEAD     2
#define DAMAGE_WEAVE    3
#define DAMAGE_MELT     4

// --- Hash / value noise ---
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 clampUV(vec2 uv) {
    return clamp(uv, vec2(0.001), vec2(0.999));
}

float luma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
}

vec3 applyChromaBoost(vec3 c) {
#if APPLY_CHROMA_BOOST
    float y = luma(c);
    return clamp(vec3(y) + (c - vec3(y)) * u_chromaBoost, 0.0, 1.0);
#else
    return c;
#endif
}

// --- Tape transport: line-locked drift instead of broadcast tearing ---
vec2 applyTransport(vec2 uv, float lineNoise, float fineNoise) {
    vec2 px = 1.0 / u_resolution;
    float time = u_tape.t;

    float slowWave = sin(uv.y * 28.0 + time * 1.7 + u_tape.seed) * 0.006;
    float capstan = (lineNoise - 0.5) * 0.035;
    float microDrag = (fineNoise - 0.5) * px.x * 18.0;

    uv.x += (slowWave + capstan + microDrag) * u_tape.warpAmount;
    uv.y += sin(time * 0.63 + uv.x * 8.0) * 0.018 * u_tape.rollAmount;

#if DAMAGE_MODE == DAMAGE_DROPOUT
    float stall = smoothstep(0.72, 1.0, lineNoise) * u_tape.dropoutAmount;
    uv.x += stall * (0.08 + hash(vec2(floor(time * 9.0), u_tape.seed)) * 0.18);

#elif DAMAGE_MODE == DAMAGE_HEAD
    float head = (1.0 - smoothstep(0.02, 0.16, uv.y));
    uv.x += head * sin(time * 24.0 + uv.y * 160.0) * 0.08 * u_tape.headSwitch;
    uv.y += head * (hash(vec2(floor(time * 30.0), u_tape.seed)) - 0.5) * px.y * 14.0 * u_tape.headSwitch;

#elif DAMAGE_MODE == DAMAGE_WEAVE
    float field = mod(floor(gl_FragCoord.y) + floor(time * 30.0), 2.0);
    uv.y += (field - 0.5) * px.y * 2.25 * u_tape.tracking;
    uv.x += (field - 0.5) * px.x * 8.0 * u_tape.warpAmount;

#elif DAMAGE_MODE == DAMAGE_MELT
    float sag = smoothstep(0.15, 0.95, uv.y) * smoothstep(1.0, 0.2, uv.y);
    uv.x += sag * (valueNoise(vec2(time * 0.8, uv.y * 7.0 + u_tape.seed)) - 0.5) * 0.12 * u_tape.warpAmount;
    uv.y -= sag * valueNoise(vec2(uv.x * 6.0, time + u_tape.seed)) * 0.025 * u_tape.rollAmount;
#endif

    return clampUV(uv);
}

// --- Horizontal magnetic smear: repeated head echo, not generic noise ---
vec3 smearSample(vec2 uv, float dragSign) {
    vec2 px = 1.0 / u_resolution;
    float reach = u_tape.smearAmount * (18.0 + 90.0 * u_tape.tracking);
    vec3 acc = vec3(0.0);
    float weightSum = 0.0;

    for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float weight = exp(-fi * 0.72);
        vec2 tapUV = uv - vec2(dragSign * fi * reach * px.x, 0.0);
        acc += texture(u_image, clampUV(tapUV)).rgb * weight;
        weightSum += weight;
    }

    return acc / weightSum;
}

// --- Chroma lag: luma holds, color arrives late ---
vec3 lagChroma(vec2 uv, vec3 base, float dragSign) {
    vec2 px = 1.0 / u_resolution;
    float lag = u_tape.chromaLag * (2.0 + 36.0 * u_tape.tracking) * px.x;

    vec3 chromaSource = texture(u_image, clampUV(uv - vec2(dragSign * lag, 0.0))).rgb;
    float y = luma(base);
    float lagY = luma(chromaSource);

    return clamp(vec3(y) + (chromaSource - vec3(lagY)), 0.0, 1.0);
}

// --- Oxide loss / tracking dirt ---
float dropoutMask(vec2 uv, float lineNoise) {
    float time = u_tape.t;
    float line = floor(uv.y * u_resolution.y);
    float band = valueNoise(vec2(floor(uv.y * (24.0 + u_tape.tracking * 96.0)), floor(time * 11.0) + u_tape.seed));
    float speck = hash(vec2(floor(uv.x * u_resolution.x * 0.35), line + floor(time * 45.0) + u_tape.seed));

    float longScratch = smoothstep(0.96 - u_tape.dropoutAmount * 0.45, 1.0, band);
    float oxideDust = smoothstep(0.985 - u_tape.dropoutAmount * 0.6, 1.0, speck);
    float raggedEdge = smoothstep(0.2, 0.85, valueNoise(vec2(uv.x * 40.0, lineNoise * 12.0 + time)));

#if DAMAGE_MODE == DAMAGE_DROPOUT
    return clamp((longScratch * raggedEdge + oxideDust) * (0.4 + u_tape.dropoutAmount * 1.8), 0.0, 1.0);
#else
    return clamp((longScratch * 0.45 + oxideDust * 0.55) * u_tape.dropoutAmount, 0.0, 1.0);
#endif
}

vec3 applyScanlines(vec2 uv, vec3 c) {
    float line = gl_FragCoord.y;
    float scan = 0.5 + 0.5 * sin(line * 3.14159265);
    float gate = mix(1.0, 0.72 + scan * 0.28, u_tape.scanlineAmount);
    return c * gate;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float timeFrame = floor(u_tape.t * 24.0);
    float line = floor(uv.y * u_resolution.y);

    float lineNoise = valueNoise(vec2(floor(uv.y * (38.0 + u_tape.tracking * 80.0)), timeFrame + u_tape.seed));
    float fineNoise = hash(vec2(line, timeFrame + u_tape.seed * 19.19));
    float dragSign = mix(-1.0, 1.0, step(0.5, lineNoise));

    vec2 tapeUV = applyTransport(uv, lineNoise, fineNoise);

    vec3 original = texture(u_image, uv).rgb;
    vec3 dragged = texture(u_image, tapeUV).rgb;
    vec3 smeared = smearSample(tapeUV, dragSign);
    dragged = mix(dragged, smeared, u_tape.smearAmount);
    dragged = mix(dragged, lagChroma(tapeUV, dragged, dragSign), u_tape.chromaLag);

    float drop = dropoutMask(tapeUV, lineNoise);
    vec3 dropoutColor = mix(vec3(0.02), vec3(0.92), hash(vec2(line, timeFrame + u_tape.seed)));
    dragged = mix(dragged, dropoutColor, drop);

    float grain = (hash(gl_FragCoord.xy + vec2(u_tape.seed, timeFrame) * 17.17) - 0.5) * u_tape.grainAmount;
    dragged = applyScanlines(tapeUV, dragged + grain);
    dragged = applyChromaBoost(dragged);

    vec3 blended = blendWithColorSpace(original, clamp(dragged, 0.0, 1.0), u_tape.blendAmount);
    outColor = vec4(blended, texture(u_image, uv).a);
}
