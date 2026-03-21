#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

out vec4 outColor;

uniform float u_min;
uniform float u_max;

#define STRETCH_LIN 0
#define STRETCH_LOG 1

#ifndef STRETCH_MODE
#define STRETCH_MODE 0
#endif

void main() {
    float eps = 1e-20;
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 raw = texture(u_image, uv);

#if STRETCH_MODE == STRETCH_LOG
    vec3 x = clamp(raw.rgb, u_min, u_max);
    float logMin = log(max(u_min, eps));
    float logMax = log(max(u_max, eps));
    float logDen = max(logMax - logMin, eps);
    vec3 norm = clamp((log(max(x, eps)) - logMin) / logDen, 0.0, 1.0);
#else
    float denom = max(u_max - u_min, eps);
    vec3 norm = clamp((raw.rgb - u_min) / denom, 0.0, 1.0);
#endif
    outColor = vec4(norm, 1.0);
}
