#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_flowStrength;
uniform float u_flowRadius;

out vec4 outColor;

float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec2 wrapUV(vec2 uv) {
    return fract(uv);
}

float sampleLuma(vec2 uv) {
    return luma(texture(u_image, wrapUV(uv)).rgb);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = (1.0 / u_resolution) * max(1.0, u_flowRadius);

    float lN = sampleLuma(uv + vec2(0.0, texel.y));
    float lS = sampleLuma(uv - vec2(0.0, texel.y));
    float lE = sampleLuma(uv + vec2(texel.x, 0.0));
    float lW = sampleLuma(uv - vec2(texel.x, 0.0));

    vec2 grad = 0.5 * vec2(lE - lW, lN - lS);
    float mag = length(grad);
    vec2 dir = mag > 1e-6 ? grad / mag : vec2(0.0);

    float speedPx = pow(mag, 0.85) * max(0.0, u_flowStrength) * max(1.0, u_flowRadius) * 12.0;
    vec2 flowPx = dir * speedPx;

    outColor = vec4(flowPx, mag, 1.0);
}