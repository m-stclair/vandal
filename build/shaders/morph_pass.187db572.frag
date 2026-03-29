#version 300 es

precision mediump float;

uniform sampler2D u_input;
uniform vec2 u_resolution;
uniform int u_radius;

out vec4 outColor;

float getGray(vec2 uv) {
#if REDUCE_TO_GRAYSCALE == 1
    return dot(texture(u_input, uv).rgb, vec3(0.299, 0.587, 0.114));
#else
    return texture(u_input, uv).r;
#endif
}

#define OPERATOR_EROSION 0
#define OPERATOR_DILATION 1

void main() {
    vec2 texelSize = 1.0 / u_resolution;
    vec2 uv = gl_FragCoord.xy / u_resolution;

#if OPERATOR == OPERATOR_EROSION
    float result = 1.0;

    for (int y = -u_radius; y <= u_radius; y++) {
        for (int x = -u_radius; x <= u_radius; x++) {
            float dist = length(vec2(float(x), float(y)));
            if (dist > float(u_radius) + 0.5) continue;

            vec2 offset = vec2(float(x), float(y)) * texelSize;
            float val = getGray(uv + offset);
            result = min(result, val);
        }
    }
#elif OPERATOR == OPERATOR_DILATION
    float result = 0.0;

    for (int y = -u_radius; y <= u_radius; y++) {
        for (int x = -u_radius; x <= u_radius; x++) {
            float dist = length(vec2(float(x), float(y)));
            if (dist > float(u_radius) + 0.5) continue;

            vec2 offset = vec2(float(x), float(y)) * texelSize;
            float val = getGray(uv + offset);
            result = max(result, val);
        }
    }
#endif
    outColor = vec4(result, result, result, 1.0);
}
