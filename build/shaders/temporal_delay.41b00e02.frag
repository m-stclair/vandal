#version 300 es
precision mediump float;

uniform sampler2D u_image;

uniform sampler2D u_delayTex0;
uniform sampler2D u_delayTex1;
uniform sampler2D u_delayTex2;
uniform sampler2D u_delayTex3;
uniform sampler2D u_delayTex4;
uniform sampler2D u_delayTex5;
uniform sampler2D u_delayTex6;
uniform sampler2D u_delayTex7;
uniform sampler2D u_delayTex8;

uniform float u_delayWeight0;
uniform float u_delayWeight1;
uniform float u_delayWeight2;
uniform float u_delayWeight3;
uniform float u_delayWeight4;
uniform float u_delayWeight5;
uniform float u_delayWeight6;
uniform float u_delayWeight7;
uniform float u_delayWeight8;

uniform vec2 u_resolution;

uniform float u_blendamount;
uniform float u_feedback;

// 0 = visible output pass
// 1 = ring-buffer write pass
uniform int u_writeMode;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

vec4 sampleDelayKernel(vec2 uv) {

    if (u_delayWeight1 < 1e-6) {
        return texture(u_delayTex0, uv);
    }

    vec4 sum = vec4(0.0);

    sum += texture(u_delayTex0, uv) * u_delayWeight0;
    sum += texture(u_delayTex1, uv) * u_delayWeight1;
    sum += texture(u_delayTex2, uv) * u_delayWeight2;
    sum += texture(u_delayTex3, uv) * u_delayWeight3;
    sum += texture(u_delayTex4, uv) * u_delayWeight4;
    sum += texture(u_delayTex5, uv) * u_delayWeight5;
    sum += texture(u_delayTex6, uv) * u_delayWeight6;
    sum += texture(u_delayTex7, uv) * u_delayWeight7;
    sum += texture(u_delayTex8, uv) * u_delayWeight8;

    return sum;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    vec4 current = texture(u_image, uv);
    vec4 delayed = sampleDelayKernel(uv);

    if (u_writeMode == 1) {
        /*
         * Store into the delay line.
         *
         * feedback = 0:
         *   pure frame delay. exact current frame goes into the ring.
         *
         * feedback > 0:
         *   delayed frame bleeds into stored frame.
         *   this creates trails / echoes / temporal smearing.
         */
        outColor = mix(current, delayed, u_feedback);
        return;
    }

    vec3 blended = blendWithColorSpace(
        current.rgb,
        delayed.rgb,
        u_blendamount
    );

    outColor = vec4(blended, current.a);
}