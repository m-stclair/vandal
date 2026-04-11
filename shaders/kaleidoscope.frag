#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_reflections;
uniform float u_tube_length;
uniform float u_magnification;
uniform float u_mirrors;
uniform float u_depth;
uniform float u_twist;

uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#define PI 3.14159265358979
#define MAX_ITERATIONS 20

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

    int iters_lo = int(floor(u_reflections));
    int iters_hi = int(ceil(u_reflections));
    float frac = fract(u_reflections);

    vec2 uv_lo = uv;  // will hold state after floor() iters
    vec2 uv_hi = uv;  // will hold state after ceil() iters

    for (int i = 0; i < MAX_ITERATIONS; i++) {
        if (i >= iters_hi) break;
        uv_hi *= u_magnification;
        uv_hi  = afold(uv_hi, u_mirrors);
        uv_hi  = abs(uv_hi) - u_twist;
        if (i + 1 == iters_lo) {
            uv_lo = uv_hi;  // snapshot after floor() iterations
        }
    }
    uv = mix(uv_lo, uv_hi, frac);
    vec2 remappedUV = uv * 0.5 + 0.5;
    vec2 baseUV = gl_FragCoord.xy / u_resolution;
    vec2 mixedUV = mix(baseUV, remappedUV, u_depth);
    vec3 inColor = texture(u_image, gl_FragCoord.xy / u_resolution).rgb;
    vec3 kaleido = texture(u_image, mixedUV).rgb;
    outColor = vec4(
        blendWithColorSpace(inColor, kaleido, u_blendamount),
        1.0
    );
}
