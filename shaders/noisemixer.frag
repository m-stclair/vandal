#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "noise.glsl"
#include "blend.glsl"
#include "psrdnoise2.glsl"

uniform sampler2D u_image;
uniform sampler2D u_cmap;
uniform float u_freqx;
uniform float u_freqy;
uniform float u_seed;
uniform vec2 u_resolution;
uniform float u_uniform;
uniform float u_perlin;
uniform float u_simplex;
uniform float u_gauss;
uniform float u_pink;
uniform float u_fc[3];
uniform vec3 u_tint;
uniform float u_blendamount;
out vec4 outColor;

void main() {
    vec2 uv = (gl_FragCoord.xy + vec2(0.5)) / u_resolution;
    vec2 uvs = uv + uniformNoise(u_seed);
    float xScl = uvs.x * u_freqx;
    float yScl = uvs.y * u_freqy;
    float noiseVal = 0.0;

    noiseVal += uniformNoise(uvs.x * uvs.y) * u_uniform;

    float pVecs[4];
    pVecs[0] = 1.0;
    pVecs[1] = 0.0;
    pVecs[2] = 0.0;
    pVecs[3] = 1.0;

    noiseVal += perlinNoise2D(vec2(xScl, yScl), u_fc, pVecs, u_seed).x * u_perlin * 2.0;

    vec2 gradientOut = vec2(0.0, 0.0); // scratch
    noiseVal += psrdnoise(vec2(xScl, yScl), vec2(0.0), 0.0, gradientOut) * u_simplex * 1.3;
    noiseVal += gaussianNoise(vec2(xScl, yScl)) * u_gauss;
    noiseVal += pinkNoise(vec2(xScl, yScl)) * u_pink;
    noiseVal = clamp(noiseVal, 0.0, 1.0);
    vec3 noisePx;
#if USE_CMAP == 0
    noisePx = noiseVal * u_tint;
#else
    noisePx = texture(u_cmap, vec2(clamp(noiseVal, 0.0, 1.0), 0.5)).rgb;
#endif
    vec3 inColor = texture(u_image, uv).rgb;
    vec3 blended = blendWithColorSpace(inColor, noisePx, u_blendamount);
    outColor = vec4(clamp(blended, 0.0, 1.0), texture(u_image, uv).a);
}
