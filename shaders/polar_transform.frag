#version 300 es
precision highp float;

#ifndef POLAR_MODE
#define POLAR_MODE 0
// 0 = unwrap  (cartesian → polar: tunnel, radial unfurl)
// 1 = wrap    (polar → cartesian: swirl, pinwheel)
#endif

uniform sampler2D u_image;
uniform vec2      u_resolution;
uniform vec2      u_center;
uniform float     u_angleOffset;   // [0,1] — full rotation at 1.0, animatable
uniform float     u_radialScale;   // radius extent in UV-space (0.5 = half-height)
uniform float     u_angularScale;  // wrapping count (1.0 = full circle, 2.0 = two turns)
uniform float     u_blendAmount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

const float TAU = 6.28318530718;

void main() {
    vec2 uv     = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 sampleUV;

#if POLAR_MODE == 0
    // Unwrap — output UV is (angle-axis, radius-axis)
    // uv.x [0..1] → angle sweeping one full revolution (× angularScale for multi-wrap)
    // uv.y [0..1] → radius from center outward (× radialScale)
    float angle  = (uv.x / u_angularScale + u_angleOffset) * TAU;
    float radius = uv.y * u_radialScale;

    // Convert back to cartesian to sample; correct x for aspect ratio
    sampleUV = u_center + vec2(cos(angle) * radius / aspect, sin(angle) * radius);

#else
    // Wrap — output UV is cartesian; we sample from polar-layout image
    vec2  delta     = uv - vec2(0.5);
    delta.x        *= aspect;
    float r         = length(delta);
    float theta     = atan(delta.y, delta.x);
    float angleNorm = fract(theta / TAU * u_angularScale - u_angleOffset);
    vec2  polarUV   = vec2(angleNorm, clamp(r / u_radialScale, 0.0, 1.0));
    sampleUV        = polarUV + (u_center - vec2(0.5));
#endif

    vec3 original = texture(u_image, uv).rgb;
    vec3 warped   = texture(u_image, sampleUV).rgb;

    outColor = vec4(blendWithColorSpace(original, warped, u_blendAmount), 1.0);
}
