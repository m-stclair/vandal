#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform sampler2D u_stateTex;
uniform vec2 u_resolution;
uniform float u_patternMix;
uniform float u_sourceColorMix;
uniform float u_patternGamma;
uniform float u_edgeBoost;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

float getPattern(vec2 state) {
    float p = clamp(state.g + (1.0 - state.r) * 0.35, 0.0, 1.0);
    return pow(p, max(0.001, u_patternGamma));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 src = texture(u_image, uv).rgb;
    vec2 state = texture(u_stateTex, uv).rg;

    float pattern = getPattern(state);

    vec2 texel = 1.0 / u_resolution;
    float vx1 = getPattern(texture(u_stateTex, clamp(uv + vec2(texel.x, 0.0), 0.0, 1.0)).rg);
    float vx2 = getPattern(texture(u_stateTex, clamp(uv - vec2(texel.x, 0.0), 0.0, 1.0)).rg);
    float vy1 = getPattern(texture(u_stateTex, clamp(uv + vec2(0.0, texel.y), 0.0, 1.0)).rg);
    float vy2 = getPattern(texture(u_stateTex, clamp(uv - vec2(0.0, texel.y), 0.0, 1.0)).rg);
    float edge = clamp(length(vec2(vx1 - vx2, vy1 - vy2)) * u_edgeBoost, 0.0, 1.0);

    vec3 chem = mix(u_colorA, u_colorB, smoothstep(0.08, 0.92, pattern));
    vec3 imageTinted = chem * mix(vec3(1.0), src * 1.35, clamp(u_sourceColorMix, 0.0, 1.0));
    vec3 patternComposite = mix(src, imageTinted, clamp(u_patternMix, 0.0, 1.0));
    patternComposite = mix(patternComposite, u_colorB, edge * 0.45);

    vec3 result = blendWithColorSpace(src, patternComposite, u_blendamount);
    outColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}