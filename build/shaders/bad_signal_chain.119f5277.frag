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
    float syncLoss;
    float flickerAmount;
    float noiseAmount;
    float rfNoise;
    float dropoutAmount;
    float chromaBleed;
    float ghostAmount;
    float scanlineAmount;
    float phosphor;
    float blendAmount;
};

uniform TearParams u_tear;
uniform ModulationParams u_mod;

out vec4 outColor;

#define TEAR_WAVE   0
#define TEAR_JUMP   1
#define TEAR_BAND   2
#define TEAR_CHUNK  3
#define TEAR_GHOST  4

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec2 saturate(vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }
vec3 saturate(vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 uv) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 uv) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += valueNoise(uv) * a;
        uv = uv * 2.07 + vec2(11.7, 4.3);
        a *= 0.5;
    }
    return v;
}

vec3 rgbToYiq(vec3 c) {
    return vec3(
        dot(c, vec3(0.299, 0.587, 0.114)),
        dot(c, vec3(0.596, -0.274, -0.322)),
        dot(c, vec3(0.211, -0.523, 0.312))
    );
}

vec3 yiqToRgb(vec3 c) {
    return vec3(
        c.x + 0.956 * c.y + 0.621 * c.z,
        c.x - 0.272 * c.y - 0.647 * c.z,
        c.x - 1.106 * c.y + 1.703 * c.z
    );
}

vec2 guardUV(vec2 uv) {
    // Horizontal wrap sells bad tracking better than black borders. Vertical clamp avoids sampling dead air.
    return vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999));
}

vec3 texRGB(vec2 uv) {
    return texture(u_image, guardUV(uv)).rgb;
}

// Horizontal sync is a timing problem first: each scanline arrives slightly early/late.
float lineSyncError(float line, float time, ModulationParams mp) {
    float field = floor(time * 59.94);
    float slowServo = (valueNoise(vec2(line * 0.018, field * 0.015 + mp.seed)) - 0.5) * 2.0;
    float headSwitch = pow(saturate(1.0 - abs(fract(line / max(u_resolution.y, 1.0)) - 0.06) * 20.0), 2.0);
    float scratch = (hash(vec2(line, field + mp.seed * 17.0)) - 0.5) * step(0.965, hash(vec2(floor(line / 3.0), field)));
    return (slowServo * 0.65 + scratch * 1.75 + headSwitch * 0.8) * mp.syncLoss;
}

vec2 applyTear(vec2 uv, TearParams tp, ModulationParams mp, float line) {
    float time = mp.t;

#if TEARMODE == TEAR_WAVE
    float wobble = sin(uv.y * TAU * (8.0 + tp.chunks) + time * 3.0);
    uv.x += wobble * 0.07;

#elif TEARMODE == TEAR_JUMP
    float tearLine = fract(time * 0.2 + hash(vec2(mp.seed, floor(time * 2.0))) * 0.2);
    float jump = 1.0 - smoothstep(0.0, 0.004 * sqrt(tp.chunks), abs(uv.y - tearLine));
    uv.x += jump * (0.08 + 0.12 * hash(vec2(line, time)));

#elif TEARMODE == TEAR_BAND
    float bandCenter = 0.18 + 0.64 * valueNoise(vec2(floor(time * 3.0) + mp.seed, 4.2));
    float bandWidth = mix(0.006, 0.055, hash(vec2(floor(time * 5.0), mp.seed)));
    float band = 1.0 - smoothstep(0.0, bandWidth, abs(uv.y - bandCenter));
    float shove = (hash(vec2(floor(time * 19.0), bandCenter + mp.seed)) - 0.5) * 0.65;
    uv.x += band * shove;

#elif TEARMODE == TEAR_CHUNK
    float chunk = floor(uv.y * tp.chunks);
    float hold = floor(time * 24.0);
    float offset = hash(vec2(chunk + mp.seed * 3.1, hold));
    float gate = step(0.58, hash(vec2(chunk, hold + 9.0)));
    uv.x += (offset - 0.5) * gate * 0.24;

#elif TEARMODE == TEAR_GHOST
    float roll = smoothstep(fract(time), 0.1 + fract(time), uv.y);
    uv.x += tp.ghostOffset * roll;
#endif

    return uv;
}

float badModulation(vec2 uv, ModulationParams mp) {
    vec2 warpedUV = uv;
    warpedUV.x *= max(0.001, 1.0 - mp.bias);
    warpedUV.y *= max(0.001, mp.bias);
    warpedUV.y += (hash(vec2(mp.t, floor(uv.y * 100.0))) - 0.5) * 0.01 * mp.jitter;
    return valueNoise(warpedUV * mp.scale + mp.seed * 7.77);
}

float dropoutMask(vec2 uv, float line, ModulationParams mp) {
    float field = floor(mp.t * 29.97);
    float group = floor(uv.y * (u_tear.chunks * 3.0 + 6.0));
    float bandSeed = hash(vec2(group + mp.seed * 13.0, field));
    float thinLines = step(0.985, hash(vec2(line, field + mp.seed)));
    float fatBand = smoothstep(0.78, 1.0, bandSeed) * smoothstep(0.15, 0.55, valueNoise(vec2(uv.x * 8.0, group)));
    return saturate((thinLines * 0.7 + fatBand) * mp.dropoutAmount);
}

vec3 analogDecode(vec2 uv, vec2 rawUV, vec2 fragCoord, ModulationParams mp) {
    float px = 1.0 / max(u_resolution.x, 1.0);
    float line = floor(fragCoord.y);
    float field = floor(mp.t * 59.94);

    // Luma rides a wider bandwidth path than chroma, so keep it sharper.
    vec3 base = texRGB(uv);
    vec3 yiqSharp = rgbToYiq(base);

    // Chroma is delayed, bandwidth-limited, and phase-wobbly.
    float chromaDelay = mix(0.35, 4.5, mp.chromaBleed) * px;
    vec2 chromaUV = uv + vec2(chromaDelay + 0.35 * lineSyncError(line, mp.t, mp) * px, 0.0);
    vec3 c0 = rgbToYiq(texRGB(chromaUV - vec2(px * 2.0, 0.0)));
    vec3 c1 = rgbToYiq(texRGB(chromaUV));
    vec3 c2 = rgbToYiq(texRGB(chromaUV + vec2(px * 2.0, 0.0)));
    vec2 iq = (c0.yz + c1.yz * 2.0 + c2.yz) * 0.25;

    float burstError = (valueNoise(vec2(line * 0.09, field * 0.07 + mp.seed)) - 0.5) * mp.chromaBleed;
    float phase = burstError * 0.75 + sin((line + mp.seed) * PI) * 0.035 * mp.chromaBleed;
    float cp = cos(phase);
    float sp = sin(phase);
    iq = vec2(iq.x * cp - iq.y * sp, iq.x * sp + iq.y * cp);
    iq *= mix(1.0, 0.72, mp.chromaBleed);

    vec3 decoded = yiqToRgb(vec3(yiqSharp.x, iq));

    // Multipath / impedance mismatch: the old bright copy trailing behind the signal.
    vec2 ghostUV = uv - vec2(u_tear.ghostOffset * (0.35 + mp.ghostAmount), 0.0);
    vec3 ghost = texRGB(ghostUV);
    decoded += ghost * (0.18 * mp.ghostAmount);
    decoded *= 1.0 - 0.08 * mp.ghostAmount;

    // Snow is not just random RGB glitter: mostly luma grit with a little chroma spit.
    float white = hash(fragCoord + vec2(mp.seed * 113.0, field * 1.37));
    float rfGate = smoothstep(0.98 - 0.68 * mp.rfNoise, 1.0, white);
    float shaped = (white - 0.5) * (0.12 + 0.88 * rfGate) * mp.noiseAmount;
    decoded += vec3(shaped) * (0.65 + 1.35 * mp.rfNoise);
    decoded.rb += (vec2(hash(fragCoord.yx + field), hash(fragCoord + field * 2.0)) - 0.5) * 0.06 * mp.rfNoise;

    // Tape dropout: oxidized missing signal, often horizontal, often white/gray, often brutal.
    float drop = dropoutMask(rawUV, line, mp);
    float dropTexture = fbm(vec2(rawUV.x * 60.0 + mp.seed, rawUV.y * 900.0 + field));
    vec3 dropoutColor = vec3(0.72 + 0.28 * dropTexture);
    decoded = mix(decoded, dropoutColor, drop);

    // CRT-ish display response: scanline aperture plus a small phosphor compression/knee.
    float fieldPhase = mod(field, 2.0) * 0.5;
    float scan = 1.0 - mp.scanlineAmount * (0.42 + 0.58 * pow(0.5 + 0.5 * cos((fragCoord.y + fieldPhase) * PI), 2.0));
    decoded *= scan;
    decoded = mix(decoded, pow(max(decoded, vec3(0.0)), vec3(1.0 / 1.18)), mp.phosphor * 0.45);
    decoded += vec3(pow(max(yiqSharp.x, 0.0), 2.0)) * 0.05 * mp.phosphor;

    // Mains hum / AGC breathing. Slow, wide, annoying in the way real bad gear is annoying.
    float flicker = sin(mp.t * TAU * 0.5 + rawUV.y * 2.1) * 0.055 * mp.flickerAmount;
    flicker += (valueNoise(vec2(field * 0.03 + mp.seed, 2.0)) - 0.5) * 0.08 * mp.flickerAmount;
    decoded += flicker;

    return saturate(decoded);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float line = floor(gl_FragCoord.y);

    // 1) Timing/sync damage moves where the decoder samples the source.
    vec2 syncUV = uv;
    syncUV.x += lineSyncError(line, u_mod.t, u_mod) * 0.018;
    syncUV.x += (badModulation(uv, u_mod) - 0.5) * 0.012 * u_mod.jitter;

    // 2) Gross tearing sits on top of that smaller line timing error.
    vec2 tearUV = mix(syncUV, applyTear(syncUV, u_tear, u_mod, line), u_tear.amount);

    // 3) Decode as if luma/chroma/RF/display were different dirty stages, not one noise knob.
    vec3 signalColor = analogDecode(tearUV, uv, gl_FragCoord.xy, u_mod);

    vec3 inColor = texture(u_image, uv).rgb;
    vec3 blended = blendWithColorSpace(inColor, signalColor, u_mod.blendAmount);
    outColor = vec4(blended, texture(u_image, uv).a);
}
