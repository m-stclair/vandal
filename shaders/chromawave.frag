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
uniform float u_bandHue;

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
#else
    #error invalid spatial pattern
#endif
    float signal = spatialSignal / length(u_resolution);
#endif
#if WAVETYPE == 3
    float selector = modulateHueWave(signal, spreadNorm, u_shiftNorm);
    float base = fract(u_shiftNorm);
    float alt  = fract(base + 0.5);
    hue = mix(base, alt, selector);
#else
    hue = clamp(modulateHueWave(signal, spreadNorm, u_shiftNorm), 0.0, 0.999);
#endif

#if USE_BANDING == 1
    hue = quantize(hue, u_bandingSteps + 1.) + u_bandHue;
#endif
#if CHROMAWAVE_BLEED == 1
    hue = mix(hue, inLCH.x, u_bleed);
#endif
//    vec3 fx = hsv2rgb(vec3(u_lightNorm, u_satNorm, hue));
    vec3 fx = hsv2rgb(vec3(hue, u_satNorm, u_lightNorm));
    vec3 outRGB = blendWithColorSpace(srgb, fx, u_blendamount);
    return vec4(outRGB, 1.0);
}


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    outColor = clamp(chromawave(uv), 0., 1.);
}
