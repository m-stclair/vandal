#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec2 u_texelSize;

uniform float u_warpStrength;
uniform float u_edgeGain;
uniform float u_edgeLow;
uniform float u_edgeHigh;
uniform float u_flowGamma;
uniform float u_twistAmount;
uniform float u_directionPolarity;
uniform float u_chromaGateAmount;

out vec4 outColor;

#include "colorconvert.glsl"

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;

mat2 rotate2d(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

float channelAt(vec2 uv) {
    vec3 color = texture(u_image, fract(uv)).rgb;
#if SCALAR_CHANNEL == 0
    return luminance(srgb2linear(color));
#elif SCALAR_CHANNEL == 1
    return color.r;
#elif SCALAR_CHANNEL == 2
    return color.g;
#elif SCALAR_CHANNEL == 3
    return color.b;
#elif SCALAR_CHANNEL == 4
    return srgb2NormLCH(color).z;
#elif SCALAR_CHANNEL == 5
    return srgb2NormLCH(color).y;
#elif SCALAR_CHANNEL == 6
    return 0.5;
#else
    #error invalid scalar channel
#endif
}

float softBand(float x, float a, float b, float fuzz) {
    float low = smoothstep(a - fuzz, a + fuzz, x);
    float high = 1.0 - smoothstep(b - fuzz, b + fuzz, x);
    return low * high;
}

vec2 sobelGradient(vec2 uv) {
    vec2 t = u_texelSize;

    float tl = channelAt(uv + vec2(-t.x,  t.y));
    float tc = channelAt(uv + vec2( 0.0,  t.y));
    float tr = channelAt(uv + vec2( t.x,  t.y));

    float ml = channelAt(uv + vec2(-t.x,  0.0));
    float mr = channelAt(uv + vec2( t.x,  0.0));

    float bl = channelAt(uv + vec2(-t.x, -t.y));
    float bc = channelAt(uv + vec2( 0.0, -t.y));
    float br = channelAt(uv + vec2( t.x, -t.y));

    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
    return vec2(gx, gy);
}

vec2 computeOffset(vec2 uv) {
    float center = channelAt(uv);
    vec2 grad = sobelGradient(uv);
    float rawEdge = length(grad);
    float edge = clamp(rawEdge * u_edgeGain, 0.0, 1.0);

    const float CUTOFF_SMOOTHNESS = 0.02;
#if SCALAR_CHANNEL != 6
    float mask = softBand(edge, u_edgeLow, u_edgeHigh, CUTOFF_SMOOTHNESS);
#else
    float mask = 1.0;
#endif

    float magnitude = pow(max(edge * mask, 0.0), u_flowGamma) * u_warpStrength;

#if USE_CHROMA_GATE == 1
    vec3 color = texture(u_image, uv).rgb;
    float chroma = srgb2NormLCH(color).y;
    magnitude = mix(magnitude, magnitude * chroma, u_chromaGateAmount);
#endif

    vec2 normal = grad / max(rawEdge, 0.0001);
    vec2 tangent = vec2(-normal.y, normal.x);

#if FLOW_MODE == 0
    vec2 direction = tangent;
#elif FLOW_MODE == 1
    vec2 direction = normal;
#elif FLOW_MODE == 2
    float braid = 0.5 + 0.5 * sin(center * TAU + edge * PI + u_twistAmount);
    vec2 braided = mix(tangent, normal, braid);
    vec2 direction = braided * inversesqrt(max(dot(braided, braided), 1e-8));
#else
    #error invalid flow mode
#endif

    direction = rotate2d((center - 0.5) * u_twistAmount) * direction;
    direction *= 1.0 - 2.0 * u_directionPolarity;

    return direction * magnitude;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    outColor = vec4(computeOffset(uv), 0.0, 0.0);
}
