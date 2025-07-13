#version 300 es

precision mediump float;

uniform sampler2D u_image;

out vec4 outColor;

#include "psrdnoise2.glsl"
#include "colorconvert.glsl"
#include "blend.glsl"

// zone mask types
#define ZONE_BOX         0
#define ZONE_VERTICAL    1
#define ZONE_RADIAL      2
#define ZONE_HORIZONTAL  3

#define WARPMODE_SHIFT 0
#define WARPMODE_SINE 1
#define WARPMODE_NOISE 2
#define WARPMODE_LENS 3

#define WARPDRIVE_MODE 1
#define WARPDRIVE_CHANNEL 2
#define WARPDRIVE_COLORSPACE 0

#define PREBLEND_WARP_CHANNEL 1

// ---- UNIFORMS ----
uniform vec2 u_resolution;
uniform vec2 u_zoneMin;           // normalized [0,1]
uniform vec2 u_zoneMax;           // normalized [0,1]
uniform float u_zoneSoftness;     // softness scalar
uniform float u_zoneFalloffGamma; // only used by radial
uniform int u_debugMask;          // 0 = normal, 1 = debug
uniform float u_param_a;
uniform float u_param_b;
uniform float u_warpStrength;
uniform float u_blendamount;
uniform float u_warpAngle; // in radians
uniform float u_zoneAngle;  // radians


// ---- UTILS ----
float sstep(float edge0, float edge1, float x) {
    float eps = 1e-5;
    return smoothstep(edge0, edge1 + eps, x);
}

float channelDrive(vec3 color) {
    #if WARPDRIVE_COLORSPACE == COLORSPACE_RGB
        return color[WARPDRIVE_CHANNEL];
    #elif WARPDRIVE_COLORSPACE == COLORSPACE_HSL
        vec3 hsl = srgb2HSL(color);
        return hsl[WARPDRIVE_CHANNEL];
    #elif WARPDRIVE_COLORSPACE == COLORSPACE_LCH
        vec3 lch = srgb2NormLCH(color);
        return lch[WARPDRIVE_CHANNEL];
    #else
        return 0.0;
    #endif
}

// ---- MAIN MASK FUNCTION ----
float boundedMask(vec2 uv) {
    vec2 center = (u_zoneMin + u_zoneMax) * 0.5;
    vec2 offset = uv - center;

    float ca = cos(-u_zoneAngle);
    float sa = sin(-u_zoneAngle);
    mat2 rot = mat2(ca, -sa, sa, ca);

    // rotate UV around center
    vec2 uv_rot = rot * offset + center;

    vec2 minBound = u_zoneMin;
    vec2 maxBound = u_zoneMax;
    float softness = max(u_zoneSoftness, 1e-5); // clamp to avoid degenerate soft edges

    #if ZONESHAPE == ZONE_BOX
        vec2 edgeSoft = vec2(softness);
        vec2 inner = vec2(
            sstep(minBound.x, minBound.x + edgeSoft.x, uv_rot.x),
            sstep(minBound.y, minBound.y + edgeSoft.y, uv_rot.y)
        );
        vec2 outer = vec2(
            1.0 - sstep(maxBound.x - edgeSoft.x, maxBound.x, uv_rot.x),
            1.0 - sstep(maxBound.y - edgeSoft.y, maxBound.y, uv_rot.y)
        );
        return inner.x * inner.y * outer.x * outer.y;

    #elif ZONESHAPE == ZONE_VERTICAL
        float left = sstep(minBound.x, minBound.x + softness, uv_rot.x);
        float right = 1.0 - sstep(maxBound.x - softness, maxBound.x, uv_rot.x);
        return left * right;

    #elif ZONESHAPE == ZONE_RADIAL
        vec2 rCenter = (minBound + maxBound) * 0.5;
        float radius = length(maxBound - minBound) * 0.5;
        vec2 rel = (uv_rot - rCenter) / radius;
        float dist = length(rel);  // or add aspect stretch here
        float t = smoothstep(radius, radius - softness, dist);
        return pow(t, u_zoneFalloffGamma);

    #elif ZONESHAPE == ZONE_HORIZONTAL
        float top = sstep(minBound.y, minBound.y + softness, uv_rot.y);
        float bottom = 1.0 - sstep(maxBound.y - softness, maxBound.y, uv_rot.y);
        return top * bottom;
    #else
        return 0.0;
    #endif
}

vec2 rotate(vec2 v, float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat2(c, -s, s, c) * v;
}

vec2 warpFunction(vec2 uv) {
    vec2 baseWarp = vec2(0.0);
    float warpAngle = u_warpAngle;
#if WARPMODE == WARPMODE_SHIFT
    baseWarp = vec2(0.01, 0.0);  // constant x-shift — classic head-switch
#elif WARPMODE == WARPMODE_SINE
    baseWarp = vec2(
        sin((uv.y + u_param_a / 2.) * 40.0) * 0.005,
        0.0
    );
#elif WARPMODE == WARPMODE_NOISE
    vec2 outgrad = vec2(0., 0.);  // scratch space for psrdnoise
    float n = psrdnoise(uv * 2.0 + u_param_a, vec2(0., 0.), 0.0, outgrad);
    baseWarp = vec2(n - 0.5) * 0.01;
#elif WARPMODE == WARPMODE_LENS
    float xSize = (u_zoneMax.x - u_zoneMin.x);
    float ySize = (u_zoneMax.y - u_zoneMin.y);
    vec2 center = vec2(
        u_zoneMin.x + xSize / 2., u_zoneMin.y + ySize / 2.
    );
    vec2 deltaUV = uv - center;
    float dist = length(deltaUV);
    float sizeMean = (xSize + ySize) / 2.;
    baseWarp = normalize(deltaUV) * pow(dist, 2.0) / 30. / sizeMean;
    warpAngle += 3.14159;
#else
    baseWarp = vec2(0.01, 0.0);
#endif
#if WARPDRIVE_MODE == 1
    vec3 color = texture(u_image, uv).rgb;
    float drive = channelDrive(color);
    baseWarp *= drive;
#endif
    return rotate(baseWarp, warpAngle);
}

vec2 maskedWarp(vec2 uv, float mask) {
    vec2 delta = warpFunction(uv);  // To be defined below
    return uv + delta * mask * u_warpStrength;
}


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 baseColor = texture(u_image, uv).rgb;
    vec3 accum = baseColor;
    float totalBlend = 0.0;

    float mask = boundedMask(uv);

#if DEBUG_MASK == 1
    outColor = vec4(vec3(mask), 1.0);
    return;
#endif
    vec2 warpedUV = maskedWarp(uv, mask);
    vec3 warpedColor = texture(u_image, warpedUV).rgb;
#if PREBLEND_CHANNEL_WARP == 1
    vec3 lch = srgb2NormLCH(warpedColor);
#if PREBLEND_WARP_CHANNEL == 1
    lch.y = fract(lch.y + mask * u_param_b);
#else
    lch.z += mask * u_param_b;
    lch.z = clamp(lch.z, 0., 1.);
#endif
    warpedColor = normLCH2SRGB(lch);
#endif
    outColor = vec4(
        blendWithColorSpace(baseColor, warpedColor, u_blendamount), 1.0
    );
}
