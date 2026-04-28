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

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"


float modulateHueWave(float signal, float spread, float shift) {
    float p = fract(signal * spread + shift);
    float duty = clamp(u_duty, 0.01, 0.99);

#if WAVETYPE == 0
    // Sawtooth (asymmetric ramp)
    return (p < duty)
        ? p / duty
        : 0.0;
#elif WAVETYPE == 1
    // Triangle (skewed)
    return (p < duty)
        ? p / duty
        : (1.0 - p) / (1.0 - duty);
#elif WAVETYPE == 2
    // Sine (not duty-sensitive for now)
    return 0.5 + 0.5 * sin(6.2831853 * p);
#elif WAVETYPE == 3
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
    // full hue-wheel walk.
    return fract(base + bandIndex / count);

#elif PALETTE_MODE == 1
    // Analogous ribbon.
    float arc = 0.22;
    return fract(base + (t - 0.5) * arc);

#elif PALETTE_MODE == 2
    // Analogous with cool/warm accent.
    float k = mod(bandIndex, 6.0);

    if (k < 0.5) return fract(base);
    if (k < 1.5) return fract(base + 0.035);
    if (k < 2.5) return fract(base - 0.045);
    if (k < 3.5) return fract(base + 0.085);
    if (k < 4.5) return fract(base - 0.075);

    return fract(base + 0.54);

#elif PALETTE_MODE == 3
    // Dusty split-accent loop.
    float k = mod(bandIndex, 7.0);

    if (k < 0.5) return fract(base);
    if (k < 1.5) return fract(base + 0.025);
    if (k < 2.5) return fract(base - 0.035);
    if (k < 3.5) return fract(base + 0.070);

    // Split accents, softened by being less frequent.
    if (k < 4.5) return fract(base + 0.44);
    if (k < 5.5) return fract(base + 0.58);

    return fract(base - 0.085);

#else
    #error invalid palette mode
#endif
}

float quantize(float v, float steps) {
    return floor(v * steps) / steps;
}


vec4 chromawave(vec2 uv) {
    vec3 srgb = texture(u_image, uv).rgb;
    float luma = luminance(srgb2linear(srgb));
    if (luma < u_threshold) {
        return vec4(
           blendWithColorSpace(srgb, vec3(0.0, 0.0, 0.0), u_blendamount), 1.
        );
    }

#if CHROMAWAVE_CYCLE == 0
    vec3 inLCH = rgb2hsv(srgb);
#elif CHROMAWAVE_BLEED == 1
    vec3 inLCH = rgb2hsv(srgb);
#endif
    float hue;
    float spreadNorm = max(u_spreadNorm, 1e-5);

#if CHROMAWAVE_CYCLE == 0
    float signal = inLCH.x;
#elif CHROMAWAVE_CYCLE == 1
    float threshold = clamp(u_threshold, 0.0, 0.99);
    float signal = clamp((luma - threshold) / (1.0 - threshold), 0.0, 1.0);
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
    // tear-y angular pattern
    spatialSignal = fract(atan(delta.y, delta.x)) * (delta.x + delta.y);
#elif SPATIAL_PATTERN == 5
    // checkerboard-ish
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
    float selector = modulateHueWave(signal, spreadNorm, u_shiftNorm);
    float base = fract(u_baseHue);
    float alt  = fract(base + 0.5);
    hue = mix(base, alt, selector);
#else
    float phase = clamp(modulateHueWave(signal, spreadNorm, u_shiftNorm), 0.0, 0.999);
    #if USE_BANDING == 1
        float count = bandCount();
        float idx = bandIndexFromPhase(phase);
        hue = paletteHue(idx, count, u_baseHue);
    #else
        #if PALETTE_MODE == 0
            hue = fract(phase + u_baseHue);
        #else
            // Smooth palette modes are inherently ambiguous.
            // So either disable them without banding, or intentionally hard-select.
            float count = 8.0;
            float idx = floor(phase * count);
            hue = paletteHue(idx, count, u_baseHue);
        #endif
    #endif
#endif

#if CHROMAWAVE_BLEED == 1
    hue = mix(hue, inLCH.x, u_bleed);
#endif
    vec3 fx = hsv2rgb(vec3(hue, u_satNorm, u_lightNorm));
    vec3 outRGB = blendWithColorSpace(srgb, fx, u_blendamount);
    return vec4(outRGB, 1.0);
}


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    outColor = clamp(chromawave(uv), 0., 1.);
}
