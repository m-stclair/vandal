#version 300 es
precision mediump float;
precision highp int;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec2 u_tilecount;
uniform float u_offsetamount;
uniform float u_blendamount;
uniform float u_seed;
uniform float u_edgeSoftness;
uniform float u_tileWarp;

out vec4 outColor;

#include "noise.glsl"
#include "colorconvert.glsl"
#include "blend.glsl"

#define BOUNDARY_HARD 0
#define BOUNDARY_SOFT 1


float tileHash(vec2 id) {
    return fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
}

#if BOUNDARY_MODE == BOUNDARY_HARD
    vec2 desyncOffset(vec2 uv) {
        vec2 tileID = floor(uv * u_tilecount);
        float angle = tileHash(tileID + u_seed * 0.1) * 6.28318;
        vec2 dir = vec2(cos(angle), sin(angle));
        vec2 tileSize = 1.0 / u_tilecount;
        return uv + dir * tileSize * u_offsetamount;
    }
#elif BOUNDARY_MODE == BOUNDARY_SOFT
    #include "noise3D.glsl"

    vec2 desyncOffset(vec2 uv) {
        vec2 tiled = uv * u_tilecount;
        vec2 tileID = floor(tiled);
        vec2 local = fract(tiled);

        float angle = tileHash(tileID + u_seed * 0.1) * 6.28318;
        vec2 dir = vec2(cos(angle), sin(angle));

        vec2 tileSize = 1.0 / u_tilecount;

        vec2 edgeDist = min(local, 1.0 - local);
        float edgeMask = smoothstep(0.0, u_edgeSoftness, min(edgeDist.x, edgeDist.y));

        float n = snoise(vec3(local, tileHash(tileID + u_seed)));
        vec2 innerWarp = vec2(cos(n * 6.28318), sin(n * 6.28318)) * tileSize * u_tileWarp;

        return uv + (dir * tileSize * u_offsetamount + innerWarp) * edgeMask;
    }
#else
    #error invalid BOUNDARY_MODE
#endif

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 warpedUV = desyncOffset(uv);
    vec3 original = texture(u_image, uv).rgb;
    vec3 warped = texture(u_image, warpedUV).rgb;
    outColor = vec4(blendWithColorSpace(original, warped, u_blendamount), 1.0);
}