#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_width;         // band width
uniform vec2 u_phase;         // offset/shifting of pattern
uniform float u_softness;      // edge falloff for antialiasing (0 = hard)
uniform float u_blendamount;
uniform float u_spacingfactor;
uniform float u_skew;  // 0 = no skew, 1 = 45 deg, -1 = -45 deg
uniform float u_noisescale;
uniform float u_noiseamount;
uniform float u_lumamod;
uniform float u_lumathreshold;
uniform float u_luma_angle;
uniform float u_horizonroll;  // horizon mode roll, in turns; rotates which side of the screen is sky
uniform vec3 u_channelphase;
uniform vec3 u_color;
uniform vec3 u_backgroundColor;
uniform float u_backgroundOpacity;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#define DIRECTION_VERTICAL 0
#define DIRECTION_HORIZONTAL 1
#define DIRECTION_GRID 2
#ifndef DIRECTION
#define DIRECTION DIRECTION_VERTICAL
#endif

#define MODE_BINARY 0
#define MODE_SINE 1
#define MODE_TRI 2
#define MODE_SAW 3
#define MODE_HORIZON 4
#ifndef MODE
#define MODE MODE_BINARY
#endif

// TODO: use hash()
float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453);
}

vec2 jitteredUV(vec2 uv, float amount, float scale) {
    float n = rand(uv) - 0.5;
    float g = rand(uv + n);
    return uv + n * step(g, amount) * scale;
}

float binaryBand(float coord, float phase) {
    float spacing = u_width * u_spacingfactor;
    float local = mod(coord + phase, spacing);
    return step(spacing - u_width, local);
}

float waveFunction(float coord, float phase) {
    float spacing = u_width * u_spacingfactor;
    float local = mod(coord + phase, spacing);
    #if MODE == MODE_BINARY
    // Stripe is "on" when in the upper portion of spacing cycle
    return step(spacing - u_width, local);
    #elif MODE == MODE_SINE
    return 0.5 + 0.5 * sin(6.2831 * (coord + phase) / spacing);
    #elif MODE == MODE_TRI
    return abs(fract((coord + phase) / spacing) * 2.0 - 1.0);
    #elif MODE == MODE_SAW
    return fract((coord + phase) / spacing);
    #else
    return 1.0;
    #endif
}

float horizonLineMask(float coord, float phase) {
    // Horizon mode needs more breathing room than the flat modes. Using the
    // flat spacing directly makes the perspective region alias into a screen-door
    // mess unless Width/Spacing are pushed to extremes.
    float lineWidth = max(u_width, 1.0);
    float spacing = max(lineWidth * (u_spacingfactor * 3.0), lineWidth + 4.0);
    float local = abs(fract((coord + phase) / spacing) - 0.5) * spacing;
    float aa = clamp(fwidth(coord), 0.75, lineWidth * 0.65);
    return 1.0 - smoothstep(lineWidth * 0.5 - aa, lineWidth * 0.5 + aa, local);
}

vec2 rotateDepthAxis(vec2 p, float turns) {
    float a = turns * 6.28318530718;
    float s = sin(a);
    float c = cos(a);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

vec2 horizonSpace(vec2 uv) {
    vec2 pixelCoord = uv * u_resolution;
    vec2 centered = pixelCoord - 0.5 * u_resolution;
    return rotateDepthAxis(centered, u_horizonroll);
}

float horizonOffset() {
    return clamp(u_phase.y, -0.48 * u_resolution.y, 0.48 * u_resolution.y);
}

float horizonPlaneMask(vec2 uv) {
    vec2 p = horizonSpace(uv);

    return step(0.0, p.y - horizonOffset());
}

float horizonPattern(vec2 uv, float phase) {
    vec2 p = horizonSpace(uv);
    float floorDistance = p.y - horizonOffset();

    if (floorDistance <= 0.0) {
        return 0.0;
    }

    float focalLength = 0.72 * u_resolution.y;

    float perspectiveBias = max(80.0, 0.18 * u_resolution.y + u_width * 2.0);
    float perspectiveScale = focalLength / (floorDistance + perspectiveBias);

    float perspectiveX = (p.x - u_phase.x + u_skew * floorDistance) * perspectiveScale;
    float perspectiveY = (focalLength * focalLength) / (floorDistance + perspectiveBias);

#if DIRECTION == DIRECTION_HORIZONTAL
    float line = horizonLineMask(perspectiveY, u_phase.y + phase);
    return 1.0 - line;
#elif DIRECTION == DIRECTION_VERTICAL
    float line = horizonLineMask(perspectiveX, u_phase.x + phase);
    return 1.0 - line;
#elif DIRECTION == DIRECTION_GRID
    float gx = horizonLineMask(perspectiveX, u_phase.x + phase);
    float gy = horizonLineMask(perspectiveY, u_phase.y + phase);
    return 1.0 - max(gx, gy);
#else
    float line = horizonLineMask(perspectiveY, phase);
    return 1.0 - line;
#endif
}

float gridPattern(vec2 uv, float phase) {
    vec2 pixelCoord = uv * u_resolution;
#if MODE == MODE_HORIZON
    return horizonPattern(uv, phase);
#elif DIRECTION == DIRECTION_HORIZONTAL
    return waveFunction(pixelCoord.y + u_skew * pixelCoord.x, phase);
#elif DIRECTION == DIRECTION_VERTICAL
    return waveFunction(pixelCoord.x + u_skew * pixelCoord.y, phase);
#elif DIRECTION == DIRECTION_GRID
    float gx = waveFunction(pixelCoord.x + u_skew * pixelCoord.y, u_phase.x + phase);
    float gy = waveFunction(pixelCoord.y + u_skew * pixelCoord.x, u_phase.y + phase);
    return gx * gy;
#else
    return waveFunction(pixelCoord.y, phase);
#endif
}


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
#if ADD_NOISE == 1
    vec2 grid_uv = jitteredUV(uv, u_noiseamount, u_noisescale);
#else
    vec2 grid_uv = uv;
#endif
    vec4 pix = texture(u_image, uv);
    vec3 srgb = pix.rgb;
    vec3 pattern = vec3(
        gridPattern(grid_uv, u_channelphase.x),
        gridPattern(grid_uv, u_channelphase.y),
        gridPattern(grid_uv, u_channelphase.z)
    );


#if INVERT == 1
    pattern = 1.0 - pattern;
#endif
#if MOD_LUMA == 1
    float lum = luminance(srgb2linear(srgb));
    float flip = clamp(-u_lumamod, 0.0, 1.0);
    vec3 modulated = mix(pattern, 1.0 - pattern, flip);
    float amp = mix(1.0, lum, abs(u_lumamod));
    float mask = 1.0 - smoothstep(u_lumathreshold, u_lumathreshold + u_luma_angle, lum);
    pattern = modulated * amp * mask;
#endif
    vec3 coverage = clamp(pattern, 0.0, 1.0);
#if MODE == MODE_HORIZON
    coverage *= horizonPlaneMask(uv);
#endif
    vec3 background = mix(srgb, u_backgroundColor, u_backgroundOpacity);
    vec3 result = mix(background, u_color, coverage);

    vec3 blended = blendWithColorSpace(
        srgb,
        result,
        u_blendamount
    );
    outColor = vec4(blended, pix.a);
}