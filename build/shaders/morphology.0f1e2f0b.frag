#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform sampler2D u_morphology;
uniform vec2 u_resolution;
uniform float u_blendAmount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#define SUBTRACT_MODE_NONE 0
#define SUBTRACT_MODE_MORPH 1
#define SUBTRACT_MODE_IMAGE 2
#define SUBTRACT_MODE_TEX 3

#if SUBTRACT_MODE == SUBTRACT_MODE_TEX
uniform sampler2D u_morphology_2; // erode for dilate - erode gradient operation
#endif

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    // this should always be grayscale atm
    vec3 morph = texture(u_morphology, uv).rgb;
    vec3 srgb = texture(u_image, uv).rgb;
#if SUBTRACT_MODE == SUBTRACT_MODE_NONE
    vec3 result = morph;
#elif SUBTRACT_MODE == SUBTRACT_MODE_MORPH
    vec3 lin = srgb2linear(srgb);
    vec3 result = luminance(lin) - morph;
#elif SUBTRACT_MODE == SUBTRACT_MODE_IMAGE
    vec3 lin = srgb2linear(srgb);
    vec3 result = morph - luminance(lin);
#elif SUBTRACT_MODE == SUBTRACT_MODE_TEX
    vec3 morph2 = texture(u_morphology_2, uv).rgb;
    vec3 result = morph - morph2;
#else
    // error
    vec3 result = vec3(1.0, 0.0, 1.0);
#endif
    outColor = vec4(blendWithColorSpace(srgb, result, u_blendAmount), 1.0);
}

