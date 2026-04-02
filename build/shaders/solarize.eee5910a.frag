#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_threshold;
uniform float u_strength;
uniform float u_softness;

out vec4 outColor;

#include "colorconvert.glsl"

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);
    vec3 srgb = pix.rgb;

    float mask = smoothstep(
        u_threshold - u_softness,
        u_threshold + u_softness,
        luminance(srgb2linear(srgb))
    );
    vec3 inverted = 1.0 - srgb;
    vec3 solarized = mix(srgb, inverted, mask);

    vec3 result = mix(srgb, solarized, u_strength);
    outColor = vec4(clamp(result, 0.0, 1.0), pix.a);
}
