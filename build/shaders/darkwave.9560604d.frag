#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_shiftNorm;
uniform float u_spreadNorm;
uniform float u_threshold;
uniform float u_bleed;
uniform float u_satNorm;
uniform float u_lightNorm;
uniform float u_blendamount;
uniform float u_bandingSteps;
uniform float u_duty;
uniform vec2 u_origin;
uniform float u_baseHue;
uniform float u_shadowPower;
uniform float u_voidAmount;
uniform float u_falloff;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"


float modulateDarkWave(float signal, float spread, float shift) {
    float p = fract(signal * spread + shift);
    float duty = clamp(u_duty, 0.01, 0.99);

#if WAVETYPE == 0
    // Sawtooth: slow crawl into the dark, then a hard drop.
    return (p < duty)
        ? p / duty
        : 0.0;
#elif WAVETYPE == 1
    // Triangle: the shadow breathes in, then out.
    return (p < duty)
        ? p / duty
        : (1.0 - p) / (1.0 - duty);
#elif WAVETYPE == 2
    // Sine: soft occult pulse.
    return 0.5 + 0.5 * sin(6.2831853 * p);
#elif WAVETYPE == 3
    // Square: hard portal split.
    return step(duty, p);
#else
    #error invalid wave type
#endif
}

float bandCount() {
    return max(floor(u_bandingSteps + 1.0), 1.0);
}

float bandIndexFromPhase(float phase) {
    float count = bandCount();
    return floor(clamp(phase, 0.0, 0.999999) * count);
}

float paletteHue(float bandIndex, float count, float baseHue) {
    float base = fract(baseHue);
    float denom = max(count - 1.0, 1.0);
    float t = bandIndex / denom;

#if PALETTE_MODE == 0
    // Full hue-wheel walk.
    return fract(base + bandIndex / count);

#elif PALETTE_MODE == 1
    // Nocturne ribbon: narrow violet/blue/green bruise field.
    float arc = 0.18;
    float wobble = sin((bandIndex + 1.0) * 1.6180339) * 0.025;
    return fract(base + (t - 0.5) * arc + wobble);

#elif PALETTE_MODE == 2
    // Ember cuts inside a cold base.
    float k = mod(bandIndex, 7.0);

    if (k < 0.5) return fract(base);
    if (k < 1.5) return fract(base + 0.030);
    if (k < 2.5) return fract(base - 0.040);
    if (k < 3.5) return fract(base + 0.075);
    if (k < 4.5) return fract(base - 0.065);

    // Infrequent hot wounds.
    if (k < 5.5) return fract(base + 0.31);

    return fract(base + 0.39);

#elif PALETTE_MODE == 3
    // Spectral underworld: cyan, violet, green, magenta, then back to the pit.
    float k = mod(bandIndex, 8.0);

    if (k < 0.5) return fract(base);
    if (k < 1.5) return fract(base + 0.08);
    if (k < 2.5) return fract(base - 0.06);
    if (k < 3.5) return fract(base + 0.47);
    if (k < 4.5) return fract(base + 0.55);
    if (k < 5.5) return fract(base + 0.67);
    if (k < 6.5) return fract(base - 0.13);

    return fract(base + 0.02);

#else
    #error invalid palette mode
#endif
}

vec3 crushIntoVoid(vec3 color, float depth, float mask) {
    float voidMix = clamp(u_voidAmount * depth * mask, 0.0, 1.0);
    vec3 coldBlack = vec3(0.005, 0.003, 0.012);
    return mix(color, coldBlack + color * (1.0 - u_voidAmount), voidMix);
}


vec4 darkworld(vec2 uv) {
    vec3 srgb = texture(u_image, uv).rgb;
    vec3 linear = srgb2linear(srgb);
    float luma = luminance(linear);

    float threshold = clamp(u_threshold, 0.0, 0.99);
    float falloff = max(u_falloff, 1e-5);

    float mask = 1.0 - smoothstep(threshold, min(threshold + falloff, 1.0), luma);
    if (mask <= 0.0001) {
        return vec4(srgb, 1.0);
    }

    float rawDepth = clamp((threshold - luma) / max(threshold, 1e-5), 0.0, 1.0);
    float depth = pow(rawDepth, max(u_shadowPower, 1e-5));

#if DARKWORLD_CYCLE == 0
    vec3 inLCH = rgb2hsv(srgb);
#elif DARKWORLD_BLEED == 1
    vec3 inLCH = rgb2hsv(srgb);
#endif

    float hue;
    float spreadNorm = max(u_spreadNorm, 1e-5);

#if DARKWORLD_CYCLE == 0
    float signal = inLCH.x;
#elif DARKWORLD_CYCLE == 1
    // Shadow mode: hue motion comes from darkness itself.
    float signal = depth;
#else
    vec2 delta = gl_FragCoord.xy - u_origin;
    float spatialSignal;
#if SPATIAL_PATTERN == 0
    // radial
    spatialSignal = length(delta);
#elif SPATIAL_PATTERN == 1
    // horizontal
    spatialSignal = delta.x;
#elif SPATIAL_PATTERN == 2
    // vertical
    spatialSignal = delta.y;
#elif SPATIAL_PATTERN == 3
    // diagonal
    spatialSignal = dot(delta, normalize(vec2(1.0, 1.0)));
#elif SPATIAL_PATTERN == 4
    // torn angular pattern
    spatialSignal = fract(atan(delta.y, delta.x)) * (delta.x + delta.y);
#elif SPATIAL_PATTERN == 5
    // checkerboard-ish, but swallowed by shadow depth
    spatialSignal = (sin(delta.x / 20. / spreadNorm) + sin(delta.y / 20. / spreadNorm)) * (delta.x + delta.y);
#elif SPATIAL_PATTERN == 6
    // smooth angular sweep
    spatialSignal = atan(delta.y, delta.x) * 6.28 * spreadNorm;
#else
    #error invalid spatial pattern
#endif
    float signal = spatialSignal / length(u_resolution);
#endif

#if WAVETYPE == 3
    float selector = modulateDarkWave(signal, spreadNorm, u_shiftNorm);
    float base = fract(u_baseHue);
    float alt  = fract(base + 0.5);
    hue = mix(base, alt, selector);
#else
    float phase = clamp(modulateDarkWave(signal, spreadNorm, u_shiftNorm), 0.0, 0.999);
    #if USE_BANDING == 1
        float count = bandCount();
        float idx = bandIndexFromPhase(phase);
        hue = paletteHue(idx, count, u_baseHue);
    #else
        #if PALETTE_MODE == 0
            hue = fract(phase + u_baseHue);
        #else
            // Palette modes are meant to feel cut, like light seen through broken glass.
            // Without explicit banding, choose a fixed hidden step grid.
            float count = 8.0;
            float idx = floor(phase * count);
            hue = paletteHue(idx, count, u_baseHue);
        #endif
    #endif
#endif

#if DARKWORLD_BLEED == 1
    hue = mix(hue, inLCH.x, u_bleed);
#endif

    float glow = clamp(u_lightNorm * mix(0.45, 1.35, depth), 0.0, 1.0);
    float sat = clamp(u_satNorm * mix(0.75, 1.25, depth), 0.0, 1.0);
    vec3 fx = hsv2rgb(vec3(hue, sat, glow));

    vec3 blended = blendWithColorSpace(srgb, fx, u_blendamount * mask);
    vec3 outRGB = crushIntoVoid(blended, depth, mask);

    // Preserve a little source texture, otherwise shadows become flat soup.
    outRGB = mix(outRGB, outRGB * (0.65 + 0.35 * srgb), mask * depth * 0.35);

    return vec4(outRGB, 1.0);
}


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    outColor = clamp(darkworld(uv), 0., 1.);
}
