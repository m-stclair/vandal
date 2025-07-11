#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform vec3 u_mix1;
uniform vec3 u_mix2;
uniform vec3 u_mix3;
uniform vec3 u_offset;
out vec4 outColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pixel = texture(u_image, uv);
#if COLORSPACE == COLORSPACE_RGB
    vec3 color = pixel.rgb;
#elif COLORSPACE == COLORSPACE_LAB
    vec3 color = normalizeLab(rgb2lab(pixel.rgb));
#elif COLORSPACE == COLORSPACE_LCH
    vec3 color = normalizeLCH(rgb2lch(pixel.rgb));
#elif COLORSPACE == 3
    vec3 color = rgb2hsv(pixel.rgb);
#else
    vec3 color = pixel.rgb;
#endif
    float c1 = dot(color, u_mix1) + u_offset.r;
    float c2 = dot(color, u_mix2) + u_offset.g;
    float c3 = dot(color, u_mix3) + u_offset.b;
    vec3 outpix = vec3(c1, c2, c3);
#if COLORSPACE == COLORSPACE_LAB
    outpix = lab2rgb(denormalizeLab(outpix));
#elif COLORSPACE == COLORSPACE_LCH
    outpix = lch2rgb(denormalizeLCH(outpix));
#elif COLORSPACE == COLORSPACE_HSV
    outpix = hsv2rgb(outpix);
#endif
    outColor = vec4(clamp(outpix, 0.0, 1.0), pixel.a);
}
