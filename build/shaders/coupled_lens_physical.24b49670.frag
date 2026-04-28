#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_lens_separation;
uniform float u_lens_radius;
uniform float u_curvature_a;
uniform float u_curvature_b;
uniform float u_refractive_index;
uniform float u_dispersion;
uniform float u_coupling;
uniform float u_passes;
uniform float u_rotation;
uniform float u_aperture;
uniform float u_aperture_falloff;
uniform float u_edge_softness;
uniform float u_depth;

uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#define MAX_ITERATIONS 20

mat2 rot2(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

float discMask(float r, float radius, float softness) {
    radius = max(radius, 1e-5);
    softness = clamp(softness, 0.001, 0.999);
    float inner = radius * (1.0 - softness);
    return 1.0 - smoothstep(inner, radius, r);
}

float lensField(vec2 p, vec2 center, float radius, float softness) {
    vec2 d = p - center;
    float r = length(d);
    float mask = discMask(r, radius, softness);
    float nr = clamp(r / max(radius, 1e-5), 0.0, 1.0);

    // central optical strength, fading toward the edge
    return (1.0 - nr * nr) * mask;
}

vec2 warpLens(
    vec2 p,
    vec2 center,
    float radius,
    float curvature,
    float refractiveIndex,
    float softness
) {
    vec2 d = p - center;
    float r = length(d);
    float radiusSafe = max(radius, 1e-5);
    float nr = clamp(r / radiusSafe, 0.0, 1.0);

    float mask = discMask(r, radius, softness);

    // crude thin-lens-ish "power": stronger curvature, larger eta-1 => more bend
    float opticalPower = curvature * (refractiveIndex - 1.0);

    // slight spherical aberration feel toward the edge
    float spherical = 1.0 + 0.45 * nr * nr;

    // strongest in center, tapering to edge
    float bend = opticalPower * (1.0 - nr * nr) * spherical * mask;

    // sample-space warp. positive bend compresses inward, negative expands outward.
    float scale = 1.0 / max(0.12, 1.0 + bend);

    return center + d * scale;
}

vec2 coupledPass(vec2 p, vec2 centerA, vec2 centerB, float eta, int passIndex) {
    float fieldA = lensField(p, centerA, u_lens_radius, u_edge_softness);
    float fieldB = lensField(p, centerB, u_lens_radius, u_edge_softness);

    // each lens becomes stronger when the other lens influences the same region
    float etaA = eta + (eta - 1.0) * u_coupling * fieldB;
    float etaB = eta + (eta - 1.0) * u_coupling * fieldA;

    float curvatureA = u_curvature_a * (1.0 + 0.25 * u_coupling * fieldB);
    float curvatureB = u_curvature_b * (1.0 + 0.25 * u_coupling * fieldA);

    bool forwardOrder = mod(float(passIndex), 2.0) < 1.0;

    if (forwardOrder) {
        p = warpLens(p, centerA, u_lens_radius, curvatureA, etaA, u_edge_softness);
        p = warpLens(p, centerB, u_lens_radius, curvatureB, etaB, u_edge_softness);
    } else {
        p = warpLens(p, centerB, u_lens_radius, curvatureB, etaB, u_edge_softness);
        p = warpLens(p, centerA, u_lens_radius, curvatureA, etaA, u_edge_softness);
    }

    // mild relay-like cross-axis shove to make the pair feel coupled rather than isolated
    vec2 axis = centerB - centerA;
    float axisLen = max(length(axis), 1e-5);
    axis /= axisLen;

    float imbalance = fieldB - fieldA;
    p += axis * imbalance * 0.03 * u_coupling;

    return p;
}

vec2 traceSystem(vec2 uv, vec2 centerA, vec2 centerB, float eta) {
    int passesLo = int(floor(u_passes));
    int passesHi = int(ceil(u_passes));
    float frac = fract(u_passes);

    vec2 uvLo = uv;
    vec2 uvHi = uv;

    for (int i = 0; i < MAX_ITERATIONS; i++) {
        if (i >= passesHi) break;

        uvHi = coupledPass(uvHi, centerA, centerB, eta, i);

        if (i + 1 == passesLo) {
            uvLo = uvHi;
        }
    }

    return mix(uvLo, uvHi, frac);
}

void main() {
    vec2 baseUV = gl_FragCoord.xy / u_resolution;

    // centered, aspect-safe coordinate space
    vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5)
              / min(u_resolution.x, u_resolution.y);

    mat2 R = rot2(u_rotation);
    vec2 centerA = R * vec2(-u_lens_separation, 0.0);
    vec2 centerB = R * vec2( u_lens_separation, 0.0);

    float etaBase = max(u_refractive_index, 1.0);
    float disp = max(u_dispersion, 0.0);

    // chromatic dispersion: slightly different eta per channel
    float etaR = etaBase + disp;
    float etaG = etaBase;
    float etaB = max(1.0, etaBase - disp);

    vec2 uvR = traceSystem(uv, centerA, centerB, etaR);
    vec2 uvG = traceSystem(uv, centerA, centerB, etaG);
    vec2 uvB = traceSystem(uv, centerA, centerB, etaB);

    vec2 texR = clamp(mix(baseUV, uvR * 0.5 + 0.5, u_depth), 0.0, 1.0);
    vec2 texG = clamp(mix(baseUV, uvG * 0.5 + 0.5, u_depth), 0.0, 1.0);
    vec2 texB = clamp(mix(baseUV, uvB * 0.5 + 0.5, u_depth), 0.0, 1.0);

    vec3 inColor = texture(u_image, baseUV).rgb;

    vec3 dispersed = vec3(
        texture(u_image, texR).r,
        texture(u_image, texG).g,
        texture(u_image, texB).b
    );

    // pupil / aperture transmission
    float pupilRadius = max(1e-5, u_lens_radius * u_aperture);
    float pupilA = discMask(length(uv - centerA), pupilRadius, u_aperture_falloff);
    float pupilB = discMask(length(uv - centerB), pupilRadius, u_aperture_falloff);
    float transmission = max(pupilA, pupilB);

    // keep some energy even near edges unless depth is high
    transmission = mix(1.0, transmission, u_depth);

    vec3 lensColor = mix(inColor, dispersed, transmission);

    outColor = vec4(
        blendWithColorSpace(inColor, lensColor, u_blendamount),
        1.0
    );
}