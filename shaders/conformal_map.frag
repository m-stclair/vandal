#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2  u_resolution;
uniform vec2  u_center;

uniform float u_inputZoom;
uniform float u_outputScale;
uniform float u_depth;

uniform float u_preRotate;
uniform float u_postRotate;

uniform float u_power;
uniform float u_branchAngle;

uniform bool  u_wrap;
uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#ifndef MODE
#define MODE 0
#endif

#define MODE_POWER     0
#define MODE_LOG       1
#define MODE_INVERSION 2

const float PI  = 3.141592653589793;
const float TAU = 6.283185307179586;
const float SINGULARITY_CLAMP = 0.025;
const float SINGULARITY_CLAMP_SQ = SINGULARITY_CLAMP * SINGULARITY_CLAMP;

mat2 rot2(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

vec2 cmul(vec2 a, vec2 b) {
    return vec2(
        a.x * b.x - a.y * b.y,
        a.x * b.y + a.y * b.x
    );
}

vec2 cconj(vec2 z) {
    return vec2(z.x, -z.y);
}

vec2 cdiv(vec2 a, vec2 b) {
    float d = max(dot(b, b), SINGULARITY_CLAMP_SQ);
    return vec2(
        (a.x * b.x + a.y * b.y) / d,
        (a.y * b.x - a.x * b.y) / d
    );
}

vec2 cinv(vec2 z) {
    return cdiv(vec2(1.0, 0.0), z);
}

float wrapAngle(float a) {
    return mod(a + PI, TAU) - PI;
}

// If u_branchAngle means "the visible branch cut direction on screen"
float branchAngleInPreRotatedSpace() {
    // screenToComplex already applies u_preRotate:
    //
    //     theta_z = theta_screen + u_preRotate
    //
    // so compensate here to keep the branch cut visually controlled by
    // u_branchAngle instead of drifting with u_preRotate.
    //
    // The wrap discontinuity occurs at phi + PI, so subtract PI if the
    // uniform is meant to point directly at the visible cut.
    return u_branchAngle - PI + u_preRotate;
}

vec2 clogp(vec2 z) {
    float r = max(length(z), SINGULARITY_CLAMP);

    float theta = atan(z.y, z.x);
    float phi = branchAngleInPreRotatedSpace();

    // This is the important change:
    // keep the angle in world/pre-rotated coordinates,
    // only use phi to decide where the jump happens.
    float a = phi + wrapAngle(theta - phi);

    return vec2(log(r), a);
}

vec2 cexpp(vec2 z) {
    float ex = exp(clamp(z.x, -20.0, 20.0));

    // Plain complex exponential.
    // No u_branchAngle here.
    return ex * vec2(cos(z.y), sin(z.y));
}

vec2 cpowp(vec2 z, float p) {
    vec2 lz = clogp(z);
    return cexpp(vec2(lz.x * p, lz.y * p));
}


vec2 screenToComplex(vec2 st) {
    float aspect = u_resolution.x / u_resolution.y;
    vec2 z = st - u_center;
    z.x *= aspect;
    z = rot2(u_preRotate) * z;
    z /= max(u_inputZoom, 1e-4);
    return z;
}

vec2 complexToUV(vec2 w) {
    float aspect = u_resolution.x / u_resolution.y;

    w = rot2(u_postRotate) * w;

    float r = length(w);
    vec2 dir = (r > 1e-8) ? (w / r) : vec2(0.0);

    // bounded projection so the whole thing doesn’t go screaming off to infinity
    float s = tanh(r * max(u_outputScale, 1e-4));
    vec2 disk = dir * s;

    disk.x /= aspect;
    return u_center + 0.5 * disk;
}

vec2 mapComplex(vec2 z) {

#if MODE == MODE_POWER
    return cpowp(z, u_power);

#elif MODE == MODE_LOG
    return clogp(z);

#elif MODE == MODE_INVERSION
    return cinv(z);

#else
    #error invalid MODE
#endif
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;

    vec2 z = screenToComplex(st);
    vec2 w = mapComplex(z);

    vec2 mappedUV = complexToUV(w);
    mappedUV = mix(st, mappedUV, u_depth);

    if (u_wrap) {
        mappedUV = fract(mappedUV);
    } else {
        mappedUV = clamp(mappedUV, 0.0, 1.0);
    }

    vec3 original = texture(u_image, st).rgb;
    vec3 warped   = texture(u_image, mappedUV).rgb;

    outColor = vec4(
        blendWithColorSpace(original, warped, u_blendamount),
        1.0
    );
}