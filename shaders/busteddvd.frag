#version 300 es
precision highp float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;

struct DVDParams {
    float seed;
    float t;
    float blendAmount;

    float macroblockAmount;
    float blockSize;
    float packetLoss;
    float errorConceal;

    float motionVectorGlitch;
    float gopStutter;
    float iframePop;
    float sliceTear;

    float quantization;
    float dctRinging;
    float mosquitoNoise;
    float banding;

    float chromaSubsample;
    float chromaMisalign;
    float colorTableSlip;

    float bitRot;
    float blockSparkle;
    float deinterlaceComb;
};

uniform DVDParams u_dvd;

out vec4 outColor;

const float PI = 3.141592653589793;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec2 saturate(vec2 x) {
    return clamp(x, vec2(0.0), vec2(1.0));
}

vec3 saturate(vec3 x) {
    return clamp(x, vec3(0.0), vec3(1.0));
}

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash2(vec2 p) {
    return vec2(hash(p + 13.17), hash(p + 91.71));
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
        p = p * 2.07 + 17.23;
        a *= 0.5;
    }
    return v;
}

vec2 safeUV(vec2 uv) {
    return clamp(uv, vec2(0.001), vec2(0.999));
}

vec3 sampleRGB(vec2 uv) {
    return texture(u_image, safeUV(uv)).rgb;
}

// Rec. 601-ish YCbCr. DVD is a digital component/compression problem, not a
// composite RF problem. Luma survives more often. Chroma gets blocky, delayed,
// averaged, and occasionally decoded from the wrong neighborhood.
vec3 rgbToYcbcr(vec3 rgb) {
    return vec3(
        dot(rgb, vec3(0.299, 0.587, 0.114)),
        dot(rgb, vec3(-0.168736, -0.331264, 0.5)),
        dot(rgb, vec3(0.5, -0.418688, -0.081312))
    );
}

vec3 ycbcrToRgb(vec3 ycc) {
    return vec3(
        ycc.x + 1.402 * ycc.z,
        ycc.x - 0.344136 * ycc.y - 0.714136 * ycc.z,
        ycc.x + 1.772 * ycc.y
    );
}

float frameNumber() {
    return floor(u_dvd.t * 29.97);
}

float heldFrameNumber() {
    float hold = 1.0 + floor(u_dvd.gopStutter * 7.0);
    return floor(frameNumber() / hold) * hold;
}

float gopNumber() {
    return floor(frameNumber() / 15.0);
}

float blockPx() {
    return mix(8.0, 40.0, u_dvd.blockSize);
}

vec2 blockGrid(vec2 uv, float px) {
    return max(vec2(1.0), floor(u_resolution / max(px, 1.0)));
}

vec2 blockCoord(vec2 uv, float px) {
    return floor(uv * blockGrid(uv, px));
}

vec2 blockLocal(vec2 uv, float px) {
    return fract(uv * blockGrid(uv, px));
}

vec2 blockCenterUV(vec2 uv, float px) {
    vec2 grid = blockGrid(uv, px);
    return (floor(uv * grid) + 0.5) / grid;
}

float blockBoundary(vec2 uv, float px) {
    vec2 local = blockLocal(uv, px);
    vec2 edge = min(local, 1.0 - local);
    float line = 1.0 - smoothstep(0.0, 0.055, min(edge.x, edge.y));
    return line;
}

float iframePulse() {
    float frame = frameNumber();
    float gopPhase = mod(frame, 15.0);
    float hardCut = 1.0 - smoothstep(0.0, 2.5, gopPhase);
    float dirtyReset = 0.65 + 0.35 * hash(vec2(gopNumber(), u_dvd.seed));
    return hardCut * dirtyReset * u_dvd.iframePop;
}

float packetMask(vec2 uv) {
    float px = blockPx();
    vec2 cell = blockCoord(uv, px);
    float frame = heldFrameNumber();
    float gop = gopNumber();

    float badBlock = smoothstep(
        1.0 - (0.010 + 0.170 * u_dvd.packetLoss),
        1.0,
        hash(cell * vec2(1.7, 2.3) + vec2(frame * 0.11, gop + u_dvd.seed))
    );

    float slice = floor(uv.y * mix(18.0, 54.0, u_dvd.sliceTear));
    float badSlice = step(
        1.0 - (0.010 + 0.115 * u_dvd.packetLoss + 0.060 * u_dvd.sliceTear),
        hash(vec2(slice * 1.31 + u_dvd.seed, frame * 0.27 + gop))
    );
    float sliceBreakup = smoothstep(0.18, 0.88, fbm(vec2(uv.x * 9.0, slice + frame * 0.23)));

    float burstCenter = fract(hash(vec2(gop, u_dvd.seed + 41.0)) + u_dvd.t * 0.041);
    float burstBand = 1.0 - smoothstep(0.014, 0.130, abs(uv.y - burstCenter));
    float burst = burstBand * smoothstep(0.78, 1.0, hash(vec2(gop, floor(frame / 3.0) + u_dvd.seed)));

    return saturate(max(badBlock, badSlice * sliceBreakup) + burst * 0.65) * u_dvd.packetLoss;
}

vec2 applySliceTear(vec2 uv) {
    float frame = heldFrameNumber();
    float sliceCount = mix(18.0, 70.0, u_dvd.sliceTear);
    float slice = floor(uv.y * sliceCount);
    float bad = step(
        1.0 - (0.018 + 0.120 * u_dvd.sliceTear),
        hash(vec2(slice + u_dvd.seed, frame * 0.19))
    );
    float offset = (hash(vec2(slice * 3.1, frame + u_dvd.seed)) - 0.5) * 0.13;
    float zipper = (valueNoise(vec2(uv.x * 11.0, slice + frame)) - 0.5) * 0.018;
    uv.x += (offset + zipper) * bad * u_dvd.sliceTear;
    return uv;
}

vec2 applyMotionVectorFault(vec2 uv) {
    float px = blockPx();
    vec2 cell = blockCoord(uv, px);
    float frame = heldFrameNumber();
    float gop = gopNumber();

    float activeBlock = smoothstep(
        1.0 - (0.012 + 0.180 * u_dvd.motionVectorGlitch),
        1.0,
        hash(cell + vec2(gop * 7.0 + u_dvd.seed, frame * 0.13))
    );

    vec2 drift = hash2(cell + vec2(gop, u_dvd.seed)) - 0.5;
    drift = sign(drift) * pow(abs(drift), vec2(0.55));

    // MPEG prediction failure feels like a confident copy from the wrong block:
    // rectangular, stepped, and temporally sticky. Not a wavy cable. A bad guess.
    vec2 vectorPx = drift * mix(2.0, 72.0, u_dvd.motionVectorGlitch);
    uv += activeBlock * vectorPx / u_resolution;

    float smear = smoothstep(0.62, 1.0, activeBlock + packetMask(uv) * 0.8);
    vec2 smearDir = normalize(drift + vec2(0.001));
    uv += smearDir * px * 0.35 / u_resolution * smear * u_dvd.errorConceal;

    return uv;
}

vec3 sampleChroma420(vec2 uv, float damage) {
    float px = blockPx();
    float frame = heldFrameNumber();
    vec2 cell = blockCoord(uv, px);

    vec3 yccLuma = rgbToYcbcr(sampleRGB(uv));

    float chromaPx = mix(2.0, 18.0 + px * 0.42, u_dvd.chromaSubsample);
    vec2 chromaUV = blockCenterUV(uv, chromaPx);

    vec2 chromaStep = (hash2(cell + vec2(frame, u_dvd.seed)) - 0.5);
    chromaStep *= vec2(3.0 + 13.0 * u_dvd.chromaMisalign) / u_resolution;
    chromaUV += chromaStep * u_dvd.chromaMisalign * (0.35 + damage);

    vec3 yccChroma = rgbToYcbcr(sampleRGB(chromaUV));
    vec2 cbcr = yccChroma.yz;

    float slip = smoothstep(
        1.0 - (0.006 + 0.125 * u_dvd.colorTableSlip),
        1.0,
        hash(cell * 0.73 + vec2(gopNumber(), u_dvd.seed))
    );

    vec2 wrongCbcr = rgbToYcbcr(sampleRGB(blockCenterUV(uv + chromaStep * 8.0, px * 2.0))).zy;
    cbcr = mix(cbcr, wrongCbcr, slip * u_dvd.colorTableSlip);
    cbcr += (hash2(cell + vec2(19.0, frame)) - 0.5) * 0.10 * slip * u_dvd.colorTableSlip;

    vec3 ycc = vec3(yccLuma.x, cbcr);
    return ycbcrToRgb(ycc);
}

vec3 applyBlockDecode(vec2 uv, vec3 c) {
    float px = blockPx();
    float p = packetMask(uv);
    float frame = heldFrameNumber();
    vec2 cell = blockCoord(uv, px);

    vec2 coarseUV = blockCenterUV(uv, px);
    vec2 fineUV = blockCenterUV(uv, max(4.0, px * 0.5));
    vec3 coarse = sampleChroma420(coarseUV, p);
    vec3 fine = sampleChroma420(fineUV, p);

    float baseBlockiness = u_dvd.macroblockAmount * (0.35 + 0.55 * u_dvd.quantization);
    c = mix(c, fine, baseBlockiness * 0.42);
    c = mix(c, coarse, p * (0.40 + 0.55 * u_dvd.errorConceal));

    vec2 donorDir = hash2(cell + vec2(frame * 0.17, u_dvd.seed)) - 0.5;
    vec2 donorUV = coarseUV + donorDir * px * mix(0.5, 3.5, u_dvd.errorConceal) / u_resolution;
    vec3 donor = sampleChroma420(donorUV, p);
    c = mix(c, donor, p * u_dvd.errorConceal * 0.62);

    return c;
}

float edgeSignal(vec2 uv) {
    vec2 texel = 1.0 / u_resolution;
    vec3 l = sampleRGB(uv - vec2(texel.x * 2.0, 0.0));
    vec3 r = sampleRGB(uv + vec2(texel.x * 2.0, 0.0));
    vec3 u = sampleRGB(uv + vec2(0.0, texel.y * 2.0));
    vec3 d = sampleRGB(uv - vec2(0.0, texel.y * 2.0));
    float e = length(r - l) + length(u - d);
    return smoothstep(0.055, 0.42, e);
}

vec3 applyQuantization(vec2 uv, vec3 c) {
    vec3 ycc = rgbToYcbcr(c);
    float px = blockPx();
    vec2 cell = blockCoord(uv, px);
    float dither = hash(gl_FragCoord.xy + heldFrameNumber() + u_dvd.seed) - 0.5;

    float yLevels = mix(256.0, 18.0, u_dvd.quantization);
    float cLevels = mix(224.0, 10.0, saturate(u_dvd.quantization + u_dvd.chromaSubsample * 0.25));

    float blockBias = (hash(cell + vec2(gopNumber(), u_dvd.seed)) - 0.5) * u_dvd.quantization;
    ycc.x = floor(ycc.x * yLevels + dither * 0.82 + blockBias) / yLevels;
    ycc.yz = floor((ycc.yz + 0.5) * cLevels + dither * 0.55 + blockBias) / cLevels - 0.5;

    float bandLevels = mix(256.0, 28.0, u_dvd.banding);
    float bandedY = floor(ycc.x * bandLevels + 0.5) / bandLevels;
    ycc.x = mix(ycc.x, bandedY, u_dvd.banding * (0.35 + 0.45 * u_dvd.quantization));

    return ycbcrToRgb(ycc);
}

vec3 applyDCTTexture(vec2 uv, vec3 c) {
    float px = blockPx();
    float edge = edgeSignal(uv);
    vec2 local8 = fract(uv * u_resolution / 8.0) - 0.5;
    vec2 localBlock = blockLocal(uv, px) - 0.5;

    float basis8 = cos(local8.x * PI * 8.0) * 0.55 + cos(local8.y * PI * 8.0) * 0.45;
    float basisBlock = cos(localBlock.x * PI * 2.0) * cos(localBlock.y * PI * 2.0);
    float ring = (basis8 * 0.65 + basisBlock * 0.35) * edge;

    c += ring * (0.010 + 0.070 * u_dvd.dctRinging);

    float mosquito = hash(gl_FragCoord.xy + vec2(heldFrameNumber() * 13.1, u_dvd.seed * 9.7)) - 0.5;
    float fly = edge * smoothstep(0.18, 0.90, fbm(vec2(gl_FragCoord.xy * 0.33 + heldFrameNumber())));
    c += mosquito * fly * (0.018 + 0.120 * u_dvd.mosquitoNoise);

    float boundary = blockBoundary(uv, px);
    c *= 1.0 - boundary * u_dvd.macroblockAmount * (0.018 + 0.080 * u_dvd.quantization);
    c += boundary * (hash(blockCoord(uv, px) + heldFrameNumber()) - 0.5) * 0.035 * u_dvd.packetLoss;

    return c;
}

vec3 applyIFramePop(vec2 uv, vec3 c) {
    float pulse = iframePulse();
    float px = blockPx();
    vec2 cell = blockCoord(uv, px);
    float resetNoise = hash(cell + vec2(gopNumber(), u_dvd.seed));
    float reset = smoothstep(0.35, 1.0, resetNoise) * pulse;

    vec3 cleaner = sampleChroma420(uv, 0.0);
    vec3 tooSharp = cleaner + (cleaner - sampleChroma420(blockCenterUV(uv, 8.0), 0.0)) * 0.18;
    c = mix(c, tooSharp, reset * 0.30);
    c += (resetNoise - 0.5) * reset * 0.055;

    return c;
}

vec3 applyBitFailures(vec2 uv, vec3 c) {
    float frame = heldFrameNumber();
    float px = blockPx();
    vec2 cell = blockCoord(uv, max(2.0, px * 0.25));
    vec2 macro = blockCoord(uv, px);

    float rot = step(
        1.0 - (0.0015 + 0.045 * u_dvd.bitRot),
        hash(cell + vec2(frame * 1.7, u_dvd.seed))
    );

    vec3 bitColor = vec3(
        hash(cell + 3.0),
        hash(cell + 31.0),
        hash(cell + 113.0)
    );
    bitColor = floor(bitColor * 4.0) / 3.0;
    c = mix(c, bitColor, rot * (0.45 + 0.40 * u_dvd.bitRot));

    float sparkle = step(
        1.0 - (0.002 + 0.075 * u_dvd.blockSparkle),
        hash(macro * vec2(2.1, 3.7) + vec2(frame, u_dvd.seed))
    );
    float checker = step(0.5, hash(floor(gl_FragCoord.xy * 0.5) + frame));
    vec3 hot = vec3(0.08, 0.88, 1.0) * (0.40 + 0.60 * checker) + vec3(0.75, 0.0, 0.38) * (1.0 - checker);
    c = mix(c, hot, sparkle * u_dvd.blockSparkle * 0.55);

    return c;
}

vec3 applyDeinterlaceComb(vec2 uv, vec3 c) {
    float edge = edgeSignal(uv);
    float line = mod(floor(gl_FragCoord.y), 2.0);
    vec2 texel = 1.0 / u_resolution;
    vec3 alternate = sampleRGB(uv + vec2(0.0, mix(-1.0, 1.0, line) * texel.y * 1.4));
    float comb = edge * u_dvd.deinterlaceComb;
    c = mix(c, alternate, comb * 0.26);
    c += (line - 0.5) * comb * 0.055;
    return c;
}

vec3 applyDecodeCurve(vec3 c) {
    c = saturate(c);
    float luma = dot(c, vec3(0.299, 0.587, 0.114));
    float legalClamp = smoothstep(0.015, 0.985, luma);
    c = mix(vec3(legalClamp), c, 0.92);

    // DVD failure often keeps a hard digital edge: clipped, posterized, sure of
    // itself. This is the opposite of VHS mush.
    c = mix(c, floor(c * 255.0 + 0.5) / 255.0, 0.28 * u_dvd.quantization);
    return saturate(c);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 sourceUV = uv;

    vec2 damagedUV = applySliceTear(uv);
    damagedUV = applyMotionVectorFault(damagedUV);

    float packet = packetMask(damagedUV);

    vec3 damaged = sampleChroma420(damagedUV, packet);
    damaged = applyBlockDecode(damagedUV, damaged);
    damaged = applyQuantization(damagedUV, damaged);
    damaged = applyDCTTexture(damagedUV, damaged);
    damaged = applyIFramePop(damagedUV, damaged);
    damaged = applyBitFailures(damagedUV, damaged);
    damaged = applyDeinterlaceComb(damagedUV, damaged);
    damaged = applyDecodeCurve(damaged);

    vec3 inColor = texture(u_image, sourceUV).rgb;
    vec3 blended = blendWithColorSpace(inColor, damaged, u_dvd.blendAmount);

    outColor = vec4(blended, texture(u_image, sourceUV).a);
}
