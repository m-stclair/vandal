#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform sampler2D u_calcPass;
uniform vec2 u_resolution;

uniform float u_stepSize;
uniform float u_falloff;
uniform float u_sharpness;
uniform float u_angle;
uniform float u_jitter;
uniform float u_seed;
uniform vec2 u_texelSize;
uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#ifndef STEPS
    #error
#endif

float hash(vec2 p) {
    return fract(sin(dot(p ,vec2(127.1,311.7))) * 43758.5453123);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 accum = texture(u_image, uv).rgb;
    float totalWeight = 1.0;

    // forward walk
    vec2 pos = uv;
    for (int i = 1; i <= STEPS; i++) {
        float angle = texture(u_calcPass, pos).x + u_angle + hash(pos + u_seed) * u_jitter;
        vec2 tangent = vec2(cos(angle), sin(angle)) * u_stepSize;
        pos += tangent * u_texelSize;

        float w = exp(-pow(float(i), u_sharpness) * u_falloff);
        accum += texture(u_image, pos).rgb * w;
        totalWeight += w;
    }

    // backward walk
    pos = uv;
    for (int i = 1; i <= STEPS; i++) {
        float angle = texture(u_calcPass, pos).x + u_angle + hash(pos + u_seed) * u_jitter;
        vec2 tangent = vec2(cos(angle), sin(angle)) * u_stepSize;
        pos -= tangent * u_texelSize;

        float w = exp(-float(i*i) * u_falloff);
        accum += texture(u_image, pos).rgb * w;
        totalWeight += w;
    }

    accum /= totalWeight;

    vec3 base = texture(u_image, uv).rgb;
    outColor = vec4(blendWithColorSpace(base, accum, u_blendamount), 1.0);
}