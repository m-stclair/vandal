#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_exposure;
uniform float u_chroma_weight;
uniform float u_chroma_fade_low;
uniform float u_chroma_fade_high;
uniform float u_shoulder;
uniform float u_center;
uniform float u_curve_strength;
uniform float u_tint_hue;
uniform float u_tint_strength;
uniform float u_lift;
uniform float u_gamma;
uniform float u_gain;

// NOTE: this is not directly user-controllable at present. It is constructed
//  in JS by applying exposure + curve to constants to avoid per-pixel calcs
//  here.
// shadow low, shadow high, highlight low, highlight high
uniform vec4 u_thresholds;

out vec4 outColor;

#include "colorconvert.glsl"

// Prevent log2 from going negative infinity
float safeLog2(float x) {
    return log2(max(x, 1e-6));
}

float applyLiftGammaGain(float jz, vec4 th, float lift, float gamma, float gain) {

    // Weight zones with smooth masks
    float shadow = 1.0 - smoothstep(th.x, th.y, jz);
    float mid = smoothstep(th.x, th.y, jz) * (1.0 - smoothstep(th.z, th.w, jz));
    float highlight = smoothstep(th.z, th.w, jz);

    // Add weighted per-zone biases
    float delta = lift * shadow + gamma * mid + gain * highlight;
    return clamp(jz + delta, 0.0, 1.0);  // Clamp to stay sane
}


// Core sigmoid tone curve in log2-stop space
float applyToneCurve_logStops(float jz, float centerStops, float shoulder, float strength) {
    float logJz = safeLog2(jz);          // Convert perceptual brightness to stop space
    float toneLog = 1.0 / (1.0 + exp(-shoulder * (logJz - centerStops)));
    return mix(jz, toneLog, strength);   // Return in Jz space
}

vec3 applyLook(vec3 srgb) {
    vec3 lin = srgb2linear(srgb);
    vec3 jchz = rgb2jchz(lin);

    // Exposure
    jchz.x *= exp2(u_exposure);

    float luma = jchz.x;
    float chroma = jchz.y;
    float hue = jchz.z;

    vec2 azbz = chroma * vec2(cos(hue), sin(hue));

    // --- Tone curve in log2-stop space ---
    float logJz = log2(max(luma, 1e-6));
    float curve_base = 1.0 / (1.0 + exp(-u_shoulder * (logJz - u_center)));
    float curve = mix(luma, curve_base, u_curve_strength);

    float tone = applyLiftGammaGain(curve, u_thresholds, u_lift, u_gamma, u_gain);
    // --- Chroma fade / mix ---
    float chroma_fade = smoothstep(u_chroma_fade_low, u_chroma_fade_high, luma);
    float chroma_base = chroma * u_chroma_weight * chroma_fade;

    vec2 azbz_base = chroma_base * normalize(azbz);

    // --- Tint axis logic (bipolar, log-stop centered) ---
    float tone_ratio = clamp(logJz - u_center, -2.0, 2.0);  // bipolar stop space
    float tint_lerp = tone_ratio * 0.5 + 0.5;  // map to [0,1]
    vec2 tint_axis = vec2(cos(u_tint_hue), sin(u_tint_hue));
    vec2 tint_vec = mix(-tint_axis, tint_axis, tint_lerp) * u_tint_strength;

    // --- Final azbz with independent base + tint ---
    vec2 azbz_out = azbz_base + tint_vec;
    float chroma_out = length(azbz_out);
    float hue_out = atan(azbz_out.y, azbz_out.x);

    vec3 jchz_out = vec3(tone, chroma_out, hue_out);
    vec3 rgb_out = jchz2rgb(jchz_out);
    return linear2srgb(rgb_out);

}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);
    outColor = vec4(clamp(applyLook(pix.rgb), 0., 1.), pix.a);
}
