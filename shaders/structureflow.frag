#version 300 es

precision mediump float;

#define PI     3.14159265358979

uniform sampler2D u_image;
uniform sampler2D u_structureTensor;
uniform vec2 u_resolution;
uniform float u_magnitude;
uniform float u_anisoDrag;
uniform float u_edgeAngle;
uniform float u_blendAmount;
uniform vec2 u_texelSize;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 u_structureTensor = texture(u_structureTensor, uv).rg;
    // structure tensor angle comes in normed to [0, 1]
    float angleRadians = u_structureTensor.r * PI - PI * 0.5;
    float angleRot = angleRadians + u_edgeAngle;
    vec2 flow = vec2(cos(angleRot), sin(angleRot));
    float anisotropy = u_structureTensor.g;
    float push = anisotropy * u_anisoDrag + 1.0 - u_anisoDrag;
    vec4 color = texture(u_image, uv);
    vec4 colorShifted = texture(u_image, uv + flow * push * u_magnitude * u_texelSize);
    outColor = vec4(blendWithColorSpace(color.rgb, colorShifted.rgb, u_blendAmount), 1.0);
}