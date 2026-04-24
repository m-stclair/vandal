#version 300 es

precision mediump float;

#include "colorconvert.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform vec3 u_mix1;
uniform vec3 u_mix2;
uniform vec3 u_mix3;
uniform vec3 u_offset;
out vec4 outColor;


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 srgb = texture(u_image, uv);
    vec3 color = extractColor(srgb.rgb);
    float c1 = dot(color, u_mix1) + u_offset.x;
    float c2 = dot(color, u_mix2) + u_offset.y;
    float c3 = dot(color, u_mix3) + u_offset.z;
    vec3 outpix = encodeColor(vec3(c1, c2, c3));
    outColor = vec4(clamp(outpix, 0.0, 1.0), srgb.a);
}
