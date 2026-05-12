#version 300 es
precision highp float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;

struct ProjectorParams {
    float seed;
    float t;
    float blendAmount;

    float gateWeave;
    float frameSlip;
    float shutterFlicker;
    float lampInstability;

    float focusBlur;
    float lensBreathing;
    float chromaticFringe;
    float keystoneWarp;

    float dustAmount;
    float scratchAmount;
    float burnAmount;
    float sprocketShadow;

    float vignette;
    float gateShadow;
};

uniform ProjectorParams u_projector;

out vec4 outColor;

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;

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
    p3 += dot(p3, p3.yzx + 31.31);
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
        p = p * 2.07 + vec2(17.2, 9.4);
        a *= 0.5;
    }
    return v;
}

float frameNumber() {
    return floor(u_projector.t * 18.0);
}

vec2 safeUV(vec2 uv) {
    return clamp(uv, vec2(0.001), vec2(0.999));
}

vec3 sampleRGB(vec2 uv) {
    return texture(u_image, safeUV(uv)).rgb;
}

float band(float x, float center, float width) {
    return 1.0 - smoothstep(width * 0.35, width, abs(x - center));
}

vec2 applyProjectorTransport(vec2 uv, out float frameLine) {
    float frame = frameNumber();
    float seed = u_projector.seed;
    float t = u_projector.t;

    // Gate weave is not a wavy cable fault. It is the film physically failing to sit still.
    vec2 held = vec2(
        valueNoise(vec2(frame * 0.43 + seed, 2.1)),
        valueNoise(vec2(frame * 0.39 + seed, 8.7))
    ) - 0.5;

    vec2 servo = vec2(
        sin(t * 1.7 + seed) + 0.45 * sin(t * 4.9 + seed * 0.2),
        cos(t * 1.3 + seed * 1.7) + 0.35 * sin(t * 5.7 + seed)
    );

    uv += (held * vec2(0.018, 0.010) + servo * vec2(0.0028, 0.0020)) * u_projector.gateWeave;

    // Intermittent claw miss: the frame yanks vertically, sometimes exposing the frame bar.
    float slipChance = smoothstep(
        1.0 - (0.015 + 0.20 * u_projector.frameSlip),
        1.0,
        hash(vec2(frame, seed + 19.0))
    );
    float slipDir = hash(vec2(frame + 4.0, seed)) < 0.5 ? -1.0 : 1.0;
    float slip = slipDir * slipChance * (0.035 + 0.22 * hash(vec2(seed, frame + 71.0))) * u_projector.frameSlip;
    uv.y = fract(uv.y + slip);

    float seam = min(fract(uv.y), 1.0 - fract(uv.y));
    frameLine = (1.0 - smoothstep(0.004, 0.026 + 0.05 * u_projector.frameSlip, seam)) * slipChance;

    return uv;
}

vec2 applyLensAndGate(vec2 uv) {
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 centered = uv - 0.5;
    vec2 roundSpace = vec2(centered.x * aspect, centered.y);
    float r2 = dot(roundSpace, roundSpace);

    float breathe = (valueNoise(vec2(u_projector.t * 0.23 + u_projector.seed, 5.0)) - 0.5) * 0.045;
    float scale = 1.0 + breathe * u_projector.lensBreathing;

    // Broken projector optics bend the whole image a little, especially near the gate.
    centered *= scale * (1.0 + r2 * 0.035 * u_projector.lensBreathing);
    centered.x += centered.y * u_projector.keystoneWarp * 0.075;
    centered.x += centered.y * centered.y * u_projector.keystoneWarp * 0.060;

    return centered + 0.5;
}

vec3 focusSample(vec2 uv) {
    vec2 texel = 1.0 / u_resolution;
    float r = u_projector.focusBlur * u_projector.focusBlur;
    vec2 d1 = texel * mix(0.35, 3.7, r);
    vec2 d2 = texel * mix(0.70, 7.0, r);

    vec3 c = sampleRGB(uv) * 0.40;
    c += sampleRGB(uv + vec2(d1.x, 0.0)) * 0.115;
    c += sampleRGB(uv - vec2(d1.x, 0.0)) * 0.115;
    c += sampleRGB(uv + vec2(0.0, d1.y)) * 0.095;
    c += sampleRGB(uv - vec2(0.0, d1.y)) * 0.095;
    c += sampleRGB(uv + d2) * 0.045;
    c += sampleRGB(uv - d2) * 0.045;
    c += sampleRGB(uv + vec2(d2.x, -d2.y)) * 0.045;
    c += sampleRGB(uv + vec2(-d2.x, d2.y)) * 0.045;

    return c;
}

vec3 sampleBadOptics(vec2 uv, vec2 screenUV) {
    vec3 c = focusSample(uv);

    vec2 fromCenter = screenUV - 0.5;
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 radial = vec2(fromCenter.x * aspect, fromCenter.y);
    float radius = length(radial);
    vec2 dir = normalize(fromCenter + vec2(0.0001));
    vec2 fringe = dir * (1.0 + radius * 4.0) * u_projector.chromaticFringe * 2.8 / u_resolution;

    // Lens color separation: not RGB channel glitch, glass failing at the edge.
    c.r = mix(c.r, sampleRGB(uv + fringe).r, u_projector.chromaticFringe);
    c.b = mix(c.b, sampleRGB(uv - fringe).b, u_projector.chromaticFringe);

    return c;
}

float speckLayer(vec2 uv, float scale, float seed, float density, float minRadius, float maxRadius) {
    vec2 p = uv * scale;
    vec2 cell = floor(p);
    vec2 local = fract(p);
    vec2 center = vec2(
        hash(cell + vec2(seed, 1.7)),
        hash(cell + vec2(8.3, seed))
    );

    float rnd = hash(cell + vec2(seed * 2.1, 11.0));
    float activeCell = step(1.0 - density, rnd);
    float radius = mix(minRadius, maxRadius, hash(cell + seed));
    float d = length(local - center);
    return activeCell * (1.0 - smoothstep(radius, radius + 0.055, d));
}

float dustAndHair(vec2 uv) {
    float frame = frameNumber();
    float amt = u_projector.dustAmount;

    // Two worlds: projector/lens dirt is locked to the screen, film dirt hops with frames.
    float lensDust = speckLayer(uv, 72.0, u_projector.seed + 13.0, 0.10 * amt, 0.030, 0.115);
    float filmDust = speckLayer(uv + vec2(0.0, frame * 0.013), 108.0, frame + u_projector.seed, 0.18 * amt, 0.018, 0.080);

    float hairX = 0.12 + 0.76 * valueNoise(vec2(floor(frame * 0.12) + u_projector.seed, 31.0));
    float hairWobble = sin(uv.y * 15.0 + u_projector.t * 0.8 + u_projector.seed) * 0.012;
    float hairLife = smoothstep(0.72, 0.97, valueNoise(vec2(floor(frame * 0.08), u_projector.seed + 55.0)));
    float hair = (1.0 - smoothstep(0.0015, 0.012, abs(uv.x - hairX - hairWobble))) * hairLife * amt;
    hair *= smoothstep(0.02, 0.24, uv.y) * (1.0 - smoothstep(0.72, 0.98, uv.y));

    return saturate(lensDust + filmDust + hair * 0.85);
}

float scratchMask(vec2 uv) {
    float frame = frameNumber();
    float amt = u_projector.scratchAmount;
    float lanes = 52.0;
    float lane = floor(uv.x * lanes);

    float family = floor(frame * 0.055 + hash(vec2(lane, u_projector.seed)) * 9.0);
    float x = (lane + hash(vec2(lane, family + u_projector.seed))) / lanes;
    float width = mix(0.00055, 0.0045, hash(vec2(family, lane + 4.0)));
    float life = step(1.0 - (0.020 + 0.30 * amt), hash(vec2(lane, family + 17.0)));

    float broken = smoothstep(0.18, 0.92, fbm(vec2(uv.y * 19.0, lane * 0.37 + family)));
    float wiggle = (valueNoise(vec2(uv.y * 8.0, family + lane)) - 0.5) * 0.006 * amt;
    float line = 1.0 - smoothstep(width, width * 5.5, abs(uv.x - x - wiggle));

    float brightOrDark = hash(vec2(lane + 8.0, family));
    return line * broken * life * amt * mix(-1.0, 1.0, step(0.54, brightOrDark));
}

float sprocketAndGate(vec2 uv) {
    float edge = (1.0 - smoothstep(0.0, 0.090, uv.x)) + smoothstep(0.910, 1.0, uv.x);
    float holes = 1.0 - smoothstep(0.18, 0.35, abs(fract((uv.y + u_projector.t * 0.08) * 8.0) - 0.5));
    float flutter = 0.55 + 0.45 * valueNoise(vec2(frameNumber() * 0.21 + u_projector.seed, floor(uv.y * 8.0)));
    return saturate(edge * holes * flutter * u_projector.sprocketShadow);
}

vec3 applyLampAndSurface(vec2 uv, vec3 c, float frameLine) {
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
    float r = length(p);

    float shutter = 1.0 - u_projector.shutterFlicker * (
        0.055 +
        0.075 * pow(0.5 + 0.5 * sin(u_projector.t * TAU * 18.0), 3.0) +
        0.090 * hash(vec2(frameNumber(), u_projector.seed))
    );

    float lampBreath = 1.0 + (valueNoise(vec2(u_projector.t * 0.45 + u_projector.seed, 14.0)) - 0.5) * 0.26 * u_projector.lampInstability;
    float hotspot = 1.0 - smoothstep(0.05, 0.95, r);
    c *= shutter * lampBreath;
    c *= mix(1.0, 0.70 + 0.52 * hotspot, u_projector.lampInstability);

    float vignette = 1.0 - smoothstep(0.25, 0.92, r);
    c *= mix(1.0, vignette, u_projector.vignette);

    float gateX = smoothstep(0.0, 0.035, uv.x) * smoothstep(0.0, 0.035, 1.0 - uv.x);
    float gateY = smoothstep(0.0, 0.030, uv.y) * smoothstep(0.0, 0.030, 1.0 - uv.y);
    c *= mix(1.0, gateX * gateY, u_projector.gateShadow);

    c *= 1.0 - frameLine * (0.52 + 0.40 * u_projector.frameSlip);
    c *= 1.0 - sprocketAndGate(uv) * 0.62;

    return c;
}

vec3 applyFilmDamage(vec2 uv, vec3 c) {
    float dust = dustAndHair(uv);
    c = mix(c, vec3(0.015, 0.012, 0.010), dust * (0.34 + 0.38 * u_projector.dustAmount));

    float scratch = scratchMask(uv);
    c += max(scratch, 0.0) * vec3(0.48, 0.45, 0.38);
    c *= 1.0 - max(-scratch, 0.0) * 0.72;

    // Heat at the gate: amber bloom, then punched-out white/orange when pushed.
    vec2 burnUV = (uv - 0.5) * vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
    float burnField = fbm(burnUV * 5.0 + vec2(u_projector.seed, u_projector.t * 0.26));
    float burnShape = smoothstep(0.82 - 0.52 * u_projector.burnAmount, 1.0, burnField + 0.24 * (1.0 - length(burnUV)));
    vec3 amber = vec3(1.0, 0.48, 0.12);
    c = mix(c, amber, burnShape * u_projector.burnAmount * 0.34);
    c += burnShape * u_projector.burnAmount * vec3(0.34, 0.12, 0.03);

    return saturate(c);
}

vec3 applyPrintResponse(vec3 c) {
    // Projection print response: lifted blacks, warm lamp, slightly dirty whites.
    float luma = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(luma), 0.055);
    c = pow(max(c, vec3(0.0)), vec3(0.92, 0.95, 1.02));
    c *= vec3(1.045, 1.000, 0.930);
    c += vec3(0.010, 0.008, 0.004);
    return saturate(c);
}

void main() {
    vec2 screenUV = gl_FragCoord.xy / u_resolution;

    float frameLine = 0.0;
    vec2 uv = applyProjectorTransport(screenUV, frameLine);
    uv = applyLensAndGate(uv);

    vec3 projected = sampleBadOptics(uv, screenUV);
    projected = applyPrintResponse(projected);
    projected = applyFilmDamage(screenUV, projected);
    projected = applyLampAndSurface(screenUV, projected, frameLine);

    vec4 src = texture(u_image, safeUV(screenUV));
    vec3 blended = blendWithColorSpace(src.rgb, projected, u_projector.blendAmount);
    outColor = vec4(blended, src.a);
}