#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_brightness;
uniform float u_gamma;
uniform float u_exposure;
uniform float u_saturation;
uniform float u_chromaExposure;
uniform float u_chromaGamma;
uniform float u_hueShift;
uniform float u_hueGamma;
uniform float u_hueExposure;
uniform float u_hueCenter;

out vec4 outColor;

#include "colorconvert.glsl"

float gamma(float x, float gammaValue) {
    return pow(x, 1.0 / gammaValue);
}

float exposure(float x, float exposureValue) {
    return x * exp2(exposureValue);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);
    vec3 color = extractColor(pix.rgb);
    // NOTE: colorspace produced by extractColor/encodeColor here can only be
    //  normalized LCH or JCHz. So first channel is always lightness, second
    //  chroma, third hue. And valid bounds are always 0-1.
    float lightness = clamp(gamma(exposure(color.x, u_exposure), u_gamma) + u_brightness, 0.0, 1.0);
    float chroma = clamp(gamma(exposure(color.y, u_chromaExposure), u_chromaGamma) + u_saturation, 0.0, 1.0);
    float hue = fract(color.z - u_hueCenter);
    hue = gamma(exposure(hue, u_hueExposure), u_hueGamma) + u_hueShift;
    hue = fract(hue + u_hueCenter);
    outColor = vec4(encodeColor(vec3(lightness, chroma, hue)), pix.a);
}
