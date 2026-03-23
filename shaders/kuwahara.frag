#version 300 es

precision mediump float;


#define PI     3.14159265358979
#define TWO_PI 6.28318530717959
#define N_SECTORS 8

uniform sampler2D u_image;
uniform sampler2D u_calcPass;  // pass 1 output
uniform vec2 u_resolution;
uniform vec2  u_texelSize;
uniform float u_radius;
uniform float u_sharpness;
uniform float u_eccentricity;
uniform float u_blendAmount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

void main() {

    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texelSize = u_texelSize / u_resolution;

    vec2  td          = texture(u_calcPass, uv).rg;
    float angle = td.r * PI - PI * 0.5;
    float anisotropy  = td.g;

    // Build a rotation + anisotropic scale matrix.
    // We squash the kernel perpendicular to the edge direction
    // (stretching it along the edge) proportional to anisotropy.
    float stretch = 1.0 + u_eccentricity * anisotropy;
    float cosA = cos(angle);
    float sinA = sin(angle);

    // Rotate, scale x by 1/stretch (compress), scale y by stretch (elongate)
    // Net effect: kernel footprint becomes an ellipse aligned to the edge
    mat2 transform = mat2(cosA / stretch, sinA * stretch,
                         -sinA / stretch, cosA * stretch);

    float sectorAngle = TWO_PI / float(N_SECTORS);

    // Accumulate per-sector statistics
    vec3  sectorMean[N_SECTORS];
    float sectorWeight[N_SECTORS];
    float sectorVar[N_SECTORS];
    vec3  sectorM2[N_SECTORS];   // for variance: E[x^2]

    for (int s = 0; s < N_SECTORS; s++) {
        sectorMean[s]   = vec3(0.0);
        sectorM2[s]     = vec3(0.0);
        sectorWeight[s] = 0.0;
    }

    int r = int(ceil(u_radius));

    for (int dx = -r; dx <= r; dx++) {
        for (int dy = -r; dy <= r; dy++) {
            vec2 offset = vec2(float(dx), float(dy));

            // Transform into the oriented, anisotropically-scaled kernel space
            vec2 tOff = transform * offset;

            float dist = length(tOff);
            if (dist > u_radius) continue;

            // Gaussian weight over distance
            float gw = exp(-dist * dist / (2.0 * u_radius * u_radius * 0.25));

            vec3 color = texture(u_image, uv + offset * texelSize).rgb;

            // Sample angle in transformed space — this is what we use for
            // sector assignment. Because the transform aligns the kernel
            // with the edge, angle 0 always points "along" the edge.
            float sampleAngle = atan(tOff.y, tOff.x);

            // Distribute this sample across all sectors using smooth
            // raised-cosine weights — the Kyprianidis trick that avoids
            // hard sector cuts and gives the painterly softness
            for (int s = 0; s < N_SECTORS; s++) {
                float sCenter = (float(s) + 0.5) * sectorAngle;
                float diff    = sampleAngle - sCenter;

                diff = diff - TWO_PI * round(diff / TWO_PI);

                float sw = max(0.0, cos(diff * float(N_SECTORS) * 0.5));

                sw = pow(sw, u_sharpness) * gw;

                sectorMean[s]   += sw * color;
                sectorM2[s]     += sw * color * color;
                sectorWeight[s] += sw;
            }
        }
    }

    // Find the sector with minimum variance
    const vec3 luma = vec3(0.299, 0.587, 0.114);
    vec3  bestMean = vec3(0.0);
    float bestVar  = 1e10;

    for (int s = 0; s < N_SECTORS; s++) {
        if (sectorWeight[s] < 1e-6) continue;

        vec3 mean = sectorMean[s] / sectorWeight[s];
        vec3 m2   = sectorM2[s]   / sectorWeight[s];
        vec3 var  = max(vec3(0.0), m2 - mean * mean); // numerical safety clamp

        float totalVar = dot(var, luma);

        if (totalVar < bestVar) {
            bestVar  = totalVar;
            bestMean = mean;
        }
    }

    vec4 color = texture(u_image, uv);
    outColor = vec4(blendWithColorSpace(color.rgb, bestMean, u_blendAmount), 1.0);
}