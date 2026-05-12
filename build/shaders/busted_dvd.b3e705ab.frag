#version 300 es
precision highp float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform sampler2D u_noise;
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
    float sliceTear;

    float quantization;
    float dctRinging;
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
const float EPS = 0.001;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec2 saturate(vec2 x) {
    return clamp(x, vec2(0.0), vec2(1.0));
}

vec3 saturate(vec3 x) {
    return clamp(x, vec3(0.0), vec3(1.0));
}

float enabled(float x) {
    return step(EPS, x);
}

vec2 noiseOffset(float salt) {
    return fract(vec2(0.173, -0.119) * salt + vec2(0.011, 0.017) * u_dvd.seed);
}

vec4 sampleNoise(vec2 uv, float salt) {
    return texture(u_noise, fract(uv + noiseOffset(salt)));
}

vec4 sampleNoiseFrag(vec2 frag, float salt) {
    return sampleNoise((frag + 0.5) / u_resolution, salt);
}

vec4 sampleNoiseSlice(float slice, float sliceCount, float salt) {
    float count = max(sliceCount, 1.0);
    return sampleNoise(vec2(0.5, (slice + 0.5) / count), salt);
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

vec2 blockGrid(float px) {
    return max(vec2(1.0), floor(u_resolution / max(px, 1.0)));
}

vec4 sampleNoiseCell(vec2 cell, float px, float salt) {
    vec2 grid = blockGrid(px);
    return sampleNoise((cell + 0.5) / grid, salt);
}

vec2 blockCoord(vec2 uv, float px) {
    return floor(uv * blockGrid(px));
}

vec2 blockLocal(vec2 uv, float px) {
    return fract(uv * blockGrid(px));
}

vec2 blockCenterUV(vec2 uv, float px) {
    vec2 grid = blockGrid(px);
    return (floor(uv * grid) + 0.5) / grid;
}

float blockBoundary(vec2 uv, float px) {
    vec2 local = blockLocal(uv, px);
    vec2 edge = min(local, 1.0 - local);
    float line = 1.0 - smoothstep(0.0, 0.055, min(edge.x, edge.y));
    return line;
}

float packetMask(vec2 uv) {
    float amt = u_dvd.packetLoss * enabled(u_dvd.packetLoss);

    float px = blockPx();
    vec2 cell = blockCoord(uv, px);
    float frame = heldFrameNumber();
    float gop = gopNumber();

    vec4 blockNoise = sampleNoiseCell(cell, px, frame * 0.11 + gop * 1.7 + 5.0);
    float badBlock = smoothstep(
        1.0 - (0.010 + 0.170 * u_dvd.packetLoss),
        1.0,
        blockNoise.r
    );

    float sliceCount = mix(18.0, 54.0, u_dvd.sliceTear);
    float slice = floor(uv.y * sliceCount);
    vec4 sliceNoise = sampleNoiseSlice(slice, sliceCount, frame * 0.27 + gop * 1.3 + 17.0);

    float badSlice = step(
        1.0 - (0.010 + 0.115 * u_dvd.packetLoss + 0.060 * u_dvd.sliceTear),
        sliceNoise.g
    );

    float breakupNoise = sampleNoise(
        vec2(uv.x * 9.0, (slice + 0.5) / max(sliceCount, 1.0)),
        frame * 0.23 + 23.0
    ).b;

    float sliceBreakup = smoothstep(0.18, 0.88, breakupNoise);

    float burstCenter = fract(sampleNoise(vec2(0.37, 0.61), gop + 41.0).r + u_dvd.t * 0.041);
    float burstBand = 1.0 - smoothstep(0.014, 0.130, abs(uv.y - burstCenter));

    float burst = burstBand * smoothstep(
        0.78,
        1.0,
        sampleNoise(vec2(0.73, 0.29), gop + floor(frame / 3.0) + 73.0).a
    );

    return saturate(max(badBlock, badSlice * sliceBreakup) + burst * 0.65) * amt;
}

vec2 applySliceTear(vec2 uv) {
    float amt = u_dvd.sliceTear * enabled(u_dvd.sliceTear);

    float frame = heldFrameNumber();
    float sliceCount = mix(18.0, 70.0, u_dvd.sliceTear);
    float slice = floor(uv.y * sliceCount);

    vec4 sliceNoise = sampleNoiseSlice(slice, sliceCount, frame * 0.19 + 101.0);

    float bad = step(
        1.0 - (0.018 + 0.120 * u_dvd.sliceTear),
        sliceNoise.r
    );

    float offset = (sliceNoise.g - 0.5) * 0.13;

    float zipper = (
        sampleNoise(
            vec2(uv.x * 11.0, (slice + 0.5) / max(sliceCount, 1.0)),
            frame + 131.0
        ).b - 0.5
    ) * 0.018;

    uv.x += (offset + zipper) * bad * amt;
    return uv;
}

vec2 applyMotionVectorFault(vec2 uv, float packet) {
    float mv = u_dvd.motionVectorGlitch * enabled(u_dvd.motionVectorGlitch);
    float conceal = u_dvd.errorConceal * enabled(u_dvd.errorConceal);

    float px = blockPx();
    vec2 cell = blockCoord(uv, px);
    float frame = heldFrameNumber();
    float gop = gopNumber();

    vec2 drift = sampleNoiseCell(cell, px, gop + 151.0).rg - 0.5;
    drift = sign(drift) * pow(abs(drift), vec2(0.55));

    float activeBlock = enabled(u_dvd.motionVectorGlitch) * smoothstep(
        1.0 - (0.012 + 0.180 * u_dvd.motionVectorGlitch),
        1.0,
        sampleNoiseCell(cell, px, gop * 7.0 + frame * 0.13 + 173.0).b
    );

    // MPEG prediction failure feels like a confident copy from the wrong block:
    // rectangular, stepped, and temporally sticky. Not a wavy cable. A bad guess.
    vec2 vectorPx = drift * mix(2.0, 72.0, u_dvd.motionVectorGlitch);
    uv += activeBlock * vectorPx / u_resolution;

    float smear = smoothstep(0.62, 1.0, activeBlock * mv + packet * 0.8);
    vec2 smearDir = normalize(drift + vec2(0.001));
    uv += smearDir * px * 0.35 / u_resolution * smear * conceal;

    return uv;
}

vec3 sampleChroma420(vec2 uv, float damage) {
    float px = blockPx();
    float frame = heldFrameNumber();
    vec2 cell = blockCoord(uv, px);

    float chromaActive = enabled(max(
        max(u_dvd.chromaSubsample, u_dvd.chromaMisalign),
        u_dvd.colorTableSlip
    ));

    float misalign = u_dvd.chromaMisalign * enabled(u_dvd.chromaMisalign);
    float slipActive = enabled(u_dvd.colorTableSlip);

    vec3 baseRgb = sampleRGB(uv);
    vec3 yccLuma = rgbToYcbcr(baseRgb);

    float chromaPx = mix(2.0, 18.0 + px * 0.42, u_dvd.chromaSubsample);
    vec2 chromaUV = blockCenterUV(uv, chromaPx);

    vec2 chromaStepA = sampleNoiseCell(cell, px, frame + 191.0).rg - 0.5;
    chromaStepA *= vec2(3.0 + 13.0 * u_dvd.chromaMisalign) / u_resolution;
    chromaUV += chromaStepA * misalign * (0.35 + damage);

    vec3 yccChroma = rgbToYcbcr(sampleRGB(chromaUV));
    vec2 cbcr = yccChroma.yz;

    float slip = smoothstep(
        1.0 - (0.006 + 0.125 * u_dvd.colorTableSlip),
        1.0,
        sampleNoiseCell(cell, px, gopNumber() + 211.0).a
    );

    float slipAmount = slip * u_dvd.colorTableSlip * slipActive;

    vec2 chromaStepB = sampleNoiseCell(cell, px, frame + 223.0).rg - 0.5;
    chromaStepB *= vec2(3.0 + 13.0 * u_dvd.chromaMisalign) / u_resolution;

    vec2 wrongCbcr = rgbToYcbcr(
        sampleRGB(blockCenterUV(uv + chromaStepB * 8.0, px * 2.0))
    ).zy;

    cbcr = mix(cbcr, wrongCbcr, slipAmount);
    cbcr += (sampleNoiseCell(cell, px, frame + 229.0).ba - 0.5) * 0.10 * slipAmount;

    vec3 ycc = vec3(yccLuma.x, cbcr);
    vec3 chromaRgb = ycbcrToRgb(ycc);

    return mix(baseRgb, chromaRgb, chromaActive);
}

vec3 applyBlockDecode(vec2 uv, vec3 c, float packet) {
    float macroblock = u_dvd.macroblockAmount * enabled(u_dvd.macroblockAmount);
    float conceal = u_dvd.errorConceal * enabled(u_dvd.errorConceal);

    float px = blockPx();
    float frame = heldFrameNumber();
    vec2 cell = blockCoord(uv, px);

    vec2 fineUV = blockCenterUV(uv, max(4.0, px * 0.5));
    vec3 fine = sampleChroma420(fineUV, packet);

    float baseBlockiness = macroblock * (0.35 + 0.55 * u_dvd.quantization);
    c = mix(c, fine, baseBlockiness * 0.42);

    vec2 coarseUV = blockCenterUV(uv, px);
    vec3 coarse = sampleChroma420(coarseUV, packet);
    c = mix(c, coarse, packet * (0.40 + 0.55 * u_dvd.errorConceal));

    vec2 donorDir = sampleNoiseCell(cell, px, frame * 0.17 + 251.0).rg - 0.5;
    vec2 donorUV = coarseUV + donorDir * px * mix(0.5, 3.5, u_dvd.errorConceal) / u_resolution;
    vec3 donor = sampleChroma420(donorUV, packet);
    c = mix(c, donor, packet * conceal * 0.62);

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
    vec3 yccBase = rgbToYcbcr(c);
    vec3 ycc = yccBase;

    float px = blockPx();
    vec2 cell = blockCoord(uv, px);

    float quantActive = enabled(max(u_dvd.quantization, u_dvd.chromaSubsample));
    float banding = u_dvd.banding * enabled(u_dvd.banding);

    float dither = sampleNoiseFrag(gl_FragCoord.xy, heldFrameNumber() + 271.0).a - 0.5;

    float yLevels = mix(256.0, 18.0, u_dvd.quantization);
    float cLevels = mix(224.0, 10.0, saturate(u_dvd.quantization + u_dvd.chromaSubsample * 0.25));

    float blockBias = (sampleNoiseCell(cell, px, gopNumber() + 293.0).r - 0.5) * u_dvd.quantization;

    ycc.x = floor(ycc.x * yLevels + dither * 0.82 + blockBias) / yLevels;
    ycc.yz = floor((ycc.yz + 0.5) * cLevels + dither * 0.55 + blockBias) / cLevels - 0.5;

    ycc = mix(yccBase, ycc, quantActive);

    float bandLevels = mix(256.0, 28.0, u_dvd.banding);
    float bandedY = floor(ycc.x * bandLevels + 0.5) / bandLevels;
    ycc.x = mix(ycc.x, bandedY, banding * (0.35 + 0.45 * u_dvd.quantization));

    return ycbcrToRgb(ycc);
}

vec3 applyDCTTexture(vec2 uv, vec3 c, float edge) {
    float px = blockPx();

    float dctActive = enabled(u_dvd.dctRinging);
    float packet = u_dvd.packetLoss * enabled(u_dvd.packetLoss);

    vec2 local8 = fract(uv * u_resolution / 8.0) - 0.5;
    vec2 localBlock = blockLocal(uv, px) - 0.5;

    float basis8 = cos(local8.x * PI * 8.0) * 0.55 + cos(local8.y * PI * 8.0) * 0.45;
    float basisBlock = cos(localBlock.x * PI * 2.0) * cos(localBlock.y * PI * 2.0);
    float ring = (basis8 * 0.65 + basisBlock * 0.35) * edge;

    c += ring * (0.010 + 0.070 * u_dvd.dctRinging) * dctActive;

    c += (
        sampleNoiseCell(blockCoord(uv, px), px, heldFrameNumber() + 311.0).g - 0.5
    ) * 0.035 * packet;

    return c;
}

vec3 applyBitFailures(vec2 uv, vec3 c) {
    float bitRot = u_dvd.bitRot * enabled(u_dvd.bitRot);
    float sparkleAmt = u_dvd.blockSparkle * enabled(u_dvd.blockSparkle);

    float frame = heldFrameNumber();
    float px = blockPx();
    float bitPx = max(2.0, px * 0.25);

    vec2 cell = blockCoord(uv, bitPx);

    float rot = step(
        1.0 - (0.045 * u_dvd.bitRot),
        sampleNoiseCell(cell, bitPx, frame * 1.7 + 331.0).a
    );

    vec3 bitColor = sampleNoiseCell(cell, bitPx, frame + 337.0).rgb;
    bitColor = floor(bitColor * 4.0) / 3.0;

    c = mix(c, bitColor, rot * bitRot * (0.45 + 0.40 * u_dvd.bitRot));

    vec2 macro = blockCoord(uv, px);

    float sparkle = step(
        1.0 - (0.002 + 0.075 * u_dvd.blockSparkle),
        sampleNoiseCell(macro, px, frame + 353.0).a
    );

    float checker = step(
        0.5,
        sampleNoiseFrag(floor(gl_FragCoord.xy * 0.5) * 2.0, frame + 367.0).b
    );

    vec3 hot =
        vec3(0.08, 0.88, 1.0) * (0.40 + 0.60 * checker) +
        vec3(0.75, 0.0, 0.38) * (1.0 - checker);

    c = mix(c, hot, sparkle * sparkleAmt * 0.55);

    return c;
}

vec3 applyDeinterlaceComb(vec2 uv, vec3 c, float edge) {
    float combAmt = u_dvd.deinterlaceComb * enabled(u_dvd.deinterlaceComb);

    float line = mod(floor(gl_FragCoord.y), 2.0);
    vec2 texel = 1.0 / u_resolution;

    vec3 alternate = sampleRGB(
        uv + vec2(0.0, mix(-1.0, 1.0, line) * texel.y * 1.4)
    );

    float comb = edge * combAmt;

    c = mix(c, alternate, comb * 0.26);
    c += (line - 0.5) * comb * 0.055;

    return c;
}

vec3 applyDecodeCurve(vec3 c) {
    float quant = u_dvd.quantization * enabled(u_dvd.quantization);

    c = saturate(c);

    float luma = dot(c, vec3(0.299, 0.587, 0.114));
    float legalClamp = smoothstep(0.015, 0.985, luma);
    c = mix(vec3(legalClamp), c, 0.92);

    // DVD failure often keeps a hard digital edge: clipped, posterized, sure of
    // itself. This is the opposite of VHS mush.
    c = mix(c, floor(c * 255.0 + 0.5) / 255.0, 0.28 * quant);

    return saturate(c);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 sourceUV = uv;

    vec4 src = texture(u_image, sourceUV);

    vec2 damagedUV = uv;

    damagedUV = applySliceTear(damagedUV);

    float packet = packetMask(damagedUV);

    damagedUV = applyMotionVectorFault(damagedUV, packet);

    vec3 damaged = sampleChroma420(damagedUV, packet);

    damaged = applyBlockDecode(damagedUV, damaged, packet);
    damaged = applyQuantization(damagedUV, damaged);

    float edge = edgeSignal(damagedUV);

    damaged = applyDCTTexture(damagedUV, damaged, edge);
    damaged = applyBitFailures(damagedUV, damaged);
    damaged = applyDeinterlaceComb(damagedUV, damaged, edge);

    damaged = applyDecodeCurve(damaged);

    vec3 blended = blendWithColorSpace(src.rgb, damaged, u_dvd.blendAmount);
    outColor = vec4(blended, src.a);
}