#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"
#include "posterize.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_bayer_resolution;
uniform float u_blendamount;
uniform float u_bias;
uniform float u_logbase;
out vec4 outColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pixel = texture(u_image, uv);
#if COLORSPACE == COLORSPACE_RGB
    vec3 color = pixel.rgb;
#elif COLORSPACE == COLORSPACE_LAB
    vec3 color = rgb2lab(pixel.rgb)
        * vec3(0.01, 0.00392, 0.00392);
#elif COLORSPACE == COLORSPACE_LCH
    vec3 color = rgb2lch(pixel.rgb)
        * vec3(0.01, 0.00392, 0.00392);
#elif COLORSPACE == COLORSPACE_HSV
    vec3 color = rgb2hsv(pixel.rgb);
#else
    vec3 color = pixel.rgb;
#endif
    vec3 outpix = posterize(color, uv, u_bayer_resolution, u_bias, u_logbase);
#if COLORSPACE == COLORSPACE_LAB
    outpix /= vec3(0.01, 0.00392, 0.00392);
    outpix = lab2rgb(outpix);
#elif COLORSPACE == COLORSPACE_LCH
    outpix /= vec3(0.01, 0.00392, 0.00392);
    outpix = lch2rgb(outpix);
#elif COLORSPACE == COLORSPACE_HSV
    outpix = hsv2rgb(outpix);
#else
    outpix = outpix;
#endif
    outColor = vec4(mix(pixel.rgb, outpix, u_blendamount), pixel.a);
}
