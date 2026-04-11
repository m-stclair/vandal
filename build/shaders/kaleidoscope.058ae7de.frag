#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_reflections;
uniform float u_tube_length;
uniform float u_magnification;
uniform float u_mirrors;

uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#define PI 3.14159265358979
#define MAX_ITERATIONS 10

vec2 afold(vec2 p, float n) {
    float a = atan(p.y, p.x);
    float r = length(p);
    float slice = PI / n;
    a = mod(a, 2.0 * slice);
    a = abs(a - slice);
    return vec2(cos(a), sin(a)) * r;
}

float rfold(float r, float period) {
    r = mod(r, period * 2.0);
    return abs(r - period);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5)  // center origin
              / min(u_resolution.x, u_resolution.y);  // texels must be pixel-space symmetrical

    uv = afold(uv, u_mirrors);

    float r = length(uv);
    float a = atan(uv.y, uv.x);
    r = rfold(r, u_tube_length);
    uv = vec2(cos(a), sin(a)) * r;

    for (int i = 0; i < MAX_ITERATIONS; i++) {
        if (float(i) >= u_reflections) break;
        uv = uv * u_magnification;
        uv = afold(uv, u_mirrors);
        uv = abs(uv) - 0.3;
    }

    // map folded coords back to [0,1] UV space for texture sample
    vec2 texUV = uv * 0.5 + 0.5;

    vec3 inColor = texture(u_image, gl_FragCoord.xy / u_resolution).rgb;
    vec3 kaleido = texture(u_image, texUV).rgb;
    outColor = vec4(
        blendWithColorSpace(inColor, kaleido, u_blendamount),
        1.0
    );
}