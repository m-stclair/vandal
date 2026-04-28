#version 300 es

precision mediump float;

#ifndef STREAM_STEPS
    #error undefined stream steps
#endif

uniform vec2 u_texelSize;
uniform float u_blendamount;
uniform sampler2D u_image;
uniform sampler2D u_offsets;
uniform vec2 u_resolution;
uniform float u_stepLength;
uniform float u_decay;
uniform float u_centerWeight;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"


vec3 streamColor(vec2 uv) {
    vec3 accum = texture(u_image, uv).rgb * u_centerWeight;
    float weightSum = max(u_centerWeight, 0.0001);

    vec2 forwardUv = uv;
    vec2 backwardUv = uv;

    for (int i = 1; i <= STREAM_STEPS; i++) {
        vec2 forwardOffset = texture(u_offsets, forwardUv).xy;
        vec2 backwardOffset = texture(u_offsets, backwardUv).xy;

        forwardUv = fract(forwardUv + forwardOffset * u_stepLength);
        backwardUv = fract(backwardUv - backwardOffset * u_stepLength);

        float fi = float(i);
        float w = pow(1.0 - fi / float(STREAM_STEPS + 1), u_decay);

        accum += texture(u_image, forwardUv).rgb * w;
        accum += texture(u_image, backwardUv).rgb * w;
        weightSum += 2.0 * w;
    }

    return accum / weightSum;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 warped = streamColor(uv);
    vec3 color = texture(u_image, uv).rgb;
    outColor = vec4(
        blendWithColorSpace(color, warped, u_blendamount), 1.0
    );
}
