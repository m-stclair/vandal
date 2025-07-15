#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_warpStrength;       // e.g., -0.5 to 0.5
uniform float u_directionAngle;     // radians
uniform float u_modAmount;          // 0 to 1 (modulation intensity)
uniform int u_driverChannel;        // 0: luma, 1: R, 2: G, 3: B, 4: hue, 5: saturation
uniform int u_modulatorChannel;     // same enum as above, or -1 for none
uniform float u_modulatorPolarity;
uniform float u_driverPolarity;
uniform float u_threshLow;
uniform float u_threshHigh;
uniform float u_driverGamma;
uniform int u_flatThreshold;
uniform float u_blendamount;


out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

// --- utility functions ---

float getChannelValue(vec3 color, int selector) {
    if (selector == 0) return luminance(color);
    if (selector == 1) return color.r;
    if (selector == 2) return color.g;
    if (selector == 3) return color.b;
    if (selector == 4) return rgb2hsv(color).x;
    if (selector == 5) return rgb2hsv(color).y;
    return 0.0;
}


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 color = texture(u_image, uv).rgb;

    float driver = getChannelValue(color, u_driverChannel);
    driver = pow(driver, u_driverGamma);
    float mask = smoothstep(u_threshLow, u_threshHigh, driver);
    float mod = u_modulatorChannel >= 0 ? getChannelValue(color, u_modulatorChannel) : 1.0;
    driver = driver + u_driverPolarity * (1. - 2. * driver);
    float offsetAmt;
    if (u_flatThreshold == 0) {
        driver *= mask;
        mod = mod + u_modulatorPolarity * (1. - 2. * driver);
        offsetAmt = u_warpStrength * mix(1.0, mod, u_modAmount) * driver;
    } else {
        offsetAmt = mask * u_warpStrength;
    }
    vec2 dir = vec2(cos(u_directionAngle), sin(u_directionAngle));
    vec2 offsetUV = fract(uv + offsetAmt * dir);
    vec4 warped = texture(u_image, offsetUV);
    outColor = vec4(
        blendWithColorSpace(texture(u_image, uv).rgb, warped.rgb, u_blendamount),
        1.
    );
}
