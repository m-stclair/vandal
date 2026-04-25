#version 300 es

precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_freq;
uniform float u_freqScale;
uniform float u_phaseScale;
uniform float u_phaseOff;
uniform float u_blend;
uniform float u_phaseGamma;

uniform float u_hueOff;
uniform float u_hueScale;
uniform float u_chromaGamma;


out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#define WAVEFORM_SIN 0
#define WAVEFORM_SAW 1
#define WAVEFORM_SQUARE 2
#define WAVEFORM_TRI 3

float waveform(float x) {
#if WAVEFORM_MODE == WAVEFORM_SIN
    return sin(x);
#elif WAVEFORM_MODE == WAVEFORM_SAW
    return fract(x / 6.28318); // normalize to [0,1]
#elif WAVEFORM_MODE == WAVEFORM_SQUARE
    return sign(sin(x)); // returns -1 or +1
#elif WAVEFORM_MODE == WAVEFORM_TRI
    return abs(fract(x / 6.28318) * 2.0 - 1.0); // triangle wave
#else
    #error invalid waveform mode
#endif
}

#define SPATIAL_XY 0
#define SPATIAL_CHECKER 1
#define SPATIAL_RADIAL 2
#define SPATIAL_ARC 3
#define SPATIAL_NONE 4

#define MODE_GRAYSCALE 0
#define MODE_LUMA 1
#define MODE_COLOR 2


float spatialPattern(vec2 uv, float freq) {
#if SPATIAL_MODE == SPATIAL_NONE
    return 0.0;
#elif SPATIAL_MODE == SPATIAL_XY
    return mod((uv.x + uv.y) * freq, 2.0) - 1.0;
#elif SPATIAL_MODE == SPATIAL_CHECKER
    return sin(uv.x * freq * 3.14159) * sin(uv.y * freq * 3.14159);
#elif SPATIAL_MODE == SPATIAL_RADIAL
    vec2 center = vec2(0.5);
    float dist = length(uv - center);
    return dist * freq;
#elif SPATIAL_MODE == SPATIAL_ARC
    vec2 center = vec2(0.5);
    float angle = atan(uv.y - center.y, uv.x - center.x);
    return angle * freq;
#else
    #error invalid spatial mode
#endif
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);
    vec3 color = pix.rgb;

    float luma = luminance(srgb2linear(color));
    float phase = pow(luma, u_phaseGamma) * 6.28318;

    float spatial = spatialPattern(uv, u_freq);
    float patternA = waveform(spatial * u_freqScale + phase);
    float patternB = waveform(-phase * (spatial * u_freqScale + phase * u_phaseScale) + u_phaseOff);
    float patval = clamp(abs(patternA - patternB), 0.0, 1.0);
#if COLOR_MODE == MODE_GRAYSCALE
    vec3 blended = blendWithColorSpace(color, patval, u_blend);
#elif COLOR_MODE == MODE_LUMA
    vec3 lch = srgb2NormLCH(color);
    vec3 pattern = normLCH2SRGB(vec3(patval, lch.y, lch.z));
    vec3 blended = blendWithColorSpace(color, pattern, u_blend);
#elif COLOR_MODE == MODE_COLOR
    vec3 lch = srgb2NormLCH(color);
    float sat = pow(lch.y, u_chromaGamma);
    float hue = patval * u_hueScale + u_hueOff;
    vec3 pattern = normLCH2SRGB(vec3(patval, sat, hue));
    vec3 blended = blendWithColorSpace(color, pattern, u_blend);
#else
    #error invalid color mode
#endif
    outColor = vec4(blended, 1.0);
}
