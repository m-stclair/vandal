#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

out vec4 outColor;

#define RISOGRAPH_DUOTONE 0
#define RISOGRAPH_TRITONE 1

#ifndef RISOGRAPH_MODE
#define RISOGRAPH_MODE 0
#endif

float lumaFromRgbFast(vec3 rgb) {
    rgb = clamp(rgb, 0.0, 1.0);
    return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 c = texture(u_image, uv).rgb;

    float luma = lumaFromRgbFast(c);
    float chroma = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);

    float ink1 = 0.0;
    float ink2 = 0.0;
    float ink3 = 0.0;

#if RISOGRAPH_MODE == RISOGRAPH_TRITONE
    // Shadow plate, with a little cool-channel appetite.
    ink1 = (1.0 - smoothstep(0.18, 0.92, luma)) * 1.10 + max(c.b - c.r, 0.0) * 0.28;

    // Middle plate, the loud one.
    ink2 = (1.0 - abs(luma - 0.55) * 1.75) * 0.88 + chroma * 0.22 + c.r * 0.12;

    // Highlight/tint plate for cheap-paper overprint glow.
    ink3 = smoothstep(0.30, 0.96, luma) * 0.62 + max(c.g - c.b, 0.0) * 0.25;
#else
    // Dark structural plate.
    ink1 = (1.0 - smoothstep(0.16, 0.95, luma)) * 1.12 + max(c.b - c.r, 0.0) * 0.20;

    // Accent plate, lives in mids and color, not shadows.
    float mids = 1.0 - smoothstep(0.62, 0.98, abs(luma - 0.52) * 1.7);
    ink2 = mids * 0.78 + chroma * 0.36 + c.r * 0.10;
#endif

    outColor = vec4(clamp(vec3(ink1, ink2, ink3), 0.0, 1.0), 1.0);
}
