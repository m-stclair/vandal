#version 300 es

precision mediump float;

#include "colorconvert.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_exposure;
uniform float u_chroma_weight;
uniform float u_chroma_fade_low;
uniform float u_chroma_fade_high;
uniform float u_center;
uniform float u_shoulder;
uniform vec3  u_tint_axis;
uniform float u_tint_strength;

out vec4 outColor;


float toneMap(float x, float s) {
    return 1.0 / (1.0 + exp(-s * (x - 0.18)));
}

float toneMapFilmic(float x, float a, float b) {
    return (x * (a + x)) / (x * (a + x) + b);
}

vec3 applyLook(vec3 srgb) {
    vec3 lin = srgb2linear(srgb);
    lin *= exp2(u_exposure);

    // perceptual luma for chroma fading
    float perceptual_luma = dot(linear2srgb(lin), vec3(0.2126, 0.7152, 0.0722));

    // perform tone shaping in log space
    float lin_luma = dot(lin, vec3(0.2126, 0.7152, 0.0722));
    float log_luma = log2(lin_luma + 1e-4);
    float tone = 1.0 / (1.0 + exp(-u_shoulder * (log_luma - u_center)));  // center now in stops

    // compute chroma in perceptual space (safer, clearer intent)
    vec3 perceptual = linear2srgb(lin);
    vec3 chroma = perceptual - vec3(perceptual_luma);

    // chroma fade curve: fade shadows/highlights
    float chroma_fade = smoothstep(u_chroma_fade_low, u_chroma_fade_high, perceptual_luma);

    float chroma_mix = u_chroma_weight * chroma_fade;

    // combine tone-mapped luma with chroma
    vec3 perceptualOut = vec3(tone) + chroma * chroma_mix;

    // apply tint
    vec3 tint = mix(vec3(1.0), u_tint_axis, u_tint_strength * tone);
    perceptualOut *= tint;
    return perceptualOut;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);
    outColor = vec4(applyLook(pix.rgb), pix.a);
}
