#version 300 es
precision highp float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;

struct VHSParams {
    float seed;
    float t;
    float blendAmount;

    float trackingAmount;
    float tapeWarp;
    float headSwitch;
    float verticalRoll;

    float syncLoss;
    float signalBandwidth;
    float rfNoise;
    float interlaceJitter;

    float chromaBleed;
    float ghostAmount;
    float colorRot;

    float snowAmount;
    float dropoutAmount;
    float scanlineAmount;
    float crushedLuma;
};

uniform VHSParams u_vhs;

out vec4 outColor;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec3 saturate(vec3 x) {
    return clamp(x, vec3(0.0), vec3(1.0));
}

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

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += valueNoise(p) * a;
        p = p * 2.03 + 11.7;
        a *= 0.5;
    }
    return v;
}

float band(float y, float center, float width) {
    float d = abs(y - center);
    return 1.0 - smoothstep(width * 0.35, width, d);
}

vec2 safeUV(vec2 uv) {
    return clamp(uv, vec2(0.001), vec2(0.999));
}

vec3 sampleRGB(vec2 uv) {
    return texture(u_image, safeUV(uv)).rgb;
}

// NTSC-ish YIQ. The exact VHS chain is uglier than this, but this gives us
// a useful separation: luma gets detail/ringing, chroma gets bandwidth loss,
// phase noise, delay, and line-to-line crawl.
vec3 rgbToYiq(vec3 rgb) {
    return vec3(
        dot(rgb, vec3(0.299, 0.587, 0.114)),
        dot(rgb, vec3(0.596, -0.274, -0.322)),
        dot(rgb, vec3(0.211, -0.523, 0.312))
    );
}

vec3 yiqToRgb(vec3 yiq) {
    return vec3(
        yiq.x + 0.956 * yiq.y + 0.621 * yiq.z,
        yiq.x - 0.272 * yiq.y - 0.647 * yiq.z,
        yiq.x - 1.106 * yiq.y + 1.703 * yiq.z
    );
}

vec3 sampleYiq(vec2 uv) {
    return rgbToYiq(sampleRGB(uv));
}

vec2 rotate2(vec2 v, float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, s, -s, c) * v;
}

float frameNumber() {
    return floor(u_vhs.t * 29.97);
}

float lineNumber(vec2 uv) {
    return floor(uv.y * u_resolution.y);
}

vec2 applyVerticalRoll(vec2 uv) {
    float servo = fbm(vec2(u_vhs.t * 0.08 + u_vhs.seed, 3.1));
    float roll = fract(u_vhs.t * (0.035 + 0.035 * servo) + u_vhs.seed * 0.013);
    uv.y = fract(uv.y + roll * 0.22 * u_vhs.verticalRoll);
    return uv;
}

vec2 applyInterlaceWeave(vec2 uv) {
    float frame = frameNumber();
    float field = mod(frame, 2.0) * 2.0 - 1.0;
    float line = lineNumber(uv);
    float weave = field * (0.42 + 0.35 * hash(vec2(frame, u_vhs.seed))) / u_resolution.y;
    float comb = (mod(line, 2.0) * 2.0 - 1.0) * 0.18 / u_resolution.y;
    uv.y += (weave + comb) * u_vhs.interlaceJitter;
    return uv;
}

vec2 applyTapeWarp(vec2 uv) {
    float t = u_vhs.t;
    float seed = u_vhs.seed;
    float y = uv.y;
    float line = lineNumber(uv);
    float frame = frameNumber();

    // Capstan and guide errors: mostly low-frequency horizontal timebase error,
    // with small line-correlated jitter on top.
    float capstan = fbm(vec2(y * 5.5 + seed, t * 0.16));
    float guide = valueNoise(vec2(line * 0.042 + seed * 2.1, frame * 0.18));
    float lineWobble = sin(y * 360.0 + t * 5.1 + seed) * 0.0022;

    float warp = (capstan - 0.5) * 0.052;
    warp += (guide - 0.5) * 0.016;
    warp += lineWobble;

    uv.x += warp * u_vhs.tapeWarp;
    return uv;
}

vec2 applyTrackingDamage(vec2 uv) {
    float t = u_vhs.t;
    float seed = u_vhs.seed;
    float frame = frameNumber();
    float line = lineNumber(uv);

    float spliceA = fract(t * 0.097 + hash(vec2(seed, frame * 0.031)));
    float spliceB = fract(0.68 - t * 0.057 + hash(vec2(seed + 9.0, frame * 0.017)));

    float tearA = band(uv.y, spliceA, 0.010 + 0.038 * hash(vec2(frame, seed)));
    float tearB = band(uv.y, spliceB, 0.005 + 0.022 * hash(vec2(seed, frame + 4.0)));

    // H-sync dropout: when the line timing pulse is ambiguous, whole rows jump.
    float syncEnvelope = valueNoise(vec2(line * 0.037 + seed, frame * 0.39));
    float badSync = smoothstep(1.0 - (0.018 + 0.16 * u_vhs.syncLoss), 1.0, syncEnvelope);
    float syncKick = (hash(vec2(line * 1.7, frame + seed)) - 0.5) * 0.19;

    float zipper = step(0.955 - 0.055 * u_vhs.syncLoss, hash(vec2(line * 0.091, frame + seed)));
    zipper *= hash(vec2(frame, line)) - 0.5;

    float tearKick = (hash(vec2(frame + 17.0, seed)) - 0.5) * 0.38;

    uv.x += tearA * tearKick * u_vhs.trackingAmount;
    uv.x += tearB * -tearKick * 0.55 * u_vhs.trackingAmount;
    uv.x += badSync * syncKick * u_vhs.syncLoss;
    uv.x += zipper * 0.028 * (u_vhs.trackingAmount + u_vhs.syncLoss);

    return uv;
}

float headSwitchMask(vec2 uv) {
    float bottom = smoothstep(0.835, 1.0, uv.y);
    float serration = 0.65 + 0.35 * sin(uv.y * 115.0 + u_vhs.t * 10.0 + u_vhs.seed);
    return bottom * serration * u_vhs.headSwitch;
}

vec2 applyHeadSwitch(vec2 uv) {
    float h = headSwitchMask(uv);
    float thump = (hash(vec2(floor(u_vhs.t * 10.0), u_vhs.seed)) - 0.5) * 0.18;
    float chew = sin(uv.y * 95.0 + u_vhs.t * 9.0 + u_vhs.seed) * 0.019;

    uv.x += h * (chew + thump);
    uv.y += h * sin(uv.x * 38.0 + u_vhs.t * 4.0) * 0.012;

    return uv;
}

vec3 sampleCompositeSignal(vec2 uv) {
    float px = 1.0 / u_resolution.x;
    float py = 1.0 / u_resolution.y;
    float line = lineNumber(uv);
    float frame = frameNumber();

    vec3 center = sampleYiq(uv);

    // Luma is the high-bandwidth part of the tape signal, but consumer VHS still
    // softens it and produces edge ringing when the RF envelope gets ugly.
    float lumaRadius = px * mix(0.7, 4.25, u_vhs.signalBandwidth);
    float yWide = center.x * 0.54;
    yWide += sampleYiq(uv + vec2(lumaRadius, 0.0)).x * 0.18;
    yWide += sampleYiq(uv - vec2(lumaRadius, 0.0)).x * 0.18;
    yWide += sampleYiq(uv + vec2(lumaRadius * 2.7, 0.0)).x * 0.05;
    yWide += sampleYiq(uv - vec2(lumaRadius * 2.7, 0.0)).x * 0.05;

    float preEcho = center.x - sampleYiq(uv + vec2(lumaRadius * 3.8, 0.0)).x;
    float y = mix(center.x, yWide, 0.64 * u_vhs.signalBandwidth);
    y += preEcho * 0.08 * (u_vhs.signalBandwidth + u_vhs.ghostAmount);

    // Chroma is deliberately worse: lower bandwidth, horizontal delay, vertical
    // leakage, then phase rotation. This is where VHS gets that unstable color meat.
    float chromaRadius = px * (2.0 + 11.0 * u_vhs.chromaBleed + 6.0 * u_vhs.signalBandwidth);
    vec2 iq = center.yz * 0.36;
    iq += sampleYiq(uv + vec2(chromaRadius, 0.0)).yz * 0.22;
    iq += sampleYiq(uv - vec2(chromaRadius, 0.0)).yz * 0.22;
    iq += sampleYiq(uv + vec2(0.0, py)).yz * 0.10;
    iq += sampleYiq(uv - vec2(0.0, py)).yz * 0.10;

    float chromaDelay = px * (2.0 + 22.0 * u_vhs.chromaBleed);
    iq = mix(iq, sampleYiq(uv + vec2(chromaDelay, 0.0)).yz, 0.28 * u_vhs.chromaBleed);
    iq *= 1.0 - 0.26 * u_vhs.signalBandwidth;

    float phaseNoise = valueNoise(vec2(line * 0.17 + u_vhs.seed, frame * 0.41)) - 0.5;
    float phase = phaseNoise * 1.28 * u_vhs.colorRot;
    phase += sin(u_vhs.t * 1.7 + uv.y * 31.0 + u_vhs.seed) * 0.42 * u_vhs.colorRot;
    phase += headSwitchMask(uv) * sin(line * 0.9 + u_vhs.t * 12.0) * 0.75;
    iq = rotate2(iq, phase);

    // Residual subcarrier/cross-color. Not accurate enough for a lab report,
    // accurate enough to stop feeling like generic RGB channel offset.
    float crawl = sin(gl_FragCoord.x * 1.63 + line * 2.17 + u_vhs.t * 17.0 + u_vhs.seed);
    float crawlAmp = (0.008 + 0.018 * u_vhs.colorRot) * u_vhs.chromaBleed;
    y += crawl * dot(iq, vec2(0.8, 0.2)) * crawlAmp;
    iq += vec2(crawl, -crawl) * y * crawlAmp * 0.42;

    // Ghosting as delayed signal energy, not just a second RGB sample pasted over it.
    float ghostShift = px * (10.0 + 110.0 * u_vhs.ghostAmount);
    vec3 echoA = sampleYiq(uv + vec2(ghostShift, 0.0));
    vec3 echoB = sampleYiq(uv - vec2(ghostShift * 0.38, 0.0));
    y += (echoA.x * 0.20 + echoB.x * 0.08 - 0.075) * u_vhs.ghostAmount;
    iq += rotate2(echoA.yz, 0.22 + phase * 0.3) * 0.20 * u_vhs.ghostAmount;

    return yiqToRgb(vec3(y, iq));
}

float dropoutMask(vec2 uv) {
    float t = u_vhs.t;
    float seed = u_vhs.seed;
    float frame = frameNumber();
    float line = lineNumber(uv);
    float lineBlock = floor(uv.y * 92.0);

    // Oxide loss tends to be horizontal and line-correlated: the head sees a weak
    // carrier for a chunk of time, then the demodulated picture turns into bright RF hash.
    float rowSpark = hash(vec2(lineBlock, frame + seed));
    float weakCarrier = smoothstep(1.0 - (0.007 + 0.125 * u_vhs.dropoutAmount), 1.0, rowSpark);
    float scratchTexture = smoothstep(0.36, 0.94, fbm(vec2(uv.x * 38.0, lineBlock * 0.31 + frame)));

    float creaseCenter = fract(0.79 + sin(t * 0.11 + seed) * 0.19);
    float crease = band(uv.y, creaseCenter, 0.004 + 0.030 * u_vhs.dropoutAmount);
    float creaseBreakup = smoothstep(0.30, 0.96, fbm(vec2(uv.x * 24.0, t * 3.0 + seed)));

    float headChew = headSwitchMask(uv) * smoothstep(0.52, 0.95, valueNoise(vec2(uv.x * 80.0, frame + seed)));

    return saturate((weakCarrier * scratchTexture + crease * creaseBreakup + headChew * 0.55) * u_vhs.dropoutAmount);
}

vec3 applyRFDropoutAndSnow(vec2 uv, vec3 rgb) {
    vec3 yiq = rgbToYiq(rgb);
    float frame = frameNumber();
    float line = lineNumber(uv);

    float snow = hash(gl_FragCoord.xy + vec2(frame * 13.1 + u_vhs.seed, frame * -7.7));
    float chromaSnow = hash(gl_FragCoord.yx + vec2(frame * -5.3, u_vhs.seed * 19.1));
    float carrierEnvelope = 0.35 + 0.65 * valueNoise(vec2(line * 0.071 + u_vhs.seed, frame * 0.73));
    float rf = u_vhs.rfNoise * carrierEnvelope;

    yiq.x += (snow - 0.5) * (0.045 + 0.34 * u_vhs.snowAmount) * (0.45 + rf);
    yiq.yz += vec2(snow - 0.5, chromaSnow - 0.5) * 0.070 * u_vhs.snowAmount * (0.5 + u_vhs.rfNoise);

    float d = dropoutMask(uv);
    vec3 carrierGone = vec3(0.86 + 0.14 * snow, 0.0, 0.0);
    carrierGone.x -= 0.20 * valueNoise(vec2(uv.x * 68.0, frame + line * 0.07));
    yiq = mix(yiq, carrierGone, d);

    vec3 outRgb = yiqToRgb(yiq);

    float salt = step(1.0 - 0.020 * u_vhs.snowAmount * (1.0 + u_vhs.rfNoise), snow);
    outRgb = mix(outRgb, vec3(0.86 + snow * 0.14), salt);

    return outRgb;
}

vec3 applyDisplayAndLuma(vec2 uv, vec3 c) {
    float frame = frameNumber();
    float scan = sin(gl_FragCoord.y * 3.14159265);
    float dirtyScan = 0.050 + 0.060 * scan;
    c *= 1.0 - dirtyScan * u_vhs.scanlineAmount;

    float field = mod(floor(gl_FragCoord.y + frame), 2.0);
    c += (field - 0.5) * 0.030 * (u_vhs.scanlineAmount + u_vhs.interlaceJitter);

    // Head switching dirt lives near the bottom and often yanks black level around.
    float h = headSwitchMask(uv);
    c += h * vec3(0.025, -0.006, -0.022) * sin(uv.x * 90.0 + u_vhs.t * 12.0);

    float luma = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 crushed = mix(vec3(smoothstep(0.075, 0.94, luma)), c, 0.72);
    c = mix(c, crushed, u_vhs.crushedLuma);

    float breathing = 1.0 + sin(u_vhs.t * 3.7 + u_vhs.seed) * 0.045 * u_vhs.crushedLuma;
    c *= breathing;

    return saturate(c);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 sourceUV = uv;

    vec2 damagedUV = applyVerticalRoll(uv);
    damagedUV = applyInterlaceWeave(damagedUV);
    damagedUV = applyTapeWarp(damagedUV);
    damagedUV = applyTrackingDamage(damagedUV);
    damagedUV = applyHeadSwitch(damagedUV);

    vec3 damaged = sampleCompositeSignal(damagedUV);
    damaged = applyRFDropoutAndSnow(damagedUV, damaged);
    damaged = applyDisplayAndLuma(damagedUV, damaged);

    vec3 inColor = texture(u_image, sourceUV).rgb;
    vec3 blended = blendWithColorSpace(inColor, damaged, u_vhs.blendAmount);

    outColor = vec4(blended, texture(u_image, sourceUV).a);
}
